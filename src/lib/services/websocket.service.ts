/**
 * WebSocket Service for Real-time Sandbox Features
 * Handles terminal sessions, file system watching, status updates, and collaborative features
 */

export interface WebSocketMessage {
	type: string;
	data: any;
	timestamp: number;
	sessionId?: string;
}

export interface TerminalMessage extends WebSocketMessage {
	type:
		| 'terminal_create'
		| 'terminal_input'
		| 'terminal_output'
		| 'terminal_resize'
		| 'terminal_disconnect';
	data: {
		terminalId?: string;
		sandboxId?: string;
		content?: string;
		dimensions?: { cols: number; rows: number };
		exitCode?: number;
		shell?: string;
		workingDir?: string;
	};
}

export interface FileSystemMessage extends WebSocketMessage {
	type:
		| 'file_created'
		| 'file_modified'
		| 'file_deleted'
		| 'directory_created'
		| 'directory_deleted'
		| 'watch_filesystem'
		| 'unwatch_filesystem'
		| 'file_changed';
	data: {
		sandboxId: string;
		path: string;
		content?: string;
		isDirectory: boolean;
		size?: number;
		lastModified?: string;
	};
}

export interface StatusMessage extends WebSocketMessage {
	type: 'sandbox_status' | 'sandbox_metrics' | 'sandbox_error' | 'subscribe_status';
	data: {
		sandboxId: string;
		status?: string;
		metrics?: any;
		error?: string;
		details?: any;
	};
}

export interface CollaborationMessage extends WebSocketMessage {
	type:
		| 'user_joined'
		| 'user_left'
		| 'cursor_position'
		| 'selection_changed'
		| 'file_lock'
		| 'file_unlock'
		| 'collaboration';
	data: {
		userId: string;
		username: string;
		sandboxId: string;
		filePath?: string;
		position?: { line: number; column: number };
		selection?: { start: any; end: any };
	};
}

export interface ConnectionMessage extends WebSocketMessage {
	type: 'connection_confirmed';
	data: {
		connectionId: string;
	};
}

export type AnyWebSocketMessage =
	| TerminalMessage
	| FileSystemMessage
	| StatusMessage
	| CollaborationMessage
	| ConnectionMessage;

export class WebSocketService {
	private ws: WebSocket | null = null;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectDelay = 1000;
	private isConnecting = false;
	private messageHandlers = new Map<string, Set<(message: AnyWebSocketMessage) => void>>();
	private connectionPromise: Promise<void> | null = null;

	// Connection state
	public isConnected = false;
	public connectionId: string | null = null;

	constructor(
		private baseUrl: string = typeof window !== 'undefined'
			? `ws://${window.location.host}/api/ws`
			: 'ws://localhost:5173/api/ws'
	) {}

	/**
	 * Connect to WebSocket server
	 */
	async connect(authToken?: string): Promise<void> {
		if (this.isConnecting || this.isConnected) {
			return this.connectionPromise || Promise.resolve();
		}

		this.isConnecting = true;
		this.connectionPromise = new Promise((resolve, reject) => {
			try {
				const url = authToken ? `${this.baseUrl}?token=${authToken}` : this.baseUrl;
				this.ws = new WebSocket(url);

				this.ws.onopen = () => {
					console.log('WebSocket connected');
					this.isConnected = true;
					this.isConnecting = false;
					this.reconnectAttempts = 0;
					resolve();
				};

				this.ws.onmessage = (event) => {
					this.handleMessage(event);
				};

				this.ws.onclose = (event) => {
					console.log('WebSocket disconnected:', event.code, event.reason);
					this.isConnected = false;
					this.isConnecting = false;
					this.connectionId = null;

					// Attempt reconnection for non-intentional closes
					if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
						this.scheduleReconnect();
					}
				};

				this.ws.onerror = (error) => {
					console.error('WebSocket error:', error);
					this.isConnecting = false;
					reject(error);
				};
			} catch (error) {
				this.isConnecting = false;
				reject(error);
			}
		});

