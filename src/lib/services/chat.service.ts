/**
 * Centralized Chat Service
 * Manages chat threads, messages, and SSE streaming with stable stores
 * Prevents reactivity issues by providing memoized, stable references
 */

import { terminalBridge } from '$lib/services/terminal-bridge.service';
import { agentActions } from '$lib/stores/agent-state.store';
import type { ChatMessage, ChatThread } from '$lib/stores/chatThreads';
import { chatThreadsActions, chatThreadsStore } from '$lib/stores/chatThreads';
import { chatFileContext } from '@/stores/editor';
import { selectedModelStore } from '@/stores/model';
import { derived, get, writable, type Readable } from 'svelte/store';

// UI Message type for components
export interface UIChatMessage {
	id: string;
	content: string;
	role: 'user' | 'assistant' | 'system';
	timestamp: Date;
	isLoading?: boolean;
	fileContext?: {
		fileName?: string;
		filePath?: string;
		language?: string;
	};
	metadata?: any;
	agentInterrupt?: {
		toolCalls: Array<{
			name: string;
			args: Record<string, any>;
			id?: string;
		}>;
		stateSnapshot?: {
			currentFile?: string | null;
			sandboxId?: string | null;
			fileContent?: string | null;
		};
		reason?: string;
	};
}

export interface SendMessagePayload {
	content: string;
	includeCodeContext?: boolean;
	codeQuery?: string;
	projectId: string;
	sandboxId?: string;
	sandboxType?: string;
	currentFile?: string | null;
}

class ChatService {
	private currentProjectId = writable<string>('default');
	private isLoadingMessages = writable<boolean>(false);
	private errorMessage = writable<string | null>(null);
	private loadedThreadIds = new Set<string>();
	private activeSSEUnsubscribe: (() => void) | null = null;
	private isWaitingForInterruptApproval = false;

	// Stable derived stores
	public readonly threads: Readable<ChatThread[]>;
	public readonly selectedThread: Readable<ChatThread | null>;
	public readonly messages: Readable<UIChatMessage[]>;
	public readonly isLoading: Readable<boolean>;
	public readonly error: Readable<string | null>;

	constructor() {
		// Create stable derived stores that won't trigger excessive reactivity
		this.threads = derived([chatThreadsStore, this.currentProjectId], ([$store, $projectId]) => {
			return $store[$projectId] ?? [];
		});

		this.selectedThread = derived(this.threads, ($threads) => {
			return $threads.find((t) => t.selected) ?? null;
		});

		// Memoized messages conversion - only recalculates when the actual thread changes
		this.messages = derived(this.selectedThread, ($selectedThread) => {
			if (!$selectedThread) return [];

			const uiMessages = $selectedThread.messages.map((m: ChatMessage): UIChatMessage => {
				const uiMessage: UIChatMessage = {
					id: m.id,
					content: m.content,
					role: m.role === 'system' ? 'assistant' : (m.role as 'user' | 'assistant'),
					timestamp: new Date(m.timestamp),
					isLoading: false,
					metadata: m.metadata,
					agentInterrupt: m.metadata?.agentInterrupt
						? {
								...m.metadata.agentInterrupt,
								toolCalls:
									m.metadata.agentInterrupt.toolCalls?.map((tool: any) => ({
										name: tool.name,
										args: tool.parameters || tool.args || {},
										id: tool.id
									})) || []
							}
						: undefined
				};

				// Debug logging for interrupt messages
				if (uiMessage.agentInterrupt) {
					console.log('[ChatService] Message with interrupt:', {
						id: uiMessage.id,
						hasInterrupt: true,
						toolCallsCount: uiMessage.agentInterrupt.toolCalls?.length
					});
				}

				return uiMessage;
			});

			return uiMessages;
		});

		this.isLoading = this.isLoadingMessages;
		this.error = this.errorMessage;
	}

	/**
	 * Set the current project context
	 */
	setProject(projectId: string) {
		this.currentProjectId.set(projectId);
	}

