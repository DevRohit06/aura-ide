<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import ChatContainer from './chat-container.svelte';
	import ChatInput from './chat-input.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';

	const dispatch = createEventDispatcher<{
		close: void;
	}>();

	// Chat state
	let messages = $state<
		Array<{
			id: string;
			content: string;
			role: 'user' | 'assistant';
			timestamp: Date;
		}>
	>([]);

	let isLoading = $state(false);

	function generateId(): string {
		return Date.now().toString(36) + Math.random().toString(36).substr(2);
	}

	function addMessage(content: string, role: 'user' | 'assistant') {
		messages = [
			...messages,
			{
				id: generateId(),
				content,
				role,
				timestamp: new Date()
			}
		];
	}

	async function handleSendMessage(event: CustomEvent<{ content: string }>) {
		const { content } = event.detail;

		// Add user message
		addMessage(content, 'user');

		// Show loading state
		isLoading = true;

		try {
			// Simulate API call - replace with actual AI service
			await new Promise((resolve) => setTimeout(resolve, 1500));

			// Add assistant response (mock response for now)
			const responses = [
				"I can help you with that! Could you provide more context about what you're trying to achieve?",
				"That's a great question. Let me analyze your code and provide some suggestions.",
				"I see what you're working on. Here are some recommendations to improve your code:",
				'Based on your code, I notice a few areas where we could optimize performance.',
				'This looks good! Here are some best practices you might consider:'
			];

			const randomResponse = responses[Math.floor(Math.random() * responses.length)];
			addMessage(randomResponse, 'assistant');
		} catch (error) {
			addMessage('Sorry, I encountered an error. Please try again.', 'assistant');
		} finally {
			isLoading = false;
		}
	}

	function handleAttach() {
		// TODO: Implement file attachment
		console.log('Attach file');
	}

	function handleVoice() {
		// TODO: Implement voice input
		console.log('Voice input');
	}

	function clearChat() {
		messages = [];
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
			{#if messages.length > 0}
				<Button variant="ghost" size="icon" class="h-8 w-8" onclick={clearChat} title="Clear chat">
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
	<div class="flex-1 overflow-hidden">
		<ChatContainer {messages} {isLoading} />
	</div>

	<!-- Chat input -->
	<ChatInput onsend={handleSendMessage} onattach={handleAttach} onvoice={handleVoice} />
</div>
