<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { ChevronDown } from '@lucide/svelte';
	import { createEventDispatcher, onMount, tick } from 'svelte';
	import Message from './message.svelte';

	interface MessageType {
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

	interface Props {
		messages?: MessageType[];
		isLoading?: boolean;
	}

	let { messages = [], isLoading = false }: Props = $props();

	// Forward interrupt events from Message components
	const dispatch = createEventDispatcher<{
		approveInterrupt: { toolCalls: any[] };
		rejectInterrupt: void;
		modifyInterrupt: { edits: Array<{ filePath: string; content: string }> };
	}>();

	let scrollContainer = $state<HTMLDivElement>();
	let shouldAutoScroll = $state(true);
	let userScrolled = $state(false);
	let showScrollButton = $state(false);
	let newMessagesCount = $state(0);
	let lastMessageCount = $state(0);
	let isScrolling = $state(false);

	// Track new messages while user is scrolled up
	$effect(() => {
		if (messages.length > lastMessageCount) {
			if (showScrollButton) {
				newMessagesCount += messages.length - lastMessageCount;
			} else {
				newMessagesCount = 0;
			}
		}
		lastMessageCount = messages.length;
	});

	async function scrollToBottom(smooth = true) {
		if (!scrollContainer) return;

		isScrolling = true;
		try {
			if (smooth) {
				scrollContainer.scrollTo({
					top: scrollContainer.scrollHeight,
					behavior: 'smooth'
				});
			} else {
				scrollContainer.scrollTop = scrollContainer.scrollHeight;
			}
		} finally {
			// Wait for scroll to complete
			setTimeout(
				() => {
					isScrolling = false;
				},
				smooth ? 300 : 50
			);
		}
	}

	function handleScroll() {
		if (!scrollContainer) return;

		const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
		const isNearBottom = scrollTop + clientHeight >= scrollHeight - 50; // 50px threshold
		const isScrolledUp = scrollTop < scrollHeight - clientHeight - 150; // Show button when 150px from bottom

		shouldAutoScroll = isNearBottom;
		userScrolled = !isNearBottom;
		showScrollButton = isScrolledUp && messages.length > 0;

		// Reset isScrolling flag if user manually scrolled
		if (isScrolling) {
			isScrolling = false;
		}
	}

	function scrollToBottomClick() {
		shouldAutoScroll = true;
		userScrolled = false;
		showScrollButton = false;
		newMessagesCount = 0;
		scrollToBottom(true);
	}

	// Auto-scroll when new messages arrive
	$effect(() => {
		if (messages.length && shouldAutoScroll && !userScrolled) {
			// Use tick to ensure DOM is updated
			tick().then(() => {
				scrollToBottom(false);
			});
		}
	});

	// Auto-scroll when loading completes
	$effect(() => {
		if (!isLoading && messages.length && shouldAutoScroll && !userScrolled) {
			tick().then(() => {
				scrollToBottom(false);
			});
		}
	});

	// Initial scroll to bottom
	onMount(() => {
		// Wait for content to load
		setTimeout(() => {
			if (messages.length > 0) {
				scrollToBottom(false);
			}
		}, 100);
	});
</script>

<div class="flex h-full flex-col">
	<!-- Messages container -->
	<div class="relative h-full flex-1">
		<div bind:this={scrollContainer} class="h-full overflow-y-auto px-1" onscroll={handleScroll}>
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
				<div class="space-y-1">
					{#each messages as message, index (message.id)}
						<Message
							{message}
							isLast={index === messages.length - 1}
							on:approveInterrupt={(e) => dispatch('approveInterrupt', e.detail)}
							on:rejectInterrupt={() => dispatch('rejectInterrupt')}
							on:modifyInterrupt={(e) => dispatch('modifyInterrupt', e.detail)}
						/>
					{/each}
				</div>

				<!-- Loading indicator -->
				{#if isLoading}
					<div class="flex animate-pulse gap-3 p-4">
						<div class="h-8 w-8 shrink-0 rounded-full bg-muted"></div>
						<div class="flex-1 space-y-2">
							<div class="h-4 w-full rounded bg-muted"></div>
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
		{#if showScrollButton}
			<div class="absolute right-4 bottom-4 z-20">
				<Button
					size="icon"
					variant="secondary"
					class="relative h-10 w-10 rounded-full border border-border/50 bg-background/80 shadow-lg backdrop-blur-sm transition-all duration-200 hover:bg-background/90"
					onclick={scrollToBottomClick}
					title="Scroll to bottom ({newMessagesCount} new messages)"
				>
					<ChevronDown size={16} />
					{#if newMessagesCount > 0}
						<div
							class="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground"
						>
							{newMessagesCount > 99 ? '99+' : newMessagesCount}
						</div>
					{/if}
				</Button>
			</div>
		{/if}
	</div>
</div>
