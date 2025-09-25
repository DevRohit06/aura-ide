<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuSeparator,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu';
	import type { Project } from '$lib/types';
	import { chatStore } from '@/stores/chat.svelte';
	import { fileContext } from '@/stores/editor';
	import { selectedModelStore } from '@/stores/model';
	import { Edit3, History, MessageSquare, MoreHorizontal, Plus, Trash2 } from 'lucide-svelte';
	import { createEventDispatcher, onMount, tick } from 'svelte';
	import ChatContainer from './chat-container.svelte';
	import ChatInput from './chat-input.svelte';

	// UI Message type for ChatContainer
	interface UIMessage {
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

	// Props
	interface Props {
		project?: Project;
		chatThreads?: any[];
		recentMessages?: any[];
	}

	let { project = undefined, chatThreads = [], recentMessages = [] }: Props = $props();

	const dispatch = createEventDispatcher<{
		close: void;
	}>();

	// Thread-based state
	let threadMessages = $state<UIMessage[]>([]);
	let isLoadingMessages = $state(false);

	// UI state
	let showThreadHistory = $state(false);
	let isCreatingThread = $state(false);
	let editingThreadId = $state<string | null>(null);
	let editingThreadName = $state('');

	// Reactive references to store state
	const activeThread = $derived(chatStore.activeThread);
	const activeThreadId = $derived(chatStore.activeThreadId);
	const currentFileContext = $derived($fileContext);

	// Model selection - use store subscription for Svelte 4 stores
	let selectedModel = $state($selectedModelStore);

	// Load messages when active thread changes
	$effect(() => {
		if (activeThreadId) {
			loadThreadMessages(activeThreadId);
		}
	});

	// Initialize chat store with loaded data
	onMount(() => {
		// Set project context in chat store
		if (project?.id) {
			chatStore.setProjectContext(project.id);
		}

		if (chatThreads.length > 0) {
			// Update the store's threads with the loaded data
			chatStore.threads = chatThreads;

			// Set the most recent thread as active if no active thread
			if (!chatStore.activeThreadId && chatThreads.length > 0) {
				chatStore.activeThreadId = chatThreads[0].id;
			}
		}

		// Initialize with recent messages if available
		if (recentMessages.length > 0) {
			threadMessages = recentMessages.map((msg) => ({
				id: msg.id,
				content: msg.content,
				role: msg.role === 'system' ? 'assistant' : (msg.role as 'user' | 'assistant'),
				timestamp: new Date(msg.timestamp),
				isLoading: false,
				fileContext: msg.fileContext
			}));
		}
	});

	async function loadThreadMessages(threadId: string) {
		if (!threadId) return;

		isLoadingMessages = true;
		try {
			const messages = await chatStore.getThreadMessages(threadId);
			threadMessages = messages.map((msg) => ({
				id: msg.id,
				content: msg.content,
				role: msg.role === 'system' ? 'assistant' : (msg.role as 'user' | 'assistant'),
				timestamp: new Date(msg.timestamp),
				isLoading: false,
				fileContext: msg.fileContext
			}));
		} catch (error) {
			console.error('Failed to load thread messages:', error);
		} finally {
			isLoadingMessages = false;
		}
	}

	async function handleSendMessage(event: CustomEvent<{ content: string }>) {
		const { content } = event.detail;

		if (!project?.id) {
			console.error('No project context available');
			return;
		}

		try {
			// Ensure we have an active thread or create one
			let threadId = chatStore.activeThreadId;
			if (!threadId) {
				// Create a new thread for this project
				threadId = await chatStore.createThread(
					`Chat ${new Date().toLocaleTimeString()}`,
					'Chat session created ' + new Date().toLocaleString(),
					project.id
				);
			}

			// Prepare file context metadata
			const fileContextMetadata =
				currentFileContext.isAttached && currentFileContext.file
					? {
							fileContext: {
								fileName: currentFileContext.file.name,
								filePath: currentFileContext.file.path,
								language: currentFileContext.file.language
							},
							context: currentFileContext.context
						}
					: undefined;

			// Add user message to thread
			const messageId = await chatStore.addMessageToThread(
				threadId,
				content,
				'user',
				fileContextMetadata?.fileContext,
				fileContextMetadata
			);

			// Add user message to UI immediately
			const userMessage: UIMessage = {
				id: messageId,
				content,
				role: 'user',
				timestamp: new Date(),
				isLoading: false,
				fileContext: fileContextMetadata?.fileContext
			};
			threadMessages = [...threadMessages, userMessage];

			// Add loading assistant message
			const loadingMessageId = crypto.randomUUID();
			const loadingMessage: UIMessage = {
				id: loadingMessageId,
				content: '',
				role: 'assistant',
				timestamp: new Date(),
				isLoading: true
			};
			threadMessages = [...threadMessages, loadingMessage];

			// Send to AI and get response with file context
			const response = await fetch('/api/chat/completion', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					threadId,
					content,
					model: selectedModel,
					enableTools: true,
					fileContext: fileContextMetadata?.fileContext,
					contextVariables: fileContextMetadata?.context,
					projectId: project.id
				})
			});

			if (!response.ok) {
				throw new Error('Failed to get AI response');
			}

			const responseData = await response.json();

			// Add assistant response to thread
			await chatStore.addMessageToThread(threadId, responseData.content, 'assistant');

			// Update loading message with response
			threadMessages = threadMessages.map((msg) =>
				msg.id === loadingMessageId
					? { ...msg, content: responseData.content, isLoading: false }
					: msg
			);
		} catch (error) {
			console.error('Failed to send message:', error);
			// Remove loading message on error
			threadMessages = threadMessages.filter((msg) => !msg.isLoading);
		}
	}

	function handleAttach() {
		console.log('File attachment - TODO: Implement file upload');
	}

	function handleVoice() {
		console.log('Voice input - TODO: Implement voice recording');
	}

	async function createNewThread() {
		if (!project?.id || isCreatingThread) return;

		isCreatingThread = true;
		try {
			const threadName = `Chat ${new Date().toLocaleTimeString()}`;
			const threadId = await chatStore.createThread(
				threadName,
				'New chat session created',
				project.id
			);

			// Switch to the new thread
			chatStore.activeThreadId = threadId;
			threadMessages = [];
			showThreadHistory = false;
		} catch (error) {
			console.error('Failed to create new thread:', error);
		} finally {
			isCreatingThread = false;
		}
	}

	async function switchToThread(threadId: string) {
		if (threadId === activeThreadId) {
			showThreadHistory = false;
			return;
		}

		chatStore.activeThreadId = threadId;
		showThreadHistory = false;
		await loadThreadMessages(threadId);
	}

	async function deleteThread(threadId: string, event?: Event) {
		if (event) {
			event.stopPropagation();
		}

		if (!confirm('Are you sure you want to delete this chat thread?')) {
			return;
		}

		try {
			await chatStore.deleteThread(threadId);

			// If we deleted the active thread, switch to another or create new
			if (threadId === activeThreadId) {
				const remainingThreads = chatStore.threads.filter((t) => t.id !== threadId);
				if (remainingThreads.length > 0) {
					chatStore.activeThreadId = remainingThreads[0].id;
					await loadThreadMessages(remainingThreads[0].id);
				} else {
					// No threads left, create a new one
					await createNewThread();
				}
			}
		} catch (error) {
			console.error('Failed to delete thread:', error);
		}
	}

	async function startEditingThread(threadId: string, currentName: string, event?: Event) {
		if (event) {
			event.stopPropagation();
		}

		editingThreadId = threadId;
		editingThreadName = currentName;

		// Focus the input after DOM update
		await tick();
		const input = document.querySelector(`[data-thread-input="${threadId}"]`) as HTMLInputElement;
		if (input) {
			input.focus();
			input.select();
		}
	}

	async function saveThreadName(threadId: string) {
		if (!editingThreadName.trim()) {
			cancelEditingThread();
			return;
		}

		try {
			await chatStore.updateThread(threadId, { title: editingThreadName.trim() });
			cancelEditingThread();
		} catch (error) {
			console.error('Failed to update thread name:', error);
		}
	}

	function cancelEditingThread() {
		editingThreadId = null;
		editingThreadName = '';
	}

	function handleThreadInputKeydown(event: KeyboardEvent, threadId: string) {
		if (event.key === 'Enter') {
			saveThreadName(threadId);
		} else if (event.key === 'Escape') {
			cancelEditingThread();
		}
	}

	function clearChat() {
		createNewThread();
	}
