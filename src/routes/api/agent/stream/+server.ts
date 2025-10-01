/**
 * Agent Streaming API using Server-Sent Events (SSE)
 * Provides real-time streaming of agent responses and tool executions
 */

import { env } from '$env/dynamic/private';
import { agentGraph } from '$lib/agent/graph';
import { modelManager } from '$lib/agent/model-manager';
import { DatabaseService } from '$lib/services/database.service';
import { logger } from '$lib/utils/logger';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import type { RequestHandler } from './$types';

// Types for SSE events
interface SSEEvent {
	type: 'start' | 'thinking' | 'tool_call' | 'tool_result' | 'content' | 'complete' | 'error';
	data: any;
	timestamp: number;
}

// Helper to create message doc (copied from main agent API)
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

// Convert messages to LangChain format
function convertToLangChainMessages(messages: any[]): (HumanMessage | AIMessage)[] {
	return messages.map((msg) => {
		const content = String(msg.content || '');
		return msg.role === 'assistant' ? new AIMessage(content) : new HumanMessage(content);
	});
}

// Resolve model configuration
function resolveModelConfig(modelName?: string, modelConfig?: any) {
	if (modelName) {
		const preset = modelManager.getModelPreset(modelName);
		if (preset) return preset;
	}

	if (modelConfig) return modelConfig;

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
		return { provider: 'openai', model: modelName };
	}

	return {
		provider: 'openai',
		model: env.OPENAI_API_KEY ? 'gpt-4o-mini' : 'gpt-4o'
	};
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const body = await request.json();
	const {
		message,
		threadId,
		projectId,
		currentFile,
		sandboxId,
		sandboxType,
		modelName,
		modelConfig
	} = body;

	const userId = locals?.user?.id || 'default';

	// Create SSE stream
	const stream = new ReadableStream({
		start(controller) {
			(async () => {
				try {
					// Helper to enqueue SSE events
					const enqueueEvent = (event: SSEEvent) => {
						const eventData = `data: ${JSON.stringify(event)}\n\n`;
						controller.enqueue(new TextEncoder().encode(eventData));
					};

					// Send start event
					enqueueEvent({
						type: 'start',
						data: { message: 'Agent processing started' },
						timestamp: Date.now()
					});

					// Ensure we have a thread
					const actualThreadId = threadId || (await createNewThread(userId, projectId));

					// Save user message
					const userMessageDoc = createMessageDoc(actualThreadId, userId, message, 'user', {
						projectId,
						currentFile
					});
					await DatabaseService.createChatMessage(userMessageDoc);

					// Send thinking event
					enqueueEvent({
						type: 'thinking',
						data: { message: 'Agent is thinking...' },
						timestamp: Date.now()
					});

					// Resolve model configuration
					const finalModelConfig = resolveModelConfig(modelName, modelConfig);

					// Load conversation history
					const previousMessages = await DatabaseService.findChatMessagesByThreadId(
						actualThreadId,
						20
					);
					const historyMessages = convertToLangChainMessages(previousMessages);
					const userMessage = new HumanMessage(String(message || ''));
					const allMessages = [...historyMessages, userMessage];

					// Prepare initial state
					const initialState = {
						messages: allMessages,
						currentFile: currentFile || null,
						sandboxId: sandboxId || null,
						sandboxType: sandboxType || null,
						useMorph: false,
						codeContext: [],
						terminalOutput: [],
						awaitingHumanInput: false,
						modelConfig: finalModelConfig
					};

					// Invoke agent with streaming
					const config = { configurable: { thread_id: actualThreadId } };
					const result = await agentGraph.invoke(initialState, config);

					// Check for interrupts
					if ((result as any).__interrupt__) {
						const interruptData = (result as any).__interrupt__[0];
						enqueueEvent({
							type: 'tool_call',
							data: {
								interrupt: true,
								toolCalls: interruptData.value?.toolCalls || [],
								stateSnapshot: interruptData.value?.stateSnapshot || {},
								reason: interruptData.value?.reason || 'Human approval required'
							},
							timestamp: Date.now()
						});
					} else {
						// Extract and send response
						const lastMessage = result.messages?.[result.messages?.length - 1];
						const content = lastMessage?.content || 'No response';

						// Stream content in chunks (simulate typing)
						const contentStr = String(content);
						const chunkSize = 10;
						for (let i = 0; i < contentStr.length; i += chunkSize) {
							const chunk = contentStr.slice(i, i + chunkSize);
							enqueueEvent({
								type: 'content',
								data: { chunk, isComplete: i + chunkSize >= contentStr.length },
								timestamp: Date.now()
							});
							// Small delay for typing effect
							await new Promise((resolve) => setTimeout(resolve, 50));
						}

						// Save assistant response
						const assistantMessageDoc = createMessageDoc(
							actualThreadId,
							userId,
							contentStr,
							'assistant',
							{
								projectId,
								metadata: {
									model: `${finalModelConfig.provider}/${finalModelConfig.model}`,
									provider: finalModelConfig.provider
								}
							}
						);
						await DatabaseService.createChatMessage(assistantMessageDoc);
					}

					// Send completion event
					enqueueEvent({
						type: 'complete',
						data: {
							threadId: actualThreadId,
							message: 'Response complete'
						},
						timestamp: Date.now()
					});
				} catch (error) {
					logger.error('SSE Agent stream error:', error);
					controller.enqueue(
						new TextEncoder().encode(
							`data: ${JSON.stringify({
								type: 'error',
								data: {
									error: error instanceof Error ? error.message : 'Stream error',
									code: 'STREAM_ERROR'
								},
								timestamp: Date.now()
							})}\n\n`
						)
					);
				} finally {
					controller.close();
				}
			})();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Headers': 'Content-Type'
		}
	});
};
