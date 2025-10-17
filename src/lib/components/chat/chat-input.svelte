<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { modelActions, selectedModelStore } from '@/stores/model';
	import { ArrowUp } from '@lucide/svelte';
	import { createEventDispatcher } from 'svelte';
	import CompactModelSelector from './compact-model-selector.svelte';

	const dispatch = createEventDispatcher<{
		send: { content: string; includeCodeContext?: boolean; codeQuery?: string };
		attach: void;
		voice: void;
	}>();

	let { disabled = false }: { disabled?: boolean } = $props();

	function handleModelChange(modelId: string) {
		modelActions.setModel(modelId);
	}

	let input = $state('');
	let textareaElement = $state<HTMLTextAreaElement>();
	let isComposing = $state(false);

	// New: include code context toggle and optional custom query
	let includeCodeContext = $state(false);
	let codeQuery = $state('');

	function handleSend() {
		const content = input.trim();
		if (!content) return;

		dispatch('send', { content, includeCodeContext, codeQuery });
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

<div class="p-4 py-1">
	<!-- Modern input container -->
	<div
		class="relative rounded-xl border border-border/50 bg-muted/10 transition-all duration-200 focus-within:border-primary/30 focus-within:bg-background focus-within:shadow-sm"
	>
		<!-- Model selector header -->
		<div class="flex items-center justify-between border-b border-border/30 px-3 py-2">
			<CompactModelSelector
				value={$selectedModelStore}
				onValueChange={handleModelChange}
				placeholder="Sonnet 4"
			/>
		</div>

		<div class="flex items-end gap-2 p-3">
			<!-- Attachment button -->
			<!-- <Button
				variant="ghost"
				size="icon"
				class="h-8 w-8 shrink-0 rounded-lg transition-colors hover:bg-muted/80"
				{disabled}
				onclick={() => dispatch('attach')}
				title="Attach file"
			>
				<Plus />
			</Button> -->

			<!-- Input area -->
			<div class="relative flex min-h-[36px] flex-1 items-center">
				<textarea
					bind:this={textareaElement}
					bind:value={input}
					placeholder="Ask me anything..."
					class="max-h-40 min-h-[24px] w-full resize-none border-0 bg-transparent py-1 text-sm leading-6 placeholder:text-muted-foreground/60 focus:outline-none"
					rows={1}
					{disabled}
					onkeydown={handleKeyDown}
					oninput={handleInput}
					oncompositionstart={handleCompositionStart}
					oncompositionend={handleCompositionEnd}
				></textarea>
			</div>

			<!-- Action buttons -->
			<div class="flex shrink-0 items-center gap-1">
				<!-- Voice button -->
				<!-- <Button
					variant="ghost"
					size="icon"
					class="h-8 w-8 rounded-lg transition-colors hover:bg-muted/80"
					{disabled}
					onclick={() => dispatch('voice')}
					title="Voice input"
				>
					<span class="text-sm text-muted-foreground">🎤</span>
				</Button> -->

				<!-- Send button -->
				<Button
					size="icon"
					class="h-9 w-9 rounded-lg bg-primary text-primary-foreground transition-all duration-200 hover:scale-105 hover:bg-primary/90 disabled:scale-100 disabled:cursor-not-allowed disabled:bg-muted/50 disabled:text-muted-foreground"
					disabled={disabled || !input.trim()}
					onclick={handleSend}
					title="Send message (Enter)"
				>
					<ArrowUp class="h-4 w-4" />
				</Button>
			</div>
		</div>
	</div>

	<!-- Subtle tips -->
	<div class="mt-2 flex items-center justify-center gap-3 px-1 text-xs text-muted-foreground/50">
		<span class="flex items-center gap-1.5">
			<kbd class="rounded border bg-muted/30 px-1.5 py-0.5 font-mono text-[10px] shadow-sm">⏎</kbd>
			Send
		</span>
		<span class="text-muted-foreground/30">•</span>
		<span class="flex items-center gap-1.5">
			<kbd class="rounded border bg-muted/30 px-1.5 py-0.5 font-mono text-[10px] shadow-sm">⇧⏎</kbd>
			New line
		</span>
	</div>

	<!-- Add a small toggle and optional query input -->
</div>
