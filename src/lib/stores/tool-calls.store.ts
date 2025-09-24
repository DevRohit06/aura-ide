/**
 * Tool Calls Store
 * Manages tool call state and provides reactive updates
 */

import { toolManager } from '$lib/services/tool-manager.service.js';
import type { ToolCall, ToolCallExecutionContext } from '$lib/types/tools.js';
import { derived, writable } from 'svelte/store';

// Active tool calls
export const activeToolCalls = writable<Map<string, ToolCall>>(new Map());

// Tool call history
export const toolCallHistory = writable<ToolCall[]>([]);

// Current execution context
export const executionContext = writable<ToolCallExecutionContext | null>(null);

// Derived stores
export const hasActiveToolCalls = derived(activeToolCalls, ($activeCalls) => $activeCalls.size > 0);

export const isExecutingAnyTool = derived(activeToolCalls, ($activeCalls) =>
	Array.from($activeCalls.values()).some((call) => call.status === 'executing')
);

export const totalToolCalls = derived(
	[activeToolCalls, toolCallHistory],
	([$activeCalls, $history]) => $activeCalls.size + $history.length
);

/**
 * Tool call actions
 */
export const toolCallActions = {
	/**
	 * Execute a tool call
	 */
	async executeToolCall(
		toolName: string,
		parameters: Record<string, any>,
		context?: Partial<ToolCallExecutionContext>
	): Promise<void> {
		// Get current context
		let currentContext: ToolCallExecutionContext = { userId: 'unknown' };

		const unsubscribe = executionContext.subscribe((ctx) => {
			if (ctx) currentContext = ctx;
		});
		unsubscribe();

		// Merge with provided context
		const finalContext = { ...currentContext, ...context };

		try {
			await toolManager.executeToolCall(
				{
					name: toolName,
					parameters
				},
				finalContext
			);
		} catch (error) {
			console.error('Failed to execute tool call:', error);
		}
	},

	/**
	 * Set execution context
	 */
	setExecutionContext(context: ToolCallExecutionContext) {
		executionContext.set(context);
	},

	/**
	 * Update execution context
	 */
	updateExecutionContext(updates: Partial<ToolCallExecutionContext>) {
		executionContext.update(
			(ctx) =>
				({
					...ctx,
					...updates
				}) as ToolCallExecutionContext
		);
	},

	/**
	 * Clear execution context
	 */
	clearExecutionContext() {
		executionContext.set(null);
	},

	/**
	 * Add tool call to history
	 */
	addToHistory(toolCall: ToolCall) {
		toolCallHistory.update((history) => {
			// Keep only last 50 calls
			const newHistory = [...history, toolCall].slice(-50);
			return newHistory;
		});
	},

	/**
	 * Clear tool call history
	 */
	clearHistory() {
		toolCallHistory.set([]);
	},

	/**
	 * Remove active tool call
	 */
	removeActiveCall(callId: string) {
		activeToolCalls.update((calls) => {
			calls.delete(callId);
			return calls;
		});
	}
};

// Initialize store subscriptions
toolManager.activeCalls.subscribe((calls) => {
	activeToolCalls.set(calls);

	// Move completed calls to history
	calls.forEach((call) => {
		if (call.status === 'success' || call.status === 'error') {
			setTimeout(() => {
				toolCallActions.addToHistory(call);
				toolCallActions.removeActiveCall(call.id);
			}, 2000); // Keep completed calls visible for 2 seconds
		}
	});
});
