<script lang="ts">
	import { searchStore, searchActions } from '$lib/stores/search.store';
	import Button from '$lib/components/ui/button/button.svelte';
	import Badge from '$lib/components/ui/badge/badge.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import type { SavedSearch } from '$lib/stores/search.store';

	// Props
	interface Props {
		visible: boolean;
		onClose: () => void;
	}

	let { visible, onClose }: Props = $props();

	// State
	let newSearchName = $state('');
	let showSaveDialog = $state(false);

	// Save current search
	function handleSaveSearch() {
		if (newSearchName.trim() && $searchStore.query.trim()) {
			searchActions.saveSearch(newSearchName.trim());
			newSearchName = '';
			showSaveDialog = false;
		}
	}

	// Load saved search
	function handleLoadSearch(savedSearch: SavedSearch) {
		searchActions.loadSavedSearch(savedSearch);
		onClose();
	}

	// Delete saved search
	function handleDeleteSearch(id: string) {
		searchActions.deleteSavedSearch(id);
	}

	// Select from history
	function handleSelectHistory(query: string) {
		searchActions.setQuery(query);
		onClose();
	}

	// Format date
	function formatDate(date: Date): string {
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(date);
	}
</script>

{#if visible}
	<div
		class="absolute top-16 right-4 z-50 max-h-96 w-80 animate-in rounded-lg border border-border bg-background/95 shadow-lg backdrop-blur-sm duration-200 fade-in-0 slide-in-from-right-2"
		role="dialog"
		aria-label="Search History"
	>
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-border p-3">
			<div class="flex items-center gap-2">
				<svg
					class="h-4 w-4 text-muted-foreground"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<span class="text-sm font-medium">Search History</span>
			</div>
			<Button
				variant="ghost"
				size="icon"
				class="h-6 w-6"
				onclick={onClose}
				aria-label="Close search history"
			>
				<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path d="M6 6l12 12M6 18L18 6" />
				</svg>
			</Button>
		</div>

		<div class="max-h-80 overflow-y-auto">
			<!-- Save Current Search -->
			{#if $searchStore.query.trim()}
				<div class="border-b border-border p-3">
					{#if showSaveDialog}
						<div class="space-y-2">
							<Input
								bind:value={newSearchName}
								placeholder="Search name..."
								class="text-sm"
								onkeydown={(e) => e.key === 'Enter' && handleSaveSearch()}
							/>
							<div class="flex gap-2">
								<Button
									size="sm"
									onclick={handleSaveSearch}
									disabled={!newSearchName.trim()}
									class="text-xs"
								>
									Save
								</Button>
								<Button
									variant="outline"
									size="sm"
									onclick={() => (showSaveDialog = false)}
									class="text-xs"
								>
									Cancel
								</Button>
							</div>
						</div>
					{:else}
						<Button
							variant="outline"
							size="sm"
							onclick={() => (showSaveDialog = true)}
							class="w-full text-xs"
						>
							<svg class="mr-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
								<polyline points="17,21 17,13 7,13 7,21" />
								<polyline points="7,3 7,8 15,8" />
							</svg>
							Save Current Search
						</Button>
					{/if}
				</div>
			{/if}

			<!-- Saved Searches -->
			{#if $searchStore.savedSearches.length > 0}
				<div class="border-b border-border">
					<div class="p-2">
						<h4 class="mb-2 text-xs font-medium text-muted-foreground">Saved Searches</h4>
						<div class="space-y-1">
							{#each $searchStore.savedSearches as savedSearch (savedSearch.id)}
								<div class="group flex items-center gap-2 rounded p-2 hover:bg-muted/50">
									<button class="flex-1 text-left" onclick={() => handleLoadSearch(savedSearch)}>
										<div class="text-sm font-medium">{savedSearch.name}</div>
										<div class="font-mono text-xs text-muted-foreground">
											{savedSearch.query}
										</div>
										<div class="mt-1 flex items-center gap-1">
											<span class="text-xs text-muted-foreground">
												{formatDate(savedSearch.createdAt)}
											</span>
											{#if savedSearch.options.caseSensitive}
												<Badge variant="outline" class="px-1 py-0 text-xs">Aa</Badge>
											{/if}
											{#if savedSearch.options.wholeWord}
												<Badge variant="outline" class="px-1 py-0 text-xs">ab</Badge>
											{/if}
											{#if savedSearch.options.useRegex}
												<Badge variant="outline" class="px-1 py-0 text-xs">.*</Badge>
											{/if}
										</div>
									</button>
									<Button
										variant="ghost"
										size="icon"
										class="h-6 w-6 opacity-0 group-hover:opacity-100"
										onclick={() => handleDeleteSearch(savedSearch.id)}
										aria-label="Delete saved search"
									>
										<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
											/>
										</svg>
									</Button>
								</div>
							{/each}
						</div>
					</div>
				</div>
			{/if}

			<!-- Recent Searches -->
			{#if $searchStore.searchHistory.length > 0}
				<div class="p-2">
					<h4 class="mb-2 text-xs font-medium text-muted-foreground">Recent Searches</h4>
					<div class="space-y-1">
						{#each $searchStore.searchHistory.slice(0, 10) as historyItem}
							<button
								class="w-full rounded p-2 text-left font-mono text-sm hover:bg-muted/50 focus:bg-muted/50 focus:outline-none"
								onclick={() => handleSelectHistory(historyItem)}
							>
								{historyItem}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Empty state -->
			{#if $searchStore.searchHistory.length === 0 && $searchStore.savedSearches.length === 0}
				<div class="flex flex-col items-center justify-center p-8 text-center">
					<svg
						class="mb-2 h-8 w-8 text-muted-foreground"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<p class="text-sm text-muted-foreground">No search history</p>
					<p class="mt-1 text-xs text-muted-foreground">Your searches will appear here</p>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	/* Custom animations */
	@keyframes slide-in-from-right {
		from {
			transform: translateX(8px);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	.animate-in {
		animation: slide-in-from-right 0.2s ease-out;
	}
</style>
