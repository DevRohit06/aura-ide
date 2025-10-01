/**
 * WebSocket Server Handler for SvelteKit
 * Handles real-time communication for sandbox features
 */

import type {
	AnyWebSocketMessage,
	CollaborationMessage,
	FileSystemMessage,
	StatusMessage,
	TerminalMessage
} from '$lib/services/websocket.service';
import type { RequestHandler } from '@sveltejs/kit';
import type { WebSocket } from 'ws';
import WebSocketClient from 'ws';

// WebSocket server setup
let wss: any = null;

// Connection tracking
const connections = new Map<
	string,
	{
		ws: WebSocket;
		userId?: string;
		sandboxId?: string;
		subscriptions: Set<string>;
	}
>();

// Terminal sessions
const terminalSessions = new Map<
	string,
	{
		sandboxId: string;
		process?: any;
		connections: Set<string>;
	}
>();

// File watchers
const fileWatchers = new Map<
	string,
	{
		sandboxId: string;
		path: string;
		watcher?: any;
		connections: Set<string>;
	}
>();

// Terminal proxy sessions map: proxySessionId -> provider ws client and client connections
const terminalProxySessions = new Map<
	string,
	{
		providerWs?: WebSocket;
		sandboxId: string;
		clients: Set<string>;
	}
>();

/**
 * Initialize WebSocket server (no longer needed with SvelteKit upgrade handling)
 */
function initializeWebSocketServer() {
	// WebSocket server is now handled by SvelteKit's GET handler
	console.log('WebSocket server initialization delegated to SvelteKit');
}

/**
 * Handle new WebSocket connection
 */
function handleConnection(ws: WebSocket, connectionId: string) {
	console.log(`New WebSocket connection: ${connectionId}`);

	// Store connection
	connections.set(connectionId, {
		ws,
		subscriptions: new Set()
	});

	// Send connection confirmation
	ws.send(
		JSON.stringify({
			type: 'connection_confirmed',
			data: { connectionId },
			timestamp: Date.now()
		})
	);

	// Handle messages
	ws.on('message', (data: Buffer) => {
		try {
			const message: AnyWebSocketMessage = JSON.parse(data.toString());
			handleMessage(connectionId, message);
		} catch (error) {
			console.error('Error parsing WebSocket message:', error);
		}
	});

	// Handle disconnection
	ws.on('close', () => {
		handleDisconnection(connectionId);
	});

	ws.on('error', (error: Error) => {
		console.error(`WebSocket error for ${connectionId}:`, error);
	});
}

/**
 * Handle incoming messages
 */
async function handleMessage(connectionId: string, message: AnyWebSocketMessage) {
	const connection = connections.get(connectionId);
	if (!connection) return;

	try {
		switch ((message as any).type) {
			case 'terminal_create':
				await handleTerminalCreate(connectionId, message as TerminalMessage);
				break;

			case 'terminal_input':
				await handleTerminalInput(connectionId, message as TerminalMessage);
				break;

			case 'terminal_resize':
				await handleTerminalResize(connectionId, message as TerminalMessage);
				break;

			case 'watch_filesystem':
				await handleFileSystemWatch(connectionId, message as FileSystemMessage);
				break;

			case 'unwatch_filesystem':
				await handleFileSystemUnwatch(connectionId, message as FileSystemMessage);
				break;

			case 'subscribe_status':
				await handleStatusSubscription(connectionId, message as StatusMessage);
				break;

			case 'user_joined':
				await handleUserJoined(connectionId, message as CollaborationMessage);
				break;

			case 'user_left':
				await handleUserLeft(connectionId, message as CollaborationMessage);
				break;

			case 'cursor_position':
				await handleCursorPosition(connectionId, message as CollaborationMessage);
				break;

			case 'terminal_proxy_start':
				await handleTerminalProxyStart(connectionId, message);
				break;

			case 'terminal_proxy_input':
				await handleTerminalProxyInput(connectionId, message);
				break;

			case 'terminal_proxy_close':
				await handleTerminalProxyClose(connectionId, message);
				break;

			default:
				console.warn(`Unknown message type: ${message.type}`);
		}
	} catch (error) {
		console.error(`Error handling message ${message.type}:`, error);

		// Send error response
		connection.ws.send(
			JSON.stringify({
				type: 'error',
				data: {
					originalType: message.type,
					error: error instanceof Error ? error.message : 'Unknown error'
				},
				timestamp: Date.now()
			})
		);
	}
}

