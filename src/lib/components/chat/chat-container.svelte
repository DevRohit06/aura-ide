<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { ChevronDown, MessageSquare } from '@lucide/svelte';
	import { createEventDispatcher, onMount, tick, untrack } from 'svelte';
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
		user?: {
			id: string;
			email: string;
			username?: string;
			name?: string;
			image?: string | null;
		};
	}

	let { messages = [], isLoading = false, user = undefined }: Props = $props();

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
	let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
	let scrollDebounceTimeout: ReturnType<typeof setTimeout> | null = null;

	// Track new messages while user is scrolled up
	$effect(() => {
		const currentCount = messages.length;
		if (currentCount > lastMessageCount && lastMessageCount > 0) {
			if (showScrollButton) {
				newMessagesCount += currentCount - lastMessageCount;
			} else {
				newMessagesCount = 0;
			}
		}
		lastMessageCount = currentCount;
	});

	function scrollToBottom(smooth = true) {
		if (!scrollContainer || isScrolling) return;

		// Clear any pending scroll operations
		if (scrollTimeout) {
			clearTimeout(scrollTimeout);
			scrollTimeout = null;
		}

		isScrolling = true;

		// Use requestAnimationFrame for better performance
		requestAnimationFrame(() => {
			if (!scrollContainer) {
				isScrolling = false;
				return;
			}

			const targetScroll = scrollContainer.scrollHeight;

			if (smooth) {
				scrollContainer.scrollTo({
					top: targetScroll,
					behavior: 'smooth'
				});
				// Reset flag after animation
				scrollTimeout = setTimeout(() => {
					isScrolling = false;
					scrollTimeout = null;
				}, 300);
			} else {
				scrollContainer.scrollTop = targetScroll;
				isScrolling = false;
			}
		});
	}

	function handleScroll() {
		if (!scrollContainer || isScrolling) return;

		// Debounce scroll handler to avoid excessive updates
		if (scrollDebounceTimeout) {
			clearTimeout(scrollDebounceTimeout);
		}

		scrollDebounceTimeout = setTimeout(() => {
			if (!scrollContainer) return;

			const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
			const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

			// More lenient threshold for auto-scroll (100px)
			const isNearBottom = distanceFromBottom <= 100;
			// Show scroll button when more than 200px from bottom
			const isScrolledUp = distanceFromBottom > 200;

			shouldAutoScroll = isNearBottom;
			userScrolled = !isNearBottom;
			showScrollButton = isScrolledUp && untrack(() => messages.length) > 0;
			scrollDebounceTimeout = null;
		}, 50);
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
		const msgCount = messages.length;

		// Use untrack to read scroll state without creating dependencies
		const shouldScroll = untrack(() => shouldAutoScroll && !userScrolled && !isScrolling);

		if (msgCount > 0 && shouldScroll) {
			// Defer scroll to next frame to ensure DOM is ready
			requestAnimationFrame(() => {
				tick().then(() => {
					if (untrack(() => shouldAutoScroll && !isScrolling)) {
						scrollToBottom(false);
					}
				});
			});
		}
	});

	// Auto-scroll when loading completes
	let wasLoading = $state(false);
	$effect(() => {
		const currentlyLoading = isLoading;

		// Only scroll when loading completes (goes from true to false)
		if (wasLoading && !currentlyLoading) {
			const msgCount = untrack(() => messages.length);
			const shouldScroll = untrack(() => shouldAutoScroll);

			if (msgCount > 0 && shouldScroll) {
				// Smooth scroll when loading completes
				requestAnimationFrame(() => {
					tick().then(() => {
						if (untrack(() => shouldAutoScroll && !isScrolling)) {
							scrollToBottom(true);
						}
					});
				});
			}
		}
		wasLoading = currentlyLoading;
	});

	// Initial scroll to bottom
	onMount(() => {
		// Wait for content to load
		const timeout = setTimeout(() => {
			if (messages.length > 0) {
				scrollToBottom(false);
			}
		}, 100);

		// Cleanup function
		return () => {
			clearTimeout(timeout);
			if (scrollTimeout) clearTimeout(scrollTimeout);
			if (scrollDebounceTimeout) clearTimeout(scrollDebounceTimeout);
		};
	});
</script>

<div class="flex h-full flex-col">
	<!-- Messages container -->
	<div class="relative h-full flex-1">
		<div bind:this={scrollContainer} class="h-full overflow-y-auto px-1" onscroll={handleScroll}>
			{#if messages.length === 0}
				<div class="flex h-full items-center justify-center p-8 text-center">
					<div class="max-w-md space-y-4">
						<div class="flex justify-center">
							<div class="rounded-full bg-primary/10 p-6">
								<MessageSquare class="h-12 w-12 text-primary" />
							</div>
						</div>
						<div>
							<h3 class="mb-2 text-lg font-semibold">Start a conversation</h3>
							<p class="text-sm leading-relaxed text-muted-foreground">
								Ask questions about your code, get suggestions, or request help with debugging. I'm
								here to assist you!
							</p>
						</div>
					</div>
				</div>
			{:else}
				<div class="space-y-1 py-2">
					{#each messages as message, index (message.id)}
						<Message
							{message}
							{user}
							isLast={index === messages.length - 1}
							on:approveInterrupt={(e) => dispatch('approveInterrupt', e.detail)}
							on:rejectInterrupt={() => dispatch('rejectInterrupt')}
							on:modifyInterrupt={(e) => dispatch('modifyInterrupt', e.detail)}
						/>
					{/each}
				</div>

				<!-- Loading indicator - only show when loading but NOT streaming -->
				{@const hasStreamingMessage = messages.some((m) => m.metadata?.isStreaming)}
				{#if isLoading && !hasStreamingMessage}
					<div class="mx-4 mb-4 flex gap-3 rounded-lg border bg-muted/30 p-4">
						<div
							class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10"
						>
							<div class="h-2 w-2 animate-pulse rounded-full bg-primary"></div>
						</div>
						<div class="flex-1 space-y-2">
							<div class="flex items-center gap-2">
								<div class="h-3 w-24 animate-pulse rounded bg-muted"></div>
							</div>
							<div class="space-y-1.5">
								<div class="h-2.5 w-full animate-pulse rounded bg-muted"></div>
								<div class="h-2.5 w-4/5 animate-pulse rounded bg-muted"></div>
								<div class="h-2.5 w-2/3 animate-pulse rounded bg-muted"></div>
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
