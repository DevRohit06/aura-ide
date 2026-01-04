/**
 * Agent Streaming API - Enhanced Coding Agent
 *
 * This is the main agent endpoint that powers Aura's AI coding assistant.
 * It uses AI SDK v6 with multi-step tool execution for complex coding tasks.
 */

import { aiSdkTools } from '$lib/agent/ai-tools';
import { buildCodingAgentPrompt, type AgentContext } from '$lib/agent/system-prompts';
import { DatabaseService } from '$lib/services/database.service';
import { logger } from '$lib/utils/logger';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from 'ai';
import type { RequestHandler } from './$types';

// Constants
const MAX_AGENT_STEPS = 25; // Allow more steps for complex tasks
const MAX_HISTORY_MESSAGES = 30; // Context window for conversation history
const FILE_TREE_MAX_DEPTH = 3;

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
			contextWindowSize: MAX_HISTORY_MESSAGES
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
		// Anthropic models
		if (modelName.includes('claude') || modelName.includes('anthropic')) {
			return anthropic(modelName);
		}
		// OpenAI models
		if (
			modelName.includes('gpt') ||
			modelName.includes('openai') ||
			modelName.includes('o1') ||
			modelName.includes('o3')
		) {
			return openai(modelName);
		}
	}
	// Default to GPT-4o for best tool use performance
	return openai('gpt-4o');
}

// Fetch project details
async function getProjectDetails(
	projectId: string
): Promise<{ project: any; fileTree: string; framework?: string }> {
	try {
		const project = await DatabaseService.findProjectById(projectId);
		if (!project?.sandboxId) {
			return { project, fileTree: '' };
		}

		const { DaytonaService } = await import('$lib/services/sandbox/daytona.service.js');
		const daytonaService = DaytonaService.getInstance();

		const files = await daytonaService.listFiles(project.sandboxId, '/home/daytona');
		if (!files || !Array.isArray(files)) {
			return { project, fileTree: '' };
		}

		// Build a comprehensive tree
		const tree = buildFileTree(files, FILE_TREE_MAX_DEPTH);

		// Detect framework from package.json or other markers
		let framework: string | undefined;
		try {
			const packageJson = await daytonaService.readFile(
				project.sandboxId,
				'/home/daytona/package.json'
			);
			if (packageJson) {
				const pkg = JSON.parse(packageJson);
				const deps = { ...pkg.dependencies, ...pkg.devDependencies };
				if (deps['next']) framework = 'Next.js';
				else if (deps['@sveltejs/kit']) framework = 'SvelteKit';
				else if (deps['vue']) framework = 'Vue';
				else if (deps['react']) framework = 'React';
				else if (deps['express']) framework = 'Express';
				else if (deps['fastify']) framework = 'Fastify';
			}
		} catch {
			// Ignore framework detection errors
		}

		return { project, fileTree: tree, framework };
	} catch (error) {
		logger.warn('Failed to fetch project details:', error);
		return { project: null, fileTree: '' };
	}
}

function buildFileTree(files: any[], maxDepth: number, depth: number = 0, prefix: string = ''): string {
	if (depth >= maxDepth) return '';

	let result = '';
	const sorted = [...files].sort((a, b) => {
		if (a.type === 'directory' && b.type !== 'directory') return -1;
		if (a.type !== 'directory' && b.type === 'directory') return 1;
		return (a.name || '').localeCompare(b.name || '');
	});

	// Filter out noise
	const filtered = sorted.filter((file) => {
		const name = file.name || file.path?.split('/').pop() || '';
		return (
			!name.startsWith('.') &&
			name !== 'node_modules' &&
			name !== '__pycache__' &&
			name !== 'dist' &&
			name !== 'build' &&
			name !== '.next' &&
			name !== 'coverage'
		);
	});

	for (let i = 0; i < filtered.length && i < 50; i++) {
		const file = filtered[i];
		const name = file.name || file.path?.split('/').pop() || '';
		const isLast = i === Math.min(filtered.length, 50) - 1;
		const icon = file.type === 'directory' ? '📁' : '📄';

		result += `${prefix}${isLast ? '└── ' : '├── '}${icon} ${name}\n`;

		if (file.type === 'directory' && file.children && depth < maxDepth - 1) {
			result += buildFileTree(
				file.children,
				maxDepth,
				depth + 1,
				prefix + (isLast ? '    ' : '│   ')
			);
		}
	}

	if (filtered.length > 50) {
		result += `${prefix}... and ${filtered.length - 50} more items\n`;
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
		const previousMessages = await DatabaseService.findChatMessagesByThreadId(
			actualThreadId,
			MAX_HISTORY_MESSAGES
		);

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

		// Get project context
		let fileTree = '';
		let framework: string | undefined;
		let projectName: string | undefined;

		if (projectId) {
			const projectDetails = await getProjectDetails(projectId);
			fileTree = projectDetails.fileTree;
			framework = projectDetails.framework;
			projectName = projectDetails.project?.name;
		}

		// Build agent context
		const agentContext: AgentContext = {
			sandboxId,
			sandboxType: sandboxType || 'daytona',
			projectId,
			currentFile,
			fileTree,
			projectName,
			framework
		};

		// Build the system prompt
		const systemPrompt = buildCodingAgentPrompt(agentContext);

		// Resolve model
		const model = resolveModel(modelName);

		// Convert UIMessages to ModelMessages for streamText
		const modelMessages = await convertToModelMessages(uiMessages);

		// Track step information for metadata
		let totalSteps = 0;
		let allToolCalls: any[] = [];
		let allToolResults: any[] = [];

		// Use streamText with enhanced agent loop
		const result = streamText({
			model,
			system: systemPrompt,
			messages: modelMessages,
			tools: aiSdkTools,
			maxSteps: MAX_AGENT_STEPS,
			stopWhen: stepCountIs(MAX_AGENT_STEPS),
			onStepFinish: async ({ stepType, toolCalls, toolResults }) => {
				totalSteps++;

				if (toolCalls && toolCalls.length > 0) {
					allToolCalls.push(
						...toolCalls.map((tc: any) => ({
							id: tc.toolCallId,
							name: tc.toolName,
							arguments: tc.args
						}))
					);
				}

				if (toolResults && toolResults.length > 0) {
					allToolResults.push(
						...toolResults.map((tr: any) => ({
							toolCallId: tr.toolCallId,
							toolName: tr.toolName,
							result: typeof tr.result === 'string' ? tr.result.substring(0, 500) : tr.result
						}))
					);
				}

				logger.info('[CodingAgent] Step finished:', {
					step: totalSteps,
					stepType,
					toolCallCount: toolCalls?.length || 0,
					hasResults: !!toolResults
				});
			},
			onFinish: async ({ text, usage }) => {
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
								hasToolCalls: allToolCalls.length > 0,
								toolCallCount: allToolCalls.length,
								totalSteps,
								toolCalls: allToolCalls.slice(0, 20), // Limit stored tool calls
								toolResults: allToolResults.slice(0, 20),
								usage: usage
									? {
											promptTokens: usage.promptTokens,
											completionTokens: usage.completionTokens,
											totalTokens: usage.totalTokens
										}
									: undefined
							}
						}
					);
					await DatabaseService.createChatMessage(assistantMessageDoc);
				}

				logger.info('[CodingAgent] Stream completed', {
					threadId: actualThreadId,
					textLength: text?.length || 0,
					totalSteps,
					toolCallCount: allToolCalls.length,
					usage
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
		logger.error('[CodingAgent] Stream error', error);
		return new Response(JSON.stringify({ error: error.message || 'Agent stream failed' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
