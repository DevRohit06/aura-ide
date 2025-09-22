/**
 * WebSocket Integration Hook for Svelte Components
 * Provides reactive WebSocket functionality with automatic cleanup
 */

import { webSocketService, type AnyWebSocketMessage } from '$lib/services/websocket.service';
import { onDestroy } from 'svelte';
import { writable, type Writable } from 'svelte/store';

export interface WebSocketState {
	connected: boolean;
	connecting: boolean;
	error: string | null;
	lastMessage: AnyWebSocketMessage | null;
	connectionId: string | null;
}

/**
 * Main WebSocket hook for general usage
 */
export function useWebSocket() {
	const state: Writable<WebSocketState> = writable({
		connected: false,
		connecting: false,
		error: null,
		lastMessage: null,
		connectionId: null
	});

	let unsubscribers: (() => void)[] = [];

	/**
	 * Connect to WebSocket server
	 */
	async function connect(authToken?: string) {
		state.update((s) => ({ ...s, connecting: true, error: null }));

		try {
			await webSocketService.connect(authToken);
			state.update((s) => ({
				...s,
				connected: true,
				connecting: false,
				connectionId: webSocketService.connectionId
			}));
		} catch (error) {
			state.update((s) => ({
				...s,
				connected: false,
				connecting: false,
				error: error instanceof Error ? error.message : 'Connection failed'
			}));
		}
	}

	/**
	 * Disconnect from WebSocket server
	 */
	function disconnect() {
		webSocketService.disconnect();
		state.update((s) => ({
			...s,
			connected: false,
			connecting: false,
			connectionId: null
		}));
	}

	/**
	 * Send message to WebSocket server
	 */
	async function send(message: Omit<AnyWebSocketMessage, 'timestamp'>) {
		try {
			await webSocketService.send(message);
		} catch (error) {
			state.update((s) => ({
				...s,
				error: error instanceof Error ? error.message : 'Send failed'
			}));
		}
	}

	/**
	 * Subscribe to specific message types
	 */
	function subscribe(messageType: string, handler: (message: AnyWebSocketMessage) => void) {
		const unsubscribe = webSocketService.subscribe(messageType, handler);
		unsubscribers.push(unsubscribe);
		return unsubscribe;
	}

	// Auto-cleanup on destroy
	onDestroy(() => {
		unsubscribers.forEach((unsub) => unsub());
		unsubscribers = [];
	});

	return {
		state,
		connect,
		disconnect,
		send,
		subscribe
	};
}

/**
 * Terminal-specific WebSocket hook
 */
export function useTerminalWebSocket() {
	const { state, connect, disconnect, send, subscribe } = useWebSocket();

	const terminalState = writable({
		sessions: new Map<string, { id: string; name: string; active: boolean }>(),
		activeSession: null as string | null,
		output: new Map<string, string[]>()
	});

	/**
	 * Create a new terminal session
	 */
	async function createTerminalSession(
		sandboxId: string,
		options: {
			shell?: string;
			workingDir?: string;
			dimensions?: { cols: number; rows: number };
		} = {}
	) {
		const terminalId = await webSocketService.createTerminalSession(sandboxId, options);

		terminalState.update((state) => {
			const newSessions = new Map(state.sessions);
			newSessions.set(terminalId, {
				id: terminalId,
				name: `Terminal ${newSessions.size + 1}`,
				active: true
			});

			return {
				...state,
				sessions: newSessions,
				activeSession: terminalId
			};
		});

		return terminalId;
	}

	/**
	 * Send input to terminal
	 */
	async function sendTerminalInput(terminalId: string, input: string) {
		await webSocketService.sendTerminalInput(terminalId, input);
	}

	/**
	 * Subscribe to terminal output
	 */
	function subscribeToTerminal(terminalId: string) {
		return webSocketService.subscribeToTerminal(terminalId, (output: string) => {
			terminalState.update((state) => {
				const newOutput = new Map(state.output);
				const existing = newOutput.get(terminalId) || [];
				newOutput.set(terminalId, [...existing, output]);

				return {
					...state,
					output: newOutput
				};
			});
		});
	}

	/**
	 * Resize terminal
	 */
	async function resizeTerminal(terminalId: string, dimensions: { cols: number; rows: number }) {
		await webSocketService.resizeTerminal(terminalId, dimensions);
	}

	return {
		state,
		terminalState,
		connect,
		disconnect,
		createTerminalSession,
		sendTerminalInput,
		subscribeToTerminal,
		resizeTerminal
	};
}

/**
 * File system watching WebSocket hook
 */
