<script lang="ts">
	import { onMount } from 'svelte';
	import Message from './message.svelte';
	import { Button } from '$lib/components/ui/button';

	interface MessageType {
		id: string;
		content: string;
		role: 'user' | 'assistant';
		timestamp: Date;
		isLoading?: boolean;
	}

	interface Props {
		messages?: MessageType[];
		isLoading?: boolean;
	}

	let { messages = [], isLoading = false }: Props = $props();

	let scrollContainer = $state<HTMLDivElement>();
	let shouldAutoScroll = $state(true);
	let userScrolled = $state(false);

	function scrollToBottom(smooth = true) {
		if (!scrollContainer) return;

		scrollContainer.scrollTo({
			top: scrollContainer.scrollHeight,
			behavior: smooth ? 'smooth' : 'instant'
		});
	}

	function handleScroll() {
		if (!scrollContainer) return;

		const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
		const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10; // 10px threshold

		shouldAutoScroll = isAtBottom;
		userScrolled = !isAtBottom;
	}

	function scrollToBottomClick() {
		shouldAutoScroll = true;
		userScrolled = false;
		scrollToBottom();
	}

	// Auto-scroll when messages change
	$effect(() => {
		if (messages.length > 0 && shouldAutoScroll && !userScrolled) {
			setTimeout(() => scrollToBottom(), 0);
		}
	});

	// Initial scroll to bottom
	onMount(() => {
		setTimeout(() => scrollToBottom(false), 100);
	});
</script>

<div class="flex h-full flex-col">
	<!-- Messages container -->
	<div class="relative flex-1">
		<div
			bind:this={scrollContainer}
			class="h-full overflow-y-auto scroll-smooth"
			onscroll={handleScroll}
		>
			{#if messages.length === 0}
				<div class="flex h-full items-center justify-center p-8 text-center">
					<div class="max-w-sm">
						<div class="mb-4 text-6xl">💬</div>
						<h3 class="mb-2 text-lg font-semibold">Start a conversation</h3>
						<p class="text-sm text-muted-foreground">
							Ask questions about your code, get suggestions, or request help with debugging.
						</p>
					</div>
				</div>
			{:else}
				<div class="divide-y divide-border">
					{#each messages as message, index}
						<Message {message} isLast={index === messages.length - 1} />
					{/each}
				</div>

				<!-- Loading indicator -->
				{#if isLoading}
					<div class="flex animate-pulse gap-3 p-4">
						<div class="h-8 w-8 shrink-0 rounded-full bg-muted"></div>
						<div class="flex-1 space-y-2">
							<div class="h-4 w-20 rounded bg-muted"></div>
							<div class="space-y-1">
								<div class="h-3 w-full rounded bg-muted"></div>
								<div class="h-3 w-3/4 rounded bg-muted"></div>
								<div class="h-3 w-1/2 rounded bg-muted"></div>
							</div>
						</div>
					</div>
				{/if}
			{/if}
		</div>

		<!-- Scroll to bottom button -->
		{#if userScrolled && !shouldAutoScroll}
			<div class="absolute bottom-4 left-1/2 -translate-x-1/2 transform">
				<Button size="sm" variant="secondary" class="shadow-lg" onclick={scrollToBottomClick}>
					↓ New messages
				</Button>
			</div>
		{/if}
	</div>
</div>