		return this.connectionPromise;
	}

	/**
	 * Disconnect from WebSocket server
	 */
	disconnect(): void {
		if (this.ws) {
			this.ws.close(1000, 'Client disconnect');
			this.ws = null;
		}
		this.isConnected = false;
		this.connectionId = null;
		this.messageHandlers.clear();
	}

	/**
	 * Send message to server
	 */
	async send(message: Omit<AnyWebSocketMessage, 'timestamp'>): Promise<void> {
		if (!this.isConnected) {
			await this.connect();
		}

		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			const fullMessage: AnyWebSocketMessage = {
				...message,
				timestamp: Date.now()
			} as AnyWebSocketMessage;

			this.ws.send(JSON.stringify(fullMessage));
		} else {
			throw new Error('WebSocket not connected');
		}
	}

	/**
	 * Subscribe to specific message types
	 */
	subscribe(messageType: string, handler: (message: AnyWebSocketMessage) => void): () => void {
		if (!this.messageHandlers.has(messageType)) {
			this.messageHandlers.set(messageType, new Set());
		}

		this.messageHandlers.get(messageType)!.add(handler);

		// Return unsubscribe function
		return () => {
			const handlers = this.messageHandlers.get(messageType);
			if (handlers) {
				handlers.delete(handler);
				if (handlers.size === 0) {
					this.messageHandlers.delete(messageType);
				}
			}
		};
	}

	/**
	 * Handle incoming messages
	 */
	private handleMessage(event: MessageEvent): void {
		try {
			const message: AnyWebSocketMessage = JSON.parse(event.data);

			// Handle connection confirmation
			if (message.type === 'connection_confirmed') {
				this.connectionId = message.data.connectionId;
				return;
			}

			// Dispatch to registered handlers
			const handlers = this.messageHandlers.get(message.type);
			if (handlers) {
				handlers.forEach((handler) => {
					try {
						handler(message);
					} catch (error) {
						console.error('Error in message handler:', error);
					}
				});
			}
		} catch (error) {
			console.error('Error parsing WebSocket message:', error);
		}
	}

	/**
	 * Schedule reconnection attempt
	 */
	private scheduleReconnect(): void {
		this.reconnectAttempts++;
		const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

		console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

		setTimeout(() => {
			if (!this.isConnected) {
				this.connect().catch((error) => {
					console.error('Reconnection failed:', error);
				});
			}
		}, delay);
	}

	/**
	 * Terminal-specific methods
	 */
	async createTerminalSession(
		sandboxId: string,
		options: {
			shell?: string;
			workingDir?: string;
			dimensions?: { cols: number; rows: number };
		}
	): Promise<string> {
		const message: TerminalMessage = {
			type: 'terminal_create',
			data: {
				sandboxId,
				...options
			},
			timestamp: Date.now()
		} as TerminalMessage;

		await this.send(message);

		// In a real implementation, you'd wait for a response with the terminal ID
		return `terminal_${Date.now()}`;
	}

	async sendTerminalInput(terminalId: string, input: string): Promise<void> {
		const message: TerminalMessage = {
			type: 'terminal_input',
			data: {
				terminalId,
				content: input
			},
			timestamp: Date.now()
		};

		await this.send(message);
	}

	async resizeTerminal(
		terminalId: string,
		dimensions: { cols: number; rows: number }
	): Promise<void> {
		const message: TerminalMessage = {
			type: 'terminal_resize',
			data: {
				terminalId,
				dimensions
			},
			timestamp: Date.now()
		};

		await this.send(message);
	}

	subscribeToTerminal(terminalId: string, handler: (output: string) => void): () => void {
		return this.subscribe('terminal_output', (message: AnyWebSocketMessage) => {
			if (message.type === 'terminal_output') {
				const terminalMsg = message as TerminalMessage;
				if (terminalMsg.data.terminalId === terminalId && terminalMsg.data.content) {
					handler(terminalMsg.data.content);
				}
			}
		});
	}

	/**
	 * File system watching methods
	 */
	async watchFileSystem(sandboxId: string, path: string = '/'): Promise<void> {
		const message: FileSystemMessage = {
			type: 'watch_filesystem',
			data: {
				sandboxId,
				path,
				isDirectory: true
			},
			timestamp: Date.now()
		} as FileSystemMessage;

		await this.send(message);
	}

	async unwatchFileSystem(sandboxId: string, path: string = '/'): Promise<void> {
		const message: FileSystemMessage = {
			type: 'unwatch_filesystem',
			data: {
				sandboxId,
				path,
				isDirectory: true
			},
			timestamp: Date.now()
		} as FileSystemMessage;

		await this.send(message);
	}

	subscribeToFileChanges(
		sandboxId: string,
		handler: (change: FileSystemMessage) => void
	): () => void {
		return this.subscribe('file_changed', (message: AnyWebSocketMessage) => {
			if (message.type === 'file_changed') {
				const fileMsg = message as FileSystemMessage;
				if (fileMsg.data.sandboxId === sandboxId) {
					handler(fileMsg);
				}
			}
		});
	}

	/**
	 * Sandbox status monitoring
	 */
	async subscribeSandboxStatus(sandboxId: string): Promise<void> {
		const message: StatusMessage = {
			type: 'subscribe_status',
			data: {
				sandboxId
			},
			timestamp: Date.now()
		} as StatusMessage;

		await this.send(message);
	}

	subscribeToStatusUpdates(
		sandboxId: string,
		handler: (status: StatusMessage) => void
	): () => void {
		return this.subscribe('sandbox_status', (message: AnyWebSocketMessage) => {
			if (message.type === 'sandbox_status') {
				const statusMsg = message as StatusMessage;
				if (statusMsg.data.sandboxId === sandboxId) {
					handler(statusMsg);
				}
			}
		});
	}

	subscribeToMetricsUpdates(
		sandboxId: string,
		handler: (metrics: StatusMessage) => void
	): () => void {
		return this.subscribe('sandbox_metrics', (message: AnyWebSocketMessage) => {
			if (message.type === 'sandbox_metrics') {
				const metricsMsg = message as StatusMessage;
				if (metricsMsg.data.sandboxId === sandboxId) {
					handler(metricsMsg);
				}
			}
		});
	}

	/**
	 * Collaboration methods
	 */
	async joinSandbox(sandboxId: string, userId: string, username: string): Promise<void> {
		const message: CollaborationMessage = {
			type: 'user_joined',
			data: {
				userId,
				username,
				sandboxId
			},
			timestamp: Date.now()
		};

		await this.send(message);
	}

	async leaveSandbox(sandboxId: string, userId: string): Promise<void> {
		const message: CollaborationMessage = {
			type: 'user_left',
			data: {
				userId,
				username: '',
				sandboxId
			},
			timestamp: Date.now()
		};

		await this.send(message);
	}

	async updateCursorPosition(
		sandboxId: string,
		filePath: string,
		userId: string,
		username: string,
		position: { line: number; column: number }
	): Promise<void> {
		const message: CollaborationMessage = {
			type: 'cursor_position',
			data: {
				userId,
				username,
				sandboxId,
				filePath,
				position
			},
			timestamp: Date.now()
		};

		await this.send(message);
	}

	subscribeToCollaboration(
		sandboxId: string,
		handler: (message: CollaborationMessage) => void
	): () => void {
		return this.subscribe('collaboration', (message: AnyWebSocketMessage) => {
			if (
				message.type === 'collaboration' ||
				message.type === 'user_joined' ||
				message.type === 'user_left' ||
				message.type === 'cursor_position' ||
				message.type === 'selection_changed' ||
				message.type === 'file_lock' ||
				message.type === 'file_unlock'
			) {
				const collabMsg = message as CollaborationMessage;
				if (collabMsg.data.sandboxId === sandboxId) {
					handler(collabMsg);
				}
			}
		});
	}
}

// Singleton instance
export const webSocketService = new WebSocketService();