/**
 * Handle terminal creation
 */
async function handleTerminalCreate(connectionId: string, message: TerminalMessage) {
	const { sandboxId, shell = '/bin/bash', workingDir = '/', dimensions } = message.data;

	if (!sandboxId) {
		throw new Error('Sandbox ID is required for terminal creation');
	}

	const terminalId = `terminal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

	// In a real implementation, you would:
	// 1. Spawn a new terminal process using pty
	// 2. Set up proper process management
	// 3. Handle stdout/stderr streams

	// For now, simulate terminal creation
	terminalSessions.set(terminalId, {
		sandboxId,
		connections: new Set([connectionId])
	});

	// Send terminal created response
	const connection = connections.get(connectionId);
	if (connection) {
		connection.ws.send(
			JSON.stringify({
				type: 'terminal_created',
				data: {
					terminalId,
					sandboxId,
					shell,
					workingDir
				},
				timestamp: Date.now()
			})
		);
	}
}

/**
 * Handle terminal input
 */
async function handleTerminalInput(connectionId: string, message: TerminalMessage) {
	const { terminalId, content } = message.data;

	if (!terminalId || !content) {
		throw new Error('Terminal ID and content are required');
	}

	const session = terminalSessions.get(terminalId);
	if (!session) {
		throw new Error('Terminal session not found');
	}

	// In a real implementation, you would write to the terminal process
	// For now, simulate command execution

	// Echo the input back as output (simulation)
	broadcastToTerminal(terminalId, {
		type: 'terminal_output',
		data: {
			terminalId,
			content: `$ ${content}\n`
		},
		timestamp: Date.now()
	});

	// Simulate command result
	setTimeout(() => {
		const output = simulateCommandExecution(content);
		broadcastToTerminal(terminalId, {
			type: 'terminal_output',
			data: {
				terminalId,
				content: output
			},
			timestamp: Date.now()
		});
	}, 100);
}

/**
 * Handle terminal resize
 */
async function handleTerminalResize(connectionId: string, message: TerminalMessage) {
	const { terminalId, dimensions } = message.data;

	if (!terminalId || !dimensions) {
		throw new Error('Terminal ID and dimensions are required');
	}

	// In a real implementation, you would resize the pty
	console.log(`Resizing terminal ${terminalId} to ${dimensions.cols}x${dimensions.rows}`);
}

/**
 * Handle file system watching
 */
async function handleFileSystemWatch(connectionId: string, message: FileSystemMessage) {
	const { sandboxId, path } = message.data;
	const watchKey = `${sandboxId}:${path}`;

	let watcher = fileWatchers.get(watchKey);
	if (!watcher) {
		watcher = {
			sandboxId,
			path,
			connections: new Set()
		};

		// In a real implementation, you would set up fs.watch or chokidar
		// watcher.watcher = fs.watch(actualPath, (eventType, filename) => {
		//   broadcastFileChange(sandboxId, path, eventType, filename);
		// });

		fileWatchers.set(watchKey, watcher);
	}

	watcher.connections.add(connectionId);
}

/**
 * Handle file system unwatch
 */
async function handleFileSystemUnwatch(connectionId: string, message: FileSystemMessage) {
	const { sandboxId, path } = message.data;
	const watchKey = `${sandboxId}:${path}`;

	const watcher = fileWatchers.get(watchKey);
	if (watcher) {
		watcher.connections.delete(connectionId);

		if (watcher.connections.size === 0) {
			// Close watcher if no more connections
			if (watcher.watcher) {
				watcher.watcher.close();
			}
			fileWatchers.delete(watchKey);
		}
	}
}

/**
 * Handle status subscription
 */
async function handleStatusSubscription(connectionId: string, message: StatusMessage) {
	const { sandboxId } = message.data;
	const connection = connections.get(connectionId);

	if (connection) {
		connection.sandboxId = sandboxId;
		connection.subscriptions.add('status');

		// Start sending periodic status updates
		// In a real implementation, you would set up proper monitoring
	}
}

/**
 * Handle user joined collaboration
 */
async function handleUserJoined(connectionId: string, message: CollaborationMessage) {
	const { userId, username, sandboxId } = message.data;
	const connection = connections.get(connectionId);

	if (connection) {
		connection.userId = userId;
		connection.sandboxId = sandboxId;

		// Broadcast to other users in the same sandbox
		broadcastToSandbox(
			sandboxId,
			{
				type: 'user_joined',
				data: { userId, username, sandboxId },
				timestamp: Date.now()
			},
			connectionId
		);
	}
}

/**
 * Handle user left collaboration
 */
async function handleUserLeft(connectionId: string, message: CollaborationMessage) {
	const { userId, sandboxId } = message.data;

	// Broadcast to other users in the same sandbox
	broadcastToSandbox(
		sandboxId,
		{
			type: 'user_left',
			data: { userId, username: '', sandboxId },
			timestamp: Date.now()
		},
		connectionId
	);
}

/**
 * Handle cursor position updates
 */
async function handleCursorPosition(connectionId: string, message: CollaborationMessage) {
	const { sandboxId } = message.data;

	// Broadcast cursor position to other users in the same sandbox
	broadcastToSandbox(sandboxId, message, connectionId);
}

/**
 * Handle connection disconnection
 */
function handleDisconnection(connectionId: string) {
	console.log(`WebSocket disconnected: ${connectionId}`);

	const connection = connections.get(connectionId);
	if (connection) {
		// Clean up terminal sessions
		for (const [terminalId, session] of terminalSessions.entries()) {
			session.connections.delete(connectionId);
			if (session.connections.size === 0) {
				// Close terminal session if no more connections
				terminalSessions.delete(terminalId);
			}
		}

		// Clean up file watchers
		for (const [watchKey, watcher] of fileWatchers.entries()) {
			watcher.connections.delete(connectionId);
			if (watcher.connections.size === 0) {
				if (watcher.watcher) {
					watcher.watcher.close();
				}
				fileWatchers.delete(watchKey);
			}
		}

		// Broadcast user left if they were in a sandbox
		if (connection.sandboxId && connection.userId) {
			broadcastToSandbox(
				connection.sandboxId,
				{
					type: 'user_left',
					data: {
						userId: connection.userId,
						username: '',
						sandboxId: connection.sandboxId
					},
					timestamp: Date.now()
				},
				connectionId
			);
		}
	}

	connections.delete(connectionId);
}

/**
 * Broadcast message to terminal connections
 */
function broadcastToTerminal(terminalId: string, message: any) {
	const session = terminalSessions.get(terminalId);
	if (session) {
		for (const connectionId of session.connections) {
			const connection = connections.get(connectionId);
			if (connection) {
				connection.ws.send(JSON.stringify(message));
			}
		}
	}
}

/**
 * Broadcast message to sandbox connections
 */
function broadcastToSandbox(sandboxId: string, message: any, excludeConnection?: string) {
	for (const [connectionId, connection] of connections.entries()) {
		if (connection.sandboxId === sandboxId && connectionId !== excludeConnection) {
			connection.ws.send(JSON.stringify(message));
		}
	}
}

/**
 * Simulate command execution (for demonstration)
 */
function simulateCommandExecution(command: string): string {
	const cmd = command.trim();

	if (cmd === 'ls' || cmd === 'ls -la') {
		return 'file1.txt\nfile2.js\ndirectory1/\n';
	} else if (cmd === 'pwd') {
		return '/workspace\n';
	} else if (cmd.startsWith('echo ')) {
		return cmd.substring(5) + '\n';
	} else if (cmd === 'date') {
		return new Date().toString() + '\n';
	} else if (cmd === 'whoami') {
		return 'sandbox-user\n';
	} else {
		return `Command '${cmd}' not found\n`;
	}
}

async function handleTerminalProxyStart(connectionId: string, message: any) {
	const connection = connections.get(connectionId);
	if (!connection) throw new Error('Connection not found');

	const { sandboxId, preferredWsUrl, shell, dimensions, clientSessionId, providerSessionId } =
		message.data || {};

	if (!sandboxId) throw new Error('sandboxId is required to start proxy');

	// Authorization check: ensure the WebSocket connection is associated with the same sandbox
	if (connection.sandboxId && connection.sandboxId !== sandboxId) {
		throw new Error('Unauthorized to open terminal proxy for this sandbox');
	}

	// Ask the SandboxManager for the provider for this sandbox and create a provider-side session
	const { sandboxManager } = await import('$lib/services/sandbox/sandbox-manager');
	const provider = await sandboxManager.getProviderForSandbox(sandboxId);

	// Attempt to create/connect the provider terminal session
	const providerConnection = await provider.connectTerminal(sandboxId, {
		shell,
		rows: dimensions?.rows,
		cols: dimensions?.cols
	});

	// If provider returned an absolute wsUrl, open a ws client to the provider and proxy data
	const providerWsUrl = providerConnection?.wsUrl;
	const proxySessionId =
		providerConnection?.sessionId ||
		`proxy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

	// Create proxy session entry
	terminalProxySessions.set(proxySessionId, { sandboxId, clients: new Set([connectionId]) });

	if (providerWsUrl && providerWsUrl.startsWith('ws')) {
		// Open client to provider and pipe messages back to the requesting client(s)
		const providerClient = new WebSocketClient(providerWsUrl as string);
		terminalProxySessions.get(proxySessionId)!.providerWs = providerClient;

		providerClient.on('open', () => {
			// Notify the requesting client that proxy is ready
			const conn = connections.get(connectionId);
			conn?.ws.send(JSON.stringify({ type: 'terminal_proxy_ready', data: { proxySessionId } }));
		});

		providerClient.on('message', (data: Buffer | string) => {
			// Broadcast to all clients connected to this proxy session
			const session = terminalProxySessions.get(proxySessionId);
			if (!session) return;
			for (const clientId of session.clients) {
				const clientConn = connections.get(clientId);
				if (clientConn) {
					clientConn.ws.send(
						JSON.stringify({
							type: 'terminal_proxy_data',
							data: { proxySessionId, content: typeof data === 'string' ? data : data.toString() }
						})
					);
				}
			}
		});

		providerClient.on('error', (err) => {
			const session = terminalProxySessions.get(proxySessionId);
			if (session) {
				for (const clientId of session.clients) {
					const clientConn = connections.get(clientId);
					clientConn?.ws.send(
						JSON.stringify({
							type: 'terminal_proxy_error',
							data: { proxySessionId, error: String(err) }
						})
					);
				}
			}
		});

		providerClient.on('close', () => {
			const session = terminalProxySessions.get(proxySessionId);
			if (session) {
				for (const clientId of session.clients) {
					const clientConn = connections.get(clientId);
					clientConn?.ws.send(
						JSON.stringify({ type: 'terminal_proxy_closed', data: { proxySessionId } })
					);
				}
				terminalProxySessions.delete(proxySessionId);
			}
		});
	} else if (providerConnection?.sshConnection) {
		// Provider only supports SSH — inform client
		const conn = connections.get(connectionId);
		conn?.ws.send(
			JSON.stringify({
				type: 'terminal_proxy_ssh',
				data: {
					proxySessionId,
					ssh: providerConnection.sshConnection,
					publicUrl: providerConnection.publicUrl
				}
			})
		);
	} else {
		// No wsUrl and no ssh — indicate that only publicUrl may be available
		const conn = connections.get(connectionId);
		conn?.ws.send(
			JSON.stringify({
				type: 'terminal_proxy_error',
				data: { proxySessionId, error: 'Provider did not return a usable terminal URL' }
			})
		);
	}
}

