import { DatabaseService } from '$lib/services/database.service.js';
import { LLMService } from '$lib/services/llm/llm.service.js';
import { r2StorageService } from '$lib/services/r2-storage.service.js';
import { toolManager } from '$lib/services/tool-manager.service.js';
import { webSocketService } from '$lib/services/websocket.service.js';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Enhanced type definitions for better type safety
interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

interface ToolCall {
	id: string;
	function: {
		name: string;
		arguments: string;
	};
}

interface ToolResult {
	tool_call_id: string;
	content: string;
}

interface ChatCompletionRequest {
	threadId: string;
	content: string;
	model?: string;
	fileContext?: {
		fileName?: string;
		filePath?: string;
		language?: string;
	};
	contextVariables?: {
		selectedCode?: string;
		framework?: string;
	};
	enableTools?: boolean;
	projectId?: string;
}

interface ExecutionContext {
	projectId?: string;
	userId: string;
}

/**
 * Formats tools for chat completion API
 * @returns Array of formatted tool definitions
 */
function getToolsForChatCompletion() {
	return toolManager.getTools().map((tool) => ({
		type: 'function' as const,
		function: {
			name: tool.name,
			description: tool.description,
			parameters: tool.parameters
		}
	}));
}

/**
 * Safely parses JSON arguments with fallback handling
 * @param argumentsString - JSON string to parse
 * @returns Parsed arguments object
 */
function parseToolArguments(argumentsString: string): Record<string, unknown> {
	try {
		return JSON.parse(argumentsString);
	} catch {
		// If not valid JSON, treat as string content
		return { content: argumentsString };
	}
}

/**
 * Enhanced file operations that work directly with R2 storage
 */
