import { writable, derived } from 'svelte/store';

export interface ChatMessage {
	id: string;
	content: string;
	role: 'user' | 'assistant';
	timestamp: Date;
	isLoading?: boolean;
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
 */
class ChatStore {
	sessions = $state<ChatSession[]>([]);
	activeSessionId = $state<string | null>(null);

	constructor() {
		this.createSession();
	}

	/**
	 * Get the currently active session
	 */
	get activeSession(): ChatSession | null {
		return this.sessions.find((session) => session.id === this.activeSessionId) || null;
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
	 */
	addMessage(
		sessionId: string,
		content: string,
		role: 'user' | 'assistant',
		isLoading = false
	): string {
		const messageId = crypto.randomUUID();
		const newMessage: ChatMessage = {
			id: messageId,
			content,
			role,
			timestamp: new Date(),
			isLoading
		};

		const sessionIndex = this.sessions.findIndex((s) => s.id === sessionId);
		if (sessionIndex !== -1) {
			this.sessions[sessionIndex].messages.push(newMessage);
		}

		return messageId;
	}

	/**
	 * Update an existing message (used for streaming)
	 */
	updateMessage(sessionId: string, messageId: string, content: string, isLoading = false): void {
		const sessionIndex = this.sessions.findIndex((s) => s.id === sessionId);
		if (sessionIndex !== -1) {
			const messageIndex = this.sessions[sessionIndex].messages.findIndex(
				(m) => m.id === messageId
			);
			if (messageIndex !== -1) {
				this.sessions[sessionIndex].messages[messageIndex].content = content;
				this.sessions[sessionIndex].messages[messageIndex].isLoading = isLoading;
			}
		}
	}

	/**
	 * Send a message with API communication
	 */
	async sendMessage(sessionId: string, content: string): Promise<void> {
		try {
			// Add user message immediately
			this.addMessage(sessionId, content, 'user');

			// Add loading assistant message
			const assistantMessageId = this.addMessage(sessionId, '', 'assistant', true);

			const endpoint = '/api/llm/agent';
			const requestBody = {
				messages: [{ role: 'user', content }],
				stream: true,
				provider: 'openai',
				model: 'gpt-4o',
				temperature: 0
			};

			console.log(`Using API:`, endpoint);

			// Make API request
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(requestBody)
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			// Handle streaming response
			await this.handleStreamingResponse(response, sessionId, assistantMessageId);
		} catch (error) {
			console.error('Error sending message:', error);
			this.handleError(sessionId, error);
		}
	}

	/**
	 * Handle streaming response from API
	 */
	private async handleStreamingResponse(
		response: Response,
		sessionId: string,
		messageId: string
	): Promise<void> {
		const reader = response.body?.getReader();
		const decoder = new TextDecoder();
		let accumulatedContent = '';

		if (!reader) {
			throw new Error('No response body reader available');
		}

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			const chunk = decoder.decode(value);
			const lines = chunk.split('\n');

			for (const line of lines) {
				if (line.startsWith('data: ')) {
					try {
						const data = JSON.parse(line.slice(6));

						if (data.type === 'chunk' && data.content) {
							accumulatedContent += data.content;
							this.updateMessage(sessionId, messageId, accumulatedContent, true);
						} else if (data.type === 'done') {
							this.updateMessage(sessionId, messageId, accumulatedContent, false);
							return;
						} else if (data.type === 'error') {
							throw new Error(data.error);
						}
					} catch (e) {
						// Ignore malformed JSON chunks
						console.warn('Failed to parse SSE chunk:', e);
					}
				}
			}
		}
	}

	/**
	 * Handle errors during message sending
	 */
	private handleError(sessionId: string, error: unknown): void {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

		// Find and update any loading message with error
		const sessionIndex = this.sessions.findIndex((s) => s.id === sessionId);
		if (sessionIndex !== -1) {
			const loadingMessageIndex = this.sessions[sessionIndex].messages.findIndex(
				(m) => m.isLoading
			);
			if (loadingMessageIndex !== -1) {
				this.sessions[sessionIndex].messages[loadingMessageIndex].content =
					`Sorry, I encountered an error: ${errorMessage}. Please try again.`;
				this.sessions[sessionIndex].messages[loadingMessageIndex].isLoading = false;
			}
		}
	}

	/**
	 * Clear all messages in the active session
	 */
	clearActiveSession(): void {
		if (this.activeSessionId) {
			const sessionIndex = this.sessions.findIndex((s) => s.id === this.activeSessionId);
			if (sessionIndex !== -1) {
				this.sessions[sessionIndex].messages = [];
			}
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
}

// Export singleton instance
export const chatStore = new ChatStore();
