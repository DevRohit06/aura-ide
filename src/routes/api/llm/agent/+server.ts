import { AgentService } from '@/services/agents/agent.service';
import { HumanMessage } from '@langchain/core/messages';
import { error, json } from '@sveltejs/kit';
import { v4 as uuidv4 } from 'uuid';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const {
			messages,
			agentId,
			provider = 'openai',
			model = 'gpt-4o',
			temperature = 0,
			promptId,
			sessionId,
			sessionName,
			sessionPath,
			stream = false
		} = body;

		// Validate required fields
		if (!messages || !Array.isArray(messages)) {
			throw error(400, 'Messages array is required');
		}

		// Initialize agent service
		const agentService = new AgentService();

		// Convert messages to LangChain format for agent service
		const langchainMessages = messages.map((msg: any) => {
			if (msg.role === 'user') {
				return new HumanMessage(msg.content);
			}
			// For now, only handle user messages
			// Assistant messages can be added later if needed
			return new HumanMessage(msg.content);
		});

		// Convert messages to LLM service format for streaming
		const llmMessages = messages.map((msg: any) => ({
			role: msg.role as 'system' | 'user' | 'assistant',
			content: msg.content
		}));

		// Create or get agent
		let currentAgentId = agentId;
		if (!currentAgentId) {
			const agentConfig = {
				model,
				provider,
				temperature,
				systemMessage: 'You are a helpful AI assistant with access to web search tools.',
				memoryType: 'conversation' as const
			};

			currentAgentId = agentService.createAgent(agentConfig);
		}

		// Ensure we have a sessionId for consistency
		let currentSessionId = sessionId;
		if (!currentSessionId) {
			currentSessionId = uuidv4();
		}

		if (stream) {
			// Handle streaming response
			const streamResponse = new Response(
				new ReadableStream({
					async start(controller) {
						try {
							// For streaming, we'll use the LLM service directly since agent streaming isn't implemented yet
							const { LLMService } = await import('@/services/llm/llm.service');
							const llmService = new LLMService();

							const stream = await llmService.stream(
								{
									messages: llmMessages,
									model,
									temperature
								},
								currentSessionId,
								promptId
							);

							for await (const chunk of stream) {
								if (chunk.content) {
									const data = JSON.stringify({
										type: 'chunk',
										content: chunk.content,
										done: false
									});
									controller.enqueue(`data: ${data}\n\n`);
								}
							}

							// Send completion message
							const completionData = JSON.stringify({
								type: 'done',
								agentId: currentAgentId,
								sessionId: currentSessionId,
								done: true
							});
							controller.enqueue(`data: ${completionData}\n\n`);
							controller.close();
						} catch (err) {
							console.error('Streaming error:', err);
							const errorData = JSON.stringify({
								type: 'error',
								error: err instanceof Error ? err.message : 'Streaming error',
								done: true
							});
							controller.enqueue(`data: ${errorData}\n\n`);
							controller.close();
						}
					}
				}),
				{
					headers: {
						'Content-Type': 'text/event-stream',
						'Cache-Control': 'no-cache',
						Connection: 'keep-alive'
					}
				}
			);

			return streamResponse;
		} else {
			// Handle regular response using agent service
			const result = await agentService.invokeAgent(currentAgentId, langchainMessages, {
				sessionId: currentSessionId,
				sessionName,
				sessionPath
			});

			// Extract the assistant's response
			const assistantMessage = result.messages[result.messages.length - 1];

			return json({
				response: assistantMessage.content,
				agentId: currentAgentId,
				sessionId: currentSessionId
			});
		}
	} catch (err) {
		console.error('Agent API Error:', err);
		throw error(500, err instanceof Error ? err.message : 'Internal server error');
	}
};
