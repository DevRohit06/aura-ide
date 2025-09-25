<script lang="ts">
	import { run } from 'svelte/legacy';

	// import AnimatedShinyText from '$lib/components/animated-shiny-text.svelte';
	import Icon from '@iconify/svelte';
	import { onMount } from 'svelte';
	import { fade, slide } from 'svelte/transition';

	interface Props {
		text: string;
		raw: string;
	}

	let { text, raw }: Props = $props();

	let expanded = $state(false);
	let thinkingDots = $state('');
	let interval: NodeJS.Timeout = $state();
	let contentDiv: HTMLDivElement = $state();
	let decodedText: string = $derived(
		text
			? text
					.replace(/&#39;/g, "'")
					.replace(/&quot;/g, '"')
					.replace(/&amp;/g, '&')
			: ''
	);

	let isThinking = $derived(!raw?.includes('</think>'));
	run(() => {
		expanded = isThinking;
	});

	// Clean up interval on component destroy
	onMount(() => {
		return () => {
			if (interval) {
				clearInterval(interval);
			}
		};
	});

	// Start/stop thinking animation
	run(() => {
		if (isThinking && !interval) {
			interval = setInterval(() => {
				thinkingDots = thinkingDots.length >= 3 ? '' : thinkingDots + '.';
			}, 500);
		} else if (!isThinking && interval) {
			clearInterval(interval);
			interval = undefined;
			thinkingDots = '';
			expanded = false;
		}
	});

	// Auto scroll to bottom when content changes
	run(() => {
		if (contentDiv && text) {
			contentDiv.scrollTop = contentDiv.scrollHeight;
		}
	});

	// Decode HTML entities
</script>

<div
	class="relative mb-2 rounded-lg border bg-background px-2 py-1.5"
	transition:fade={{ duration: 200 }}
>
	<div class="flex items-center gap-2 text-sm text-foreground/60">
		<button
			class="flex items-center gap-1 transition-colors hover:text-foreground/80"
			onclick={() => {
				if (!isThinking) {
					expanded = !expanded;
				}
			}}
		>
			<Icon
				icon={expanded ? 'material-symbols:expand-less' : 'material-symbols:expand-more'}
				class="h-5 w-5"
			/>
			<span class="flex items-center gap-1 text-foreground/80">
				<Icon icon="material-symbols:psychology" class="h-4 w-4" />
				{#if isThinking}
					<!-- <AnimatedShinyText> -->
					<span class="italic">Thinking{thinkingDots}</span>
					<!-- </AnimatedShinyText> -->
				{:else}
					<span>View my thought process</span>
				{/if}
			</span>
		</button>
	</div>

	{#if expanded}
		<div class="not-prose text-sm text-foreground/60" transition:slide={{ duration: 200 }}>
			<div
				class="scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent mt-2 max-h-[250px] overflow-y-auto rounded-lg bg-background/5 p-3"
				bind:this={contentDiv}
			>
				<div class="whitespace-pre-wrap">{decodedText}</div>
			</div>
		</div>
	{/if}
</div>

<style>
	/* Add any additional styles here */
	/* Custom scrollbar styling */
</style>
