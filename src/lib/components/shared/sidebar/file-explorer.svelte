<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { gitChanges } from '$lib/data/dummy-files.js';
	import { initializeDummyData } from '$lib/data/initialize-dummy-data.js';
	import { filesStore, fileStateActions, tabActions } from '$lib/stores/editor.ts';
	import { fileActions } from '$lib/stores/files.store.js';
	import type { Directory, File, FileSystemItem } from '@/types/files';
	import FilePlusIcon from '@lucide/svelte/icons/file-plus';
	import CollapseIcon from '@lucide/svelte/icons/fold-vertical';
	import FolderPlusIcon from '@lucide/svelte/icons/folder-plus';
	import RefreshIcon from '@lucide/svelte/icons/refresh-ccw';
	import FileTreeItem from './file-tree-item.svelte';

	interface Props {
		project?: { id: string; sandboxId?: string; sandboxProvider?: string };
		searchQuery?: string;
	}

	let { project, searchQuery = '' }: Props = $props();

	// State
	let expandedFolders = $state(new Set(['src', 'lib']));
	let selectedItem: string | null = $state(null);
	let draggedItem: FileSystemItem | null = $state(null);
	let clipboard: { item: FileSystemItem; operation: 'cut' | 'copy' } | null = $state(null);

	// Build file tree
	function buildFileTree(files: Map<string, FileSystemItem>): FileSystemItem[] {
		const rootItems: FileSystemItem[] = [];
		const itemsArray = Array.from(files.values());
		// Filter for root level items (no '/' in path or path represents top-level item)
		const roots = itemsArray.filter(
			(item) => !item.path.includes('/') || item.path.split('/').length === 1
		);

		roots.sort((a, b) => {
			const aName = a.name || a.path?.split('/')[0] || '';
			const bName = b.name || b.path?.split('/')[0] || '';
			if (a.type !== b.type) {
				return a.type === 'directory' ? -1 : 1;
			}
			return aName.localeCompare(bName);
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

	// Check if file has changes
	function hasChanges(fileId: string): boolean {
		const file = $filesStore.get(fileId);
		if (!file) return false;
		return (
			gitChanges[file.name as keyof typeof gitChanges] !== undefined ||
			fileStateActions.isFileDirty(fileId)
		);
	}

	// Event handlers
	async function handleFileClick(item: FileSystemItem) {
		const fileId = item.path;
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
		const file = $filesStore.get(fileId);
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

	async function loadFileContent(fileId: string) {
		const file = $filesStore.get(fileId);
		if (!file || file.type !== 'file') return;

		try {
			fileStateActions.setFileLoading(fileId, true);

			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 10000);

			const response = await fetch('/api/files', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					operation: 'read',
					sandboxId: project?.sandboxId || 'current-sandbox',
					projectId: project?.id,
					path: file.path,
					sandboxProvider: project?.sandboxProvider
				}),
				signal: controller.signal
			});

			clearTimeout(timeoutId);

			if (response.ok) {
				const result = await response.json();
				if (result.success && result.data !== undefined) {
					const content =
						typeof result.data.content === 'string'
							? result.data.content
							: String(result.data.content);
					fileActions.updateFileContent(fileId, content);
				}
			}
		} catch (error) {
			console.error('Error loading file content:', error);
		} finally {
			fileStateActions.setFileLoading(fileId, false);
		}
	}

	function toggleFolder(item: FileSystemItem) {
		if (expandedFolders.has(item.path)) {
			expandedFolders.delete(item.path);
		} else {
			expandedFolders.add(item.path);
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
			console.log(`Moving ${draggedItem.name} to ${targetItem.name}`);
		}
		draggedItem = null;
	}

	// Context menu actions
	async function handleCreateFile(parentId?: string) {
		const fileName = prompt('Enter file name:');
		if (!fileName) return;

		try {
			const parent = parentId ? $filesStore.get(parentId) : null;
			const parentPath = parent?.path || '';
			const filePath = parentPath ? `${parentPath}/${fileName}` : fileName;

			const newFile: File = {
				id: `file-${Date.now()}`,
				name: fileName,
				type: 'file',
				path: filePath,
				content: '',
				size: 0,
				modifiedAt: new Date(),
				createdAt: new Date(),
				parentId: parentId || null,
				permissions: {
					read: true,
					write: true,
					execute: false,
					delete: true,
					share: true,
					owner: 'current-user',
					collaborators: []
				},
				language: 'plaintext',
				encoding: 'utf-8',
				mimeType: 'text/plain',
				isDirty: false,
				isReadOnly: false,
				metadata: {
					extension: '',
					lineCount: 0,
					characterCount: 0,
					wordCount: 0,
					lastCursor: null,
					bookmarks: [],
					breakpoints: [],
					folds: [],
					searchHistory: []
				}
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
			const parent = parentId ? $filesStore.get(parentId) : null;
			const parentPath = parent?.path || '';
			const folderPath = parentPath ? `${parentPath}/${folderName}` : folderName;

			const newFolder: Directory = {
				id: `folder-${Date.now()}`,
				name: folderName,
				type: 'directory',
				path: folderPath,
				content: '',
				children: [],
				modifiedAt: new Date(),
				createdAt: new Date(),
				parentId: parentId || null,
				permissions: {
					read: true,
					write: true,
					execute: false,
					delete: true,
					share: true,
					owner: 'current-user',
					collaborators: []
				},
				isExpanded: false,
				isRoot: false
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
			const pathParts = item.path.split('/');
			pathParts[pathParts.length - 1] = newName;
			const newPath = pathParts.join('/');

			fileActions.updateFile(item.id, { name: newName, path: newPath });
		} catch (error) {
			console.error('Failed to rename:', error);
		}
	}

	async function handleDelete(item: FileSystemItem) {
		if (!confirm(`Delete ${item.name}?`)) return;

		try {
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
			if (clipboard.operation === 'cut') {
				clipboard = null;
			}
		}
	}

	// Reactive computed values
	const fileTree = $derived(buildFileTree($filesStore));
	const filteredTree = $derived(filterFiles(Array.from($filesStore.values()), searchQuery));
</script>

<div class="flex h-full flex-col">
	<!-- Explorer Header -->
	<div class="border-b border-border p-2">
		<div class="flex items-center justify-between">
			<h2 class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Explorer</h2>
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
										console.log('Refresh not implemented for real projects');
									} else {
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
				{@render renderFileTreeItem(item, 0)}
			{/each}
		{:else}
			{#each fileTree as item (item.path)}
				{@render renderFileTreeItem(item, 0)}
			{/each}
		{/if}
	</div>
</div>

{#snippet renderFileTreeItem(item: FileSystemItem, level: number)}
	<FileTreeItem
		{item}
		{level}
		isRoot={level === 0}
		isSelected={selectedItem === item.path}
		isExpanded={expandedFolders.has(item.path)}
		children={getChildren(item.id, $filesStore)}
		hasChanges={hasChanges(item.id)}
		hasChildChanges={item.type === 'directory' &&
			getChildren(item.id, $filesStore).some(
				(child) => child.type === 'file' && hasChanges(child.path)
			)}
		changeType={gitChanges.find((change) => change.file === item.name)?.state}
		isDirty={fileStateActions.isFileDirty(item.id)}
		canPaste={!!clipboard}
		onToggleFolder={toggleFolder}
		onFileClick={handleFileClick}
		onDragStart={handleDragStart}
		onDrop={handleDrop}
		onCreateFile={handleCreateFile}
		onCreateFolder={handleCreateFolder}
		onRename={handleRename}
		onCopy={handleCopy}
		onCut={handleCut}
		onPaste={handlePaste}
		onDelete={handleDelete}
	/>

	{#if item.type === 'directory' && expandedFolders.has(item.path)}
		<div class="children" style="margin-left: calc(8px + {level} * 16px + 7px);">
			{#each getChildren(item.id, $filesStore) as child (child.id)}
				{@render renderFileTreeItem(child, level + 1)}
			{/each}
		</div>
	{/if}
{/snippet}

<style>
	.children {
		border-left: 1px solid hsl(var(--border));
	}
</style>
