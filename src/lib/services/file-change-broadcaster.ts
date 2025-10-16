/**
 * File Change Broadcaster Service
 * Broadcasts file change events to all connected clients via SSE
 */

export interface FileChangeEvent {
	type: 'created' | 'modified' | 'deleted' | 'renamed';
	path: string;
	content?: string;
	newPath?: string;
	timestamp: number;
	projectId?: string;
	sandboxId?: string;
	userId?: string;
	metadata?: Record<string, any>;
}

interface ClientConnection {
	id: string;
	controller: ReadableStreamDefaultController;
	projectId?: string;
	sandboxId?: string;
	userId?: string;
	connectedAt: number;
}

class FileChangeBroadcaster {
	private static instance: FileChangeBroadcaster;
	private clients: Map<string, ClientConnection> = new Map();
	private eventQueue: FileChangeEvent[] = [];
	private readonly maxQueueSize = 100;

	private constructor() {}

	static getInstance(): FileChangeBroadcaster {
		if (!FileChangeBroadcaster.instance) {
			FileChangeBroadcaster.instance = new FileChangeBroadcaster();
		}
		return FileChangeBroadcaster.instance;
	}

	/**
	 * Register a new client connection
	 */
	registerClient(
		clientId: string,
		controller: ReadableStreamDefaultController,
		options?: { projectId?: string; sandboxId?: string; userId?: string }
	): void {
		this.clients.set(clientId, {
			id: clientId,
			controller,
			projectId: options?.projectId,
			sandboxId: options?.sandboxId,
			userId: options?.userId,
			connectedAt: Date.now()
		});

		console.log(`📡 Client ${clientId} registered for file change notifications`, {
			totalClients: this.clients.size,
			projectId: options?.projectId,
			sandboxId: options?.sandboxId
		});

		// Send recent events to the new client
		this.sendRecentEvents(clientId);
	}

	/**
	 * Unregister a client connection
	 */
	unregisterClient(clientId: string): void {
		if (this.clients.delete(clientId)) {
			console.log(`📡 Client ${clientId} unregistered`, {
				remainingClients: this.clients.size
			});
		}
	}

	/**
	 * Broadcast a file change event to all relevant clients
	 */
	broadcast(event: FileChangeEvent): void {
		// Add to queue for new clients
		this.eventQueue.push(event);
		if (this.eventQueue.length > this.maxQueueSize) {
			this.eventQueue.shift(); // Remove oldest event
		}

		const eventData = `data: ${JSON.stringify(event)}\n\n`;
		const encoder = new TextEncoder();

		let successCount = 0;
		let failureCount = 0;

		for (const [clientId, client] of this.clients.entries()) {
			// Filter: only send to clients watching the same project/sandbox
			if (event.projectId && client.projectId && event.projectId !== client.projectId) {
				continue;
			}
			if (event.sandboxId && client.sandboxId && event.sandboxId !== client.sandboxId) {
				continue;
			}

			try {
				client.controller.enqueue(encoder.encode(eventData));
				successCount++;
			} catch (error) {
				console.error(`Failed to send event to client ${clientId}:`, error);
				this.unregisterClient(clientId);
				failureCount++;
			}
		}

		console.log(
			`📡 Broadcasted file change: ${event.type} ${event.path} (${successCount} clients, ${failureCount} failures)`
		);
	}

	/**
	 * Send recent events to a specific client
	 */
	private sendRecentEvents(clientId: string): void {
		const client = this.clients.get(clientId);
		if (!client) return;

		const encoder = new TextEncoder();
		const relevantEvents = this.eventQueue.filter((event) => {
			if (event.projectId && client.projectId && event.projectId !== client.projectId) return false;
			if (event.sandboxId && client.sandboxId && event.sandboxId !== client.sandboxId) return false;
			return true;
		});

		for (const event of relevantEvents) {
			try {
				const eventData = `data: ${JSON.stringify(event)}\n\n`;
				client.controller.enqueue(encoder.encode(eventData));
			} catch (error) {
				console.error(`Failed to send recent event to client ${clientId}:`, error);
				break;
			}
		}
	}

	/**
	 * Get statistics about connected clients
	 */
	getStats(): {
		totalClients: number;
		queueSize: number;
		clientsByProject: Record<string, number>;
	} {
		const clientsByProject: Record<string, number> = {};

		for (const client of this.clients.values()) {
			const key = client.projectId || 'unknown';
			clientsByProject[key] = (clientsByProject[key] || 0) + 1;
		}

		return {
			totalClients: this.clients.size,
			queueSize: this.eventQueue.length,
			clientsByProject
		};
	}

	/**
	 * Clear event queue
	 */
	clearQueue(): void {
		this.eventQueue = [];
	}
}

export const fileChangeBroadcaster = FileChangeBroadcaster.getInstance();
