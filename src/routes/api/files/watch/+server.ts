/**
 * File Watch SSE Endpoint
 * Streams file change events to clients in real-time
 */

import { auth } from '$lib/auth';
import { fileChangeBroadcaster } from '$lib/services/file-change-broadcaster';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, url }) => {
	try {
		// Authenticate user
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session?.user) {
			return new Response('Unauthorized', { status: 401 });
		}

		// Get filter parameters from query string
		const projectId = url.searchParams.get('projectId') || undefined;
		const sandboxId = url.searchParams.get('sandboxId') || undefined;
		const clientId = crypto.randomUUID();

		console.log(`📡 File watch SSE connection established`, {
			clientId,
			userId: session.user.id,
			projectId,
			sandboxId
		});

		// Create SSE stream
		const stream = new ReadableStream({
			start(controller) {
				// Register client with broadcaster
				fileChangeBroadcaster.registerClient(clientId, controller, {
					projectId,
					sandboxId,
					userId: session.user.id
				});

				// Send initial connection message
				const encoder = new TextEncoder();
				const initialMessage = {
					type: 'connected',
					clientId,
					timestamp: Date.now(),
					message: 'File watcher connected'
				};
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialMessage)}\n\n`));

				// Send heartbeat every 30 seconds to keep connection alive
				const heartbeatInterval = setInterval(() => {
					try {
						const heartbeat = {
							type: 'heartbeat',
							timestamp: Date.now()
						};
						controller.enqueue(encoder.encode(`data: ${JSON.stringify(heartbeat)}\n\n`));
					} catch (error) {
						console.error('Failed to send heartbeat:', error);
						clearInterval(heartbeatInterval);
						fileChangeBroadcaster.unregisterClient(clientId);
					}
				}, 30000);

				// Cleanup on stream close
				request.signal.addEventListener('abort', () => {
					clearInterval(heartbeatInterval);
					fileChangeBroadcaster.unregisterClient(clientId);
					controller.close();
					console.log(`📡 File watch SSE connection closed for client ${clientId}`);
				});
			},
			cancel() {
				fileChangeBroadcaster.unregisterClient(clientId);
				console.log(`📡 File watch SSE stream cancelled for client ${clientId}`);
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
	} catch (error) {
		console.error('File watch SSE error:', error);
		return new Response('Internal Server Error', { status: 500 });
	}
};
