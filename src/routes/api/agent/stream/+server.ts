/**
 * Agent Streaming API using AI SDK v6
 * Returns UI Message Stream format for proper agent loop handling
 * Supports tool calling with multi-step execution and project context
 */

import { aiSdkTools } from '$lib/agent/ai-tools';
import { DatabaseService } from '$lib/services/database.service';
import { logger } from '$lib/utils/logger';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from 'ai';
import type { RequestHandler } from './$types';

// Helper to create message doc
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
) {
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

// Helper to create new thread
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
			contextWindowSize: 20
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

// Resolve AI SDK Model
function resolveModel(modelName?: string) {
	if (modelName) {
		if (modelName.includes('claude') || modelName.includes('anthropic')) {
			return anthropic(modelName);
		}
		if (modelName.includes('gpt') || modelName.includes('openai')) {
			return openai(modelName);
		}
	}
	// Default
	return openai('gpt-4o');
}

// Fetch project file tree for context
async function getProjectFileTree(projectId: string): Promise<string> {
	try {
		const project = await DatabaseService.findProjectById(projectId);
		if (!project?.sandboxId) {
			return '';
		}

		const { DaytonaService } = await import('$lib/services/sandbox/daytona.service.js');
		const daytonaService = DaytonaService.getInstance();
		
		const files = await daytonaService.listFiles(project.sandboxId, '/home/daytona');
		if (!files || !Array.isArray(files)) {
			return '';
		}

		// Build simple tree string (top 2 levels)
		const tree = buildSimpleTree(files, 2);
		return tree ? `\n\nProject File Structure:\n\`\`\`\n${tree}\`\`\`\n` : '';
	} catch (error) {
		logger.warn('Failed to fetch project file tree for context:', error);
		return '';
	}
}

function buildSimpleTree(files: any[], maxDepth: number, depth: number = 0, prefix: string = ''): string {
	if (depth >= maxDepth) return '';
	
	let result = '';
	const sorted = [...files].sort((a, b) => {
		if (a.type === 'directory' && b.type !== 'directory') return -1;
		if (a.type !== 'directory' && b.type === 'directory') return 1;
		return (a.name || '').localeCompare(b.name || '');
	});

	for (let i = 0; i < sorted.length && i < 30; i++) { // Limit to 30 items
		const file = sorted[i];
		const name = file.name || file.path?.split('/').pop() || '';
		
		// Skip hidden and common ignore patterns
		if (name.startsWith('.') || name === 'node_modules' || name === '__pycache__' || name === 'dist' || name === 'build') {
			continue;
		}

		const isLast = i === Math.min(sorted.length, 30) - 1;
		const icon = file.type === 'directory' ? '📁' : '📄';
		result += `${prefix}${isLast ? '└── ' : '├── '}${icon} ${name}\n`;

		if (file.type === 'directory' && file.children && depth < maxDepth - 1) {
			result += buildSimpleTree(file.children, maxDepth, depth + 1, prefix + (isLast ? '    ' : '│   '));
		}
	}

	return result;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const body = await request.json();
	const { message, threadId, projectId, currentFile, sandboxId, sandboxType, modelName } = body;

	const userId = locals?.user?.id || 'default';

	try {
		// Create or get thread
		const actualThreadId = threadId || (await createNewThread(userId, projectId));

		// Save user message
		const userMessageDoc = createMessageDoc(actualThreadId, userId, message, 'user', {
			projectId,
			currentFile
		});
		await DatabaseService.createChatMessage(userMessageDoc);

		// Load conversation history
		const previousMessages = await DatabaseService.findChatMessagesByThreadId(actualThreadId, 20);
		
		// Convert to UIMessage format for AI SDK v6
		const uiMessages: UIMessage[] = previousMessages.map((msg) => ({
			id: msg.id,
			role: msg.role as 'user' | 'assistant',
			parts: [{ type: 'text' as const, text: msg.content }],
			createdAt: new Date(msg.timestamp)
		}));
		
		// Add current message
		uiMessages.push({
			id: crypto.randomUUID(),
			role: 'user',
			parts: [{ type: 'text' as const, text: message }],
			createdAt: new Date()
		});

		// Get project file tree context
		const fileTreeContext = projectId ? await getProjectFileTree(projectId) : '';

		// Resolve model
		const model = resolveModel(modelName);

		// Build system prompt with project context
		const systemPrompt = `You are an expert coding assistant with full access to development tools and sandboxes.

Current Context:
- Current file: ${currentFile || 'None'}
- Sandbox ID: ${sandboxId || 'None'}
- Sandbox Type: ${sandboxType || 'unknown'}
- Project ID: ${projectId || 'None'}
${fileTreeContext}

Available Tools:
- web_search: Search the web for documentation and solutions
- search_codebase: Semantic search through the project codebase
- read_file: Read file contents from the sandbox
- write_file: Write or update files in the sandbox (requires sandboxId, filePath, content)
- execute_code: Execute commands in the sandbox

IMPORTANT INSTRUCTIONS:
1. When using write_file, ALWAYS provide the COMPLETE file content in the 'content' parameter
2. Use the file tree above to understand the project structure
3. Be specific about file paths when reading or writing files
4. For code changes, read the existing file first to understand context
5. After using tools, always provide a clear summary of what you did and the results
6. If a tool fails, explain the error and suggest alternatives

You are an agentic coding assistant. You should:
- Read and understand code files before making changes
- Write and modify code carefully
- Execute commands to test changes when appropriate
- Search for documentation and solutions when needed
- Always explain what you're doing and why`;

		// Convert UIMessages to ModelMessages for streamText
		const modelMessages = await convertToModelMessages(uiMessages);

		// Use streamText with stopWhen for proper multi-step agent loop
		const result = streamText({
			model,
			system: systemPrompt,
			messages: modelMessages,
			tools: aiSdkTools,
			stopWhen: stepCountIs(15), // Allow up to 15 steps for complex tasks
			onStepFinish: async ({ toolCalls, toolResults }) => {
				logger.info('[CodingAgent] Step finished:', {
					toolCallCount: toolCalls?.length || 0,
					hasResults: !!toolResults
				});
			},
			onFinish: async ({ text, toolCalls, toolResults }) => {
				// Save assistant response to database
				if (text) {
					const assistantMessageDoc = createMessageDoc(
						actualThreadId,
						userId,
						text,
						'assistant',
						{
							projectId,
							metadata: {
								model: modelName || 'gpt-4o',
								hasToolCalls: toolCalls && toolCalls.length > 0,
								toolCallCount: toolCalls?.length || 0,
								toolCalls: toolCalls?.map((tc: any) => ({
									id: tc.toolCallId,
									name: tc.toolName,
									arguments: tc.args
								})),
								toolResults: toolResults?.map((tr: any) => ({
									tool_call_id: tr.toolCallId,
									success: !tr.result?.toString().toLowerCase().includes('error'),
									output: tr.result
								}))
							}
						}
					);
					await DatabaseService.createChatMessage(assistantMessageDoc);
				}
				
				logger.info('Agent stream completed', {
					threadId: actualThreadId,
					textLength: text?.length || 0,
					toolCallCount: toolCalls?.length || 0
				});
			}
		});

		// Return UI Message Stream response
		return result.toUIMessageStreamResponse({
			headers: {
				'X-Thread-Id': actualThreadId
			}
		});
	} catch (error: any) {
		logger.error('Agent stream error', error);
		return new Response(
			JSON.stringify({ error: error.message || 'Agent stream failed' }),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};
