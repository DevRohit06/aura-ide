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
	createThread(projectId: string, title?: string) {
		const id = crypto.randomUUID();
		const now = new Date().toISOString();
		const thread: ChatThread = {
			id,
			title: title ?? `Thread ${now}`,
			projectId,
			messages: [],
			createdAt: now,
			updatedAt: now,
			selected: true
		};

		chatThreadsStore.update((store) => {
			const list = store[projectId] ?? [];
			const newList = list.map((t) => ({ ...t, selected: false })).concat(thread);
			store[projectId] = newList;
			return { ...store };
		});

		return id;
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
			store[projectId] = list.map((t) => ({ ...t, selected: t.id === threadId }));
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
			list[i].messages.push(msg);
			list[i].updatedAt = new Date().toISOString();
			store[projectId] = list.map((t) => ({ ...t, selected: t.id === threadId }));
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
			if (threadIndex === -1) return { ...store };

			const messageIndex = list[threadIndex].messages.findIndex((m) => m.id === messageId);
			if (messageIndex === -1) return { ...store };

			list[threadIndex].messages[messageIndex].content = content;
			if (metadata) {
				list[threadIndex].messages[messageIndex].metadata = {
					...list[threadIndex].messages[messageIndex].metadata,
					...metadata
				};
			}
			list[threadIndex].updatedAt = new Date().toISOString();
			store[projectId] = [...list];
			return { ...store };
		});
	},

	renameThread(projectId: string, threadId: string, title: string) {
		chatThreadsStore.update((store) => {
			const list = store[projectId] ?? [];
			const i = list.findIndex((t) => t.id === threadId);
			if (i > -1) {
				list[i].title = title;
				list[i].updatedAt = new Date().toISOString();
			}
			store[projectId] = list;
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
