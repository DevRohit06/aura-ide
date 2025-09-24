<script lang="ts" module>
	import type { Directory, File, FileSystemItem } from '@/types/files';

	export interface SidebarView {
		id: string;
		name: string;
		icon: string;
		component?: any;
	}
</script>

<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	// File icon utilities
	import { getFileIcon } from '$lib/components/editor';
	import { getDirectoryIcon } from '$lib/utils/file-icons.js';
	// Icons
	import BugIcon from '@lucide/svelte/icons/bug';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import EditIcon from '@lucide/svelte/icons/edit';
	import CollapseIcon from '@lucide/svelte/icons/fold-vertical';
	import FilesIcon from '@lucide/svelte/icons/folder-tree';
	import GitBranchIcon from '@lucide/svelte/icons/git-branch';
	import ExtensionIcon from '@lucide/svelte/icons/package';
	import RefreshIcon from '@lucide/svelte/icons/refresh-ccw';
	import SearchIcon from '@lucide/svelte/icons/search';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import TrashIcon from '@lucide/svelte/icons/trash';
	// Settings Dialog
	import PasteIcon from '@lucide/svelte/icons/clipboard';
	import FilePlusIcon from '@lucide/svelte/icons/file-plus';
	import FolderPlusIcon from '@lucide/svelte/icons/folder-plus';
	import CutIcon from '@lucide/svelte/icons/scissors';
	// Stores
	import { gitChanges } from '$lib/data/dummy-files.js';
	import { initializeDummyData } from '$lib/data/initialize-dummy-data.js';

	import { filesStore, fileStateActions, tabActions } from '$lib/stores/editor.ts';
	import { fileActions } from '$lib/stores/files.store.js';
	import Icon from '@iconify/svelte';
	import CommandPalette from './command-palette.svelte';
	import ComprehensiveSettingsDialog from './comprehensive-settings-dialog.svelte';

	// Props
	let {
		class: className = '',
		defaultView = 'explorer',
		project = undefined
	}: {
		class?: string;
		defaultView?: string;
		project?: { id: string; sandboxId?: string; sandboxProvider?: string };
	} = $props();

	// State
	let currentView = $state(defaultView);
	let searchQuery = $state('');
	let commandPaletteOpen = $state(false);
	let settingsOpen = $state(false);
	let expandedFolders = $state(new Set(['src', 'lib']));
	let selectedItem: string | null = $state(null);
	let draggedItem: FileSystemItem | null = $state(null);
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

	// Initialize dummy data only if no real project is provided
	$effect(() => {
		if (!initialized && $filesStore.size === 0) {
			initialized = true;
			if (!project) {
				// Load dummy data for development when no project is provided
				initializeDummyData();
			}
			// Files are now loaded server-side for real projects
		}
	});

	// Build file tree
	function buildFileTree(files: Map<string, FileSystemItem>): FileSystemItem[] {
		console.log('Building file tree from files:', Array.from(files.values()));
		const rootItems: FileSystemItem[] = [];
		const itemsArray = Array.from(files.values());
		// Filter for root level items (no '/' in path or path represents top-level item)
		const roots = itemsArray.filter(
			(item) => !item.path.includes('/') || item.path.split('/').length === 1
		);

		roots.sort((a, b) => {
			const aName = a.name || a.path?.split('/')[0] || '';
			const bName = b.name || b.path?.split('/')[0] || '';
			console.log('Comparing:', aName, 'with', bName);
			if (a.type !== b.type) {
				return a.type === 'directory' ? -1 : 1;
			}
			return aName.localeCompare(bName);
		});
		console.log('Root items:', roots);
		return roots;
	}

	function getChildren(parentId: string, files: Map<string, FileSystemItem>): FileSystemItem[] {
		const itemsArray = Array.from(files.values());
		const children = itemsArray.filter((item) => item.parentId === parentId);

		children.sort((a, b) => {
			if (a.type !== b.type) {
				return a.type === 'directory' ? -1 : 1;
			}
			// Handle cases where name might be undefined
			const aName = a.name || '';
			const bName = b.name || '';
			return aName.localeCompare(bName);
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
	async function handleFileClick(fileId: string) {
		if (selectedItem === fileId) {
			// Double click - open file
			await openFile(fileId);
		} else {
			// Single click - select
			selectedItem = fileId;
			// Auto-open after delay
			setTimeout(async () => {
				if (selectedItem === fileId) {
					await openFile(fileId);
				}
			}, 300);
		}
	}

	async function openFile(fileId: string) {
		console.log('Opening file:', fileId);
		const file = $filesStore.get(fileId);
		console.log('File details:', file);
		if (!file || file.type !== 'file') return;

		try {
			// Load file content on-demand if not already loaded
			if (!file.content || file.content === '') {
				await loadFileContent(fileId);
			}

			// Open file in tab
			tabActions.openFile(fileId);
		} catch (error) {
			console.error('Failed to open file:', error);
		}
	}

	async function saveFileContent(fileId: string) {
		const file = $filesStore.get(fileId);
		if (!file || file.type !== 'file' || !file.content) return;

		try {
			const response = await fetch('/api/files', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					operation: 'write',
					sandboxId: project?.sandboxId || 'current-sandbox',
					path: file.path,
					content: file.content
				})
			});

			if (response.ok) {
				const result = await response.json();
				if (result.success) {
					console.log(`Saved file: ${file.name}`);
					// Mark file as saved (could add a dirty flag to the file type)
				} else {
					console.warn('Failed to save file:', result.error);
				}
			} else {
				console.warn('Failed to save file:', response.status);
			}
		} catch (error) {
			console.error('Error saving file:', error);
		}
	}

	// Expose save function for external use (e.g., from editor component)
	export function saveFile(fileId: string) {
		return saveFileContent(fileId);
	}

	async function loadFileContent(fileId: string) {
		const file = $filesStore.get(fileId);
		if (!file || file.type !== 'file') return;

		try {
			// Set loading state
			console.log(`🔄 Starting to load content for file: ${file.name}`);
			tabActions.openFile(fileId); // Ensure file tab is open
			fileStateActions.setFileLoading(fileId, true);

			// Load file content from sandbox API with timeout
			console.log(`📡 Making API call for file: ${file.path}`);
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

			const response = await fetch('/api/files', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					operation: 'read',
					sandboxId: project?.sandboxId || 'current-sandbox',
					projectId: project?.id,
					path: file.path
				}),
				signal: controller.signal
			});

			clearTimeout(timeoutId);

			console.log(`📥 API response status: ${response.status}`);

			if (response.ok) {
				const result = await response.json();
				console.log(`📄 API result:`, result);
				if (result.success && result.data !== undefined) {
					// Ensure content is a string
					const content =
						typeof result.data.content === 'string'
							? result.data.content
							: String(result.data.content);
					// Update file content in store
					fileActions.updateFileContent(fileId, content);
					console.log(`✅ Loaded content for file: ${file.name}, length: ${content.length}`);
				} else {
					console.warn('Failed to load file content:', result.error);
				}
			} else {
				console.warn('Failed to load file content:', response.status);
			}
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				console.error('⏰ File content loading timed out:', file.name);
			} else {
				console.error('❌ Error loading file content:', error);
			}
		} finally {
			// Clear loading state
			console.log(`🔄 Clearing loading state for file: ${file.name}`);
			fileStateActions.setFileLoading(fileId, false);
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
	async function handleCreateFile(parentId?: string) {
		const fileName = prompt('Enter file name:');
		if (!fileName) return;

		try {
			// Get parent path
			const parent = parentId ? $filesStore.get(parentId) : null;
			const parentPath = parent?.path || '';
			const filePath = parentPath ? `${parentPath}/${fileName}` : fileName;

			// File created locally (placeholder for future sandbox integration)

			// Create file in local store
			const newFile: File = {
				id: `file-${Date.now()}`,
				name: fileName,
				type: 'file',
				path: filePath,
				content: '',
				size: 0,
				modifiedAt: new Date(),
				parentId: parentId || null
			};

			fileActions.addFile(newFile);
		} catch (error) {
			console.error('Failed to create file:', error);
		}
	}

	async function handleCreateFolder(parentId?: string) {
		const folderName = prompt('Enter folder name:');
		if (!folderName) return;

		try {
			// Get parent path
			const parent = parentId ? $filesStore.get(parentId) : null;
			const parentPath = parent?.path || '';
			const folderPath = parentPath ? `${parentPath}/${folderName}` : folderName;

			// Directory created locally (placeholder for future sandbox integration)

			// Create folder in local store
			const newFolder: Directory = {
				id: `folder-${Date.now()}`,
				name: folderName,
				type: 'directory',
				path: folderPath,
				children: [],
				modifiedAt: new Date(),
				parentId: parentId || null
			};

			fileActions.addFile(newFolder);
		} catch (error) {
			console.error('Failed to create folder:', error);
		}
	}

	async function handleRename(item: FileSystemItem) {
		const newName = prompt('Enter new name:', item.name);
		if (!newName || newName === item.name) return;

		try {
			// Calculate new path
			const pathParts = item.path.split('/');
			pathParts[pathParts.length - 1] = newName;
			const newPath = pathParts.join('/');

			// Item renamed locally (placeholder for future sandbox integration)

			// Update local store
			fileActions.updateFile(item.id, { name: newName, path: newPath });
		} catch (error) {
			console.error('Failed to rename:', error);
		}
	}

	async function handleDelete(item: FileSystemItem) {
		if (!confirm(`Delete ${item.name}?`)) return;

		try {
			// Item deleted locally (placeholder for future sandbox integration)

			// Delete from local store
			fileActions.removeFile(item.id);
		} catch (error) {
			console.error('Failed to delete:', error);
		}
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
	const filteredTree = $derived(filterFiles(Array.from($filesStore.values()), searchQuery));

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

<!-- Activity Bar -->
<div class="flex h-full max-h-dvh">
	<!-- Side Activity Bar -->
	<div class="flex w-12 flex-col border-r border-border bg-sidebar-accent">
		{#each sidebarViews as view (view.id)}
			<Tooltip.Provider>
				<Tooltip.Root>
					<Tooltip.Trigger class="">
						<Button variant="secondary" class="w-full" onclick={() => (currentView = view.id)}>
							{#if view.icon === 'folder-tree'}
								<FilesIcon />
							{:else if view.icon === 'search'}
								<SearchIcon />
							{:else if view.icon === 'git-branch'}
								<GitBranchIcon />
							{:else if view.icon === 'bug'}
								<BugIcon />
							{:else if view.icon === 'package'}
								<ExtensionIcon />
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
						<Button
							variant="ghost"
							size="icon"
							class="h-12 w-12 rounded-none"
							onclick={() => (settingsOpen = true)}
						>
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
				<div class=" flex items-center justify-between">
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
									<Button
										variant="ghost"
										size="sm"
										class="h-6 w-6 p-0"
										onclick={() => {
											if (project) {
												// For real projects, refresh would reload from server
												// For now, just log that refresh is not implemented
												console.log('Refresh not implemented for real projects');
											} else {
												// For dummy data, reload dummy data
												initializeDummyData();
											}
										}}
									>
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
			</div>

			<!-- File Tree -->
			<div class="flex-1 overflow-y-auto">
				{#if searchQuery.trim()}
					{#each filteredTree as item (item.path)}
						{@render FileTreeNode({ item, level: 0, isRoot: true })}
					{/each}
				{:else}
					{#each fileTree as item (item.path)}
						{@render FileTreeNode({ item, level: 0, isRoot: true })}
					{/each}
				{/if}
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
<CommandPalette bind:open={commandPaletteOpen} />

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
					{@const isExpanded = expandedFolders.has(item.path)}
					{@const hasChildChanges = children.some(
						(child) => child.type === 'file' && hasChanges(child.path)
					)}

					<button
						class="group flex w-full items-center px-2 py-1 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
						class:bg-accent={selectedItem === item.id}
						style="padding-left: {8 + level * 16}px"
						onclick={() => {
							toggleFolder(item.path);
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
								{@render FileTreeNode({ item: child, level: level })}
							{/each}
						</div>
					{/if}
				{:else}
					{@const hasFileChanges = hasChanges(item.id)}
					{@const changeType = gitChanges.find((change) => change.file === item.name)?.state}
					{@const FileIcon = getFileIcon(item.name)}
					<button
						class="group flex w-full items-center px-2 py-1 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
						class:bg-accent={selectedItem === item.id}
						style="padding-left: {8 + (level + 1) * 16}px"
						onclick={() => handleFileClick(item.path)}
						draggable="true"
						ondragstart={(e) => handleDragStart(e, item)}
					>
						<div class="flex min-w-0 flex-1 items-center">
							<Icon icon={FileIcon} class="mr-2 h-3.5 w-3.5 shrink-0" style="color: #3b82f6" />
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

<!-- Settings Dialog -->
<ComprehensiveSettingsDialog bind:open={settingsOpen} />

<style>
	.children {
		border-left: 1px solid hsl(var(--border));
		margin-left: calc(8px + var(--level, 0) * 16px + 7px);
	}
</style>
