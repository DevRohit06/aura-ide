<script lang="ts">
	import { onDestroy } from 'svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import Badge from '$lib/components/ui/badge/badge.svelte';
	import GlobalSearchResults from './global-search-results.svelte';
	import SearchHistory from './search-history.svelte';
	import { searchStore, searchActions } from '$lib/stores/search.store';
	import type { EditorView } from '@codemirror/view';
	import {
		findNext,
		findPrevious,
		replaceNext,
		replaceAll,
		setSearchQuery,
		SearchQuery
	} from '@codemirror/search'; // Props
	interface Props {
		editorView: EditorView | null;
		visible: boolean;
		onClose: () => void;
	}

	let { editorView, visible, onClose }: Props = $props();

	// State
	let searchInput = $state<HTMLInputElement | null>(null);
	let replaceInput = $state<HTMLInputElement | null>(null);
	let matchCount = $state(0);
	let currentMatch = $state(0);
	let showGlobalResults = $state(false);
	let showSearchHistory = $state(false);
	let showReplaceHistory = $state(false);
	let showHistoryPanel = $state(false);

	// Reactive values from store
	let searchValue = $derived($searchStore.query);
	let replaceValue = $derived($searchStore.replaceText);
	let showReplace = $derived($searchStore.showReplace);
	let caseSensitive = $derived($searchStore.caseSensitive);
	let wholeWord = $derived($searchStore.wholeWord);
	let useRegex = $derived($searchStore.useRegex);

	// Update search in CodeMirror
	function updateSearch() {
		if (!editorView || !searchValue) {
			return;
		}

		const query = new SearchQuery({
			search: searchValue,
			caseSensitive,
			literal: !useRegex,
			wholeWord
		});

		editorView.dispatch({
			effects: setSearchQuery.of(query)
		});

		// Update match counts in the next tick to avoid reactive loops
		setTimeout(() => updateMatchCount(), 0);
	}

	function updateMatchCount() {
		if (!editorView || !searchValue) {
			matchCount = 0;
			currentMatch = 0;
			return;
		}

		try {
			const doc = editorView.state.doc.toString();
			const flags = caseSensitive ? 'g' : 'gi';
			let searchRegex: RegExp;

			if (useRegex) {
				try {
					searchRegex = new RegExp(searchValue, flags);
				} catch (e) {
					// Invalid regex, fall back to literal search
					searchRegex = new RegExp(searchValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
				}
			} else {
				searchRegex = new RegExp(searchValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
			}

			const matches = doc.match(searchRegex);
			const newMatchCount = matches ? matches.length : 0;

			// Only update if the count actually changed to avoid unnecessary reactivity
			if (newMatchCount !== matchCount) {
				matchCount = newMatchCount;
			}

			// Update current match position
			if (newMatchCount > 0) {
				const currentPos = editorView.state.selection.main.head;
				const beforeCursor = doc.slice(0, currentPos);
				const beforeMatches = beforeCursor.match(searchRegex);
				const newCurrentMatch = beforeMatches ? beforeMatches.length : 0;
				const finalCurrentMatch = newCurrentMatch === 0 && newMatchCount > 0 ? 1 : newCurrentMatch;

				if (finalCurrentMatch !== currentMatch) {
					currentMatch = finalCurrentMatch;
				}
			} else {
				if (currentMatch !== 0) {
					currentMatch = 0;
				}
			}
		} catch (error) {
			console.error('Error updating match count:', error);
			matchCount = 0;
			currentMatch = 0;
		}
	}

	// Search functions
	function handleFindNext() {
		if (editorView && searchValue) {
			updateSearch();
			findNext(editorView);
			updateMatchCount();
			searchActions.nextMatch();
		}
	}

	function handleFindPrevious() {
		if (editorView && searchValue) {
			updateSearch();
			findPrevious(editorView);
			updateMatchCount();
			searchActions.previousMatch();
		}
	}

	function handleReplace() {
		if (editorView && searchValue) {
			updateSearch();
			replaceNext(editorView);
			updateMatchCount();
			searchActions.addToReplaceHistory(replaceValue);
		}
	}

	function handleReplaceAll() {
		if (editorView && searchValue) {
			updateSearch();
			replaceAll(editorView);
			updateMatchCount();
			searchActions.addToReplaceHistory(replaceValue);
		}
	}

	// Global search
	function handleGlobalSearch() {
		if (searchValue.trim()) {
			searchActions.performGlobalSearch();
			showGlobalResults = true;
		}
	}

	// Search input handlers
	function handleSearchInput(event: Event) {
		const target = event.target as HTMLInputElement;
		searchActions.setQuery(target.value);
	}

	function handleReplaceInput(event: Event) {
		const target = event.target as HTMLInputElement;
		searchActions.setReplaceText(target.value);
	}

	// History selection
	function selectFromSearchHistory(query: string) {
		searchActions.setQuery(query);
		showSearchHistory = false;
		searchInput?.focus();
	}

	function selectFromReplaceHistory(text: string) {
		searchActions.setReplaceText(text);
		showReplaceHistory = false;
		replaceInput?.focus();
	}

	function handleClose() {
		searchActions.clearSearch();
		showGlobalResults = false;
		showSearchHistory = false;
		showReplaceHistory = false;
		if (editorView) {
			// Clear search
			editorView.dispatch({
				effects: setSearchQuery.of(new SearchQuery({ search: '' }))
			});
		}
		onClose();
	}

	// Keyboard shortcuts
	function handleKeyDown(event: KeyboardEvent) {
		switch (event.key) {
			case 'Enter':
				event.preventDefault();
				if (event.ctrlKey || event.metaKey) {
					// Ctrl+Enter for global search
					handleGlobalSearch();
				} else if (event.shiftKey) {
					handleFindPrevious();
				} else {
					handleFindNext();
				}
				break;
			case 'Escape':
				event.preventDefault();
				if (showSearchHistory || showReplaceHistory) {
					showSearchHistory = false;
					showReplaceHistory = false;
				} else {
					handleClose();
				}
				break;
			case 'Tab':
				if (showReplace && event.target === searchInput && replaceInput) {
					event.preventDefault();
					replaceInput.focus();
				}
				break;
			case 'ArrowDown':
				if (event.target === searchInput && $searchStore.searchHistory.length > 0) {
					event.preventDefault();
					showSearchHistory = true;
				} else if (event.target === replaceInput && $searchStore.replaceHistory.length > 0) {
					event.preventDefault();
					showReplaceHistory = true;
				}
				break;
		}
	}

	// Cleanup on destroy
	onDestroy(() => {
		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}
	});

	// Focus search input when panel opens
	$effect(() => {
		console.log('Search panel visibility changed:', visible);
		if (visible && searchInput) {
			console.log('Focusing search input');
			setTimeout(() => {
				searchInput?.focus();
				searchInput?.select();
			}, 0);
		}
	});

	// Update search when search-related values change (but not match counts to avoid loops)
	let searchTimeout: number | NodeJS.Timeout;
	$effect(() => {
		// Only trigger search update for these specific values
		const searchParams = [searchValue, caseSensitive, wholeWord, useRegex];

		if (editorView && visible && searchValue) {
			// Debounce search updates to avoid excessive calls
			clearTimeout(searchTimeout);
			searchTimeout = setTimeout(() => {
				updateSearch();
			}, 150);
		} else if (editorView && visible && !searchValue) {
			// Clear search immediately when search value is empty
			clearTimeout(searchTimeout);
			matchCount = 0;
			currentMatch = 0;
			const query = new SearchQuery({ search: '' });
			editorView.dispatch({
				effects: setSearchQuery.of(query)
			});
		}
	});
</script>

{#if visible}
	<div
		class="absolute top-4 right-4 z-50 min-w-[400px] animate-in rounded-lg border border-border bg-background/95 p-2 shadow-lg backdrop-blur-sm duration-200 fade-in-0 slide-in-from-top-2"
		role="dialog"
		aria-label="Search and Replace"
	>
		<!-- Header -->
		<div class="mb-3 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<svg
					class="h-3 w-3 text-muted-foreground"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<circle cx="11" cy="11" r="8" />
					<path d="m21 21-4.35-4.35" />
				</svg>
				<span class="text-xs font-medium">Find and Replace</span>
			</div>
			<Button
				variant="ghost"
				size="icon"
				class="h-5 w-5"
				onclick={handleClose}
				aria-label="Close search"
			>
				<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path d="M6 6l12 12M6 18L18 6" />
				</svg>
			</Button>
		</div>

		<!-- Search Input -->
		<div class="space-y-3">
			<div class="flex items-center gap-2">
				<div class="relative flex-1">
					<Input
						bind:ref={searchInput}
						value={searchValue}
						placeholder="Find (Ctrl+Enter for global search)"
						class="pr-20"
						onkeydown={handleKeyDown}
						oninput={handleSearchInput}
					/>
					{#if matchCount > 0}
						<Badge
							variant="secondary"
							class="absolute top-1/2 right-2 -translate-y-1/2 px-2 py-0.5 text-xs"
						>
							{currentMatch}/{matchCount}
						</Badge>
					{/if}

					<!-- Search History Dropdown -->
					{#if showSearchHistory && $searchStore.searchHistory.length > 0}
						<div
							class="absolute top-full right-0 left-0 z-50 mt-1 max-h-32 overflow-y-auto rounded-md border border-border bg-background shadow-lg"
						>
							{#each $searchStore.searchHistory as historyItem}
								<button
									class="w-full px-3 py-1.5 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
									onclick={() => selectFromSearchHistory(historyItem)}
								>
									{historyItem}
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Navigation buttons -->
				<div class="flex items-center gap-1">
					<Button
						size="icon"
						class="size-8"
						onclick={handleFindPrevious}
						disabled={!searchValue || matchCount === 0}
						aria-label="Previous match"
						title="Previous match (Shift+Enter)"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path d="m18 15-6-6-6 6" />
						</svg>
					</Button>
					<Button
						size="icon"
						class="size-8"
						variant="default"
						onclick={handleFindNext}
						disabled={!searchValue || matchCount === 0}
						aria-label="Next match"
						title="Next match (Enter)"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path d="m6 9 6 6 6-6" />
						</svg>
					</Button>
					<Button
						size="icon"
						class="size-8"
						variant="outline"
						onclick={handleGlobalSearch}
						disabled={!searchValue.trim() || $searchStore.isSearching}
						aria-label="Global search"
						title="Search in all files (Ctrl+Enter)"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"
							/>
							<circle cx="11" cy="11" r="3" />
						</svg>
					</Button>
				</div>
			</div>

			<!-- Replace Input (when expanded) -->
			{#if showReplace}
				<div class="flex items-center gap-2">
					<div class="relative flex-1">
						<Input
							bind:ref={replaceInput}
							value={replaceValue}
							placeholder="Replace"
							onkeydown={handleKeyDown}
							oninput={handleReplaceInput}
						/>

						<!-- Replace History Dropdown -->
						{#if showReplaceHistory && $searchStore.replaceHistory.length > 0}
							<div
								class="absolute top-full right-0 left-0 z-50 mt-1 max-h-32 overflow-y-auto rounded-md border border-border bg-background shadow-lg"
							>
								{#each $searchStore.replaceHistory as historyItem}
									<button
										class="w-full px-3 py-1.5 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
										onclick={() => selectFromReplaceHistory(historyItem)}
									>
										{historyItem}
									</button>
								{/each}
							</div>
						{/if}
					</div>

					<!-- Replace buttons -->
					<div class="flex items-center gap-1">
						<Button
							size="sm"
							onclick={handleReplace}
							disabled={!searchValue || matchCount === 0}
							class="px-2 text-xs"
						>
							Replace
						</Button>
						<Button
							size="sm"
							onclick={handleReplaceAll}
							disabled={!searchValue || matchCount === 0}
							class="px-2 text-xs"
						>
							All
						</Button>
					</div>
				</div>
			{/if}

			<!-- Options -->
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-1">
					<Button
						variant={caseSensitive ? 'default' : 'secondary'}
						size="icon"
						class="h-7 w-7"
						onclick={() => searchActions.toggleCaseSensitive()}
						aria-label="Case sensitive"
						title="Case sensitive"
					>
						<span class="font-mono text-xs">Aa</span>
					</Button>
					<Button
						variant={wholeWord ? 'default' : 'secondary'}
						size="icon"
						class="h-7 w-7"
						onclick={() => searchActions.toggleWholeWord()}
						aria-label="Whole word"
						title="Whole word"
					>
						<span class="font-mono text-xs">ab</span>
					</Button>
					<Button
						variant={useRegex ? 'default' : 'secondary'}
						size="icon"
						class="h-7 w-7"
						onclick={() => searchActions.toggleUseRegex()}
						aria-label="Use regular expression"
						title="Use regular expression"
					>
						<span class="font-mono text-xs">.*</span>
					</Button>
				</div>

				<div class="flex items-center gap-1">
					<Button
						variant="outline"
						size="sm"
						onclick={() => searchActions.toggleReplace()}
						class="px-2 text-xs"
					>
						<svg class="mr-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path d="M16 3h5v5M8 3H3v5M12 22v-7m0 0-3 3m3-3 3 3M2 12h7m0 0-3-3m3 3-3 3" />
						</svg>
						{showReplace ? 'Hide' : 'Replace'}
					</Button>

					<Button
						variant="outline"
						size="sm"
						onclick={() => (showHistoryPanel = !showHistoryPanel)}
						class="px-2 text-xs"
					>
						<svg class="mr-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						History
					</Button>

					{#if $searchStore.globalResults.length > 0}
						<Button
							variant={showGlobalResults ? 'default' : 'secondary'}
							size="sm"
							onclick={() => (showGlobalResults = !showGlobalResults)}
							class="px-2 text-xs"
						>
							<svg class="mr-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"
								/>
							</svg>
							Results
						</Button>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Global Search Results -->
<GlobalSearchResults visible={showGlobalResults} onClose={() => (showGlobalResults = false)} />

<!-- Search History -->
<SearchHistory visible={showHistoryPanel} onClose={() => (showHistoryPanel = false)} />

<style>
	/* Custom animations */
	@keyframes slide-in-from-top {
		from {
			transform: translateY(-8px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	.animate-in {
		animation: slide-in-from-top 0.2s ease-out;
	}
</style>
