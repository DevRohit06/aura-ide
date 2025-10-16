import { env } from '$env/dynamic/private';
import { agentGraph } from '$lib/agent/graph';
import { modelManager } from '$lib/agent/model-manager';
import { DatabaseService } from '$lib/services/database.service';
import { sandboxManager } from '$lib/services/sandbox/sandbox-manager';
import { logger } from '$lib/utils/logger.js';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { Command } from '@langchain/langgraph';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// ===== Types =====
interface ChatMessageDoc {
	id: string;
	threadId: string;
	projectId?: string;
	userId: string;
	content: string;
	contentMarkdown: string;
	role: 'user' | 'assistant' | 'system';
	timestamp: Date;
	fileContext?: { filePath: string };
	metadata?: Record<string, any>;
	createdAt: Date;
	updatedAt: Date;
}

interface ModelConfig {
	provider: string;
	model: string;
}

interface EditResult {
	filePath: string;
	success: boolean;
	previousContent?: string;
	error?: string;
}

// ===== Constants =====
const SANDBOX_TRIGGER_KEYWORDS = [
	'create',
	'write',
	'edit',
	'file',
	'code',
	'run',
	'execute'
] as const;

const ALLOWED_ACTIONS = new Set(['approve', 'reject', 'modify']);
const DEFAULT_CONTEXT_WINDOW = 20;
const MAX_TERMINAL_OUTPUT_LINES = 10;

// ===== Utility Functions =====

/**
 * Creates a new chat thread with default settings
 */
async function createNewThread(userId: string, projectId?: string): Promise<string> {
	const newThread = {
		id: crypto.randomUUID(),
		projectId: projectId || undefined,
		userId,
		title: 'New Chat',
		isArchived: false,
		isPinned: false,
		tags: [],
		participants: [
			{
				userId,
				role: 'owner' as const,
				joinedAt: new Date(),
				permissions: {
					canWrite: true,
					canDelete: true,
					canManageParticipants: true,
					canEditSettings: true
				}
			}
		],
		settings: {
			isPublic: false,
			allowGuestMessages: false,
			enableMarkdownRendering: true,
			contextWindowSize: DEFAULT_CONTEXT_WINDOW
		},
		statistics: {
			messageCount: 0,
			participantCount: 1,
			totalTokensUsed: 0,
			totalCost: 0,
			averageResponseTime: 0
		},
		createdAt: new Date(),
		updatedAt: new Date()
	};

	await DatabaseService.createChatThread(newThread);
	return newThread.id;
}

/**
 * Determines the appropriate model configuration
 */
function resolveModelConfig(modelName?: string, modelConfig?: any): ModelConfig {
	// 1. Try preset by name
	if (modelName) {
		const preset = modelManager.getModelPreset(modelName);
		if (preset) return preset;
	}

	// 2. Use provided config
	if (modelConfig) return modelConfig;

	// 3. Infer from model name
	if (modelName) {
		if (modelName.includes('claude') || modelName.includes('anthropic')) {
			return env.ANTHROPIC_API_KEY
				? { provider: 'anthropic', model: modelName }
				: { provider: 'openai', model: 'gpt-4o-mini' };
		}
		if (modelName.includes('gpt') || modelName.includes('openai')) {
			return { provider: 'openai', model: modelName };
		}
		if (modelName.includes('groq')) {
			return { provider: 'groq', model: modelName };
		}
		// Default to OpenAI for unknown models
		return { provider: 'openai', model: modelName };
	}

	// 4. Fallback to default
	return {
		provider: 'openai',
		model: env.OPENAI_API_KEY ? 'gpt-4o-mini' : 'gpt-4o'
	};
}

/**
 * Converts MongoDB messages to LangChain format
 */
function convertToLangChainMessages(messages: any[]): (HumanMessage | AIMessage)[] {
	return messages.map((msg) => {
		const content = String(msg.content || '');
		return msg.role === 'assistant' ? new AIMessage(content) : new HumanMessage(content);
	});
}

/**
 * Creates a message document for MongoDB
 */
