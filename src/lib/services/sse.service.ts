/**
 * Server-Sent Events (SSE) Service
 * Handles real-time streaming communication with the server
 */

export interface SSEEvent {
	type: 'start' | 'thinking' | 'tool_call' | 'tool_result' | 'content' | 'complete' | 'error';
	data: any;
	timestamp: number;
}

export interface SSEOptions {
	autoReconnect?: boolean;
	maxRetries?: number;
	retryDelay?: number;
	timeout?: number;
}

export class SSEService {
	private eventSource: EventSource | null = null;
	private eventHandlers = new Map<string, Set<(event: SSEEvent) => void>>();
	private reconnectAttempts = 0;
	private isConnected = false;
	private options: Required<SSEOptions>;

	constructor(options: SSEOptions = {}) {
		this.options = {
			autoReconnect: true,
			maxRetries: 3,
			retryDelay: 1000,
			timeout: 30000,
			...options
		};
	}

	/**
	 * Connect to SSE endpoint
	 */
	connect(url: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (this.eventSource) {
				this.disconnect();
			}

			try {
				this.eventSource = new EventSource(url);

				this.eventSource.onopen = () => {
					console.log('SSE connected to:', url);
					this.isConnected = true;
					this.reconnectAttempts = 0;
					resolve();
				};

				this.eventSource.onmessage = (event) => {
					try {
						const sseEvent: SSEEvent = JSON.parse(event.data);
						this.handleEvent(sseEvent);
					} catch (error) {
						console.error('Failed to parse SSE event:', error);
					}
				};

				this.eventSource.onerror = (error) => {
					console.error('SSE error:', error);
					this.isConnected = false;

					if (this.options.autoReconnect && this.reconnectAttempts < this.options.maxRetries) {
						this.scheduleReconnect(url);
					} else {
						reject(new Error('SSE connection failed'));
					}
				};

				// Set connection timeout
				setTimeout(() => {
					if (!this.isConnected) {
						reject(new Error('SSE connection timeout'));
					}
				}, this.options.timeout);
			} catch (error) {
				reject(error);
			}
		});
	}

	/**
	 * Disconnect from SSE
	 */
	disconnect(): void {
		if (this.eventSource) {
			this.eventSource.close();
			this.eventSource = null;
			this.isConnected = false;
		}
	}

	/**
	 * Subscribe to specific event types
	 */
	subscribe(eventType: string, handler: (event: SSEEvent) => void): () => void {
		if (!this.eventHandlers.has(eventType)) {
			this.eventHandlers.set(eventType, new Set());
		}

		this.eventHandlers.get(eventType)!.add(handler);

		// Return unsubscribe function
		return () => {
			const handlers = this.eventHandlers.get(eventType);
			if (handlers) {
				handlers.delete(handler);
				if (handlers.size === 0) {
					this.eventHandlers.delete(eventType);
				}
			}
		};
	}

	/**
	 * Subscribe to all events
	 */
	subscribeAll(handler: (event: SSEEvent) => void): () => void {
		return this.subscribe('*', handler);
	}

	/**
	 * Stream a message and listen for responses
	 */
	async streamMessage(data: any): Promise<void> {
		// Send the message to trigger the stream
		const response = await fetch('/api/agent/stream', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(data)
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		// The response itself is the SSE stream
		const reader = response.body?.getReader();
		const decoder = new TextDecoder();

		if (!reader) {
			throw new Error('No response body available');
		}

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value);
				const lines = chunk.split('\n');

				for (const line of lines) {
					if (line.startsWith('data: ')) {
						try {
							const eventData = line.slice(6); // Remove 'data: ' prefix
							if (eventData.trim()) {
								const event: SSEEvent = JSON.parse(eventData);
								this.handleEvent(event);
							}
						} catch (error) {
							console.error('Failed to parse SSE event:', error);
						}
					}
				}
			}
		} finally {
			reader.releaseLock();
		}
	}

	/**
	 * Get connection status
	 */
	getStatus(): { connected: boolean; attempts: number } {
		return {
			connected: this.isConnected,
			attempts: this.reconnectAttempts
		};
	}

	/**
	 * Handle incoming SSE events
	 */
	private handleEvent(event: SSEEvent): void {
		// Emit to specific event type handlers
		const typeHandlers = this.eventHandlers.get(event.type);
		if (typeHandlers) {
			typeHandlers.forEach((handler) => {
				try {
					handler(event);
				} catch (error) {
					console.error('Error in SSE event handler:', error);
				}
			});
		}

		// Emit to wildcard handlers
		const allHandlers = this.eventHandlers.get('*');
		if (allHandlers) {
			allHandlers.forEach((handler) => {
				try {
					handler(event);
				} catch (error) {
					console.error('Error in SSE wildcard handler:', error);
				}
			});
		}
	}

	/**
	 * Schedule reconnection attempt
	 */
	private scheduleReconnect(url: string): void {
		this.reconnectAttempts++;
		const delay = this.options.retryDelay * Math.pow(2, this.reconnectAttempts - 1);

		console.log(`Scheduling SSE reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

		setTimeout(() => {
			this.connect(url).catch(console.error);
		}, delay);
	}
}

// Export singleton instance
export const sseService = new SSEService();
