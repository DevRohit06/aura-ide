import { createAgent } from '$lib/agent/index';
import { sandboxManager } from '$lib/services/sandbox';
import type { RequestHandler } from '@sveltejs/kit';
import { WebSocket } from 'ws';

interface ConnectedClient {
	ws: WebSocket;
	projectId: string;
	sandboxId?: string;
	agent?: any;
	lastActivity: Date;
}

const connectedClients = new Map<string, ConnectedClient>();

// Clean up inactive connections every 5 minutes
setInterval(
	() => {
		const now = new Date();
		for (const [clientId, client] of connectedClients.entries()) {
			if (now.getTime() - client.lastActivity.getTime() > 30 * 60 * 1000) {
				// 30 minutes
				client.ws.close();
				connectedClients.delete(clientId);
			}
		}
	},
	5 * 60 * 1000
);

export const GET: RequestHandler = async ({ params, request, locals }) => {
	const projectId = params.projectId as string;

	if (!projectId) {
		return new Response('Project ID required', { status: 400 });
	}

	// Check authentication
	if (!locals.user) {
		return new Response('Unauthorized', { status: 401 });
	}

	const upgradeHeader = request.headers.get('upgrade');
	if (upgradeHeader !== 'websocket') {
		return new Response('Expected websocket', { status: 400 });
	}

	const { socket, response } = await import('ws').then(({ WebSocketServer }) => {
		const wss = new WebSocketServer({ noServer: true });
		return new Promise<{ socket: WebSocket; response: Response }>((resolve) => {
			wss.handleUpgrade(request as any, request as any, Buffer.alloc(0), (ws) => {
				resolve({
					socket: ws,
					response: new Response(null, { status: 101 })
				});
			});
		});
	});

	const clientId = `${projectId}-${Date.now()}-${Math.random()}`;
	const client: ConnectedClient = {
		ws: socket,
		projectId,
		lastActivity: new Date()
	};

	connectedClients.set(clientId, client);

	socket.on('message', async (data: Buffer) => {
		try {
			const message = JSON.parse(data.toString());
			await handleMessage(clientId, message);
		} catch (error) {
			console.error('Error handling WebSocket message:', error);
			socket.send(
				JSON.stringify({
					type: 'error',
					message: 'Invalid message format'
				})
			);
		}
	});

	socket.on('close', () => {
		connectedClients.delete(clientId);
	});

	socket.on('error', (error) => {
		console.error('WebSocket error:', error);
		connectedClients.delete(clientId);
	});

	return response;
};

async function handleMessage(clientId: string, message: any) {
	const client = connectedClients.get(clientId);
	if (!client) return;

	client.lastActivity = new Date();

	try {
		switch (message.type) {
			case 'initialize_sandbox':
				await handleInitializeSandbox(client, message);
				break;

			case 'user_message':
				await handleUserMessage(client, message);
				break;

			case 'approve_interrupt':
				await handleApproveInterrupt(client, message);
				break;

			case 'reject_interrupt':
				await handleRejectInterrupt(client, message);
				break;

			case 'modify_interrupt':
				await handleModifyInterrupt(client, message);
				break;

			default:
				client.ws.send(
					JSON.stringify({
						type: 'error',
						message: `Unknown message type: ${message.type}`
					})
				);
		}
	} catch (error) {
		console.error('Error handling message:', error);
		client.ws.send(
			JSON.stringify({
				type: 'error',
				message: 'Internal server error'
			})
		);
	}
}

async function handleInitializeSandbox(client: ConnectedClient, message: any) {
	const { sandboxId } = message;

	if (!sandboxId) {
		client.ws.send(
			JSON.stringify({
				type: 'error',
				message: 'Sandbox ID required'
			})
		);
		return;
	}

	try {
		// Verify sandbox exists and is accessible
		const sandbox = await sandboxManager.getSandbox(sandboxId);

		if (!sandbox) {
			client.ws.send(
				JSON.stringify({
					type: 'error',
					message: 'Sandbox not found'
				})
			);
			return;
		}

		client.sandboxId = sandboxId;

		// Initialize agent with sandbox context
		client.agent = await createAgent({
			sandboxId,
			projectId: client.projectId,
			callbacks: {
				onInterrupt: (interrupt: any) => {
					client.ws.send(
						JSON.stringify({
							type: 'interrupt',
							interrupt
						})
					);
				},
				onMessage: (message: any) => {
					client.ws.send(
						JSON.stringify({
							type: 'message',
							...message
						})
					);
				},
				onStateChange: (state: any) => {
					client.ws.send(
						JSON.stringify({
							type: 'agent_state',
							state
						})
					);
				}
			}
		});

		client.ws.send(
			JSON.stringify({
				type: 'message',
				role: 'system',
				content: `Agent initialized with sandbox ${sandboxId}`,
				timestamp: new Date().toISOString()
			})
		);
	} catch (error) {
		console.error('Error initializing sandbox:', error);
		client.ws.send(
			JSON.stringify({
				type: 'error',
				message: 'Failed to initialize sandbox'
			})
		);
	}
}

async function handleUserMessage(client: ConnectedClient, message: any) {
	if (!client.agent) {
		client.ws.send(
			JSON.stringify({
				type: 'error',
				message: 'Agent not initialized'
			})
		);
		return;
	}

	try {
		await client.agent.processMessage(message.content);
	} catch (error) {
		console.error('Error processing user message:', error);
		client.ws.send(
			JSON.stringify({
				type: 'error',
				message: 'Failed to process message'
			})
		);
	}
}

async function handleApproveInterrupt(client: ConnectedClient, message: any) {
	if (!client.agent) {
		client.ws.send(
			JSON.stringify({
				type: 'error',
				message: 'Agent not initialized'
			})
		);
		return;
	}

	try {
		await client.agent.resumeWithApproval(message.toolCalls);
	} catch (error) {
		console.error('Error approving interrupt:', error);
		client.ws.send(
			JSON.stringify({
				type: 'error',
				message: 'Failed to approve actions'
			})
		);
	}
}

async function handleRejectInterrupt(client: ConnectedClient, message: any) {
	if (!client.agent) {
		client.ws.send(
			JSON.stringify({
				type: 'error',
				message: 'Agent not initialized'
			})
		);
		return;
	}

	try {
		await client.agent.resumeWithRejection();
	} catch (error) {
		console.error('Error rejecting interrupt:', error);
		client.ws.send(
			JSON.stringify({
				type: 'error',
				message: 'Failed to reject actions'
			})
		);
	}
}

async function handleModifyInterrupt(client: ConnectedClient, message: any) {
	if (!client.agent) {
		client.ws.send(
			JSON.stringify({
				type: 'error',
				message: 'Agent not initialized'
			})
		);
		return;
	}

	try {
		await client.agent.resumeWithModification(message.edits);
	} catch (error) {
		console.error('Error modifying interrupt:', error);
		client.ws.send(
			JSON.stringify({
				type: 'error',
				message: 'Failed to modify actions'
			})
		);
	}
}
