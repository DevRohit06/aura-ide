import { browser } from '$app/environment';
import type { ChatThread, ChatMessage as DbChatMessage } from '$lib/types/chat';
import type { ContextVariables } from '$lib/types/llm.types';
import { LLM_PROVIDERS } from '$lib/types/llm.types';
import { createChatContext } from './file-context.store.js';

// Legacy interface for backward compatibility with existing code
export interface ChatMessage {
	id: string;
	content: string;
	role: 'user' | 'assistant';
	timestamp: Date;
	isLoading?: boolean;
	fileContext?: {
		fileName?: string;
		filePath?: string;
		language?: string;
	};
}

export interface ChatSession {
	id: string;
	title: string;
	messages: ChatMessage[];
	created: Date;
}

/**
 * Chat Store using Svelte 5 runes for reactive state management
 * Handles chat sessions, messages, and API communication
 * Enhanced with markdown support and threaded conversations
 */
class ChatStore {
	sessions = $state<ChatSession[]>([]);
	activeSessionId = $state<string | null>(null);

	// Enhanced properties for thread-based chat
	threads = $state<ChatThread[]>([]);
	activeThreadId = $state<string | null>(null);
	currentProjectId = $state<string | null>(null);

	constructor() {
		// Only initialize sessions in browser to avoid SSR issues
		if (browser) {
			this.createSession();
			this.loadUserThreads();
		}
	}

	/**
	 * Set the current project context
	 */
	setProjectContext(projectId: string): void {
		this.currentProjectId = projectId;
	}

	/**
	 * Get the currently active session
	 */
	get activeSession(): ChatSession | null {
		return this.sessions.find((session) => session.id === this.activeSessionId) || null;
	}

	/**
	 * Get the currently active thread
	 */
	get activeThread(): ChatThread | null {
		return this.threads.find((thread) => thread.id === this.activeThreadId) || null;
	}

	/**
	 * Create a new chat session
	 */
	createSession(title?: string): string {
		const newSession: ChatSession = {
			id: crypto.randomUUID(),
			title: title || `Chat ${new Date().toLocaleTimeString()}`,
			messages: [],
			created: new Date()
		};

		this.sessions.push(newSession);
		this.activeSessionId = newSession.id;

		return newSession.id;
	}

	/**
	 * Add a message to a specific session
	 * Save content as-is without markdown processing
	 */
	addMessage(
		sessionId: string,
		content: string,
		role: 'user' | 'assistant',
		isLoading = false,
		fileContext?: ChatMessage['fileContext']
	): string {
		const messageId = crypto.randomUUID();

		const newMessage: ChatMessage = {
			id: messageId,
			content: content, // Save content as-is
			role,
			timestamp: new Date(),
			isLoading,
			fileContext
		};

		const sessionIndex = this.sessions.findIndex((s) => s.id === sessionId);
		if (sessionIndex !== -1) {
			this.sessions[sessionIndex].messages.push(newMessage);

			// If this is a real message (not loading), persist to database
			if (!isLoading && browser) {
				this.persistMessage(sessionId, newMessage, content); // Pass original content
			}
		}

		return messageId;
	}

	/**
	 * Update an existing message (used for streaming)
	 * Save content as-is without markdown processing
	 */
	updateMessage(sessionId: string, messageId: string, content: string, isLoading = false): void {
		const sessionIndex = this.sessions.findIndex((s) => s.id === sessionId);
		if (sessionIndex !== -1) {
			const messageIndex = this.sessions[sessionIndex].messages.findIndex(
				(m) => m.id === messageId
			);
			if (messageIndex !== -1) {
				// Update with raw content
				this.sessions[sessionIndex].messages[messageIndex].content = content;
				this.sessions[sessionIndex].messages[messageIndex].isLoading = isLoading;
			}
		}
	}

	/**
	 * Clear all messages in a session
	 */
	clearSession(sessionId: string): void {
		const sessionIndex = this.sessions.findIndex((s) => s.id === sessionId);
		if (sessionIndex !== -1) {
			this.sessions[sessionIndex].messages = [];
		}
	}