</script>

<div class="flex h-full w-full flex-col border-l bg-background">
	<!-- Header -->
	<div class="flex items-center justify-between border-b px-3 py-2">
		<div class="flex items-center gap-2">
			<div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
				<MessageSquare size={16} class="text-primary" />
			</div>
			<div>
				<h3 class="text-sm font-semibold">Aura Chat</h3>
				{#if activeThread}
					<p class="max-w-32 truncate text-xs text-muted-foreground" title={activeThread.title}>
						{activeThread.title}
					</p>
				{/if}
			</div>
		</div>

		<div class="flex items-center gap-1">
			<!-- New thread button -->
			<Button
				variant="ghost"
				size="icon"
				class="h-7 w-7"
				onclick={createNewThread}
				disabled={isCreatingThread}
				title="New chat"
			>
				{#if isCreatingThread}
					<div
						class="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
					></div>
				{:else}
					<Plus size={14} />
				{/if}
			</Button>

			<!-- Thread history dropdown -->
			<DropdownMenu bind:open={showThreadHistory}>
				<DropdownMenuTrigger>
					<History size={14} />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" class="max-h-96 w-80 overflow-y-auto">
					{#if chatStore.threads.length === 0}
						<div class="px-2 py-4 text-center text-sm text-muted-foreground">
							No chat threads yet
						</div>
					{:else}
						{#each chatStore.threads as thread (thread.id)}
							<DropdownMenuItem
								class="flex cursor-pointer items-center gap-2 px-2 py-2 {thread.id ===
								activeThreadId
									? 'bg-accent'
									: ''}"
								onclick={() => switchToThread(thread.id)}
							>
								<div class="min-w-0 flex-1">
									{#if editingThreadId === thread.id}
										<input
											type="text"
											bind:value={editingThreadName}
											onkeydown={(e) => handleThreadInputKeydown(e, thread.id)}
											onblur={() => saveThreadName(thread.id)}
											data-thread-input={thread.id}
											class="w-full border-none bg-transparent text-sm outline-none"
											onclick={(e) => e.stopPropagation()}
										/>
									{:else}
										<div class="truncate text-sm font-medium" title={thread.title}>
											{thread.title}
										</div>
										<div class="truncate text-xs text-muted-foreground" title={thread.description}>
											{thread.description || 'No description'}
										</div>
									{/if}
								</div>

								{#if editingThreadId !== thread.id}
									<div class="flex items-center gap-1">
										<Button
											variant="ghost"
											size="icon"
											class="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-muted"
											onclick={(e) => startEditingThread(thread.id, thread.title, e)}
											title="Rename"
										>
											<Edit3 size={12} />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											class="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
											onclick={(e) => deleteThread(thread.id, e)}
											title="Delete"
										>
											<Trash2 size={12} />
										</Button>
									</div>
								{/if}
							</DropdownMenuItem>
							{#if thread.id !== chatStore.threads[chatStore.threads.length - 1]?.id}
								<DropdownMenuSeparator />
							{/if}
						{/each}
					{/if}
				</DropdownMenuContent>
			</DropdownMenu>

			<!-- More options -->
			<DropdownMenu>
				<DropdownMenuTrigger>
					<MoreHorizontal size={14} />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onclick={() => dispatch('close')}>
						<div class="flex items-center gap-2">
							<span class="text-sm">Close chat</span>
						</div>
					</DropdownMenuItem>
					{#if activeThread}
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onclick={() => startEditingThread(activeThread.id, activeThread.title)}
						>
							<div class="flex items-center gap-2">
								<Edit3 size={14} />
								<span class="text-sm">Rename current chat</span>
							</div>
						</DropdownMenuItem>
						<DropdownMenuItem
							class="text-destructive hover:bg-destructive hover:text-destructive-foreground"
							onclick={() => deleteThread(activeThread.id)}
						>
							<div class="flex items-center gap-2">
								<Trash2 size={14} />
								<span class="text-sm">Delete current chat</span>
							</div>
						</DropdownMenuItem>
					{/if}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	</div>

	<!-- Chat messages -->
	<div class="flex-1 overflow-hidden">
		<ChatContainer
			messages={threadMessages}
			isLoading={isLoadingMessages || threadMessages.some((m) => m.isLoading)}
		/>
	</div>

	<!-- Chat input -->
	<ChatInput on:send={handleSendMessage} on:attach={handleAttach} on:voice={handleVoice} />
</div>
