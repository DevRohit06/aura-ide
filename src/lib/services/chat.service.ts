/**
 * Centralized Chat Service
 * Manages chat threads, messages, and SSE streaming with stable stores
 * Prevents reactivity issues by providing memoized, stable references
 */

import { sseService, type SSEEvent } from '$lib/services/sse.service';
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
	 * Send a message with SSE streaming
	 */
	async sendMessage(payload: SendMessagePayload): Promise<void> {
		const { content, projectId, ...restPayload } = payload;

		// Clean up any existing SSE subscription
		if (this.activeSSEUnsubscribe) {
			this.activeSSEUnsubscribe();
			this.activeSSEUnsubscribe = null;
		}

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

		// Persist user message to database (async, don't wait)
		this.persistMessage(threadId, projectId, content, 'user').catch(console.error);

		// Reset interrupt flag and set loading state
		this.isWaitingForInterruptApproval = false;
		this.isLoadingMessages.set(true);
		this.errorMessage.set(null);
		agentActions.setStatus('thinking', 'Processing your message...');

		const startTime = Date.now();
		let assistantContent = '';
		let streamingMessageId: string | null = null;

		try {
			// Set up SSE event handlers
			this.activeSSEUnsubscribe = sseService.subscribeAll((event: SSEEvent) => {
				// Pass all events to terminal bridge for display
				terminalBridge.handleSSEEvent(event);

				switch (event.type) {
					case 'start':
						agentActions.setStatus('thinking', 'Agent started processing...');
						break;

					case 'thinking':
						agentActions.setStatus('thinking', event.data.message || 'Agent is thinking...');
						break;

					case 'tool_call':
						// Check if this is an interrupt requiring human review
						if (event.data.interrupt) {
							console.log('[ChatService] Human review interrupt detected:', event.data);
							agentActions.setStatus('waiting_approval', 'Awaiting human approval...');

							// Set flag to prevent reloading messages from DB
							this.isWaitingForInterruptApproval = true;

							// Create message with agentInterrupt metadata
							const interruptMessageId = `interrupt-${Date.now()}`;
							const interruptContent =
								event.data.reason || 'Agent is requesting approval for the following actions:';

							// Normalize tool calls format
							const normalizedToolCalls = (event.data.toolCalls || []).map((tc: any) => ({
								name: tc.name,
								args: tc.args || tc.parameters || {},
								id: tc.id
							}));

							console.log(
								'[ChatService] Creating interrupt message with toolCalls:',
								normalizedToolCalls
							);

							const interruptMetadata = {
								messageId: interruptMessageId,
								isStreaming: false,
								agentInterrupt: {
									toolCalls: normalizedToolCalls,
									stateSnapshot: event.data.stateSnapshot || {},
									reason: event.data.reason || 'Human approval required'
								}
							};

							// Add to UI store
							chatThreadsActions.addMessage(
								projectId,
								threadId,
								'assistant',
								interruptContent,
								interruptMetadata
							);

							// Persist interrupt message to database with full metadata
							this.persistMessage(
								threadId,
								projectId,
								interruptContent,
								'assistant',
								interruptMetadata
							).catch((err) => console.error('Failed to persist interrupt message:', err));

							// Stop loading state to allow user interaction
							this.isLoadingMessages.set(false);
						} else {
							// Regular tool call without interrupt
							agentActions.setStatus('executing', 'Executing tools...');
							agentActions.addExecutingTool('tool', event.data.toolCalls?.[0]?.name || 'tool');
						}
						break;
					case 'content':
						if (!streamingMessageId && event.data.chunk) {
							// Create streaming assistant message on first chunk
							streamingMessageId = `stream-${Date.now()}`;
							assistantContent = event.data.chunk;
							chatThreadsActions.addMessage(projectId, threadId, 'assistant', assistantContent, {
								messageId: streamingMessageId,
								isStreaming: true
							});
						} else if (streamingMessageId && event.data.chunk) {
							// Append chunk to streaming content
							assistantContent += event.data.chunk;
							chatThreadsActions.updateMessage(
								projectId,
								threadId,
								streamingMessageId,
								assistantContent,
								{ isStreaming: true }
							);
						}
						break;

					case 'complete':
						const responseTime = Date.now() - startTime;
						agentActions.recordResponseTime(responseTime);

						// Don't set to idle if waiting for interrupt approval
						if (!this.isWaitingForInterruptApproval) {
							agentActions.setStatus('idle');
						}

						// Handle thread ID synchronization
						if (event.data.threadId && isNewThread) {
							const serverThreadId = event.data.threadId;
							const tempThreadId = threadId;

							if (tempThreadId !== serverThreadId) {
								chatThreadsActions.deleteThread(projectId, tempThreadId);
							}

							threadId = serverThreadId;
							agentActions.setActiveThread(threadId);

							// Only reload if not waiting for interrupt approval
							if (!this.isWaitingForInterruptApproval) {
								this.loadThreads(projectId).then(() => {
									this.selectThread(projectId, threadId);
									this.loadThreadMessages(threadId, true);
								});
							} else {
								console.log(
									'[ChatService] Skipping message reload - waiting for interrupt approval'
								);
							}
						} else if (threadId && !this.isWaitingForInterruptApproval) {
							// Reload messages to get final version from DB (only if not waiting for approval)
							this.loadThreadMessages(threadId, true);
						} else if (this.isWaitingForInterruptApproval) {
							console.log('[ChatService] Skipping message reload - waiting for interrupt approval');
						} // Mark streaming as complete
						if (streamingMessageId) {
							chatThreadsActions.updateMessage(
								projectId,
								threadId,
								streamingMessageId,
								assistantContent,
								{ isStreaming: false }
							);
						}

						this.isLoadingMessages.set(false);
						this.cleanup();
						break;

					case 'error':
						agentActions.setError(`Agent error: ${event.data.error}`);
						if (event.data.error) {
							chatThreadsActions.addMessage(
								projectId,
								threadId,
								'assistant',
								`Error: ${event.data.error}`
							);
						}
						this.isLoadingMessages.set(false);
						this.cleanup();
						break;
				}
			});

			// Get current model
			const modelName = get(selectedModelStore);
			const fileContext = get(chatFileContext);

			// Send message via SSE stream
			await sseService.streamMessage({
				message: content,
				threadId: isNewThread ? undefined : threadId,
				projectId,
				modelName,
				currentFile: fileContext.isActive ? fileContext.filePath : null,
				...restPayload
			});
		} catch (err) {
			console.error('Failed to send message via SSE:', err);
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
			this.cleanup();
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
