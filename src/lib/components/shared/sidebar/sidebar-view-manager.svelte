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

<div class="flex h-full w-full flex-col bg-sidebar">
	{#if currentView === 'explorer'}
		<FileExplorer {project} {searchQuery} />
	{:else if currentView === 'search'}
		<div class="flex h-full flex-col">
			<div class="border-b border-border p-3">
				<h2 class="text-sm font-semibold tracking-wide text-sidebar-foreground uppercase">
					Search
				</h2>
			</div>
			<div class="flex-1 p-4">
				<p class="text-sm text-muted-foreground">Global search functionality would go here</p>
			</div>
		</div>
	{:else if currentView === 'vector-indexing'}
		<div class="flex h-full flex-col">
			<div class="border-b border-border p-3">
				<h2 class="text-sm font-semibold tracking-wide text-sidebar-foreground uppercase">
					Vector Indexing
				</h2>
			</div>
			<div class="flex-1 p-4">
				<VectorDbStatus {project} />
			</div>
		</div>
	{:else if currentView === 'source-control'}
		<div class="flex h-full flex-col">
			<div class="border-b border-border p-3">
				<h2 class="text-sm font-semibold tracking-wide text-sidebar-foreground uppercase">
					Source Control
				</h2>
			</div>
			<div class="flex-1 p-4">
				<p class="text-sm text-muted-foreground">Git integration would go here</p>
			</div>
		</div>
	{:else if currentView === 'debug'}
		<div class="flex h-full flex-col">
			<div class="border-b border-border p-3">
				<h2 class="text-sm font-semibold tracking-wide text-sidebar-foreground uppercase">
					Run and Debug
				</h2>
			</div>
			<div class="flex-1 p-4">
				<p class="text-sm text-muted-foreground">Debug functionality would go here</p>
			</div>
		</div>
	{:else if currentView === 'extensions'}
		<div class="flex h-full flex-col">
			<div class="border-b border-border p-3">
				<h2 class="text-sm font-semibold tracking-wide text-sidebar-foreground uppercase">
					Extensions
				</h2>
			</div>
			<div class="flex-1 p-4">
				<p class="text-sm text-muted-foreground">Extensions management would go here</p>
			</div>
		</div>
	{:else}
		<div class="flex h-full flex-col">
			<div class="border-b border-border p-3">
				<h2 class="text-sm font-semibold tracking-wide text-sidebar-foreground uppercase">
					Unknown View
				</h2>
			</div>
			<div class="flex-1 p-4">
				<p class="text-sm text-muted-foreground">View not implemented yet...</p>
			</div>
		</div>
	{/if}
</div>
