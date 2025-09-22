import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { messages, stream = false } = body;

		console.log('Received request:', { messages, stream });

		// Validate required fields
		if (!messages || !Array.isArray(messages)) {
			throw error(400, 'Messages array is required');
		}

		const userMessage = messages[messages.length - 1]?.content || '';

		if (stream) {
			// Return a streaming response for testing
			const response = new Response(
				new ReadableStream({
					async start(controller) {
						try {
							// Simulate streaming response
							const testResponse = `Hello! You said: "${userMessage}". This is a test response from the API.`;

							// Send chunks
							for (let i = 0; i < testResponse.length; i += 5) {
								const chunk = testResponse.slice(i, i + 5);
								const data = JSON.stringify({
									type: 'chunk',
									content: chunk,
									done: false
								});
								controller.enqueue(`data: ${data}\n\n`);

								// Small delay to simulate real streaming
								await new Promise((resolve) => setTimeout(resolve, 50));
							}

							// Send completion
							const completionData = JSON.stringify({
								type: 'done',
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

			return response;
		} else {
			// Return a simple JSON response
			return json({
				response: `Hello! You said: "${userMessage}". This is a test response from the API.`,
				agentId: 'test-agent',
				sessionId: 'test-session'
			});
		}
	} catch (err) {
		console.error('API Error:', err);
		throw error(500, err instanceof Error ? err.message : 'Internal server error');
	}
};
