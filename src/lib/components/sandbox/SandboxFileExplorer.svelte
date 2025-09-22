<!--
  SandboxFileExplorer.svelte
  File browser and management component for sandbox environments
-->
<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { Separator } from '$lib/components/ui/separator';
	import { Textarea } from '$lib/components/ui/textarea';
	import {
		Code,
		Download,
		Edit,
		File,
		FileText,
		Folder,
		Image,
		Plus,
		RefreshCw,
		Save,
		Search,
		Trash2,
		X
	} from 'lucide-svelte';
	import { onMount } from 'svelte';

	interface Props {
		sandbox: {
			id: string;
			name: string;
			status: string;
		};
		open: boolean;
	}

	let { sandbox, open = $bindable() }: Props = $props();

	interface FileSystemEntry {
		name: string;
		path: string;
		type: 'file' | 'directory';
		size?: number;
		modified?: string;
		children?: FileSystemEntry[];
	}

	interface FileContent {
		path: string;
		content: string;
		encoding: string;
		size: number;
		modified?: string;
	}

	// Component state
	let fileTree = $state<FileSystemEntry[]>([]);
	let currentPath = $state('/');
	let selectedFile = $state<FileSystemEntry | null>(null);
	let fileContent = $state<FileContent | null>(null);
	let loading = $state(false);
	let saving = $state(false);
	let error = $state<string | null>(null);
	let searchQuery = $state('');
	let showCreateDialog = $state(false);
	let editMode = $state(false);
	let editedContent = $state('');

	// New file/folder state
	let newItemName = $state('');
	let newItemType = $state<'file' | 'directory'>('file');
	let showUploadDialog = $state(false);

	// Breadcrumbs
	let pathSegments = $derived(() => {
		return currentPath.split('/').filter(Boolean);
	});

	// Load file tree
	async function loadFiles(path: string = '/') {
		loading = true;
		error = null;

		try {
			const response = await fetch(
				`/api/sandbox/${sandbox.id}/files?path=${encodeURIComponent(path)}&recursive=true`
			);
			if (!response.ok) {
				throw new Error('Failed to load files');
			}

			const data = await response.json();
			fileTree = data.files;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load files';
			console.error('Error loading files:', err);
		} finally {
			loading = false;
		}
	}

	// Load file content
	async function loadFileContent(filePath: string) {
		if (selectedFile?.type !== 'file') return;

		loading = true;
		error = null;

		try {
			const response = await fetch(`/api/sandbox/${sandbox.id}/files${filePath}`);
			if (!response.ok) {
				throw new Error('Failed to load file content');
			}

			const content = await response.json();
			fileContent = content;
			editedContent = content.content;
			editMode = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load file content';
			console.error('Error loading file content:', err);
		} finally {
			loading = false;
		}
	}

	// Save file content
	async function saveFileContent() {
		if (!fileContent) return;

		saving = true;
		error = null;

		try {
			const response = await fetch(`/api/sandbox/${sandbox.id}/files${fileContent.path}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					content: editedContent,
					encoding: fileContent.encoding
				})
			});

			if (!response.ok) {
				throw new Error('Failed to save file');
			}

			fileContent.content = editedContent;
			editMode = false;
			await loadFiles(currentPath);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save file';
			console.error('Error saving file:', err);
		} finally {
			saving = false;
		}
	}

	// Create new file or directory
	async function createItem() {
		if (!newItemName.trim()) {
			error = 'Name is required';
			return;
		}

		const itemPath = currentPath === '/' ? `/${newItemName}` : `${currentPath}/${newItemName}`;

		try {
			if (newItemType === 'file') {
				const response = await fetch(`/api/sandbox/${sandbox.id}/files`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						path: itemPath,
						content: '',
						encoding: 'utf-8'
					})
				});

				if (!response.ok) {
					throw new Error('Failed to create file');
				}
			} else {
				// Create directory - implementation depends on your API
				const response = await fetch(`/api/sandbox/${sandbox.id}/files`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						path: itemPath,
						type: 'directory'
					})
				});

				if (!response.ok) {
					throw new Error('Failed to create directory');
				}
			}

			newItemName = '';
			showCreateDialog = false;
			await loadFiles(currentPath);
		} catch (err) {
			error = err instanceof Error ? err.message : `Failed to create ${newItemType}`;
		}
	}

	// Delete file or directory
	async function deleteItem(filePath: string) {
		if (!confirm('Are you sure you want to delete this item?')) {
			return;
		}

		try {
			const response = await fetch(`/api/sandbox/${sandbox.id}/files${filePath}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				throw new Error('Failed to delete item');
			}

			// Clear selection if deleted item was selected
			if (selectedFile?.path === filePath) {
				selectedFile = null;
				fileContent = null;
			}

			await loadFiles(currentPath);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete item';
		}
	}

	// Navigate to directory
	function navigateToPath(path: string) {
		currentPath = path;
		loadFiles(path);
		selectedFile = null;
		fileContent = null;
	}

	// Handle file selection
	function selectFile(file: FileSystemEntry) {
		selectedFile = file;
		if (file.type === 'file') {
			loadFileContent(file.path);
		} else {
			fileContent = null;
		}
	}

	// Get file icon
	function getFileIcon(file: FileSystemEntry) {
		if (file.type === 'directory') {
			return Folder;
		}

		const ext = file.name.split('.').pop()?.toLowerCase();
		switch (ext) {
			case 'js':
			case 'ts':
			case 'jsx':
			case 'tsx':
			case 'vue':
			case 'svelte':
			case 'py':
			case 'java':
			case 'cpp':
			case 'c':
			case 'go':
			case 'rs':
			case 'php':
			case 'rb':
				return Code;
			case 'png':
			case 'jpg':
			case 'jpeg':
			case 'gif':
			case 'svg':
			case 'webp':
				return Image;
			case 'md':
			case 'txt':
			case 'json':
			case 'yml':
			case 'yaml':
			case 'xml':
			case 'html':
			case 'css':
				return FileText;
			default:
				return File;
		}
	}

	// Format file size
	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	// Filter files by search
	let filteredFiles = $derived(() => {
		if (!searchQuery.trim()) return fileTree;

		return fileTree.filter((file) => file.name.toLowerCase().includes(searchQuery.toLowerCase()));
	});

	// Initialize on mount
	onMount(() => {
		if (open && sandbox.status === 'running') {
			loadFiles();
		}
	});

	// Reload when dialog opens
	$effect(() => {
		if (open && sandbox.status === 'running') {
			loadFiles();
		}
	});
