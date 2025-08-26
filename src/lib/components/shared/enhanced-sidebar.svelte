<script lang="ts" module>
	import type { FileSystemItem, File, Directory } from '@/types/files';

	export interface SidebarView {
		id: string;
		name: string;
		icon: string;
		component?: any;
	}
</script>

<script lang="ts">
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import * as Resizable from '$lib/components/ui/resizable/index.js';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';

	// File icon utilities
	import { getDirectoryIcon, getFileColor } from '$lib/utils/file-icons.js';
	import { getFileIcon } from '$lib/components/editor';

	// Icons
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import SearchIcon from '@lucide/svelte/icons/search';
	import FolderIcon from '@lucide/svelte/icons/folder';
	import FolderOpenIcon from '@lucide/svelte/icons/folder-open';
	import FileIcon from '@lucide/svelte/icons/file';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import ImageIcon from '@lucide/svelte/icons/image';
	import CodeIcon from '@lucide/svelte/icons/code';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import GitBranchIcon from '@lucide/svelte/icons/git-branch';
	import BugIcon from '@lucide/svelte/icons/bug';
	import ExtensionIcon from '@lucide/svelte/icons/package';
	import FilesIcon from '@lucide/svelte/icons/folder-tree';
	import TerminalIcon from '@lucide/svelte/icons/terminal';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import RefreshIcon from '@lucide/svelte/icons/refresh-ccw';
	import CollapseIcon from '@lucide/svelte/icons/fold-vertical';
	import MoreHorizontalIcon from '@lucide/svelte/icons/more-horizontal';
	import EditIcon from '@lucide/svelte/icons/edit';
	import TrashIcon from '@lucide/svelte/icons/trash';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import CutIcon from '@lucide/svelte/icons/scissors';
	import PasteIcon from '@lucide/svelte/icons/clipboard';
	import FolderPlusIcon from '@lucide/svelte/icons/folder-plus';
	import FilePlusIcon from '@lucide/svelte/icons/file-plus';

	// Stores
	import { filesStore, tabActions, fileStateActions, tabsStore } from '$lib/stores/editor.js';
	import { layoutStore, layoutActions } from '$lib/stores/layout.store.js';
	import { gitChanges } from '$lib/data/dummy-files.js';
	import { initializeDummyData } from '$lib/data/initialize-dummy-data.js';
	import Icon from '@iconify/svelte';

	// Props
	let { class: className = '', defaultView = 'explorer' } = $props();

	// State
	let currentView = $state(defaultView);
	let searchQuery = $state('');
	let showSearch = $state(false);
	let commandPaletteOpen = $state(false);
	let expandedFolders = $state(new Set(['src', 'lib']));
	let selectedItem: string | null = $state(null);
	let draggedItem: FileSystemItem | null = $state(null);
	let contextMenuItem: FileSystemItem | null = $state(null);
	let clipboard: { item: FileSystemItem; operation: 'cut' | 'copy' } | null = $state(null);

	// Track initialization
	let initialized = $state(false);

	// Sidebar views configuration
	const sidebarViews: SidebarView[] = [
		{ id: 'explorer', name: 'Explorer', icon: 'folder-tree' },
		{ id: 'search', name: 'Search', icon: 'search' },
		{ id: 'source-control', name: 'Source Control', icon: 'git-branch' },
		{ id: 'debug', name: 'Run and Debug', icon: 'bug' },
		{ id: 'extensions', name: 'Extensions', icon: 'package' }
	];

	// Initialize dummy data
	$effect(() => {
		if (!initialized && $filesStore.size === 0) {
			initialized = true;
			initializeDummyData();
		}
	});

	// Build file tree
	function buildFileTree(files: Map<string, FileSystemItem>): FileSystemItem[] {
		const rootItems: FileSystemItem[] = [];
		const itemsArray = Array.from(files.values());
		const roots = itemsArray.filter((item) => item.parentId === null);

		roots.sort((a, b) => {
			if (a.type !== b.type) {
				return a.type === 'directory' ? -1 : 1;
			}
			return a.name.localeCompare(b.name);
		});

		return roots;
	}

	function getChildren(parentId: string, files: Map<string, FileSystemItem>): FileSystemItem[] {
		const itemsArray = Array.from(files.values());
		const children = itemsArray.filter((item) => item.parentId === parentId);

		children.sort((a, b) => {
			if (a.type !== b.type) {
				return a.type === 'directory' ? -1 : 1;
			}
			return a.name.localeCompare(b.name);
		});

		return children;
	}

	// Filter files based on search
	function filterFiles(files: FileSystemItem[], query: string): FileSystemItem[] {
		if (!query.trim()) return files;

		const searchLower = query.toLowerCase();
		return files.filter(
			(item) =>
				item.name.toLowerCase().includes(searchLower) ||
				item.path.toLowerCase().includes(searchLower)
		);
	}

	// Event handlers
	function handleFileClick(fileId: string) {
		if (selectedItem === fileId) {
			// Double click - open file
			tabActions.openFile(fileId);
		} else {
			// Single click - select
			selectedItem = fileId;
			// Auto-open after delay
			setTimeout(() => {
				if (selectedItem === fileId) {
					tabActions.openFile(fileId);
				}
			}, 300);
		}
	}

	function toggleFolder(folderId: string) {
		if (expandedFolders.has(folderId)) {
			expandedFolders.delete(folderId);
		} else {
			expandedFolders.add(folderId);
		}
		expandedFolders = new Set(expandedFolders);
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.ctrlKey || event.metaKey) {
			switch (event.key) {
				case 'k':
					event.preventDefault();
					commandPaletteOpen = true;
					break;
				case 'f':
					event.preventDefault();
					showSearch = !showSearch;
					break;
			}
		}
	}

	function handleDragStart(event: DragEvent, item: FileSystemItem) {
		draggedItem = item;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', item.id);
		}
	}

	function handleDrop(event: DragEvent, targetItem: FileSystemItem) {
		event.preventDefault();
		if (draggedItem && targetItem.type === 'directory') {
			// TODO: Implement file moving logic
			console.log(`Moving ${draggedItem.name} to ${targetItem.name}`);
		}
		draggedItem = null;
	}

	// Context menu actions
	function handleCreateFile(parentId?: string) {
		console.log('Creating file in:', parentId);
		// TODO: Implement file creation
	}

	function handleCreateFolder(parentId?: string) {
		console.log('Creating folder in:', parentId);
		// TODO: Implement folder creation
	}

	function handleRename(item: FileSystemItem) {
		console.log('Renaming:', item.name);
		// TODO: Implement rename
	}

	function handleDelete(item: FileSystemItem) {
		console.log('Deleting:', item.name);
		// TODO: Implement delete
	}

	function handleCopy(item: FileSystemItem) {
		clipboard = { item, operation: 'copy' };
	}

	function handleCut(item: FileSystemItem) {
		clipboard = { item, operation: 'cut' };
	}

	function handlePaste(targetItem?: FileSystemItem) {
		if (clipboard) {
			console.log(`${clipboard.operation} ${clipboard.item.name} to ${targetItem?.name || 'root'}`);
			// TODO: Implement paste
			if (clipboard.operation === 'cut') {
				clipboard = null;
			}
		}
	}

	// Reactive computed values
	const fileTree = $derived(buildFileTree($filesStore));
	const filteredTree = $derived(
		showSearch ? filterFiles(Array.from($filesStore.values()), searchQuery) : fileTree
	);

	// Check if file has changes
	function hasChanges(fileId: string): boolean {
		const file = $filesStore.get(fileId);
		if (!file) return false;
		return (
			gitChanges[file.name as keyof typeof gitChanges] !== undefined ||
			fileStateActions.isFileDirty(fileId)
		);
	}