function createMessageDoc(
	threadId: string,
	userId: string,
	content: string,
	role: 'user' | 'assistant',
	options: {
		projectId?: string;
		currentFile?: string;
		metadata?: Record<string, any>;
	} = {}
): ChatMessageDoc {
	return {
		id: crypto.randomUUID(),
		threadId,
		projectId: options.projectId,
		userId,
		content: String(content),
		contentMarkdown: String(content),
		role,
		timestamp: new Date(),
		fileContext: options.currentFile ? { filePath: options.currentFile } : undefined,
		metadata: options.metadata,
		createdAt: new Date(),
		updatedAt: new Date()
	};
}

/**
 * Checks if message requires sandbox environment
 */
function requiresSandbox(message: string): boolean {
	const lowerMessage = message.toLowerCase();
	return SANDBOX_TRIGGER_KEYWORDS.some((keyword) => lowerMessage.includes(keyword));
}

/**
 * Extracts readable text content from LangChain message content
 */
function extractMessageContent(content: any): string {
	if (typeof content === 'string') {
		return content;
	}

	if (Array.isArray(content)) {
		// Handle array of content blocks (common in newer LangChain versions)
		return content
			.map((block) => {
				if (typeof block === 'string') return block;
				if (block && typeof block === 'object' && block.type === 'text') {
					return block.text || '';
				}
				if (block && typeof block === 'object' && block.content) {
					return String(block.content);
				}
				return String(block);
			})
			.filter(Boolean)
			.join('\n');
	}

	if (content && typeof content === 'object') {
		// Try to extract text from common object structures
		if (content.text) return String(content.text);
		if (content.content) return String(content.content);
		if (content.message) return String(content.message);

		// Handle tool results specifically
		if (content.toolResults && Array.isArray(content.toolResults)) {
			return formatToolResults(content.toolResults);
		}

		// If it's a tool call result, format it properly
		if (content.success !== undefined && content.message) {
			return formatSingleToolResult(content);
		}

		// Fallback: try to create a readable representation
		try {
			const str = JSON.stringify(content, null, 2);
			if (str.length > 500) {
				// For large objects, provide a summary
				return `Response data (${Object.keys(content).length} properties): ${Object.keys(content).slice(0, 3).join(', ')}${Object.keys(content).length > 3 ? '...' : ''}`;
			}
			return str;
		} catch {
			return 'Complex response object';
		}
	}

	return String(content);
}

/**
 * Format tool results for display
 */
function formatToolResults(results: any[]): string {
	return results
		.map((result, index) => {
			const prefix = results.length > 1 ? `Tool ${index + 1}: ` : '';
			return prefix + formatSingleToolResult(result);
		})
		.join('\n\n');
}

/**
 * Format a single tool result for display
 */
function formatSingleToolResult(result: any): string {
	if (!result) return 'No result';

	let output = '';

	if (result.success === false) {
		output = `❌ ${result.message || 'Operation failed'}`;
		if (result.error) {
			output += `\nError: ${result.error}`;
		}
	} else if (result.success === true) {
		output = `✅ ${result.message || 'Operation completed'}`;
	} else if (result.message) {
		output = result.message;
	} else {
		output = 'Operation completed';
	}

	// Add relevant data if present
	if (result.data) {
		if (typeof result.data === 'string') {
			if (result.data.length > 200) {
				output += `\n\nData: ${result.data.slice(0, 200)}...`;
			} else {
				output += `\n\nData: ${result.data}`;
			}
		} else if (result.data.filePath || result.data.content !== undefined) {
			// File operation result
			if (result.data.filePath) {
				output += `\nFile: ${result.data.filePath}`;
			}
			if (result.data.size !== undefined) {
				output += `\nSize: ${result.data.size} bytes`;
			}
		} else if (typeof result.data === 'object') {
			try {
				const dataStr = JSON.stringify(result.data, null, 2);
				if (dataStr.length > 200) {
					output += `\n\nData: ${dataStr.slice(0, 200)}...`;
				} else {
					output += `\n\nData: ${dataStr}`;
				}
			} catch {
				output += '\n\nData: [Complex object]';
			}
		}
	}

	return output;
}

/**
 * Extract tool calls metadata from messages for database storage
 */