	/**
	 * Load threads from database for a project
	 */
	async loadThreads(projectId: string): Promise<void> {
		try {
			this.errorMessage.set(null);
			const response = await fetch(`/api/chat/threads?projectId=${projectId}`);

			if (!response.ok) {
				throw new Error('Failed to load chat threads');
			}

			const data = await response.json();
			if (data.threads && Array.isArray(data.threads)) {
				// Sort by updatedAt descending
				const sortedThreads = data.threads.sort(
					(a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
				);

				const convertedThreads = sortedThreads.map((t: any) => ({
					id: t.id,
					title: t.title,
					projectId: t.projectId,
					messages: [],
					createdAt: t.createdAt,
					updatedAt: t.updatedAt,
					selected: false
				}));

				chatThreadsStore.update((store) => {
					store[projectId] = convertedThreads;
					return { ...store };
				});
			}
		} catch (err) {
			console.error('Failed to load threads:', err);
			this.errorMessage.set('Failed to load chat threads');
		}
	}

	/**
	 * Load messages for a specific thread
	 */
	async loadThreadMessages(threadId: string, force = false): Promise<void> {
		// Skip if already loaded and not forcing
		if (!force && this.loadedThreadIds.has(threadId)) {
			return;
		}

		const projectId = get(this.currentProjectId);

		try {
			const response = await fetch(`/api/chat/threads/${threadId}/messages`);
			if (!response.ok) {
				console.error(`Failed to load messages: ${response.status}`);
				return;
			}

			const data = await response.json();
			if (data.messages && Array.isArray(data.messages)) {
				chatThreadsStore.update((store) => {
					const list = store[projectId] ?? [];
					const threadIndex = list.findIndex((t) => t.id === threadId);

					if (threadIndex > -1) {
						const updatedList = [...list];
						updatedList[threadIndex] = {
							...updatedList[threadIndex],
							messages: data.messages.map((m: any) => ({
								id: m.id,
								role: m.role,
								content: m.content,
								timestamp: m.timestamp,
								metadata: m.metadata
							})),
							updatedAt: new Date().toISOString()
						};
						store[projectId] = updatedList;
					}

					return { ...store };
				});

				// Mark as loaded
				this.loadedThreadIds.add(threadId);
			}
		} catch (err) {
			console.error('Failed to load thread messages:', err);
		}
	}

	/**
	 * Create a new thread (persists to database)
	 */
	async createThread(projectId: string, title: string = 'New Thread'): Promise<string> {
		try {
			// Create in database first
			const response = await fetch('/api/chat/threads', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title, projectId })
			});

			if (!response.ok) {
				throw new Error('Failed to create thread in database');
			}

			const data = await response.json();
			const threadId = data.thread.id;

			// Add to local store
			chatThreadsActions.createThread(projectId, title, threadId);
			this.selectThread(projectId, threadId);

