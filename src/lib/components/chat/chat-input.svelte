<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { ArrowUp, Plus } from '@lucide/svelte';

	const dispatch = createEventDispatcher<{
		send: { content: string };
		attach: void;
		voice: void;
	}>();

	let input = $state('');
	let textareaElement = $state<HTMLTextAreaElement>();
	let isComposing = $state(false);

	function handleSend() {
		const content = input.trim();
		if (!content) return;

		dispatch('send', { content });
		input = '';

		// Reset textarea height
		if (textareaElement) {
			textareaElement.style.height = 'auto';
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey && !isComposing) {
			event.preventDefault();
			handleSend();
		}
	}

	function handleInput() {
		if (!textareaElement) return;

		// Save cursor position
		const cursorPosition = textareaElement.selectionStart;

		// Auto-resize textarea
		textareaElement.style.height = 'auto';
		textareaElement.style.height = textareaElement.scrollHeight + 'px';

		// Restore cursor position
		requestAnimationFrame(() => {
			if (textareaElement && cursorPosition !== null) {
				textareaElement.setSelectionRange(cursorPosition, cursorPosition);
			}
		});
	}

	function handleCompositionStart() {
		isComposing = true;
	}

	function handleCompositionEnd() {
		isComposing = false;
	}
</script>

<div class="p-4">
	<!-- Modern input container -->
	<div
		class="relative rounded-xl border border-border/50 bg-muted/10 transition-all duration-200 focus-within:border-primary/30 focus-within:bg-background focus-within:shadow-sm"
	>
		<div class="flex items-end gap-2 p-3">
			<!-- Attachment button -->

			<!-- Input area -->
			<div class="relative flex min-h-[32px] flex-1 items-center">
				<textarea
					bind:this={textareaElement}
					bind:value={input}
					placeholder="Ask anything about your code..."
					class="max-h-32 min-h-[24px] w-full resize-none border-0 bg-transparent py-1 text-sm leading-6 placeholder:text-muted-foreground/70 focus:outline-none"
					rows={1}
					onkeydown={handleKeyDown}
					oninput={handleInput}
					oncompositionstart={handleCompositionStart}
					oncompositionend={handleCompositionEnd}
				></textarea>
			</div>
		</div>
	</div>
	<Button
		variant="ghost"
		size="icon"
		class="h-8 w-8 shrink-0 rounded-lg transition-colors hover:bg-muted/80"
		onclick={() => dispatch('attach')}
		title="Attach file"
	>
		<Plus />
	</Button>
	<!-- Action buttons -->
	<div class="flex shrink-0 items-center gap-1">
		<!-- Voice button -->
		<Button
			variant="ghost"
			size="icon"
			class="h-8 w-8 rounded-lg transition-colors hover:bg-muted/80"
			onclick={() => dispatch('voice')}
			title="Voice input"
		>
			<span class="text-sm text-muted-foreground">🎤</span>
		</Button>

		<!-- Send button -->
		<Button
			size="icon"
			class="h-8 w-8 rounded-lg bg-primary text-primary-foreground transition-all duration-200 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted/50 disabled:text-muted-foreground"
			disabled={!input.trim()}
			onclick={handleSend}
			title="Send message"
		>
			<ArrowUp />
		</Button>
	</div>

	<!-- Subtle tips -->
	<div class="mt-2 flex items-center justify-center gap-4 px-1 text-xs text-muted-foreground/60">
		<span
			>Press <kbd class="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-xs">⏎</kbd> to send</span
		>
		<span>•</span>
		<span
			><kbd class="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-xs">⇧⏎</kbd> for new line</span
		>
	</div>
</div>
