<script lang="ts" module>
	import type { FileSystemItem } from '@/types/files';
</script>

<script lang="ts">
	import * as Resizable from '$lib/components/ui/resizable/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';

	// Layout components
	import EnhancedSidebar from './enhanced-sidebar.svelte';
	import CommandPalette from './command-palette.svelte';
	import KeyboardShortcuts from './keyboard-shortcuts.svelte';

	// Icons
	import MenuIcon from '@lucide/svelte/icons/menu';
	import TerminalIcon from '@lucide/svelte/icons/terminal';
	import PanelLeftIcon from '@lucide/svelte/icons/panel-left';
	import PanelRightIcon from '@lucide/svelte/icons/panel-right';
	import LayoutIcon from '@lucide/svelte/icons/layout';
	import SearchIcon from '@lucide/svelte/icons/search';
	import SettingsIcon from '@lucide/svelte/icons/settings';

	// Stores
	import { layoutStore, layoutActions } from '$lib/stores/layout.store.js';
	import {
		filesStore,
		tabsStore,
		tabActions,
		fileStateActions,
		openFilesData
	} from '$lib/stores/editor.js';

	// Props
	let { children, showActivityBar = true, showStatusBar = true, class: className = '' } = $props();

	// State for dialogs and panels
	let commandPaletteOpen = $state(false);
	let fileSearchOpen = $state(false);
	let globalSearchOpen = $state(false);
	let goToLineOpen = $state(false);
	let findOpen = $state(false);
	let settingsOpen = $state(false);

	// Keyboard shortcut handlers
	const keyboardHandlers = {
		onNewFile: () => {
			console.log('New file requested');
			// TODO: Implement new file creation
		},

		onSaveAll: () => {
			const dirtyFiles = Array.from($filesStore.values()).filter(
				(file) => file.type === 'file' && fileStateActions.isFileDirty(file.id)
			);

			dirtyFiles.forEach((file) => {
				fileStateActions.saveFile(file.id);
			});

			console.log(`Saved ${dirtyFiles.length} files`);
		},

		onCloseTab: () => {
			const activeFileId = $tabsStore.activeFileId;
			if (activeFileId) {
				tabActions.closeFile(activeFileId);
			}
		},

		onNextTab: () => {
			const tabs = $tabsStore.openFiles;
			const activeFileId = $tabsStore.activeFileId;
			const activeIndex = tabs.findIndex((fileId) => fileId === activeFileId);
			const nextIndex = (activeIndex + 1) % tabs.length;
			if (tabs[nextIndex]) {
				tabActions.openFile(tabs[nextIndex]);
			}
		},

		onPrevTab: () => {
			const tabs = $tabsStore.openFiles;
			const activeFileId = $tabsStore.activeFileId;
			const activeIndex = tabs.findIndex((fileId) => fileId === activeFileId);
			const prevIndex = activeIndex === 0 ? tabs.length - 1 : activeIndex - 1;
			if (tabs[prevIndex]) {
				tabActions.openFile(tabs[prevIndex]);
			}
		},

		onToggleComment: () => {
			console.log('Toggle comment');
			// TODO: Implement comment toggling in active editor
		},

		onFormat: () => {
			console.log('Format document');
			// TODO: Implement document formatting
		},

		onUndo: () => {
			console.log('Undo');
			// TODO: Implement undo
		},

		onRedo: () => {
			console.log('Redo');
			// TODO: Implement redo
		},

		onCopy: () => {
			console.log('Copy');
			// TODO: Implement copy
		},

		onCut: () => {
			console.log('Cut');
			// TODO: Implement cut
		},

		onPaste: () => {
			console.log('Paste');
			// TODO: Implement paste
		},

		onSelectAll: () => {
			console.log('Select all');
			// TODO: Implement select all
		},

		onDuplicate: () => {
			console.log('Duplicate line/selection');
			// TODO: Implement duplication
		},

		onDeleteLine: () => {
			console.log('Delete line');
			// TODO: Implement line deletion
		}
	};

	// Handle resizing
	function handleSidebarResize(sizes: number[]) {
		if (sizes[0]) {
			layoutActions.setSidebarWidth(sizes[0]);
		}
	}

	function handleTerminalResize(sizes: number[]) {
		if (sizes[1]) {
			layoutActions.setTerminalHeight(sizes[1]);
		}
	}

	// Computed layout values
	const sidebarVisible = $derived($layoutStore.sidebarVisible);
	const terminalVisible = $derived($layoutStore.terminalVisible);
	const aiPanelVisible = $derived($layoutStore.aiPanelVisible);
	const sidebarWidth = $derived($layoutStore.sidebarWidth);
	const terminalHeight = $derived($layoutStore.terminalHeight);
	const aiPanelWidth = $derived($layoutStore.aiPanelWidth);

	// Initialize layout on mount
	$effect(() => {
		layoutActions.restoreLayout();
	});
