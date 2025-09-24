<script lang="ts">
	import Badge from '$lib/components/ui/badge/badge.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import {
		searchActions,
		searchResults,
		searchStore,
		searchSummary
	} from '$lib/stores/search.store';
	import { tabActions } from '$lib/stores/tabs.store';
	import type { FileSearchResult, SearchMatch } from '$lib/types/file-operations';

	// Props
	interface Props {
		visible: boolean;
		onClose: () => void;
	}

	let { visible, onClose }: Props = $props();

	// Reactive state
	let expandedFiles = $state<Set<string>>(new Set());

	// Handle file click - open file and navigate to match
	function handleFileClick(result: FileSearchResult, match?: SearchMatch) {
		// Open the file in a new tab
		tabActions.openFile(result.file.id);

		// If a specific match was clicked, we would navigate to that line
		// This would be handled by the editor component
		if (match) {
			// TODO: Implement navigation to specific line/column
			console.log('Navigate to:', match.line, match.column);
		}
	}

	// Toggle file expansion
	function toggleFileExpansion(fileId: string) {
		if (expandedFiles.has(fileId)) {
			expandedFiles.delete(fileId);
		} else {
			expandedFiles.add(fileId);
		}
		expandedFiles = new Set(expandedFiles); // Trigger reactivity
	}

	// Get file icon based on extension
	function getFileIcon(fileName: string): string {
		const ext = fileName.split('.').pop()?.toLowerCase();
		switch (ext) {
			case 'js':
			case 'jsx':
				return '📄';
			case 'ts':
			case 'tsx':
				return '🔷';
			case 'svelte':
				return '🔥';
			case 'css':
			case 'scss':
			case 'sass':
				return '🎨';
			case 'html':
				return '🌐';
			case 'json':
				return '📋';
			case 'md':
				return '📝';
			default:
				return '📄';
		}
	}

	// Format match context with highlighting
	function formatMatchContext(match: SearchMatch, query: string): string {
		const { context } = match;
		if (!query) return context;

		// Simple highlighting - in a real implementation, you'd want more sophisticated highlighting
		const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
		return context.replace(regex, '<mark>$1</mark>');
	}
</script>

{#if visible}
	<div
		class="absolute top-16 right-4 z-40 max-h-[70vh] w-96 animate-in rounded-lg border border-border bg-background/95 shadow-lg backdrop-blur-sm duration-200 fade-in-0 slide-in-from-right-2"
		role="dialog"
		aria-label="Global Search Results"
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
					<circle cx="11" cy="11" r="8" />
					<path d="m21 21-4.35-4.35" />
				</svg>
				<span class="text-sm font-medium">Search Results</span>
				{#if $searchSummary.totalFiles > 0}
					<Badge variant="secondary" class="text-xs">
						{$searchSummary.totalMatches} matches in {$searchSummary.totalFiles} files
					</Badge>
				{/if}
			</div>
			<Button
				variant="ghost"
				size="icon"
				class="h-6 w-6"
				onclick={onClose}
				aria-label="Close search results"
			>
				<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path d="M6 6l12 12M6 18L18 6" />
				</svg>
			</Button>
		</div>

		<!-- Search query display -->
		{#if $searchStore.query}
			<div class="border-b border-border p-3">
				<div class="flex items-center gap-2 text-sm text-muted-foreground">
					<span>Searching for:</span>
					<code class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
						{$searchStore.query}
					</code>
					{#if $searchStore.caseSensitive}
						<Badge variant="outline" class="text-xs">Aa</Badge>
					{/if}
					{#if $searchStore.wholeWord}
						<Badge variant="outline" class="text-xs">ab</Badge>
					{/if}
					{#if $searchStore.useRegex}
						<Badge variant="outline" class="text-xs">.*</Badge>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Results -->
		<div class="max-h-96 overflow-y-auto">
			{#if $searchStore.isSearching}
				<div class="flex items-center justify-center p-8">
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						<svg class="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
							/>
						</svg>
						Searching...
					</div>
				</div>
			{:else if $searchResults.length === 0 && $searchStore.query}
				<div class="flex flex-col items-center justify-center p-8 text-center">
					<svg
						class="mb-2 h-8 w-8 text-muted-foreground"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<circle cx="11" cy="11" r="8" />
						<path d="m21 21-4.35-4.35" />
					</svg>
					<p class="text-sm text-muted-foreground">No results found</p>
					<p class="mt-1 text-xs text-muted-foreground">
						Try adjusting your search terms or options
					</p>
				</div>
			{:else if $searchResults.length > 0}
				<div class="divide-y divide-border">
					{#each $searchResults as result (result.file.id)}
						<div class="group">
							<!-- File header -->
							<button
								class="flex w-full items-center gap-2 p-3 text-left hover:bg-muted/50 focus:bg-muted/50 focus:outline-none"
								onclick={() => toggleFileExpansion(result.file.id)}
								aria-expanded={expandedFiles.has(result.file.id)}
							>
								<svg
									class="h-3 w-3 transition-transform {expandedFiles.has(result.file.id)
										? 'rotate-90'
										: ''}"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path d="m9 18 6-6-6-6" />
								</svg>
								<span class="text-sm">{getFileIcon(result.file.name)}</span>
								<span class="flex-1 truncate text-sm font-medium">{result.file.name}</span>
								<Badge variant="secondary" class="text-xs">
									{result.matches.length}
								</Badge>
							</button>

							<!-- Matches (when expanded) -->
							{#if expandedFiles.has(result.file.id)}
								<div class="bg-muted/20">
									{#each result.matches as match, index (index)}
										<button
											class="flex w-full items-start gap-3 p-2 pl-8 text-left text-xs hover:bg-muted/50 focus:bg-muted/50 focus:outline-none"
											onclick={() => handleFileClick(result, match)}
										>
											<span class="min-w-[3rem] text-right font-mono text-muted-foreground">
												{match.line}:{match.column}
											</span>
											<span class="flex-1 font-mono text-foreground/80">
												{@html formatMatchContext(match, $searchStore.query)}
											</span>
										</button>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{:else}
				<div class="flex flex-col items-center justify-center p-8 text-center">
					<svg
						class="mb-2 h-8 w-8 text-muted-foreground"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<circle cx="11" cy="11" r="8" />
						<path d="m21 21-4.35-4.35" />
					</svg>
					<p class="text-sm text-muted-foreground">Start typing to search</p>
					<p class="mt-1 text-xs text-muted-foreground">Search across all files in your project</p>
				</div>
			{/if}
		</div>

		<!-- Footer actions -->
		{#if $searchResults.length > 0}
			<div class="border-t border-border p-3">
				<div class="flex items-center justify-between">
					<Button
						variant="outline"
						size="sm"
						onclick={() => searchActions.clearSearch()}
						class="text-xs"
					>
						Clear Results
					</Button>
					<Button
						variant="default"
						size="sm"
						onclick={() => searchActions.performGlobalSearch()}
						disabled={$searchStore.isSearching}
						class="text-xs"
					>
						Refresh
					</Button>
				</div>
			</div>
		{/if}
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

	/* Highlight styling */
	:global(mark) {
		background-color: hsl(var(--primary) / 0.2);
		color: hsl(var(--primary-foreground));
		padding: 0 2px;
		border-radius: 2px;
	}
</style>
