/**
 * File Watcher Client Service
 * Connects to the file watch SSE endpoint and handles real-time file changes
 */

import { browser } from '$app/environment';

export interface FileChangeEvent {
	type: 'created' | 'modified' | 'deleted' | 'renamed' | 'connected' | 'heartbeat';
	path: string;
	content?: string;
	newPath?: string;
	timestamp: number;
	projectId?: string;
	sandboxId?: string;
	userId?: string;
	metadata?: Record<string, any>;
}

export type FileChangeHandler = (event: FileChangeEvent) => void;

interface WatchOptions {
	projectId?: string;
	sandboxId?: string;
	reconnect?: boolean;
	reconnectDelay?: number;
	maxReconnectAttempts?: number;
}

class FileWatcherService {
	private static instance: FileWatcherService;
	private eventSource: EventSource | null = null;
	private handlers: Set<FileChangeHandler> = new Set();
	private options: WatchOptions = {};
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 10;
	private reconnectDelay = 3000;
	private isConnecting = false;
	private isConnected = false;

	private constructor() {}

	static getInstance(): FileWatcherService {
		if (!FileWatcherService.instance) {
			FileWatcherService.instance = new FileWatcherService();
		}
		return FileWatcherService.instance;
	}

	/**
	 * Start watching for file changes
	 */
	watch(options: WatchOptions = {}): void {
		if (!browser) {
			console.warn('File watcher can only run in browser');
			return;
		}

		if (this.isConnecting || this.isConnected) {
			console.log('File watcher already active');
			return;
		}

		this.options = {
			reconnect: true,
			reconnectDelay: 3000,
			maxReconnectAttempts: 10,
			...options
		};

		this.maxReconnectAttempts = this.options.maxReconnectAttempts!;
		this.reconnectDelay = this.options.reconnectDelay!;

		this.connect();
	}

	/**
	 * Stop watching for file changes
	 */
	unwatch(): void {
		if (this.eventSource) {
			this.eventSource.close();
			this.eventSource = null;
		}
		this.isConnecting = false;
		this.isConnected = false;
		this.reconnectAttempts = 0;
		console.log('📡 File watcher disconnected');
	}

	/**
	 * Subscribe to file change events
	 */
	subscribe(handler: FileChangeHandler): () => void {
		this.handlers.add(handler);
		console.log(`📡 Subscribed to file changes (${this.handlers.size} handlers)`);

		// Return unsubscribe function
		return () => {
			this.handlers.delete(handler);
			console.log(`📡 Unsubscribed from file changes (${this.handlers.size} handlers remaining)`);
		};
	}

	/**
	 * Get connection status
	 */
	getStatus(): {
		isConnected: boolean;
		isConnecting: boolean;
		reconnectAttempts: number;
		handlers: number;
	} {
		return {
			isConnected: this.isConnected,
			isConnecting: this.isConnecting,
			reconnectAttempts: this.reconnectAttempts,
			handlers: this.handlers.size
		};
	}

	/**
	 * Connect to SSE endpoint
	 */
	private connect(): void {
		if (!browser) return;

		this.isConnecting = true;

		// Build URL with query parameters
		const params = new URLSearchParams();
		if (this.options.projectId) params.set('projectId', this.options.projectId);
		if (this.options.sandboxId) params.set('sandboxId', this.options.sandboxId);

		const url = `/api/files/watch?${params.toString()}`;

		console.log(`📡 Connecting to file watcher SSE: ${url}`);

		try {
			this.eventSource = new EventSource(url);

			this.eventSource.onopen = () => {
				console.log('📡 File watcher SSE connection opened');
				this.isConnecting = false;
				this.isConnected = true;
				this.reconnectAttempts = 0;
			};

			this.eventSource.onmessage = (event) => {
				try {
					const data: FileChangeEvent = JSON.parse(event.data);

					// Skip heartbeat messages
					if (data.type === 'heartbeat') {
						return;
					}

					// Log connection message
					if (data.type === 'connected') {
						console.log('📡 File watcher connected:', data);
						return;
					}

					// Notify all handlers
					this.notifyHandlers(data);
				} catch (error) {
					console.error('Failed to parse file change event:', error);
				}
			};

			this.eventSource.onerror = (error) => {
				console.error('📡 File watcher SSE error:', error);
				this.isConnected = false;
				this.isConnecting = false;

				if (this.eventSource) {
					this.eventSource.close();
					this.eventSource = null;
				}

				// Attempt reconnection
				if (this.options.reconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
					this.reconnectAttempts++;
					console.log(
						`📡 Reconnecting file watcher (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
					);
					setTimeout(() => this.connect(), this.reconnectDelay);
				} else {
					console.error('📡 File watcher max reconnection attempts reached');
				}
			};
		} catch (error) {
			console.error('Failed to create EventSource:', error);
			this.isConnecting = false;
			this.isConnected = false;
		}
	}

	/**
	 * Notify all registered handlers of a file change event
	 */
	private notifyHandlers(event: FileChangeEvent): void {
		console.log(`📡 File change event received: ${event.type} ${event.path}`);

		for (const handler of this.handlers) {
			try {
				handler(event);
			} catch (error) {
				console.error('Error in file change handler:', error);
			}
		}
	}
}

// Export singleton instance
export const fileWatcher = FileWatcherService.getInstance();

// Export convenience function
export function watchFiles(handler: FileChangeHandler, options: WatchOptions = {}): () => void {
	fileWatcher.watch(options);
	return fileWatcher.subscribe(handler);
}