</script>

<svelte:window on:keydown={handleKeyDown} />

<!-- Activity Bar -->
<div class="flex h-full">
	<!-- Side Activity Bar -->
	<div class="flex w-12 flex-col items-center border-r border-border bg-sidebar-accent">
		{#each sidebarViews as view (view.id)}
			<Tooltip.Provider>
				<Tooltip.Root>
					<Tooltip.Trigger
						class={buttonVariants({
							variant: currentView === view.id ? 'secondary' : 'ghost',
							size: 'icon'
						})}
					>
						<Button variant="secondary" size="icon" onclick={() => (currentView = view.id)}>
							{#if view.icon === 'folder-tree'}
								<FilesIcon size={20} />
							{:else if view.icon === 'search'}
								<SearchIcon size={20} />
							{:else if view.icon === 'git-branch'}
								<GitBranchIcon size={20} />
							{:else if view.icon === 'bug'}
								<BugIcon size={20} />
							{:else if view.icon === 'package'}
								<ExtensionIcon size={20} />
							{/if}
						</Button>
					</Tooltip.Trigger>
					<Tooltip.Content side="right">
						{view.name}
					</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>
		{/each}

		<div class="mt-auto">
			<Tooltip.Provider>
				<Tooltip.Root>
					<Tooltip.Trigger>
						<Button variant="ghost" size="icon" class="h-12 w-12 rounded-none">
							<SettingsIcon size={20} />
						</Button>
					</Tooltip.Trigger>
					<Tooltip.Content side="right">Settings</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>
		</div>
	</div>

	<!-- Main Sidebar Content -->
	<div class="flex h-full flex-1 flex-col">
		{#if currentView === 'explorer'}
			<!-- Explorer Header -->
			<div class="border-b border-border p-2">
				<div class="mb-2 flex items-center justify-between">
					<h2 class="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
						Explorer
					</h2>
					<div class="flex gap-1">
						<Tooltip.Provider>
							<Tooltip.Root>
								<Tooltip.Trigger>
									<Button
										variant="ghost"
										size="sm"
										class="h-6 w-6 p-0"
										onclick={() => handleCreateFile()}
									>
										<FilePlusIcon size={14} />
									</Button>
								</Tooltip.Trigger>
								<Tooltip.Content>New File</Tooltip.Content>
							</Tooltip.Root>
						</Tooltip.Provider>
						<Tooltip.Provider>
							<Tooltip.Root>
								<Tooltip.Trigger>
									<Button
										variant="ghost"
										size="sm"
										class="h-6 w-6 p-0"
										onclick={() => handleCreateFolder()}
									>
										<FolderPlusIcon size={14} />
									</Button>
								</Tooltip.Trigger>
								<Tooltip.Content>New Folder</Tooltip.Content>
							</Tooltip.Root>
						</Tooltip.Provider>

						<Tooltip.Provider>
							<Tooltip.Root>
								<Tooltip.Trigger>
									<Button variant="ghost" size="sm" class="h-6 w-6 p-0">
										<RefreshIcon size={14} />
									</Button>
								</Tooltip.Trigger>
								<Tooltip.Content>Refresh Explorer</Tooltip.Content>
							</Tooltip.Root>
						</Tooltip.Provider>
						<Tooltip.Provider>
							<Tooltip.Root>
								<Tooltip.Trigger>
									<Button variant="ghost" size="sm" class="h-6 w-6 p-0">
										<CollapseIcon size={14} />
									</Button>
								</Tooltip.Trigger>
								<Tooltip.Content>Collapse All</Tooltip.Content>
							</Tooltip.Root>
						</Tooltip.Provider>
					</div>
				</div>

				<!-- Search Toggle -->
				<div class="flex gap-2">
					<Button
						variant="ghost"
						size="sm"
						class="h-6 flex-1 justify-start text-xs"
						onclick={() => (showSearch = !showSearch)}
					>
						<SearchIcon size={12} class="mr-1" />
						{showSearch ? 'Hide Search' : 'Search Files'}
					</Button>
				</div>

				<!-- Search Input -->
				{#if showSearch}
					<div class="mt-2">
						<Input bind:value={searchQuery} placeholder="Search files..." class="h-6 text-xs" />
					</div>
				{/if}
			</div>

			<!-- File Tree -->
			<div class="flex-1 overflow-y-auto">
				{#each filteredTree as item (item.id)}
					{@render FileTreeNode({ item, level: 0, isRoot: true })}
				{/each}
			</div>
		{:else if currentView === 'search'}
			<div class="p-4">
				<h2 class="mb-4 font-semibold">Search</h2>
				<p class="text-sm text-muted-foreground">Global search functionality would go here</p>
			</div>
		{:else if currentView === 'source-control'}
			<div class="p-4">
				<h2 class="mb-4 font-semibold">Source Control</h2>
				<p class="text-sm text-muted-foreground">Git integration would go here</p>
			</div>
		{:else}
			<div class="p-4">
				<h2 class="mb-4 font-semibold">
					{sidebarViews.find((v) => v.id === currentView)?.name}
				</h2>
				<p class="text-sm text-muted-foreground">Coming soon...</p>
			</div>
		{/if}
	</div>
</div>

<!-- Command Palette -->
<Dialog.Root bind:open={commandPaletteOpen}>
	<Dialog.Content class="max-w-2xl">
		<Command.Root>
			<Command.Input placeholder="Type a command or search..." />
			<Command.List>
				<Command.Empty>No results found.</Command.Empty>
				<Command.Group heading="Quick Actions">
					<Command.Item onSelect={() => handleCreateFile()}>
						<FilePlusIcon class="mr-2 h-4 w-4" />
						New File
						<Command.Shortcut>Ctrl+N</Command.Shortcut>
					</Command.Item>
					<Command.Item onSelect={() => handleCreateFolder()}>
						<FolderPlusIcon class="mr-2 h-4 w-4" />
						New Folder
					</Command.Item>
					<Command.Item onSelect={() => (showSearch = true)}>
						<SearchIcon class="mr-2 h-4 w-4" />
						Search Files
						<Command.Shortcut>Ctrl+F</Command.Shortcut>
					</Command.Item>
				</Command.Group>
				<Command.Group heading="Files">
					{#each Array.from($filesStore.values())
						.filter((f) => f.type === 'file')
						.slice(0, 10) as file (file.id)}
						<Command.Item onSelect={() => tabActions.openFile(file.id)}>
							<Icon icon={getFileIcon(file.name)} class="mr-2 h-4 w-4" />
							{file.name}
							<span class="ml-auto text-xs text-muted-foreground">{file.path}</span>
						</Command.Item>
					{/each}
				</Command.Group>
			</Command.List>
		</Command.Root>
	</Dialog.Content>
</Dialog.Root>

{#snippet FileTreeNode({
	item,
	level,
	isRoot
}: {
	item: FileSystemItem;
	level: number;
	isRoot?: boolean;
})}
	<ContextMenu.Root>
		<ContextMenu.Trigger>
			<div class="group">
				{#if item.type === 'directory'}
					{@const children = getChildren(item.id, $filesStore)}
					{@const isExpanded = expandedFolders.has(item.id)}
					{@const hasChildChanges = children.some(
						(child) => child.type === 'file' && hasChanges(child.id)
					)}

					<button
						class="group flex w-full items-center px-2 py-1 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
						class:bg-accent={selectedItem === item.id}
						style="padding-left: {8 + level * 16}px"
						onclick={() => {
							toggleFolder(item.id);
							selectedItem = item.id;
						}}
						draggable="true"
						ondragstart={(e) => handleDragStart(e, item)}
						ondragover={(e) => e.preventDefault()}
						ondrop={(e) => handleDrop(e, item)}
					>
						<div class="flex min-w-0 flex-1 items-center">
							{#if isExpanded}
								<ChevronDownIcon size={14} class="mr-1 shrink-0" />
								{@const DirIcon = getDirectoryIcon(true)}
								<DirIcon size={14} class="mr-2 shrink-0" style="color: #3b82f6" />
							{:else}
								<ChevronRightIcon size={14} class="mr-1 shrink-0" />
								{@const DirIcon = getDirectoryIcon(false)}
								<DirIcon size={14} class="mr-2 shrink-0" style="color: #3b82f6" />
							{/if}
							<span class="truncate text-sm">{item.name}</span>
							{#if hasChildChanges}
								<div class="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500"></div>
							{/if}
						</div>
					</button>

					{#if isExpanded}
						<div class="children">
							{#each children as child (child.id)}
								{@render FileTreeNode({ item: child, level: level + 1 })}
							{/each}
						</div>
					{/if}
				{:else}
					{@const hasFileChanges = hasChanges(item.id)}
					{@const changeType = gitChanges[item.name as keyof typeof gitChanges]}
					{@const FileIcon = getFileIcon(item.name)}
					<button
						class="group flex w-full items-center px-2 py-1 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
						class:bg-accent={selectedItem === item.id}
						style="padding-left: {8 + level * 16}px"
						onclick={() => handleFileClick(item.id)}
						draggable="true"
						ondragstart={(e) => handleDragStart(e, item)}
					>
						<div class="flex min-w-0 flex-1 items-center">
							<Icon icon={FileIcon} size={14} class="mr-2 shrink-0" style="color: #3b82f6" />
							<span
								class="truncate text-sm"
								class:text-green-400={changeType === 'A'}
								class:text-orange-400={changeType === 'M'}
								class:text-red-400={changeType === 'D'}
							>
								{item.name}
							</span>
							{#if changeType}
								<Badge variant="secondary" class="ml-auto h-4 px-1 text-xs">
									{changeType}
								</Badge>
							{/if}
							{#if fileStateActions.isFileDirty(item.id)}
								<div class="ml-1 h-1.5 w-1.5 shrink-0 rounded-full bg-white"></div>
							{/if}
						</div>
					</button>
				{/if}
			</div>
		</ContextMenu.Trigger>
		<ContextMenu.Content>
			{#if item.type === 'directory'}
				<ContextMenu.Item onclick={() => handleCreateFile(item.id)}>
					<FilePlusIcon class="mr-2 h-4 w-4" />
					New File
				</ContextMenu.Item>
				<ContextMenu.Item onclick={() => handleCreateFolder(item.id)}>
					<FolderPlusIcon class="mr-2 h-4 w-4" />
					New Folder
				</ContextMenu.Item>
				<ContextMenu.Separator />
			{/if}
			<ContextMenu.Item onclick={() => handleRename(item)}>
				<EditIcon class="mr-2 h-4 w-4" />
				Rename
			</ContextMenu.Item>
			<ContextMenu.Item onclick={() => handleCopy(item)}>
				<CopyIcon class="mr-2 h-4 w-4" />
				Copy
			</ContextMenu.Item>
			<ContextMenu.Item onclick={() => handleCut(item)}>
				<CutIcon class="mr-2 h-4 w-4" />
				Cut
			</ContextMenu.Item>
			{#if clipboard}
				<ContextMenu.Item onclick={() => handlePaste(item.type === 'directory' ? item : undefined)}>
					<PasteIcon class="mr-2 h-4 w-4" />
					Paste
				</ContextMenu.Item>
			{/if}
			<ContextMenu.Separator />
			<ContextMenu.Item onclick={() => handleDelete(item)} class="text-destructive">
				<TrashIcon class="mr-2 h-4 w-4" />
				Delete
			</ContextMenu.Item>
		</ContextMenu.Content>
	</ContextMenu.Root>
{/snippet}

<style>
	.children {
		border-left: 1px solid hsl(var(--border));
		margin-left: calc(8px + var(--level, 0) * 16px + 7px);
	}
</style>
