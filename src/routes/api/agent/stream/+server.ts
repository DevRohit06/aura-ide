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
	type:
		| 'start'
		| 'thinking'
		| 'tool_call'
		| 'tool_result'
		| 'content'
		| 'complete'
		| 'error'
		| 'output'
		| 'stdout'
		| 'command';
	data?: any;
	content?: string;
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

/**
 * Extracts readable text content from LangChain/Anthropic message content
 * Handles both string content and structured content blocks
 */
function extractMessageContent(content: any): string {
	if (typeof content === 'string') {
		return content;
	}

	if (Array.isArray(content)) {
		// Handle array of content blocks (Anthropic format)
		return content
			.map((block) => {
				if (typeof block === 'string') return block;
				if (block && typeof block === 'object' && block.type === 'text') {
					return block.text || '';
				}
				if (block && typeof block === 'object' && block.content) {
					return String(block.content);
				}
				// Ignore tool_use blocks - they're handled separately
				if (block && typeof block === 'object' && block.type === 'tool_use') {
					return '';
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

		// Fallback: stringify
		try {
			const str = JSON.stringify(content, null, 2);
			if (str.length > 500) {
				return `Response data (${Object.keys(content).length} properties)`;
			}
			return str;
		} catch {
			return 'Complex response object';
		}
	}

	return String(content);
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
					const config = {
						configurable: { thread_id: actualThreadId },
						streamMode: 'values' as const
					};

					let lastContent = '';
					let assistantMessage = '';
					let hadInterrupt = false;

					// Use stream() instead of invoke() to get real-time updates
					for await (const chunk of await agentGraph.stream(initialState, config)) {
						logger.info('Stream chunk received:', {
							hasMessages: !!chunk.messages,
							messageCount: chunk.messages?.length,
							lastMessageType: chunk.messages?.[chunk.messages.length - 1]?.constructor?.name
						});

						// Check for interrupts
						if ((chunk as any).__interrupt__) {
							hadInterrupt = true;
							const interruptData = (chunk as any).__interrupt__[0];
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
							break; // Stop streaming on interrupt
						}

						// Process messages in the chunk
						if (chunk.messages && Array.isArray(chunk.messages)) {
							const lastMessage = chunk.messages[chunk.messages.length - 1];

							// Handle tool messages (command outputs)
							if (lastMessage && (lastMessage as any).tool_call_id) {
								const toolMessage = lastMessage as any;
								const rawContent = toolMessage.content || '';

								// Normalize content to string for logging and display
								const toolOutput =
									typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent, null, 2);

								// For logging, create a safe preview
								const contentPreview =
									typeof rawContent === 'string'
										? rawContent.substring(0, 100)
										: JSON.stringify(rawContent).substring(0, 100);

								logger.info('Tool output detected:', {
									tool_call_id: toolMessage.tool_call_id,
									contentType: typeof rawContent,
									contentLength: toolOutput.length,
									contentPreview
								});

								// Emit tool result event with the actual output
								enqueueEvent({
									type: 'tool_result',
									data: {
										tool_call_id: toolMessage.tool_call_id,
										output: toolOutput,
										content: toolOutput
									},
									timestamp: Date.now()
								});

								// Also emit as stdout for terminal display
								if (toolOutput && toolOutput.trim()) {
									enqueueEvent({
										type: 'output',
										data: toolOutput,
										content: toolOutput,
										timestamp: Date.now()
									});
								}
							}

							// Handle AI messages (assistant responses)
							if (lastMessage && lastMessage.constructor?.name === 'AIMessage') {
								const rawContent = (lastMessage as any).content || '';

								// Extract text content properly (handles Anthropic structured format)
								const content = extractMessageContent(rawContent);

								// Get tool calls from LangChain's normalized format
								// LangChain's bindTools() should already normalize these to have 'args'
								const toolCallsFromMessage = (lastMessage as any).tool_calls || [];

								// If there are tool calls, emit them
								// We rely on LangChain's normalization rather than extracting from content
								if (toolCallsFromMessage.length > 0) {
									logger.info('Tool calls detected in AI message:', {
										count: toolCallsFromMessage.length,
										tools: toolCallsFromMessage.map((tc: any) => tc.name || tc.function?.name),
										firstToolCall: toolCallsFromMessage[0] // Log first one for debugging
									});

									enqueueEvent({
										type: 'tool_call',
										data: {
											toolCalls: toolCallsFromMessage.map((tc: any) => ({
												id: tc.id || '',
												name: tc.name || tc.function?.name || '',
												// LangChain should have normalized this to 'args'
												arguments: tc.args || tc.arguments || tc.function?.arguments || {},
												type: tc.type || 'function'
											}))
										},
										timestamp: Date.now()
									});
								}
								if (content && content !== lastContent) {
									// Stream new content
									const newContent = content.substring(lastContent.length);
									if (newContent) {
										const chunkSize = 10;
										for (let i = 0; i < newContent.length; i += chunkSize) {
											const textChunk = newContent.slice(i, i + chunkSize);
											enqueueEvent({
												type: 'content',
												data: { chunk: textChunk, isComplete: false },
												timestamp: Date.now()
											});
											await new Promise((resolve) => setTimeout(resolve, 30));
										}
									}
									lastContent = content;
									assistantMessage = content;
								}
							}
						}
					}

					// If we didn't have an interrupt, save the assistant response
					if (!hadInterrupt && assistantMessage) {
						// Send final content complete event
						enqueueEvent({
							type: 'content',
							data: { chunk: '', isComplete: true },
							timestamp: Date.now()
						});

						// Save assistant response
						const assistantMessageDoc = createMessageDoc(
							actualThreadId,
							userId,
							assistantMessage,
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