function extractToolCallsMetadata(messages: any[]): Record<string, any> {
	const lastMessage = messages?.[messages.length - 1];
	if (!lastMessage) return {};

	const toolCalls = (lastMessage as any)?.tool_calls;
	if (!toolCalls || !Array.isArray(toolCalls) || toolCalls.length === 0) {
		return {};
	}

	// Extract and sanitize tool calls for metadata
	// Anthropic uses "input", OpenAI uses "arguments", LangChain normalizes to "args"
	const sanitizedToolCalls = toolCalls.map((tc: any) => ({
		name: tc?.name || tc?.function?.name || '',
		arguments: tc?.args || tc?.input || tc?.arguments || tc?.function?.arguments || {},
		id: tc?.id || '',
		type: tc?.type || 'function'
	}));

	return {
		toolCalls: sanitizedToolCalls,
		hasToolCalls: true,
		toolCallCount: sanitizedToolCalls.length
	};
}

/**
 * Extract tool execution results from message history
 */
function extractToolResults(messages: any[]): any[] {
	const toolResults: any[] = [];

	// Look for tool messages (responses from tool executions)
	for (const message of messages) {
		if (message?.tool_call_id && message?.content) {
			toolResults.push({
				tool_call_id: message.tool_call_id,
				content: message.content,
				success: !message.content?.includes?.('error') && !message.content?.includes?.('failed'),
				message:
					typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
			});
		} else if (message?.name && message?.content && message?.type === 'tool') {
			// Alternative tool message format
			toolResults.push({
				tool_name: message.name,
				content: message.content,
				success: !message.content?.includes?.('error') && !message.content?.includes?.('failed'),
				message:
					typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
			});
		}
	}

	return toolResults;
}

/**
 * Handles missing sandbox scenario
 */
async function handleMissingSandbox(
	threadId: string,
	userId: string,
	message: string,
	projectId?: string,
	currentFile?: string
): Promise<Response> {
	// Save user message
	const userMessageDoc = createMessageDoc(threadId, userId, message, 'user', {
		projectId,
		currentFile
	});
	await DatabaseService.createChatMessage(userMessageDoc);

	// Create helpful response
	const sandboxMessage = `I don't have access to a sandbox environment yet. To help you with this request, I need:

1. **Sandbox ID**: The ID of the sandbox where your project is located
2. **Specific Requirements**: Any details about what you'd like to accomplish

Without a sandbox environment, I cannot access or modify files. Could you please provide these details?`;

	const assistantMessageDoc = createMessageDoc(threadId, userId, sandboxMessage, 'assistant', {
		projectId,
		metadata: { errorDetails: 'No sandbox environment available' }
	});
	await DatabaseService.createChatMessage(assistantMessageDoc);

	return json({
		success: true,
		response: sandboxMessage,
		threadId,
		metadata: { requiresSandbox: true }
	});
}

/**
 * Normalizes tool calls to array format and sanitizes for serialization
 */
function sanitizeToolCalls(toolCalls: any): any[] {
	// Handle undefined/null
	if (!toolCalls) return [];

	// If already an array, sanitize it
	if (Array.isArray(toolCalls)) {
		return toolCalls.map((tc) => {
			if (!tc) return {};
			// Anthropic uses "input", OpenAI uses "arguments", LangChain normalizes to "args"
			return {
				name: tc.name || '',
				args: tc.args || tc.input || tc.arguments || {},
				id: tc.id || '',
				type: tc.type || 'tool_call'
			};
		});
	}

	// If it's an object, try to extract array from common properties
	if (typeof toolCalls === 'object') {
		// Check if it has array-like properties
		if (toolCalls.toolCalls && Array.isArray(toolCalls.toolCalls)) {
			return sanitizeToolCalls(toolCalls.toolCalls);
		}
		if (toolCalls.calls && Array.isArray(toolCalls.calls)) {
			return sanitizeToolCalls(toolCalls.calls);
		}
		// If it's a single tool call object, wrap it in array
		if (toolCalls.name || toolCalls.function) {
			return [
				{
					name: toolCalls.name || toolCalls.function?.name || '',
					// Anthropic uses "input", OpenAI uses "arguments", LangChain normalizes to "args"
					args:
						toolCalls.args ||
						toolCalls.input ||
						toolCalls.arguments ||
						toolCalls.function?.arguments ||
						{},
					id: toolCalls.id || '',
					type: toolCalls.type || 'tool_call'
				}
			];
		}
	}

	// Fallback: return empty array
	logger.warn('Unable to normalize toolCalls, returning empty array:', typeof toolCalls);
	return [];
}

