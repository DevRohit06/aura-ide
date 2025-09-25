<script lang="ts">
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogTrigger
	} from '$lib/components/ui/dialog';
	import type { Token } from 'marked';

	interface Props {
		url: string;
		token: Token;
		children?: import('svelte').Snippet;
	}

	let { url, token, children }: Props = $props();

	let open = $state(false);
</script>

<Dialog bind:open>
	<DialogTrigger>
		<button class="cursor-pointer text-blue-600 underline hover:text-blue-800">
			{@render children?.()}
		</button>
	</DialogTrigger>
	<DialogContent class="max-h-[80vh] max-w-4xl">
		<DialogHeader>
			<DialogTitle>Link Preview</DialogTitle>
		</DialogHeader>
		<div class="mt-4">
			{#if url.startsWith('http')}
				<iframe
					src={url}
					class="h-96 w-full rounded border"
					title="Link content"
					sandbox="allow-scripts allow-same-origin"
				></iframe>
			{:else}
				<p class="text-sm text-muted-foreground">
					External link: <a
						href={url}
						target="_blank"
						rel="noopener noreferrer"
						class="text-blue-600 hover:underline">{url}</a
					>
				</p>
			{/if}
		</div>
	</DialogContent>
</Dialog>