async function handleTerminalProxyInput(connectionId: string, message: any) {
	const { proxySessionId, content } = message.data || {};
	if (!proxySessionId || typeof content !== 'string')
		throw new Error('proxySessionId and content required');

	const session = terminalProxySessions.get(proxySessionId);
	if (!session || !session.providerWs)
		throw new Error('Proxy session not found or provider not connected');

	// Write to provider
	try {
		session.providerWs.send(content);
	} catch (err) {
		const conn = connections.get(connectionId);
		conn?.ws.send(
			JSON.stringify({ type: 'terminal_proxy_error', data: { proxySessionId, error: String(err) } })
		);
	}
}

async function handleTerminalProxyClose(connectionId: string, message: any) {
	const { proxySessionId } = message.data || {};
	if (!proxySessionId) throw new Error('proxySessionId required');

	const session = terminalProxySessions.get(proxySessionId);
	if (session) {
		// Disconnect provider WS and notify clients
		if (session.providerWs) {
			try {
				session.providerWs.close();
			} catch (err) {
				// ignore
			}
		}
		for (const clientId of session.clients) {
			const clientConn = connections.get(clientId);
			clientConn?.ws.send(
				JSON.stringify({ type: 'terminal_proxy_closed', data: { proxySessionId } })
			);
		}
		terminalProxySessions.delete(proxySessionId);
	}
}

// Initialize the WebSocket server
initializeWebSocketServer();

// SvelteKit API handler for WebSocket upgrade
export const GET: RequestHandler = async ({ request }) => {
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

	// Generate unique connection ID
	const connectionId = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

	// Handle the new connection
	handleConnection(socket, connectionId);

	return response;
};