/**
 * Applies file edits to sandbox
 */
async function applyEdits(
	sandboxId: string,
	edits: Array<{ filePath: string; content: string }>,
	context?: { userId?: string; projectId?: string }
): Promise<EditResult[]> {
	const results: EditResult[] = [];

	for (const edit of edits) {
		try {
			const rawPrev = (await sandboxManager.readFile(sandboxId, edit.filePath))?.content ?? null;
			const previousContent = rawPrev && typeof rawPrev !== 'string' ? String(rawPrev) : rawPrev;

			const success = await sandboxManager.writeFile(sandboxId, edit.filePath, edit.content, {
				createDirs: true,
				userId: context?.userId,
				projectId: context?.projectId
			});

			results.push({
				filePath: edit.filePath,
				success: !!success,
				previousContent: previousContent ?? undefined
			});
		} catch (err: any) {
			results.push({
				filePath: edit.filePath,
				success: false,
				error: err?.message ?? String(err)
			});
		}
	}

	return results;
}

// ===== Request Handlers =====

export const POST: RequestHandler = async ({ request, locals }) => {
	// Read body once at the start
	const body = await request.json();
	const {
		message,
		threadId,
		projectId,
		currentFile,
		sandboxId,
		sandboxType,
		useMorph,
		modelName,
		modelConfig
	} = body;

	const userId = locals?.user?.id || 'default';

	try {
		// Ensure we have a thread
		const actualThreadId = threadId || (await createNewThread(userId, projectId));

		// Check for missing sandbox if required
		if (requiresSandbox(message) && !sandboxId) {
			return handleMissingSandbox(actualThreadId, userId, message, projectId, currentFile);
		}

		// Resolve model configuration
		const finalModelConfig = resolveModelConfig(modelName, modelConfig);

		// Load conversation history
		const previousMessages = await DatabaseService.findChatMessagesByThreadId(
			actualThreadId,
			DEFAULT_CONTEXT_WINDOW
		);
		const historyMessages = convertToLangChainMessages(previousMessages);

		// Add new user message
		const userMessage = new HumanMessage(String(message || ''));
		const allMessages = [...historyMessages, userMessage];

		// Save user message
		const userMessageDoc = createMessageDoc(actualThreadId, userId, message, 'user', {
			projectId,
			currentFile
		});
		await DatabaseService.createChatMessage(userMessageDoc);

		// Prepare initial state
		const initialState = {
			messages: allMessages,
			currentFile: currentFile || null,
			sandboxId: sandboxId || null,
			sandboxType: sandboxType || null,
			userId: userId || null,
			projectId: projectId || null,
			useMorph: !!useMorph,
			codeContext: [],
			terminalOutput: [],
			awaitingHumanInput: false,
			modelConfig: finalModelConfig
		};

		// Invoke agent with userId and projectId in config for tool execution context
		const config = {
			configurable: {
				thread_id: actualThreadId,
				userId: userId,
				projectId: projectId
			}
		};
		const result = await agentGraph.invoke(initialState, config);

		// Check if the graph was interrupted for human review
		// __interrupt__ is added by LangGraph when interrupt() is called
		if ((result as any).__interrupt__) {
			const interruptData = (result as any).__interrupt__[0];
			logger.info('Graph interrupted for human review:', interruptData);

			return json({
				interrupt: true,
				data: interruptData.value,
				threadId: actualThreadId
			});
		}

		const lastMessage = result.messages?.[result.messages?.length - 1];
		const assistantContent = extractMessageContent(lastMessage?.content ?? 'No response');

		// Check for tool execution results in the message history
		const toolResults = extractToolResults(result.messages || []);
		const toolResultsSummary =
			toolResults.length > 0
				? `\n\n**Tool Execution Results:**\n${formatToolResults(toolResults)}`
				: '';

		// Combine assistant response with tool results
		const fullContent = assistantContent + toolResultsSummary;

		// Extract tool calls and results for metadata
		const toolCallsMetadata = extractToolCallsMetadata(result.messages);

		// Save assistant response
		const assistantMessageDoc = createMessageDoc(actualThreadId, userId, fullContent, 'assistant', {
			projectId,
			metadata: {
				model: `${result.modelConfig?.provider}/${result.modelConfig?.model}`,
				provider: result.modelConfig?.provider,
				...toolCallsMetadata,
				toolResults: toolResults.length > 0 ? toolResults : undefined
			}
		});
		await DatabaseService.createChatMessage(assistantMessageDoc);

		// Update thread title if first exchange
		if (previousMessages.length === 0) {
			const title = String(message).slice(0, 50) + (String(message).length > 50 ? '...' : '');
			await DatabaseService.updateChatThread(actualThreadId, { title });
		}

		return json({
			success: true,
			response: fullContent,
			threadId: actualThreadId,
			metadata: {
				awaitingHumanInput: result.awaitingHumanInput,
				currentFile: result.currentFile,
				sandboxId: result.sandboxId,
				sandboxType: result.sandboxType,
				modelConfig: result.modelConfig,
				modelUsageHistory: result.modelUsageHistory,
				terminalOutput: result.terminalOutput?.slice(-MAX_TERMINAL_OUTPUT_LINES) || [],
				hasCodeContext: result.codeContext?.length > 0,
				toolCallsExecuted: toolResults.length
			}
		});
	} catch (err: any) {
		logger.error('Agent invocation error', err?.message ?? err);
		logger.error('Error name:', err?.name);
		logger.error('Error stack:', err?.stack);

		// Use threadId from body (already parsed at start)
		const actualThreadId = threadId || 'unknown';

		// Save error message (userId, projectId already available from body)
		const errorMessageDoc = createMessageDoc(
			actualThreadId,
			userId,
			`Error: ${err?.message ?? String(err)}`,
			'assistant',
			{
				projectId,
				metadata: { errorDetails: err?.message ?? String(err) }
			}
		);

		try {
			await DatabaseService.createChatMessage(errorMessageDoc);
		} catch (dbErr: any) {
			logger.error('Failed to save error message to DB', dbErr);
		}

		return json(
			{ success: false, error: err?.message ?? String(err), threadId: actualThreadId },
			{ status: 500 }
		);
	}
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	// Read body once at the start
	const body = await request.json();
	const { threadId, action, edits, interrupt, newModelName, projectId, streamResponse } = body;

	const userId = locals?.user?.id || 'default';

	try {
		// Validation
		if (!threadId) {
			return json({ success: false, error: 'threadId is required' }, { status: 400 });
		}

		if (!ALLOWED_ACTIONS.has(action)) {
			return json(
				{
					success: false,
					error: `Invalid action. Must be one of: ${[...ALLOWED_ACTIONS].join(', ')}`
				},
				{ status: 400 }
			);
		}
		const config = {
			configurable: {
				thread_id: threadId,
				userId: userId,
				projectId: projectId
			}
		};

		// Extract tool calls and state
		const toolCalls = sanitizeToolCalls(interrupt?.toolCalls || interrupt?.data?.toolCalls || []);
		const stateSnapshot = interrupt?.stateSnapshot || interrupt?.data?.stateSnapshot || null;
		const sandboxId = stateSnapshot?.sandboxId || edits?.[0]?.sandboxId || null;

		// Apply edits if approved or modified
		let appliedEdits: EditResult[] = [];

		if (action === 'approve' || action === 'modify') {
			const writeCalls = toolCalls.filter((tc) => ['write_file', 'edit_file'].includes(tc.name));

			if (writeCalls.length > 0 && !sandboxId) {
				return json(
					{ success: false, error: 'sandboxId not available to apply edits' },
					{ status: 400 }
				);
			}

			let editsToApply: Array<{ filePath: string; content: string }> = [];

			if (action === 'approve') {
				editsToApply = writeCalls.map((tc) => ({
					filePath: tc.args?.filePath || tc.args?.path || '',
					content: tc.args?.content || ''
				}));
			} else if (action === 'modify') {
				if (!Array.isArray(edits)) {
					return json(
						{ success: false, error: 'edits array required for modify action' },
						{ status: 400 }
					);
				}
				editsToApply = edits;
			}

			if (editsToApply.length > 0) {
				appliedEdits = await applyEdits(sandboxId, editsToApply, { userId, projectId });
			}
		}

		// Prepare human decision to resume the graph
		const humanDecision = {
			action,
			edits: action === 'modify' ? edits : undefined
		};

		// Resume agent with Command
		const result = await agentGraph.invoke(new Command({ resume: humanDecision }), config);

		// Check if there's another interrupt
		if ((result as any).__interrupt__) {
			const interruptData = (result as any).__interrupt__[0];
			logger.info('Another interrupt detected after approval, returning interrupt info');

			return json({
				success: true,
				applied: appliedEdits,
				interrupt: {
					toolCalls: interruptData.value?.toolCalls || [],
					stateSnapshot: interruptData.value?.stateSnapshot || {},
					reason: interruptData.value?.reason || 'Human approval required'
				},
				metadata: {
					awaitingHumanInput: true,
					currentFile: result.currentFile,
					sandboxId: result.sandboxId,
					sandboxType: result.sandboxType
				}
			});
		}

		const lastMessage = result.messages?.[result.messages?.length - 1];
		const resumeContent = extractMessageContent(lastMessage?.content ?? 'Action completed');

		// Extract tool results from message history
		let toolResults = extractToolResults(result.messages || []);

		// If we have applied edits but no tool results from messages, create them from applied edits
		if (appliedEdits.length > 0 && toolResults.length === 0) {
			toolResults = appliedEdits.map((edit) => ({
				tool_name: 'write_file',
				content: edit.success
					? `✅ Successfully wrote ${edit.filePath}`
					: `❌ Failed to write ${edit.filePath}: ${edit.error || 'Unknown error'}`,
				success: edit.success,
				message: edit.success
					? `Successfully wrote ${edit.filePath}`
					: `Failed to write ${edit.filePath}: ${edit.error || 'Unknown error'}`
			}));
			logger.info(`[PUT /api/agent] Created ${toolResults.length} tool results from applied edits`);
		}

		const toolResultsSummary =
			toolResults.length > 0
				? `\n\n**Tool Execution Results:**\n${formatToolResults(toolResults)}`
				: '';

		// Combine assistant response with tool results
		const fullContent = resumeContent + toolResultsSummary;

		// Extract tool calls metadata for resume response
		const toolCallsMetadata = extractToolCallsMetadata(result.messages);

		// Save response with tool results
		const resumeMessageDoc = createMessageDoc(threadId, userId, fullContent, 'assistant', {
			projectId,
			metadata: {
				model: `${result.modelConfig?.provider}/${result.modelConfig?.model}`,
				provider: result.modelConfig?.provider,
				interruptAction: action,
				appliedEdits: appliedEdits.length,
				...toolCallsMetadata,
				toolResults: toolResults.length > 0 ? toolResults : undefined
			}
		});
		await DatabaseService.createChatMessage(resumeMessageDoc);

		return json({
			success: true,
			applied: appliedEdits,
			response: fullContent,
			toolResults: toolResults.length > 0 ? toolResults : undefined,
			metadata: {
				awaitingHumanInput: result.awaitingHumanInput,
				currentFile: result.currentFile,
				sandboxId: result.sandboxId,
				sandboxType: result.sandboxType,
				modelConfig: result.modelConfig,
				modelUsageHistory: result.modelUsageHistory,
				terminalOutput: result.terminalOutput?.slice(-MAX_TERMINAL_OUTPUT_LINES) || [],
				hasCodeContext: result.codeContext?.length > 0
			}
		});
	} catch (err: any) {
		logger.error('Agent resume error', err?.message ?? err);

		// Use threadId from body (already parsed at start)
		const actualThreadId = threadId || 'unknown';

		// Save error (userId, projectId, action already available from body)
		const errorMessageDoc = createMessageDoc(
			actualThreadId,
			userId,
			`Error during interrupt handling: ${err?.message ?? String(err)}`,
			'assistant',
			{
				projectId,
				metadata: {
					errorDetails: err?.message ?? String(err),
					interruptAction: action
				}
			}
		);

		try {
			await DatabaseService.createChatMessage(errorMessageDoc);
		} catch (dbErr: any) {
			logger.error('Failed to save error message to DB', dbErr);
		}

		return json(
			{ success: false, error: err?.message ?? String(err), threadId: actualThreadId },
			{ status: 500 }
		);
	}
};
