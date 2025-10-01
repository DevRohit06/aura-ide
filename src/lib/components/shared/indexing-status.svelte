<script lang="ts">
	import { indexerStatus } from '$lib/stores/vector-indexer.store';
	import { derived } from 'svelte/store';

	const statusText = derived(indexerStatus, ($s) => {
		switch ($s.status) {
			case 'idle':
				return 'Idle';
			case 'indexing':
				return `Indexing ${$s.pending} file(s)`;
			case 'done':
				return `Indexed ${$s.indexed} file(s)`;
			case 'error':
				return `Indexing error`;
		}
	});
</script>

<div class="indexer-badge" aria-live="polite">
	{#if $indexerStatus.status === 'indexing'}
		<span class="mr-2">⏳</span>
	{/if}
	{#if $indexerStatus.status === 'done'}
		<span class="mr-2">✅</span>
	{/if}
	{#if $indexerStatus.status === 'error'}
		<span class="mr-2">❗</span>
	{/if}
	<span>{$statusText}</span>
</div>

<style>
	.indexer-badge {
		position: absolute;
		top: 8px;
		right: 16px;
		background: rgba(0, 0, 0, 0.6);
		color: white;
		padding: 6px 10px;
		border-radius: 6px;
		font-size: 12px;
		backdrop-filter: blur(4px);
	}
</style>