</script>

<!-- Keyboard Shortcuts Handler -->
<KeyboardShortcuts
	bind:commandPaletteOpen
	bind:fileSearchOpen
	bind:globalSearchOpen
	bind:goToLineOpen
	bind:findOpen
	{...keyboardHandlers}
/>

<!-- Command Palette -->
<CommandPalette bind:open={commandPaletteOpen} />

<!-- Main Layout Container -->
<div class="flex h-screen bg-background text-foreground {className}">
	<!-- Activity Bar (Optional) -->
	{#if showActivityBar}
		<div class="flex w-12 flex-col items-center border-r border-border bg-sidebar-accent py-2">
			<Tooltip.Provider>
				<Tooltip.Root>
					<Tooltip.Trigger>
						<Button
							variant="ghost"
							size="icon"
							class="mb-2 h-10 w-10"
							onclick={layoutActions.toggleSidebar}
						>
							<PanelLeftIcon size={18} />
						</Button>
					</Tooltip.Trigger>
					<Tooltip.Content side="right">
						{sidebarVisible ? 'Hide' : 'Show'} Sidebar (⌘B)
					</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>

			<Tooltip.Provider>
				<Tooltip.Root>
					<Tooltip.Trigger>
						<Button
							variant="ghost"
							size="icon"
							class="mb-2 h-10 w-10"
							onclick={() => (globalSearchOpen = true)}
						>
							<SearchIcon size={18} />
						</Button>
					</Tooltip.Trigger>
					<Tooltip.Content side="right">Global Search (⌘⇧F)</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>

			<div class="flex-1"></div>
			<Tooltip.Provider>
				<Tooltip.Root>
					<Tooltip.Trigger>
						<Button
							variant="ghost"
							size="icon"
							class="mb-2 h-10 w-10"
							onclick={() => (settingsOpen = true)}
						>
							<SettingsIcon size={18} />
						</Button>
					</Tooltip.Trigger>
					<Tooltip.Content side="right">Settings</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>
		</div>
	{/if}

	<!-- Main Content Area -->
	<div class="flex flex-1 flex-col">
		<!-- Top Layout -->
		<Resizable.PaneGroup direction="horizontal" class="flex-1">
			<!-- Sidebar -->
			{#if sidebarVisible}
				<Resizable.Pane
					defaultSize={sidebarWidth}
					minSize={200}
					maxSize={600}
					onResize={handleSidebarResize}
				>
					<EnhancedSidebar class="h-full" />
				</Resizable.Pane>
				<Resizable.Handle />
			{/if}

			<!-- Editor Area -->
			<Resizable.Pane>
				<Resizable.PaneGroup direction="vertical" class="h-full">
					<!-- Main Editor -->
					<Resizable.Pane>
						<div class="flex h-full flex-col">
							<!-- Editor Tabs Area -->
							<div class="border-b border-border bg-background">
								{#if $tabsStore.openFiles.length > 0}
									<div class="flex h-10 items-center overflow-x-auto px-2">
										{#each $openFilesData as fileData (fileData.id)}
											{@const isActive = fileData.id === $tabsStore.activeFileId}
											{@const isDirty = fileStateActions.isFileDirty(fileData.id)}
											<div
												class="flex cursor-pointer items-center border-r border-border px-3 py-1 transition-colors hover:bg-accent"
												class:bg-accent={isActive}
												onclick={() => tabActions.openFile(fileData.id)}
											>
												<span class="max-w-32 truncate text-sm">
													{fileData.name || 'Untitled'}
													{#if isDirty}
														<span class="ml-1 text-xs">●</span>
													{/if}
												</span>
												<Button
													variant="ghost"
													size="sm"
													class="ml-2 h-4 w-4 p-0 opacity-70 hover:opacity-100"
													onclick={(e) => {
														e.stopPropagation();
														tabActions.closeFile(fileData.id);
													}}
												>
													×
												</Button>
											</div>
										{/each}
									</div>
								{:else}
									<div class="flex h-10 items-center justify-center text-muted-foreground">
										<span class="text-sm">No files open</span>
									</div>
								{/if}
							</div>

							<!-- Editor Content -->
							<div class="relative flex-1">
								{@render children?.()}
							</div>
						</div>
					</Resizable.Pane>

					<!-- Terminal Panel -->
					{#if terminalVisible}
						<Resizable.Handle />
						<Resizable.Pane
							defaultSize={terminalHeight}
							minSize={100}
							maxSize={500}
							onResize={handleTerminalResize}
						>
							<div class="h-full border-t border-border bg-background">
								<!-- Terminal Header -->
								<div
									class="flex items-center justify-between border-b border-border bg-sidebar px-4 py-2"
								>
									<div class="flex items-center gap-2">
										<TerminalIcon size={16} />
										<span class="text-sm font-medium">Terminal</span>
									</div>
									<div class="flex gap-1">
										<Tooltip.Provider>
											<Tooltip.Root>
												<Tooltip.Trigger>
													<Button
														variant="ghost"
														size="sm"
														class="h-6 w-6 p-0"
														onclick={layoutActions.hideTerminal}
													>
														×
													</Button>
												</Tooltip.Trigger>
												<Tooltip.Content>Close Terminal</Tooltip.Content>
											</Tooltip.Root>
										</Tooltip.Provider>
									</div>
								</div>

								<!-- Terminal Content -->
								<div class="flex-1 p-4 font-mono text-sm">
									<p class="text-muted-foreground">Terminal integration coming soon...</p>
								</div>
							</div>
						</Resizable.Pane>
					{/if}
				</Resizable.PaneGroup>
			</Resizable.Pane>

			<!-- AI Panel (Optional) -->
			{#if aiPanelVisible}
				<Resizable.Handle />
				<Resizable.Pane defaultSize={aiPanelWidth} minSize={250} maxSize={500}>
					<div class="h-full border-l border-border bg-sidebar">
						<!-- AI Panel Header -->
						<div class="flex items-center justify-between border-b border-border px-4 py-2">
							<div class="flex items-center gap-2">
								<span class="text-sm font-medium">AI Assistant</span>
							</div>
							<Button
								variant="ghost"
								size="sm"
								class="h-6 w-6 p-0"
								onclick={layoutActions.hideAIPanel}
							>
								×
							</Button>
						</div>

						<!-- AI Panel Content -->
						<div class="flex-1 p-4">
							<p class="text-sm text-muted-foreground">AI assistance coming soon...</p>
						</div>
					</div>
				</Resizable.Pane>
			{/if}
		</Resizable.PaneGroup>

		<!-- Status Bar (Optional) -->
		{#if showStatusBar}
			<div
				class="flex h-6 items-center justify-between border-t border-border bg-sidebar px-4 text-xs"
			>
				<div class="flex items-center gap-4">
					<span class="text-muted-foreground">
						{$tabsStore.openFiles.length} tabs open
					</span>

					<!-- {#if file}
						<span class="text-muted-foreground">
							{file.path}
						</span>
					{/if} -->
				</div>

				<div class="flex items-center gap-4">
					<button
						class="cursor-pointer transition-colors hover:text-foreground"
						onclick={layoutActions.toggleTerminal}
						title="Toggle Terminal (⌘J)"
					>
						<TerminalIcon size={14} />
					</button>
					<button
						class="cursor-pointer transition-colors hover:text-foreground"
						onclick={() => (commandPaletteOpen = true)}
						title="Command Palette (⌘⇧P)"
					>
						<MenuIcon size={14} />
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Additional Dialogs -->
{#if fileSearchOpen}
	<!-- File Search Dialog -->
	<CommandPalette bind:open={fileSearchOpen} placeholder="Search files..." />
{/if}

{#if globalSearchOpen}
	<!-- Global Search Dialog -->
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<div class="m-4 w-full max-w-2xl rounded-lg border border-border bg-background p-6">
			<h2 class="mb-4 text-lg font-semibold">Global Search</h2>
			<p class="text-sm text-muted-foreground">Global search functionality coming soon...</p>
			<div class="mt-4 flex justify-end">
				<Button variant="outline" onclick={() => (globalSearchOpen = false)}>Close</Button>
			</div>
		</div>
	</div>
{/if}

{#if settingsOpen}
	<!-- Settings Dialog -->
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<div class="m-4 w-full max-w-2xl rounded-lg border border-border bg-background p-6">
			<h2 class="mb-4 text-lg font-semibold">Settings</h2>
			<p class="text-sm text-muted-foreground">Settings panel coming soon...</p>
			<div class="mt-4 flex justify-end">
				<Button variant="outline" onclick={() => (settingsOpen = false)}>Close</Button>
			</div>
		</div>
	</div>
{/if}