export function useFileSystemWebSocket() {
	const { state, connect, disconnect, send, subscribe } = useWebSocket();

	const fileSystemState = writable({
		watchedPaths: new Set<string>(),
		changes: [] as Array<{
			path: string;
			type: string;
			timestamp: Date;
			content?: string;
		}>
	});

	/**
	 * Watch file system changes
	 */
	async function watchFileSystem(sandboxId: string, path: string = '/') {
		await webSocketService.watchFileSystem(sandboxId, path);

		fileSystemState.update((state) => ({
			...state,
			watchedPaths: new Set([...state.watchedPaths, `${sandboxId}:${path}`])
		}));
	}

	/**
	 * Stop watching file system
	 */
	async function unwatchFileSystem(sandboxId: string, path: string = '/') {
		await webSocketService.unwatchFileSystem(sandboxId, path);

		fileSystemState.update((state) => {
			const newWatched = new Set(state.watchedPaths);
			newWatched.delete(`${sandboxId}:${path}`);
			return {
				...state,
				watchedPaths: newWatched
			};
		});
	}

	/**
	 * Subscribe to file changes
	 */
	function subscribeToFileChanges(sandboxId: string) {
		return webSocketService.subscribeToFileChanges(sandboxId, (change) => {
			fileSystemState.update((state) => ({
				...state,
				changes: [
					...state.changes,
					{
						path: change.data.path,
						type: change.type,
						timestamp: new Date(change.timestamp),
						content: change.data.content
					}
				].slice(-100) // Keep last 100 changes
			}));
		});
	}

	return {
		state,
		fileSystemState,
		connect,
		disconnect,
		watchFileSystem,
		unwatchFileSystem,
		subscribeToFileChanges
	};
}

/**
 * Collaboration WebSocket hook
 */
export function useCollaborationWebSocket() {
	const { state, connect, disconnect, send, subscribe } = useWebSocket();

	const collaborationState = writable({
		users: new Map<
			string,
			{
				id: string;
				username: string;
				cursor?: { line: number; column: number };
				selection?: any;
				filePath?: string;
			}
		>(),
		lockedFiles: new Set<string>()
	});

	/**
	 * Join sandbox collaboration
	 */
	async function joinSandbox(sandboxId: string, userId: string, username: string) {
		await webSocketService.joinSandbox(sandboxId, userId, username);
	}

	/**
	 * Leave sandbox collaboration
	 */
	async function leaveSandbox(sandboxId: string, userId: string) {
		await webSocketService.leaveSandbox(sandboxId, userId);
	}

	/**
	 * Update cursor position
	 */
	async function updateCursorPosition(
		sandboxId: string,
		filePath: string,
		userId: string,
		username: string,
		position: { line: number; column: number }
	) {
		await webSocketService.updateCursorPosition(sandboxId, filePath, userId, username, position);
	}

	/**
	 * Subscribe to collaboration events
	 */
	function subscribeToCollaboration(sandboxId: string) {
		return webSocketService.subscribeToCollaboration(sandboxId, (message) => {
			collaborationState.update((state) => {
				const newUsers = new Map(state.users);

				switch (message.type) {
					case 'user_joined':
						newUsers.set(message.data.userId, {
							id: message.data.userId,
							username: message.data.username
						});
						break;

					case 'user_left':
						newUsers.delete(message.data.userId);
						break;

					case 'cursor_position':
						const existingUser = newUsers.get(message.data.userId);
						if (existingUser) {
							newUsers.set(message.data.userId, {
								...existingUser,
								cursor: message.data.position,
								filePath: message.data.filePath
							});
						}
						break;
				}

				return {
					...state,
					users: newUsers
				};
			});
		});
	}

	return {
		state,
		collaborationState,
		connect,
		disconnect,
		joinSandbox,
		leaveSandbox,
		updateCursorPosition,
		subscribeToCollaboration
	};
}

/**
 * Status monitoring WebSocket hook
 */
export function useStatusWebSocket() {
	const { state, connect, disconnect, send, subscribe } = useWebSocket();

	const statusState = writable({
		sandboxStatuses: new Map<string, string>(),
		metrics: new Map<string, any>(),
		errors: new Map<string, string>()
	});

	/**
	 * Subscribe to sandbox status
	 */
	async function subscribeSandboxStatus(sandboxId: string) {
		await webSocketService.subscribeSandboxStatus(sandboxId);
	}

	/**
	 * Subscribe to status updates
	 */
	function subscribeToStatusUpdates(sandboxId: string) {
		return webSocketService.subscribeToStatusUpdates(sandboxId, (status) => {
			statusState.update((state) => {
				const newStatuses = new Map(state.sandboxStatuses);
				newStatuses.set(sandboxId, status.data.status || 'unknown');

				return {
					...state,
					sandboxStatuses: newStatuses
				};
			});
		});
	}

	/**
	 * Subscribe to metrics updates
	 */
	function subscribeToMetricsUpdates(sandboxId: string) {
		return webSocketService.subscribeToMetricsUpdates(sandboxId, (metrics) => {
			statusState.update((state) => {
				const newMetrics = new Map(state.metrics);
				newMetrics.set(sandboxId, metrics.data.metrics);

				return {
					...state,
					metrics: newMetrics
				};
			});
		});
	}

	return {
		state,
		statusState,
		connect,
		disconnect,
		subscribeSandboxStatus,
		subscribeToStatusUpdates,
		subscribeToMetricsUpdates
	};
}
