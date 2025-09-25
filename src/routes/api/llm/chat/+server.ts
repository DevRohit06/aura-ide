import { LLMService } from '$lib/services/llm/llm.service.js';
import type { LLMRequest } from '$lib/types/llm.types';
import { error, json } from '@sveltejs/kit';

export const POST = async ({ request }: { request: Request }) => {
	try {
		const body = await request.json();
		const {
			messages,
			model = 'gpt-4',
			provider = 'openai',
			temperature = 0.7,
			maxTokens = 2048,
			systemPrompt,
			contextVariables = {},
			sessionId,
			stream = true
		} = body;

		// Validate required fields
		if (!messages || !Array.isArray(messages)) {
			throw error(400, 'Messages array is required');
		}

		// Initialize LLM service
		const llmService = new LLMService({
			defaultModel: model,
			defaultTemperature: temperature,
			maxTokens
		});

		// Build LLM request with default agent behavior
		const llmRequest: LLMRequest = {
			messages: messages.map((msg: any) => ({
				role: msg.role,
				content: msg.content
			})),
			model,
			temperature,
			maxTokens,
			systemPrompt: systemPrompt
				? {
						context: 'general-chat' as const,
						promptId: 'custom',
						variables: contextVariables,
						override: true
					}
				: {
						context: 'general-chat' as const,
						promptId: 'general-chat',
						variables: {
							userName: 'Developer',
							projectName: 'Aura IDE Project'
						},
						override: false
					},
			sessionId
		};

		if (stream) {
			// Return streaming response
			const response = new Response(
				new ReadableStream({
					async start(controller) {
						try {
							const streamGenerator = llmService.stream(llmRequest, sessionId);

							for await (const chunk of streamGenerator) {
								const data = JSON.stringify({
									content: chunk.content,
									done: chunk.done || false,
									metadata: chunk.metadata
								});

								controller.enqueue(`data: ${data}\n\n`);

								if (chunk.done) {
									break;
								}
							}

							controller.close();
						} catch (err) {
							console.error('Streaming error:', err);
							const errorData = JSON.stringify({
								content: 'An error occurred while streaming the response',
								done: true,
								error: err instanceof Error ? err.message : 'Unknown error'
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

			return response;
		} else {
			// Return single response
			const response = await llmService.invoke(llmRequest, sessionId);

			return json({
				content: response.content,
				usage: response.usage,
				provider: response.provider,
				model: response.model,
				cached: response.cached,
				latency: response.latency,
				metadata: response.metadata
			});
		}
	} catch (err) {
		console.error('LLM Chat API Error:', err);

		if (err instanceof Error) {
			// Handle specific error types
			if (err.message.includes('API key')) {
				throw error(401, 'Invalid or missing API key');
			}
			if (err.message.includes('quota') || err.message.includes('rate limit')) {
				throw error(429, 'API rate limit exceeded');
			}
			if (err.message.includes('model not found')) {
				throw error(400, 'Invalid model specified');
			}
		}

		throw error(500, 'Internal server error while processing chat request');
	}
};
