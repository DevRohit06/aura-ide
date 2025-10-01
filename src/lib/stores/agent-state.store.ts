/**
 * Agent State Store
 * Manages the current state of AI agent interactions
 */

import { derived, writable } from 'svelte/store';

export type AgentStatus =
	| 'idle' // Agent is ready to receive new messages
	| 'thinking' // Agent is processing the request
	| 'executing' // Agent is executing tool calls
	| 'waiting_approval' // Agent is waiting for human approval
	| 'error' // Agent encountered an error
	| 'connected' // Agent is connected and ready
	| 'disconnected'; // Agent is not connected

export interface AgentState {
	status: AgentStatus;
	currentOperation?: string;
	progress?: number;
	toolsExecuting: Array<{
		name: string;
		id: string;
		startTime: number;
	}>;
	lastActivity: Date;
	activeThreadId?: string;
	errorMessage?: string;
}

export interface AgentMessage {
	id: string;
	threadId: string;
	status: 'pending' | 'sending' | 'sent' | 'error';
	content: string;
	timestamp: Date;
	error?: string;
}

// Core agent state
export const agentState = writable<AgentState>({
	status: 'disconnected',
	lastActivity: new Date(),
	toolsExecuting: []
});

// Pending messages queue
export const pendingMessages = writable<Map<string, AgentMessage>>(new Map());

// SSE connection state for agent communication
export const connectionState = writable<{
	connected: boolean;
	connecting: boolean;
	error?: string;
	lastConnected?: Date;
}>({ connected: false, connecting: false });

// Derived states for easy UI consumption
export const isAgentBusy = derived(agentState, ($state) =>
	['thinking', 'executing'].includes($state.status)
);

export const isAgentWaitingApproval = derived(
	agentState,
	($state) => $state.status === 'waiting_approval'
);

export const isAgentConnected = derived(
	[agentState, connectionState],
	([$agent, $connection]) => $agent.status !== 'disconnected' && $connection.connected
);

export const agentStatusDisplay = derived(agentState, ($state) => {
	switch ($state.status) {
		case 'idle':
			return { text: 'Ready', color: 'text-green-600', icon: 'ready' };
		case 'thinking':
			return { text: 'Thinking...', color: 'text-blue-600', icon: 'thinking' };
		case 'executing':
			return { text: 'Executing...', color: 'text-yellow-600', icon: 'executing' };
		case 'waiting_approval':
			return { text: 'Waiting for approval', color: 'text-orange-600', icon: 'waiting' };
		case 'error':
			return { text: 'Error', color: 'text-red-600', icon: 'error' };
		case 'connected':
			return { text: 'Connected', color: 'text-green-600', icon: 'ready' };
		case 'disconnected':
			return { text: 'Disconnected', color: 'text-gray-600', icon: 'disconnected' };
		default:
			return { text: 'Unknown', color: 'text-gray-600', icon: 'unknown' };
	}
});

// Can the agent work?
export const canAgentWork = derived(
	[agentState, connectionState],
	([$agent, $connection]) => $agent.status === 'idle' && $connection.connected
);

// Alias for backward compatibility
export const isAgentAvailable = canAgentWork;

export const pendingToolsCount = derived(agentState, ($state) =>
	Array.isArray($state.toolsExecuting) ? $state.toolsExecuting.length : 0
);

export const queuedMessagesCount = derived(pendingMessages, ($messages) => $messages.size);

// Actions
export const agentActions = {
	setStatus(status: AgentStatus, operation?: string) {
		agentState.update((state) => ({
			...state,
			status,
			currentOperation: operation,
			lastActivity: new Date()
		}));
	},

	setProgress(progress: number) {
		agentState.update((state) => ({
			...state,
			progress
		}));
	},

	addExecutingTool(name: string, id: string) {
		agentState.update((state) => ({
			...state,
			toolsExecuting: [...(state.toolsExecuting || []), { name, id, startTime: Date.now() }]
		}));
	},

	removeExecutingTool(id: string) {
		agentState.update((state) => ({
			...state,
			toolsExecuting: (state.toolsExecuting || []).filter((tool) => tool.id !== id)
		}));
	},

	setActiveThread(threadId: string) {
		agentState.update((state) => ({
			...state,
			activeThreadId: threadId
		}));
	},

	setError(errorMessage: string) {
		agentState.update((state) => ({
			...state,
			status: 'error',
			errorMessage,
			lastActivity: new Date()
		}));
	},

	clearError() {
		agentState.update((state) => ({
			...state,
			status: 'idle',
			errorMessage: undefined
		}));
	},

	// Message management
	addPendingMessage(content: string, threadId: string): string {
		const id = crypto.randomUUID();
		const message: AgentMessage = {
			id,
			threadId,
			status: 'pending',
			content,
			timestamp: new Date()
		};

		pendingMessages.update((messages) => {
			messages.set(id, message);
			return new Map(messages);
		});

		return id;
	},

	// Alias for compatibility
	queueMessage(content: string, threadId: string): string {
		return this.addPendingMessage(content, threadId);
	},

	// Record response time for metrics
	recordResponseTime(duration: number) {
		// Simple implementation - in production this would be more sophisticated
		console.log(`Agent response time: ${duration}ms`);
	},

	updateMessageStatus(id: string, status: AgentMessage['status'], error?: string) {
		pendingMessages.update((messages) => {
			const message = messages.get(id);
			if (message) {
				message.status = status;
				if (error) message.error = error;
				messages.set(id, message);
			}
			return new Map(messages);
		});
	},

	removePendingMessage(id: string) {
		pendingMessages.update((messages) => {
			messages.delete(id);
			return new Map(messages);
		});
	},

	// Connection management for SSE
	setConnectionConnected(connected: boolean) {
		connectionState.update((state) => ({
			...state,
			connected,
			connecting: false,
			lastConnected: connected ? new Date() : state.lastConnected
		}));

		// Update agent status based on connection
		if (connected) {
			agentActions.setStatus('connected');
		} else {
			agentActions.setStatus('disconnected');
		}
	},

	setConnectionConnecting(connecting: boolean) {
		connectionState.update((state) => ({
			...state,
			connecting
		}));
	},

	setConnectionError(error: string) {
		connectionState.update((state) => ({
			...state,
			error,
			connecting: false,
			connected: false
		}));
	}
};

// Auto-cleanup old pending messages
if (typeof window !== 'undefined') {
	setInterval(() => {
		pendingMessages.update((messages) => {
			const now = Date.now();
			const filtered = new Map();

			for (const [id, message] of messages) {
				// Remove messages older than 5 minutes
				if (now - message.timestamp.getTime() < 5 * 60 * 1000) {
					filtered.set(id, message);
				}
			}

			return filtered;
		});
	}, 60000); // Check every minute
}
