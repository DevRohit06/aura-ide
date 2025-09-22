<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import type { Project } from '$lib/types';
	import { chatStore } from '@/stores/chat.svelte';
	import { createEventDispatcher } from 'svelte';
	import ChatContainer from './chat-container.svelte';
	import ChatInput from './chat-input.svelte';

	// Props
	interface Props {
		project?: Project;
	}

	let { project = undefined }: Props = $props();

	const dispatch = createEventDispatcher<{
		close: void;
	}>();

	// Reactive references to store state
	const sessions = $derived(chatStore.sessions);
	const activeSession = $derived(chatStore.activeSession);
	const activeSessionId = $derived(chatStore.activeSessionId);

	async function handleSendMessage(event: CustomEvent<{ content: string }>) {
		const { content } = event.detail;

		// Ensure we have an active session
		let sessionId = chatStore.activeSessionId;
		if (!sessionId) {
			sessionId = chatStore.createSession();
		}

		// Send the message
		await chatStore.sendMessage(sessionId, content);
	}

	function handleAttach() {
		console.log('File attachment - TODO: Implement file upload');
	}

	function handleVoice() {
		console.log('Voice input - TODO: Implement voice recording');
	}

	function clearChat() {
		chatStore.createSession();
	}
</script>

<div class="flex h-full w-full flex-col border-l bg-background">
	<!-- Header -->
	<div class="flex items-center justify-between border-b p-4">
		<div class="flex items-center gap-2">
			<div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">🤖</div>
			<div>
				<h3 class="text-sm font-semibold">AI Assistant</h3>
				<p class="text-xs text-muted-foreground">Ready to help</p>
			</div>
		</div>

		<div class="flex items-center gap-1">
			{#if activeSession && activeSession.messages.length > 0}
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
			messages={activeSession?.messages || []}
			isLoading={activeSession?.messages.some((m) => m.isLoading) || false}
		/>
	</div>

	<!-- Chat input -->
	<ChatInput on:send={handleSendMessage} on:attach={handleAttach} on:voice={handleVoice} />
</div>
