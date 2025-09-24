<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import type { Project } from '$lib/types';
	import { chatStore } from '@/stores/chat.svelte';
	import { fileContext } from '@/stores/editor';
	import { selectedModelStore } from '@/stores/model';
	import { createEventDispatcher, onMount } from 'svelte';
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

	function clearChat() {
		if (project?.id) {
			// Create a new thread for this project
			chatStore
				.createThread(
					`Chat ${new Date().toLocaleTimeString()}`,
					'Chat session created ' + new Date().toLocaleString(),
					project.id
				)
				.then((threadId) => {
					threadMessages = [];
				})
				.catch((error) => {
					console.error('Failed to create new thread:', error);
				});
		}
	}
</script>

<div class="flex h-full w-full flex-col border-l bg-background">
	<!-- Header -->
	<div class="flex items-center justify-between border-b">
		<div class="flex items-center gap-2">
			<div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">🤖</div>
			<div>
				<h3 class="text-sm font-semibold">Aura</h3>
			</div>
		</div>

		<div class="flex items-center gap-1">
			{#if threadMessages.length > 0}
				<Button variant="ghost" size="icon" class="h-8 w-8" onclick={clearChat} title="New chat">
					🗑️
				</Button>
			{/if}
			<Button
				variant="ghost"
				size="icon"
				class="h-8 w-8"
				onclick={() => dispatch('close')}
				title="Close chat"
			>
				✕
			</Button>
		</div>
	</div>

	<!-- Chat messages -->
	<div class="flex-1 overflow-y-auto">
		<ChatContainer
			messages={threadMessages}
			isLoading={isLoadingMessages || threadMessages.some((m) => m.isLoading)}
		/>
	</div>

	<!-- Chat input -->
	<ChatInput on:send={handleSendMessage} on:attach={handleAttach} on:voice={handleVoice} />
</div>
