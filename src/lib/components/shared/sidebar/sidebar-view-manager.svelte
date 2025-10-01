<script lang="ts">
	import VectorDbStatus from '$lib/components/editor/vector-db-status.svelte';
	import type { SidebarView } from '$lib/stores/sidebar-panels.store';
	import FileExplorer from './file-explorer.svelte';

	interface Props {
		currentView: SidebarView;
		searchQuery?: string;
		project?: { id: string; sandboxId?: string; sandboxProvider?: string };
	}

	let { currentView, searchQuery = '', project }: Props = $props();
</script>

<div class="flex h-full flex-1 flex-col">
	{#if currentView === 'explorer'}
		<FileExplorer {project} {searchQuery} />
	{:else if currentView === 'search'}
		<div class="p-4">
			<h2 class="mb-4 font-semibold">Search</h2>
			<p class="text-sm text-muted-foreground">Global search functionality would go here</p>
		</div>
	{:else if currentView === 'vector-indexing'}
		<div class="p-4">
			<h2 class="mb-4 font-semibold">Vector Indexing</h2>
			<VectorDbStatus {project} />
		</div>
	{:else if currentView === 'source-control'}
		<div class="p-4">
			<h2 class="mb-4 font-semibold">Source Control</h2>
			<p class="text-sm text-muted-foreground">Git integration would go here</p>
		</div>
	{:else if currentView === 'debug'}
		<div class="p-4">
			<h2 class="mb-4 font-semibold">Run and Debug</h2>
			<p class="text-sm text-muted-foreground">Debug functionality would go here</p>
		</div>
	{:else if currentView === 'extensions'}
		<div class="p-4">
			<h2 class="mb-4 font-semibold">Extensions</h2>
			<p class="text-sm text-muted-foreground">Extensions management would go here</p>
		</div>
	{:else}
		<div class="p-4">
			<h2 class="mb-4 font-semibold">Unknown View</h2>
			<p class="text-sm text-muted-foreground">View not implemented yet...</p>
		</div>
	{/if}
</div>