	/**
	 * Send a message and get AI response
	 */
	async sendMessage(
		sessionId: string,
		message: string,
		provider: keyof typeof LLM_PROVIDERS = 'openai',
		model = 'gpt-4',
		systemPrompt?: string,
		contextVariables?: ContextVariables,
		fileContext?: ChatMessage['fileContext']
	): Promise<string> {
		// Add user message
		const userMessageId = this.addMessage(sessionId, message, 'user', false, fileContext);

		// Add loading assistant message
		const assistantMessageId = this.addMessage(sessionId, '', 'assistant', true);

		try {
			const session = this.sessions.find((s) => s.id === sessionId);
			if (!session) throw new Error('Session not found');

			// Prepare messages for API
			const messages = session.messages
				.filter((m) => !m.isLoading)
				.map((m) => ({
					role: m.role,
					content: m.content
				}));

			// Get file context if available
			const contextVars = createChatContext();

			// Make API request
			const response = await fetch('/api/llm/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					messages,
					model,
					provider,
					systemPrompt,
					contextVariables: {
						...contextVariables,
						...contextVars
					},
					sessionId,
					stream: false
				})
			});

			if (!response.ok) {
				throw new Error(`API request failed: ${response.statusText}`);
			}

			const data = await response.json();

			// Update assistant message with response
			this.updateMessage(sessionId, assistantMessageId, data.content, false);

			return data.content;
		} catch (error) {
			console.error('Failed to send message:', error);
			this.updateMessage(
				sessionId,
				assistantMessageId,
				'Sorry, I encountered an error while processing your request.',
				false
			);
			throw error;
		}
	}

	/**
	 * Delete a session
	 */
	deleteSession(sessionId: string): void {
		const index = this.sessions.findIndex((s) => s.id === sessionId);
		if (index !== -1) {
			this.sessions.splice(index, 1);

			// If deleted session was active, create a new one
			if (this.activeSessionId === sessionId) {
				this.createSession();
			}
		}
	}

	/**
	 * Load user's threads from database
	 */
	async loadUserThreads(): Promise<void> {
		if (!browser) return;

		try {
			const response = await fetch('/api/chat/threads?limit=50');
			if (response.ok) {
				const data = await response.json();
				this.threads = data.threads || [];
			}
		} catch (error) {
			console.error('Failed to load threads:', error);
		}
	}

	/**
	 * Create a new thread
	 */
	async createThread(
		title: string,
		description?: string,
		projectId?: string,
		tags: string[] = []
	): Promise<string> {
		try {
			const response = await fetch('/api/chat/threads', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title, description, projectId, tags })
			});

			if (!response.ok) {
				throw new Error('Failed to create thread');
			}

			const data = await response.json();
			const thread = data.thread;

			this.threads.unshift(thread);
			this.activeThreadId = thread.id;

			return thread.id;
		} catch (error) {
			console.error('Failed to create thread:', error);
			throw error;
		}
	}

	/**
	 * Add message to thread with markdown support
	 */
	async addMessageToThread(
		threadId: string,
		content: string,
		role: 'user' | 'assistant' = 'user',
		fileContext?: any,
		metadata?: any
	): Promise<string> {
		try {
			const response = await fetch(`/api/chat/threads/${threadId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content, role, fileContext, metadata })
			});

			if (!response.ok) {
				throw new Error('Failed to send message');
			}

			const data = await response.json();

			// Update local thread if it exists
			const threadIndex = this.threads.findIndex((t) => t.id === threadId);
			if (threadIndex !== -1) {
				this.threads[threadIndex].lastMessageAt = new Date();
				this.threads[threadIndex].statistics.messageCount++;
			}

			return data.message.id;
		} catch (error) {
			console.error('Failed to add message to thread:', error);
			throw error;
		}
	}

	/**
	 * Get messages for a thread
	 */
	async getThreadMessages(threadId: string, limit = 50, offset = 0): Promise<DbChatMessage[]> {
		try {
			const response = await fetch(
				`/api/chat/threads/${threadId}/messages?limit=${limit}&offset=${offset}`
			);

			if (!response.ok) {
				throw new Error('Failed to fetch messages');
			}

			const data = await response.json();
			return data.messages || [];
		} catch (error) {
			console.error('Failed to get thread messages:', error);
			return [];
		}
	}

	/**
	 * Export thread to markdown
	 */
	async exportThreadToMarkdown(threadId: string): Promise<string> {
		try {
			const response = await fetch(`/api/chat/threads/${threadId}/export`);

			if (!response.ok) {
				throw new Error('Failed to export thread');
			}

			return await response.text();
		} catch (error) {
			console.error('Failed to export thread:', error);
			throw error;
		}
	}

	/**
	 * Archive a thread
	 */
	async archiveThread(threadId: string): Promise<void> {
		try {
			const response = await fetch(`/api/chat/threads/${threadId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ isArchived: true })
			});

			if (!response.ok) {
				throw new Error('Failed to archive thread');
			}

			// Update local thread
			const threadIndex = this.threads.findIndex((t) => t.id === threadId);
			if (threadIndex !== -1) {
				this.threads[threadIndex].isArchived = true;
			}
		} catch (error) {
			console.error('Failed to archive thread:', error);
			throw error;
		}
	}

	/**
	 * Delete a thread
	 */
	async deleteThread(threadId: string): Promise<void> {
		try {
			const response = await fetch(`/api/chat/threads/${threadId}`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' }
			});

			if (!response.ok) {
				throw new Error('Failed to delete thread');
			}

			// Remove from local threads
			const threadIndex = this.threads.findIndex((t) => t.id === threadId);
			if (threadIndex !== -1) {
				this.threads.splice(threadIndex, 1);
			}

			// Clear active thread if it was deleted
			if (this.activeThreadId === threadId) {
				this.activeThreadId = null;
			}
		} catch (error) {
			console.error('Failed to delete thread:', error);
			throw error;
		}
	}

	/**
	 * Update thread properties (title, description, tags, etc.)
	 */
	async updateThread(threadId: string, updates: Partial<{
		title: string;
		name: string; // alias for title for backward compatibility
		description: string;
		tags: string[];
		isPinned: boolean;
		isArchived: boolean;
	}>): Promise<void> {
		try {
			// Handle name -> title conversion for backward compatibility
			const updatePayload = { ...updates };
			if (updates.name && !updates.title) {
				updatePayload.title = updates.name;
				delete updatePayload.name;
			}

			const response = await fetch(`/api/chat/threads/${threadId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updatePayload)
			});

			if (!response.ok) {
				throw new Error('Failed to update thread');
			}

			const data = await response.json();
			const updatedThread = data.thread;

			// Update local thread
			const threadIndex = this.threads.findIndex((t) => t.id === threadId);
			if (threadIndex !== -1) {
				// Merge updates into existing thread
				this.threads[threadIndex] = { ...this.threads[threadIndex], ...updatedThread };
			}
		} catch (error) {
			console.error('Failed to update thread:', error);
			throw error;
		}
	}

	/**
	 * Pin/unpin a thread
	 */
	async toggleThreadPin(threadId: string): Promise<void> {
		const thread = this.threads.find((t) => t.id === threadId);
		if (!thread) return;

		try {
			const response = await fetch(`/api/chat/threads/${threadId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ isPinned: !thread.isPinned })
			});

			if (!response.ok) {
				throw new Error('Failed to toggle thread pin');
			}

			// Update local thread
			thread.isPinned = !thread.isPinned;
		} catch (error) {
			console.error('Failed to toggle thread pin:', error);
			throw error;
		}
	}

	/**
	 * Search threads
	 */
	async searchThreads(query: string, projectId?: string, tags?: string[]): Promise<ChatThread[]> {
		try {
			const params = new URLSearchParams();
			if (query) params.append('q', query);
			if (projectId) params.append('projectId', projectId);
			if (tags && tags.length > 0) params.append('tags', tags.join(','));

			const response = await fetch(`/api/chat/threads?${params.toString()}`);

			if (!response.ok) {
				throw new Error('Failed to search threads');
			}

			const data = await response.json();
			return data.threads || [];
		} catch (error) {
			console.error('Failed to search threads:', error);
			return [];
		}
	}

	/**
	 * Fetch messages for current project
	 */
	async fetchProjectMessages(limit = 50, offset = 0, threadId?: string): Promise<any[]> {
		if (!this.currentProjectId) {
			console.warn('No project context set');
			return [];
		}

		try {
			const params = new URLSearchParams();
			params.append('limit', limit.toString());
			params.append('offset', offset.toString());
			if (threadId) params.append('threadId', threadId);

			const response = await fetch(
				`/api/projects/${this.currentProjectId}/messages?${params.toString()}`
			);

			if (!response.ok) {
				throw new Error('Failed to fetch project messages');
			}

			const data = await response.json();
			return data.messages || [];
		} catch (error) {
			console.error('Failed to fetch project messages:', error);
			return [];
		}
	} /**
	 * Convert legacy session to thread format
	 */
	convertSessionToThread(sessionId: string): ChatThread | null {
		const session = this.sessions.find((s) => s.id === sessionId);
		if (!session) return null;

		const now = new Date();
		const thread: ChatThread = {
			id: session.id,
			userId: 'current-user', // This should be set from auth context
			title: session.title,
			isArchived: false,
			isPinned: false,
			tags: [],
			participants: [
				{
					userId: 'current-user',
					role: 'owner',
					joinedAt: session.created,
					permissions: {
						canWrite: true,
						canDelete: true,
						canManageParticipants: true,
						canEditSettings: true
					}
				}
			],
			settings: {
				isPublic: false,
				allowGuestMessages: false,
				enableMarkdownRendering: true,
				contextWindowSize: 20
			},
			statistics: {
				messageCount: session.messages.length,
				participantCount: 1,
				totalTokensUsed: 0,
				totalCost: 0,
				averageResponseTime: 0
			},
			createdAt: session.created,
			updatedAt: now,
			lastMessageAt:
				session.messages.length > 0
					? session.messages[session.messages.length - 1].timestamp
					: session.created
		};

		return thread;
	}

	/**
	 * Persist message to database with markdown support
	 */
	private async persistMessage(
		sessionId: string,
		message: ChatMessage,
		contentMarkdown: string
	): Promise<void> {
		try {
			// Find or create corresponding thread
			let threadId = this.getThreadIdForSession(sessionId);

			if (!threadId) {
				threadId = await this.createThreadForSession(sessionId);
			}

			await fetch('/api/chat/threads/' + threadId + '/messages', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: message.content,
					role: message.role,
					fileContext: message.fileContext,
					metadata: {}
				})
			});
		} catch (error) {
			console.error('Failed to persist message:', error);
		}
	}

	/**
	 * Get thread ID for a session (for backward compatibility)
	 */
	private getThreadIdForSession(sessionId: string): string | null {
		const session = this.sessions.find((s) => s.id === sessionId);
		return session ? (session as any).threadId || null : null;
	}

	/**
	 * Create a thread for an existing session
	 */
	private async createThreadForSession(sessionId: string): Promise<string> {
		const session = this.sessions.find((s) => s.id === sessionId);
		if (!session) throw new Error('Session not found');

		try {
			const response = await fetch('/api/chat/threads', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: session.title,
					description: `Chat session created ${session.created.toLocaleString()}`,
					projectId: this.currentProjectId
				})
			});

			const data = await response.json();
			const threadId = data.thread.id;

			// Link session to thread
			(session as any).threadId = threadId;

			return threadId;
		} catch (error) {
			console.error('Failed to create thread for session:', error);
			throw error;
		}
	}
}

// Export singleton instance
export const chatStore = new ChatStore();