</script>

<Dialog bind:open class="max-w-7xl">
	<DialogContent class="flex max-h-[90vh] max-w-7xl flex-col overflow-hidden">
		<DialogHeader>
			<DialogTitle>File Explorer - {sandbox.name}</DialogTitle>
			<DialogDescription>Browse and edit files in your sandbox environment</DialogDescription>
		</DialogHeader>

		{#if sandbox.status !== 'running'}
			<Card class="border-yellow-200 bg-yellow-50">
				<CardContent class="pt-6">
					<p class="text-yellow-800">
						Sandbox must be running to access files. Current status: {sandbox.status}
					</p>
				</CardContent>
			</Card>
		{:else}
			<div class="grid flex-1 grid-cols-12 gap-4 overflow-hidden">
				<!-- File Tree Sidebar -->
				<div class="col-span-4 flex flex-col space-y-4">
					<!-- Path Navigation -->
					<div class="space-y-2">
						<div class="flex items-center gap-2">
							<Button size="sm" variant="outline" onclick={() => navigateToPath('/')}>Root</Button>
							{#each pathSegments as segment, index}
								<span>/</span>
								<Button
									size="sm"
									variant="ghost"
									onclick={() => navigateToPath('/' + pathSegments.slice(0, index + 1).join('/'))}
								>
									{segment}
								</Button>
							{/each}
						</div>

						<!-- Actions -->
						<div class="flex gap-2">
							<Button size="sm" onclick={() => loadFiles(currentPath)}>
								<RefreshCw class="mr-1 h-3 w-3" />
								Refresh
							</Button>
							<Button size="sm" onclick={() => (showCreateDialog = true)}>
								<Plus class="mr-1 h-3 w-3" />
								New
							</Button>
						</div>

						<!-- Search -->
						<div class="relative">
							<Search class="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
							<Input placeholder="Search files..." bind:value={searchQuery} class="pl-8" />
						</div>
					</div>

					<!-- File List -->
					<ScrollArea class="flex-1">
						{#if loading}
							<div class="flex items-center justify-center py-8">
								<div class="h-6 w-6 animate-spin rounded-full border-b-2 border-primary"></div>
								<span class="ml-2">Loading...</span>
							</div>
						{:else if filteredFiles().length > 0}
							<div class="space-y-1">
								{#each filteredFiles() as file}
									{@const Icon = getFileIcon(file)}
									<div
										class={`flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-muted ${
											selectedFile?.path === file.path ? 'bg-muted' : ''
										}`}
										onclick={() => selectFile(file)}
										ondblclick={() => {
											if (file.type === 'directory') {
												navigateToPath(file.path);
											}
										}}
									>
										<Icon class="h-4 w-4 text-muted-foreground" />
										<div class="min-w-0 flex-1">
											<p class="truncate text-sm font-medium">{file.name}</p>
											<div class="flex gap-2 text-xs text-muted-foreground">
												<span>{file.type}</span>
												{#if file.size}
													<span>{formatFileSize(file.size)}</span>
												{/if}
											</div>
										</div>
										<Button
											size="sm"
											variant="ghost"
											onclick={(e) => {
												e.stopPropagation();
												deleteItem(file.path);
											}}
											class="opacity-0 group-hover:opacity-100"
										>
											<Trash2 class="h-3 w-3" />
										</Button>
									</div>
								{/each}
							</div>
						{:else}
							<div class="flex items-center justify-center py-8">
								<p class="text-muted-foreground">No files found</p>
							</div>
						{/if}
					</ScrollArea>
				</div>

				<!-- File Content Area -->
				<div class="col-span-8 flex flex-col space-y-4">
					{#if selectedFile}
						<div class="flex items-center justify-between">
							<div>
								<h3 class="font-semibold">{selectedFile.name}</h3>
								<p class="text-sm text-muted-foreground">{selectedFile.path}</p>
							</div>

							{#if selectedFile.type === 'file' && fileContent}
								<div class="flex gap-2">
									{#if editMode}
										<Button size="sm" onclick={saveFileContent} disabled={saving}>
											<Save class="mr-1 h-3 w-3" />
											{saving ? 'Saving...' : 'Save'}
										</Button>
										<Button
											size="sm"
											variant="outline"
											onclick={() => {
												editedContent = fileContent.content;
												editMode = false;
											}}
										>
											Cancel
										</Button>
									{:else}
										<Button size="sm" onclick={() => (editMode = true)}>
											<Edit class="mr-1 h-3 w-3" />
											Edit
										</Button>
										<Button size="sm" variant="outline">
											<Download class="mr-1 h-3 w-3" />
											Download
										</Button>
									{/if}
								</div>
							{/if}
						</div>

						<Separator />

						{#if selectedFile.type === 'file'}
							{#if fileContent}
								{#if editMode}
									<Textarea
										bind:value={editedContent}
										class="min-h-96 flex-1 font-mono text-sm"
										placeholder="File content..."
									/>
								{:else}
									<ScrollArea class="flex-1 rounded border">
										<pre
											class="p-4 font-mono text-sm whitespace-pre-wrap">{fileContent.content}</pre>
									</ScrollArea>
								{/if}

								<div class="text-xs text-muted-foreground">
									Size: {formatFileSize(fileContent.size)} | Encoding: {fileContent.encoding}
									{#if fileContent.modified}
										| Modified: {new Date(fileContent.modified).toLocaleString()}
									{/if}
								</div>
							{:else if loading}
								<div class="flex items-center justify-center py-8">
									<div class="h-6 w-6 animate-spin rounded-full border-b-2 border-primary"></div>
									<span class="ml-2">Loading file content...</span>
								</div>
							{/if}
						{:else}
							<div class="flex items-center justify-center py-8">
								<p class="text-muted-foreground">Select a file to view its content</p>
							</div>
						{/if}
					{:else}
						<div class="flex items-center justify-center py-8">
							<p class="text-muted-foreground">Select a file or directory to get started</p>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Error Display -->
		{#if error}
			<div class="rounded-md border border-red-200 bg-red-50 p-3">
				<div class="flex items-start justify-between">
					<p class="text-sm text-red-800">{error}</p>
					<Button size="sm" variant="ghost" onclick={() => (error = null)}>
						<X class="h-3 w-3" />
					</Button>
				</div>
			</div>
		{/if}
	</DialogContent>
</Dialog>

<!-- Create New Item Dialog -->
{#if showCreateDialog}
	<Dialog bind:open={showCreateDialog}>
		<DialogContent>
			<DialogHeader>
				<DialogTitle>Create New Item</DialogTitle>
				<DialogDescription>Create a new file or directory in the current path</DialogDescription>
			</DialogHeader>

			<div class="space-y-4">
				<div class="grid gap-2">
					<Label>Type</Label>
					<div class="flex gap-4">
						<label class="flex items-center gap-2">
							<input type="radio" bind:group={newItemType} value="file" />
							File
						</label>
						<label class="flex items-center gap-2">
							<input type="radio" bind:group={newItemType} value="directory" />
							Directory
						</label>
					</div>
				</div>

				<div class="grid gap-2">
					<Label for="item-name">Name</Label>
					<Input
						id="item-name"
						bind:value={newItemName}
						placeholder={newItemType === 'file' ? 'filename.txt' : 'folder-name'}
					/>
				</div>

				<div class="flex justify-end gap-2">
					<Button
						variant="outline"
						onclick={() => {
							showCreateDialog = false;
							newItemName = '';
						}}
					>
						Cancel
					</Button>
					<Button onclick={createItem}>
						Create {newItemType}
					</Button>
				</div>
			</div>
		</DialogContent>
	</Dialog>
{/if}