async function createFileInR2(
	projectId: string,
	filePath: string,
	content: string,
	metadata?: Record<string, any>
): Promise<{ success: boolean; message: string; data?: any; error?: string }> {
	try {
		// Use the new R2 method that handles metadata
		const result = await r2StorageService.createFileInProject(
			projectId,
			filePath,
			content,
			metadata
		);

		// Send WebSocket notification for real-time updates
		if (result.success) {
			try {
				await webSocketService.send({
					type: 'file_created',
					data: {
						sandboxId: projectId, // WebSocket uses sandboxId
						path: filePath,
						content: content.substring(0, 1000), // Send preview of content
						isDirectory: false,
						size: content.length,
						lastModified: new Date().toISOString()
					}
				});
			} catch (wsError) {
				console.warn('Failed to send WebSocket notification:', wsError);
				// Don't fail the operation if WebSocket fails
			}
		}

		return result;
	} catch (error) {
		console.error(`Failed to create file in R2: ${filePath}`, error);
		return {
			success: false,
			message: `Failed to create file '${filePath}'`,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

/**
 * Read file from R2 storage
 */
async function readFileFromR2(
	projectId: string,
	filePath: string
): Promise<{ success: boolean; message: string; data?: any; error?: string }> {
	try {
		const r2Key = `projects/${projectId}/${filePath}`;
		const content = await r2StorageService.downloadFile(r2Key, { decompress: true });

		if (!content) {
			return {
				success: false,
				message: `File '${filePath}' not found`,
				error: 'FILE_NOT_FOUND'
			};
		}

		return {
			success: true,
			message: `File '${filePath}' read successfully`,
			data: {
				filePath,
				content: content.toString('utf-8'),
				size: content.length
			}
		};
	} catch (error) {
		console.error(`Failed to read file from R2: ${filePath}`, error);
		return {
			success: false,
			message: `Failed to read file '${filePath}'`,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

/**
 * Enhanced tool execution with direct R2 operations
 */
async function executeToolCallsWithR2(
	toolCalls: ToolCall[],
	context: ExecutionContext
): Promise<ToolResult[]> {
	const results: ToolResult[] = [];

	for (const toolCall of toolCalls) {
		try {
			const args = parseToolArguments(toolCall.function.arguments);

			// Handle file operations directly with R2
			if (toolCall.function.name === 'edit_file' && context.projectId) {
				const operation = args.operation as string;
				const filePath = args.filePath as string;
				const content = args.content as string;

				let operationResult;

				if (operation === 'create') {
					operationResult = await createFileInR2(context.projectId, filePath, content || '', {
						reason: args.reason as string,
						modifiedBy: 'ai_agent',
						modifiedAt: new Date().toISOString()
					});
				} else if (operation === 'read') {
					operationResult = await readFileFromR2(context.projectId, filePath);
				} else {
					// For update, delete operations, fall back to tool manager
					const enhancedArgs = {
						...args,
						projectId: context.projectId,
						userId: context.userId
					};

					operationResult = await toolManager.executeToolCall(
						{
							name: toolCall.function.name,
							parameters: enhancedArgs
						},
						{
							projectId: context.projectId,
							userId: context.userId
						}
					);
				}

				results.push({
					tool_call_id: toolCall.id,
					content: JSON.stringify(operationResult)
				});
			} else {
				// Use tool manager for non-file operations or when no projectId
				const enhancedArgs = {
					...args,
					...(context.projectId && { projectId: context.projectId }),
					userId: context.userId
				};

				const result = await toolManager.executeToolCall(
					{
						name: toolCall.function.name,
						parameters: enhancedArgs
					},
					{
						projectId: context.projectId || '',
						userId: context.userId
					}
				);

				results.push({
					tool_call_id: toolCall.id,
					content: JSON.stringify(result)
				});
			}
		} catch (toolError) {
			console.error(`Error executing tool ${toolCall.function.name}:`, toolError);

			const errorMessage =
				toolError instanceof Error
					? toolError.message
					: 'Unknown error occurred during tool execution';

			results.push({
				tool_call_id: toolCall.id,
				content: `Error: ${errorMessage}`
			});
		}
	}

	return results;
}

/**
 * Executes tool calls from chat response with enhanced error handling
 * @param toolCalls - Array of tool calls to execute
 * @param context - Execution context with user and project info
 * @returns Array of tool execution results
 */
async function executeToolCallsFromChat(
	toolCalls: ToolCall[],
	context: ExecutionContext
): Promise<ToolResult[]> {
	// Use enhanced R2 execution if projectId is available
	if (context.projectId) {
		return executeToolCallsWithR2(toolCalls, context);
	}

	// Fallback to original implementation
	const results: ToolResult[] = [];

	for (const toolCall of toolCalls) {
		try {
			// Parse arguments with fallback handling
			const args = parseToolArguments(toolCall.function.arguments);

			// Enhance args with context
			const enhancedArgs = {
				...args,
				...(context.projectId && { projectId: context.projectId }),
				userId: context.userId
			};

			// Execute the tool using tool manager
			const result = await toolManager.executeToolCall(
				{
					name: toolCall.function.name,
					parameters: enhancedArgs
				},
				{
					projectId: context.projectId || '',
					userId: context.userId
				}
			);

			results.push({
				tool_call_id: toolCall.id,
				content: JSON.stringify(result)
			});
		} catch (toolError) {
			console.error(`Error executing tool ${toolCall.function.name}:`, toolError);

			const errorMessage =
				toolError instanceof Error
					? toolError.message
					: 'Unknown error occurred during tool execution';

			results.push({
				tool_call_id: toolCall.id,
				content: `Error: ${errorMessage}`
			});
		}
	}

	return results;
}

/**
 * Creates a tool call object with proper structure
 * @param name - Tool name
 * @param args - Tool arguments
 * @param callIndex - Call index for unique ID generation
 * @returns Formatted tool call object
 */
function createToolCall(name: string, args: Record<string, unknown>, callIndex: number): ToolCall {
	return {
		id: `call_${Date.now()}_${callIndex}`,
		function: {
			name,
			arguments: JSON.stringify(args)
		}
	};
}

/**
 * Parses tool commands from LLM response content with improved pattern matching
 * Supports patterns like "READ_FILE:", "EDIT_FILE:", "LIST_FILES:"
 * @param content - LLM response content to parse
 * @returns Array of parsed tool calls
 */
function parseToolCommands(content: string): ToolCall[] {
	const toolCalls: ToolCall[] = [];
	let callIndex = 0;

	// Enhanced pattern for READ_FILE: <filepath>
	const readFilePattern = /READ_FILE:\s*([^\n\r]+)/gi;
	let match = readFilePattern.exec(content);
	while (match !== null) {
		const filePath = match[1].trim();
		if (filePath) {
			toolCalls.push(
				createToolCall(
					'edit_file',
					{
						operation: 'read',
						filePath
					},
					callIndex++
				)
			);
		}
		match = readFilePattern.exec(content);
	}

	// Enhanced pattern for LIST_FILES: <directory>
	const listFilesPattern = /LIST_FILES:\s*([^\n\r]*)/gi;
	match = listFilesPattern.exec(content);
	while (match !== null) {
		const directory = match[1]?.trim() || '';
		toolCalls.push(createToolCall('list_files', { directoryPath: directory }, callIndex++));
		match = listFilesPattern.exec(content);
	}

	// Enhanced pattern for EDIT_FILE: <filepath> followed by content
	// This pattern captures multi-line content until the next command or end of string
	const editFilePattern =
		/EDIT_FILE:\s*([^\n\r]+)(?:\n([\s\S]*?)(?=\n(?:READ_FILE|EDIT_FILE|LIST_FILES):|$))?/gi;
	match = editFilePattern.exec(content);
	while (match !== null) {
		const filePath = match[1].trim();
		const fileContent = match[2]?.trim() || '';

		if (filePath) {
			toolCalls.push(
				createToolCall(
					'edit_file',
					{
						operation: 'create',
						filePath,
						content: fileContent,
						reason: 'User requested file creation via chat'
					},
					callIndex++
				)
			);
		}
		match = editFilePattern.exec(content);
	}

	// Also look for more natural language patterns for file creation
	const createFilePattern =
		/(?:create|make|generate)\s+(?:a\s+)?(?:new\s+)?file\s+(?:called\s+|named\s+)?['""]?([^'""\n\r]+)['""]?(?:\s+with\s+(?:the\s+)?(?:following\s+)?content|:)?\s*\n([\s\S]*?)(?=\n\n|\n(?:create|make|generate)|$)/gi;
	match = createFilePattern.exec(content);
	while (match !== null) {
		const filePath = match[1].trim();
		const fileContent = match[2]?.trim() || '';

		if (filePath && !filePath.includes(' ')) {
			// Ensure it looks like a file path
			toolCalls.push(
				createToolCall(
					'edit_file',
					{
						operation: 'create',
						filePath,
						content: fileContent,
						reason: 'User requested file creation via natural language'
					},
					callIndex++
				)
			);
		}
		match = createFilePattern.exec(content);
	}

	return toolCalls;
}

/**
 * Validates the incoming request data
 * @param data - Request data to validate
 * @throws Error if validation fails
 */
function validateRequest(data: unknown): asserts data is ChatCompletionRequest {
	if (!data || typeof data !== 'object') {
		throw new Error('Invalid request data');
	}

	const request = data as Partial<ChatCompletionRequest>;

	if (!request.threadId || typeof request.threadId !== 'string') {
		throw new Error('Missing or invalid threadId');
	}

	if (!request.content || typeof request.content !== 'string') {
		throw new Error('Missing or invalid content');
	}
}

/**
 * Builds enhanced user message with file context
 * @param content - Original message content
 * @param fileContext - File context information
 * @param contextVariables - Additional context variables
 * @returns Enhanced message content
 */
function buildEnhancedContent(
	content: string,
	fileContext?: ChatCompletionRequest['fileContext'],
	contextVariables?: ChatCompletionRequest['contextVariables']
): string {
	if (!fileContext || !contextVariables) {
		return content;
	}

	const fileInfo: string[] = [];
	if (fileContext.fileName) fileInfo.push(`File: ${fileContext.fileName}`);
	if (fileContext.filePath) fileInfo.push(`Path: ${fileContext.filePath}`);
	if (fileContext.language) fileInfo.push(`Language: ${fileContext.language}`);

	let contextInfo = '';

	if (fileInfo.length > 0) {
		contextInfo += `\n\n**Current File Context:**\n${fileInfo.join('\n')}`;
	}

	if (contextVariables.selectedCode) {
		const language = fileContext.language || 'text';
		contextInfo += `\n\n**Current File Content:**\n\`\`\`${language}\n${contextVariables.selectedCode}\n\`\`\``;
	}

	if (contextVariables.framework) {
		contextInfo += `\n\n**Project Framework:** ${contextVariables.framework}`;
	}

	return content + contextInfo;
}

/**
 * Creates the enhanced system prompt for tool usage
 * @param projectId - Current project ID
 * @returns System prompt string
 */
function createToolSystemPrompt(projectId?: string): string {
	return `You are an AI assistant with access to file editing tools and R2 cloud storage. You can read, create, edit, and manage files in the user's project.

Available tools:
- edit_file: Create, update, or delete files in the project (stored in R2 cloud storage)
- read_file: Read file contents from R2 storage
- list_files: List directory contents

Current project context: ${projectId || 'not specified'}
Storage: Files are automatically stored in Cloudflare R2 cloud storage for persistence and scalability.

When the user asks you to work with files, you should use the appropriate tools to complete the request.

For file operations, use this format:
- To create a file: "EDIT_FILE: <filepath>" followed by the content
- To read a file: "READ_FILE: <filepath>"
- To list files: "LIST_FILES: <directory>"

Examples:
- "EDIT_FILE: src/components/Button.svelte" followed by the Svelte component code
- "READ_FILE: package.json"
- "LIST_FILES: src/"

All files will be automatically saved to R2 cloud storage with proper versioning and compression for optimal performance.

Please provide both the tool instruction and a natural language explanation of what you're doing.`;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Validate authentication
		if (!locals.session?.user?.id) {
			throw error(401, 'Unauthorized');
		}

		// Parse and validate request data
		const requestData = await request.json();
		validateRequest(requestData);

		const {
			threadId,
			content,
			model = 'gpt-4',
			fileContext,
			contextVariables,
			enableTools = true,
			projectId
		} = requestData;

		// Verify user has access to this thread
		const thread = await DatabaseService.findChatThreadById(threadId);
		if (!thread || thread.userId !== locals.session.user.id) {
			throw error(403, 'Access denied');
		}

		// Determine effective project ID
		const effectiveProjectId = projectId || thread.projectId;
		if (enableTools && !effectiveProjectId) {
			throw error(400, 'projectId is required when tools are enabled');
		}

		// Get recent messages for context
		const recentMessages = await DatabaseService.findChatMessagesByThreadId(threadId, 10, 0);

		// Build conversation context
		const messages: ChatMessage[] = recentMessages.map((msg) => ({
			role: msg.role as 'system' | 'user' | 'assistant',
			content: msg.content
		}));

		// Build enhanced user message with file context
		const enhancedContent = buildEnhancedContent(content, fileContext, contextVariables);

		// Add the new user message
		messages.push({
			role: 'user',
			content: enhancedContent
		});

		// Initialize LLM service
		const llmService = new LLMService();

		// Prepare base LLM request
		const baseLLMRequest = {
			messages: messages.map((msg) => ({
				role: msg.role,
				content: msg.content
			})),
			model,
			temperature: 0.7,
			maxTokens: 2000
		};

		// Check if model supports tools
		const supportsTools =
			model.includes('gpt-4') || model.includes('claude') || model.includes('gemini');

		let aiResponse;
		let toolCallResults: ToolResult[] = [];

		if (enableTools && supportsTools) {
			// Get available tools
			const tools = getToolsForChatCompletion();

			if (tools.length > 0) {
				// Create enhanced prompt with tool instructions
				const systemPrompt = createToolSystemPrompt(effectiveProjectId);

				const messagesWithSystem: ChatMessage[] = [
					{ role: 'system', content: systemPrompt },
					...messages
				];

				// Get initial AI response
				aiResponse = await llmService.invoke({
					...baseLLMRequest,
					messages: messagesWithSystem
				});

				// Parse and execute tool calls
				const toolCalls = parseToolCommands(aiResponse.content);

				if (toolCalls.length > 0) {
					// Execute tool calls with enhanced R2 integration
					toolCallResults = await executeToolCallsFromChat(toolCalls, {
						projectId: effectiveProjectId,
						userId: locals.session.user.id
					});

					// Get follow-up response with tool results
					if (toolCallResults.length > 0) {
						const toolResultsMessage: ChatMessage = {
							role: 'user',
							content: `Tool execution results:\n${toolCallResults
								.map((result) => `Tool: ${result.tool_call_id}\nResult: ${result.content}`)
								.join('\n\n')}\n\nPlease provide a summary of what was accomplished.`
						};

						const followUpResponse = await llmService.invoke({
							...baseLLMRequest,
							messages: [
								...messagesWithSystem,
								{ role: 'assistant', content: aiResponse.content },
								toolResultsMessage
							]
						});

						aiResponse = followUpResponse;
					}
				}
			} else {
				// No tools available, use standard response
				aiResponse = await llmService.invoke(baseLLMRequest);
			}
		} else {
			// Standard LLM response without tools
			aiResponse = await llmService.invoke(baseLLMRequest);
		}

		// Return successful response with enhanced details
		return json({
			content: aiResponse.content,
			usage: aiResponse.usage,
			toolsUsed: toolCallResults.length > 0,
			toolResults: toolCallResults,
			r2StorageUsed:
				!!effectiveProjectId &&
				toolCallResults.some(
					(result) => result.content.includes('R2 storage') || result.content.includes('r2Key')
				),
			projectId: effectiveProjectId
		});
	} catch (err) {
		console.error('Chat completion error:', err);

		// Re-throw SvelteKit errors
		if (err instanceof Response) {
			throw err;
		}

		// Handle other errors
		const errorMessage = err instanceof Error ? err.message : 'Failed to process chat completion';
		throw error(500, errorMessage);
	}
};
