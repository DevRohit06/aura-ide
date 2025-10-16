import { writable } from 'svelte/store';

export type ChatMessage = {
	id: string;
	role: 'user' | 'assistant' | 'system';
	content: string;
	timestamp: string;
	metadata?: {
		agentModel?: string;
		tokens?: number;
		agentInterrupt?: {
			toolCalls: Array<{
				name: string;
				parameters: Record<string, any>;
				id?: string;
			}>;
			stateSnapshot?: {
				currentFile?: string | null;
				sandboxId?: string | null;
				fileContent?: string | null;
			};
			reason?: string;
		};
	};
};

export type ChatThread = {
	id: string;
	title: string;
	projectId: string;
	messages: ChatMessage[];
	createdAt: string;
	updatedAt: string;
	selected: boolean;
};

// Store: map projectId -> ChatThread[]
export const chatThreadsStore = writable<Record<string, ChatThread[]>>({});

export const chatThreadsActions = {
	createThread(projectId: string, title?: string, id?: string) {
		const threadId = id || crypto.randomUUID();
		const now = new Date().toISOString();
		const thread: ChatThread = {
			id: threadId,
			title: title ?? `New Thread`,
			projectId,
			messages: [],
			createdAt: now,
			updatedAt: now,
			selected: true
		};

		chatThreadsStore.update((store) => {
			const list = store[projectId] ?? [];
			// Deselect all other threads
			const newList = list.map((t) => ({ ...t, selected: false })).concat(thread);
			store[projectId] = newList;
			return { ...store };
		});

		return threadId;
	},

	getThreads(projectId: string) {
		let result: ChatThread[] = [];
		const unsubscribe = chatThreadsStore.subscribe((s) => {
			result = s[projectId] ?? [];
		});
		unsubscribe();
		return result;
	},

	selectThread(projectId: string, threadId: string) {
		chatThreadsStore.update((store) => {
			const list = store[projectId] ?? [];
			// Check if already selected to prevent unnecessary updates
			const currentlySelected = list.find((t) => t.selected);
			if (currentlySelected?.id === threadId) {
				// Already selected, no update needed
				return store;
			}

			// Create new array with updated selection
			const updatedList = list.map((t) => ({ ...t, selected: t.id === threadId }));
			store[projectId] = updatedList;
			return { ...store };
		});
	},

	addMessage(
		projectId: string,
		threadId: string,
		role: ChatMessage['role'],
		content: string,
		metadata?: ChatMessage['metadata'] & { messageId?: string; isStreaming?: boolean }
	) {
		const msg: ChatMessage = {
			id: metadata?.messageId || crypto.randomUUID(),
			role,
			content,
			timestamp: new Date().toISOString(),
			metadata
		};
		chatThreadsStore.update((store) => {
			const list = store[projectId] ?? [];
			const i = list.findIndex((t) => t.id === threadId);
			if (i === -1) {
				const tid = crypto.randomUUID();
				const now = new Date().toISOString();
				const newThread: ChatThread = {
					id: tid,
					title: 'Untitled',
					projectId,
					messages: [msg],
					createdAt: now,
					updatedAt: now,
					selected: true
				};
				store[projectId] = (store[projectId] ?? [])
					.map((t) => ({ ...t, selected: false }))
					.concat(newThread);
				return { ...store };
			}
			// Create new array to trigger reactivity
			const updatedList = [...list];
			updatedList[i] = {
				...updatedList[i],
				messages: [...updatedList[i].messages, msg],
				updatedAt: new Date().toISOString()
			};
			store[projectId] = updatedList.map((t) => ({ ...t, selected: t.id === threadId }));
			return { ...store };
		});
		return msg.id;
	},

	updateMessage(
		projectId: string,
		threadId: string,
		messageId: string,
		content: string,
		metadata?: Partial<ChatMessage['metadata'] & { isStreaming?: boolean }>
	) {
		chatThreadsStore.update((store) => {
			const list = store[projectId] ?? [];
			const threadIndex = list.findIndex((t) => t.id === threadId);
			if (threadIndex === -1) return store;

			const messageIndex = list[threadIndex].messages.findIndex((m) => m.id === messageId);
			if (messageIndex === -1) return store;

			// Check if content actually changed
			const existingMessage = list[threadIndex].messages[messageIndex];
			if (
				existingMessage.content === content &&
				JSON.stringify(existingMessage.metadata) === JSON.stringify(metadata)
			) {
				// No changes, skip update
				return store;
			}

			// Create new message object to trigger reactivity
			const updatedMessage = {
				...existingMessage,
				content,
				metadata: metadata
					? {
							...existingMessage.metadata,
							...metadata
						}
					: existingMessage.metadata
			};

			// Create new messages array
			const updatedMessages = [...list[threadIndex].messages];
			updatedMessages[messageIndex] = updatedMessage;

			// Create new thread object
			const updatedThread = {
				...list[threadIndex],
				messages: updatedMessages,
				updatedAt: new Date().toISOString()
			};

			// Create new list
			const updatedList = [...list];
			updatedList[threadIndex] = updatedThread;

			store[projectId] = updatedList;
			return { ...store };
		});
	},

	renameThread(projectId: string, threadId: string, title: string) {
		chatThreadsStore.update((store) => {
			const list = store[projectId] ?? [];
			const i = list.findIndex((t) => t.id === threadId);
			if (i > -1) {
				// Create new array to trigger reactivity
				const updatedList = [...list];
				updatedList[i] = {
					...updatedList[i],
					title,
					updatedAt: new Date().toISOString()
				};
				store[projectId] = updatedList;
			}
			return { ...store };
		});
	},

	deleteThread(projectId: string, threadId: string) {
		chatThreadsStore.update((store) => {
			const list = store[projectId] ?? [];
			store[projectId] = list.filter((t) => t.id !== threadId);
			return { ...store };
		});
	},

	clear() {
		chatThreadsStore.set({});
	}
};