			console.log('[ChatService] Created and persisted thread:', threadId);
			return threadId;
		} catch (err) {
			console.error('Failed to create thread:', err);
			// Fallback to local-only thread
			const threadId = chatThreadsActions.createThread(projectId, title);
			this.selectThread(projectId, threadId);
			return threadId;
		}
	}

	/**
	 * Select a thread
	 */
	selectThread(projectId: string, threadId: string) {
		chatThreadsActions.selectThread(projectId, threadId);
		agentActions.setActiveThread(threadId);

		// Load messages if not yet loaded
		const threads = get(this.threads);
		const thread = threads.find((t) => t.id === threadId);
		if (thread && thread.messages.length === 0 && !this.loadedThreadIds.has(threadId)) {
			this.loadThreadMessages(threadId);
		}
	}

	/**
	 * Rename a thread (persists to database)
	 */
	async renameThread(projectId: string, threadId: string, title: string) {
		try {
			// Update in database
			const response = await fetch(`/api/chat/threads/${threadId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title })
			});

			if (!response.ok) {
				console.error('Failed to rename thread in database');
			}
		} catch (err) {
			console.error('Failed to rename thread:', err);
		}

		// Update local store regardless
		chatThreadsActions.renameThread(projectId, threadId, title);
	}

	/**
	 * Delete a thread (persists to database)
	 */
	async deleteThread(projectId: string, threadId: string) {
		try {
			// Delete from database
			const response = await fetch(`/api/chat/threads/${threadId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				console.error('Failed to delete thread from database');
			}
		} catch (err) {
			console.error('Failed to delete thread:', err);
		}

		// Remove from local store regardless
		chatThreadsActions.deleteThread(projectId, threadId);
		this.loadedThreadIds.delete(threadId);
	}

	/**
	 * Persist a message to the database
	 */
	private async persistMessage(
		threadId: string,
		projectId: string,
		content: string,
		role: 'user' | 'assistant',
		metadata?: any
	): Promise<void> {
		try {
			const response = await fetch(`/api/chat/threads/${threadId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content,
					role,
					projectId,
					metadata
				})
			});

			if (!response.ok) {
				console.error('Failed to persist message to database');
			}
		} catch (err) {
			console.error('Failed to persist message:', err);
		}
	}

	/**
	 * Send a message using AI SDK data stream format
	 */
	async sendMessage(payload: SendMessagePayload): Promise<void> {
		const { content, projectId, ...restPayload } = payload;

		let threadId: string;
		let isNewThread = false;

		const selectedThread = get(this.selectedThread);
		if (!selectedThread) {
			// Create thread in database
			threadId = await this.createThread(projectId, 'New Chat');
			isNewThread = true;
		} else {
			threadId = selectedThread.id;
			agentActions.setActiveThread(threadId);
		}

		// Add user message to UI immediately
		chatThreadsActions.addMessage(projectId, threadId, 'user', content, {});

		// Reset state and set loading
		this.isWaitingForInterruptApproval = false;
		this.isLoadingMessages.set(true);
		this.errorMessage.set(null);
		agentActions.setStatus('thinking', 'Processing your message...');

		const startTime = Date.now();
		let assistantContent = '';
		const streamingMessageId = `stream-${Date.now()}`;
		const currentModelName = get(selectedModelStore);
		const fileContext = get(chatFileContext);

		// Collect tool calls and results for metadata
		const toolCalls: any[] = [];
		const toolResults: any[] = [];

		try {
			const response = await fetch('/api/agent/stream', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					message: content,
					threadId: isNewThread ? undefined : threadId,
					projectId,
					modelName: currentModelName,
					currentFile: fileContext.isActive ? fileContext.filePath : null,
					...restPayload
				})
			});

			if (!response.ok) {
				throw new Error(`Stream request failed: ${response.status}`);
			}

			// Extract thread ID from headers if available
			const serverThreadId = response.headers.get('X-Thread-Id');
			if (serverThreadId) {
				threadId = serverThreadId;
				agentActions.setActiveThread(threadId);
			}

			const reader = response.body?.getReader();
			if (!reader) {
				throw new Error('No response body');
			}

			const decoder = new TextDecoder();
			let buffer = '';
			let messageCreated = false;

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() || ''; // Keep incomplete line in buffer

				for (const line of lines) {
					if (!line.trim()) continue;

					try {
						// AI SDK v6 UI Message Stream format: data: {"type":"...", ...}
						// Handle SSE format
						if (line.startsWith('data: ')) {
							const jsonStr = line.substring(6); // Remove 'data: ' prefix
							
							// Handle [DONE] marker
							if (jsonStr === '[DONE]') {
								continue;
							}

							const event = JSON.parse(jsonStr);
							
							switch (event.type) {
								case 'start':
									// Stream started
									agentActions.setStatus('thinking', 'Processing...');
									break;

								case 'start-step':
									// New step started (could be tool call or text generation)
									agentActions.setStatus('thinking', 'Working...');
									break;

								case 'text-start':
									// Text part starting
									break;

								case 'text-delta':
									// Text chunk received
									const textChunk = event.delta || '';
									assistantContent += textChunk;
									
									if (!messageCreated) {
										// Create streaming message on first chunk
										chatThreadsActions.addMessage(projectId, threadId, 'assistant', assistantContent, {
											messageId: streamingMessageId,
											isStreaming: true,
											agentModel: currentModelName
										});
										messageCreated = true;
									} else {
										chatThreadsActions.updateMessage(
											projectId,
											threadId,
											streamingMessageId,
											assistantContent,
											{ isStreaming: true, agentModel: currentModelName }
										);
									}
									break;

								case 'text-end':
									// Text part ended
									break;

								case 'tool-input-start':
									// Tool call starting
									agentActions.setStatus('executing', `Starting tool...`);
									break;

								case 'tool-input-delta':
									// Tool input streaming
									break;

								case 'tool-input-available':
									// Tool call with full input available
									agentActions.setStatus('executing', `Executing ${event.toolName || 'tool'}...`);
									toolCalls.push({
										id: event.toolCallId,
										name: event.toolName,
										arguments: event.input
									});
									terminalBridge.handleSSEEvent({
										type: 'tool_call',
										data: { toolCalls: [{ id: event.toolCallId, name: event.toolName, arguments: event.input }] },
										timestamp: Date.now()
									});
									break;

								case 'tool-output-available':
									// Tool result available
									toolResults.push({
										tool_call_id: event.toolCallId,
										output: event.output,
										success: true
									});
									terminalBridge.handleSSEEvent({
										type: 'tool_result',
										data: { tool_call_id: event.toolCallId, output: event.output },
										timestamp: Date.now()
									});
									agentActions.setStatus('thinking', 'Processing tool result...');
									break;

								case 'finish-step':
									// Step finished (will be followed by another step if agent continues)
									break;

								case 'finish':
									// Message finished
									break;

								case 'error':
									// Error occurred
									throw new Error(event.message || event.error || 'Stream error');
							}
						} else {
							// Fallback: Try old format (type:data) for backwards compatibility
							const colonIndex = line.indexOf(':');
							if (colonIndex === -1) continue;

							const type = line.substring(0, colonIndex);
							const data = line.substring(colonIndex + 1);

							switch (type) {
								case '0': // Text delta (old format)
									const textChunk = JSON.parse(data);
									assistantContent += textChunk;
									
									if (!messageCreated) {
										chatThreadsActions.addMessage(projectId, threadId, 'assistant', assistantContent, {
											messageId: streamingMessageId,
											isStreaming: true,
											agentModel: currentModelName
										});
										messageCreated = true;
									} else {
										chatThreadsActions.updateMessage(
											projectId,
											threadId,
											streamingMessageId,
											assistantContent,
											{ isStreaming: true, agentModel: currentModelName }
										);
									}
									break;

								case '9': // Tool call (old format)
									const toolCallData = JSON.parse(data);
									agentActions.setStatus('executing', `Executing ${toolCallData.toolName || 'tool'}...`);
									toolCalls.push({
										id: toolCallData.toolCallId,
										name: toolCallData.toolName,
										arguments: toolCallData.args
									});
									break;

								case 'a': // Tool result (old format)
									const toolResultData = JSON.parse(data);
									toolResults.push({
										tool_call_id: toolResultData.toolCallId,
										output: toolResultData.result,
										success: true
									});
									break;

								case 'e': // Error (old format)
									const errorData = JSON.parse(data);
									throw new Error(errorData.message || 'Stream error');
							}
						}
					} catch (parseError) {
						// Ignore parse errors for individual lines
						console.debug('[ChatService] Parse error for line:', line.substring(0, 50), parseError);
					}
				}
			}

			// Finalize the message
			const responseTime = Date.now() - startTime;
			agentActions.recordResponseTime(responseTime);
			agentActions.setStatus('idle');

			if (messageCreated) {
				chatThreadsActions.updateMessage(
					projectId,
					threadId,
					streamingMessageId,
					assistantContent,
					{ 
						isStreaming: false, 
						agentModel: currentModelName,
						hasToolCalls: toolCalls.length > 0,
						toolCallCount: toolCalls.length,
						toolCalls,
						toolResults
					}
				);
			} else if (assistantContent) {
				// Create message if we have content but message wasn't created
				chatThreadsActions.addMessage(projectId, threadId, 'assistant', assistantContent, {
					messageId: streamingMessageId,
					agentModel: currentModelName,
					hasToolCalls: toolCalls.length > 0,
					toolCallCount: toolCalls.length,
					toolCalls,
					toolResults
				});
			}

			// Reload messages from DB
			this.loadThreadMessages(threadId, true);
			this.isLoadingMessages.set(false);

		} catch (err) {
			console.error('Failed to send message:', err);
			agentActions.setError(
				`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`
			);
			chatThreadsActions.addMessage(
				projectId,
				threadId,
				'assistant',
				`Error: ${err instanceof Error ? err.message : 'Network error'}`
			);
			this.isLoadingMessages.set(false);
		}
	}

	/**
	 * Clear interrupt approval flag (call after user makes a decision)
	 */
	clearInterruptFlag() {
		this.isWaitingForInterruptApproval = false;
	}

	/**
	 * Clean up SSE subscription
	 */
	private cleanup() {
		if (this.activeSSEUnsubscribe) {
			this.activeSSEUnsubscribe();
			this.activeSSEUnsubscribe = null;
		}
	}

	/**
	 * Reset all state (useful for unmounting)
	 */
	reset() {
		this.cleanup();
		this.loadedThreadIds.clear();
		this.isLoadingMessages.set(false);
		this.errorMessage.set(null);
	}
}

// Export singleton instance
export const chatService = new ChatService();
