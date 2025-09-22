<script lang="ts">
	import {
		filesStore,
		openFiles,
		activeFileId,
		tabActions,
		fileStateActions
	} from '$lib/stores/editor.js';
	import { getFileIcon } from './index.js';
	import FileIcon from '@lucide/svelte/icons/file';
	import XIcon from '@lucide/svelte/icons/x';
	import Icon from '@iconify/svelte';

	// Handle tab click
	const handleTabClick = (fileId: string) => {
		tabActions.switchToFile(fileId);
	};

	// Handle tab close
	const handleTabClose = (fileId: string, event?: MouseEvent | KeyboardEvent) => {
		event?.stopPropagation();
		tabActions.closeFile(fileId);
	};

	// Keyboard shortcuts
	const handleKeydown = (event: KeyboardEvent) => {
		if (event.ctrlKey || event.metaKey) {
			switch (event.key) {
				case 'w':
					event.preventDefault();
					if ($activeFileId) {
						tabActions.closeFile($activeFileId);
					}
					break;
				case 'Tab': {
					event.preventDefault();
					const tabs = $openFiles;
					const currentIndex = tabs.indexOf($activeFileId || '');
					if (currentIndex !== -1) {
						const nextIndex = event.shiftKey
							? (currentIndex - 1 + tabs.length) % tabs.length
							: (currentIndex + 1) % tabs.length;
						tabActions.switchToFile(tabs[nextIndex]);
					}
					break;
				}
			}
		}
	};

	// Close all files
	const handleCloseAll = () => {
		$openFiles.forEach((fileId) => {
			tabActions.closeFile(fileId);
		});
	};
</script>

<svelte:window onkeydown={handleKeydown} />

{#if $openFiles.length > 0}
	<div class="flex h-10 overflow-x-auto overflow-y-hidden border-b border-border bg-background">
		<div class="flex min-w-0 items-center overflow-x-auto overflow-y-hidden">
			{#each $openFiles as fileId (fileId)}
				{@const file = $filesStore.get(fileId)}
				{#if file}
					{@const isActive = fileId === $activeFileId}
					{@const isDirty = fileStateActions.isFileDirty(fileId)}

					<button
						class="group flex max-w-48 min-w-fit items-center gap-2 border-r border-border bg-transparent px-3 py-2 text-sm transition-colors hover:bg-muted/50
							{isActive
							? 'border-b-2 border-b-primary bg-muted text-foreground'
							: 'text-muted-foreground hover:text-foreground'}"
						onclick={() => handleTabClick(fileId)}
						type="button"
						title="{file.path}{isDirty ? ' (modified)' : ''}"
					>
						<Icon icon={getFileIcon(file.name)} />

						<span class="min-w-0 flex-1 truncate">
							{file.name}
						</span>

						{#if isDirty}
							<span class="font-bold text-orange-500" title="Unsaved changes">•</span>
						{/if}

						<span
							class="flex h-4 w-4 cursor-pointer items-center justify-center rounded-sm opacity-0 transition-colors group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive"
							onclick={(event) => handleTabClose(fileId, event)}
							role="button"
							tabindex="0"
							aria-label="Close {file.name}"
							onkeydown={(event) => {
								if (event.key === 'Enter' || event.key === ' ') {
									event.preventDefault();
									handleTabClose(fileId);
								}
							}}
						>
							<XIcon class="h-3 w-3" />
						</span>
					</button>
				{/if}
			{/each}
		</div>

		<!-- Close all button -->
		{#if $openFiles.length > 1}
			<button
				class="ml-auto flex items-center justify-center border-l border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
				onclick={handleCloseAll}
				type="button"
				aria-label="Close all tabs"
				title="Close all tabs"
			>
				<XIcon class="h-4 w-4" />
			</button>
		{/if}
	</div>
{:else}
	<div class="flex h-10 border-b border-border bg-background">
		<div class="flex items-center px-4 text-sm text-muted-foreground">
			<FileIcon class="mr-2 h-4 w-4 opacity-50" />
			No files open
		</div>
	</div>
{/if}

<style>
	/* Custom scrollbar for tab overflow */
	.flex.overflow-x-auto {
		scrollbar-width: thin;
		scrollbar-color: hsl(var(--muted)) transparent;
	}

	.flex.overflow-x-auto::-webkit-scrollbar {
		height: 4px;
	}

	.flex.overflow-x-auto::-webkit-scrollbar-track {
		background: transparent;
	}

	.flex.overflow-x-auto::-webkit-scrollbar-thumb {
		background: hsl(var(--muted));
		border-radius: 2px;
	}

	.flex.overflow-x-auto::-webkit-scrollbar-thumb:hover {
		background: hsl(var(--muted-foreground));
	}

	/* Tab animations */
	.group {
		transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.group:hover {
		background-color: hsl(var(--muted) / 0.5);
	}

	/* Active tab styling */
	.border-b-2.border-b-primary {
		border-bottom-color: hsl(var(--primary));
		background-color: hsl(var(--muted));
	}

	/* Dirty indicator pulse animation */
	.text-orange-500 {
		animation: pulse 2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	/* Focus styles for accessibility */
	button:focus-visible {
		outline: 2px solid hsl(var(--primary));
		outline-offset: -2px;
	}

	/* Mobile responsiveness */
	@media (max-width: 640px) {
		.max-w-48 {
			max-width: 120px;
		}

		.px-3 {
			padding-left: 8px;
			padding-right: 8px;
		}
	}
</style>
