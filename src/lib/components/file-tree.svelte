<script lang="ts">
	import { TreeView, TreeViewItem } from '$lib/components/ui/tree-view';
	import {
		AutomaticR2FileSyncManager,
		type FileTreeEvent
	} from '$lib/services/automatic-r2-file-sync.service';
	import type { Project } from '$lib/types';
	import type { FileSystemItem } from '$lib/types/files';
	import { onDestroy, onMount } from 'svelte';
	// Icons
	import {
		CheckCircle,
		ChevronDown,
		ChevronRight,
		Clock,
		CloudDownload,
		CloudUpload,
		File,
		Folder,
		FolderOpen,
		Loader2,
		RefreshCw,
		XCircle
	} from 'lucide-svelte';

	// Props using Svelte 5 syntax
	let {
		project,
		userId,
		sandbox = null,
		onFileSelect = () => {},
		onFileAction = () => {}
	}: {
		project: Project;
		userId: string;
		sandbox?: any;
		onFileSelect?: (file: FileSystemItem) => void;
		onFileAction?: (action: string, file: FileSystemItem) => void;
	} = $props();

	// State using $state()
	let files = $state<FileSystemItem[]>([]);
	let isLoading = $state(false);
	let syncStatus = $state<'idle' | 'syncing' | 'error'>('idle');
	let lastSyncTime = $state<Date | null>(null);
	let fileEvents = $state<FileTreeEvent[]>([]);
	let expandedFolders = $state<Set<string>>(new Set());
	let selectedFile = $state<string | null>(null);

	// Real-time event state
	let unsubscribeCallback: (() => void) | null = null;
	let autoSyncEnabled = $state(true);
	let watchersActive = $state({ daytona: false, r2: false });

	// Derived state for file tree display
	let displayFiles = $derived(
		files.map((file) => ({
			...file,
			hasRecentActivity: fileEvents.some(
				(event) => event.filePath === file.path && Date.now() - event.timestamp.getTime() < 30000 // 30 seconds
			),
			syncStatus: getSyncStatusForFile(file.path),
			isModified: file.modifiedAt ? Date.now() - file.modifiedAt.getTime() < 60000 : false, // 1 minute
			isExpanded: expandedFolders.has(file.path),
			isSelected: selectedFile === file.path
		}))
	);

	// Tree structure derived from flat file list
	let fileTree = $derived(buildFileTree(displayFiles));

	/**
	 * Build hierarchical tree structure from flat file list
	 */
	function buildFileTree(flatFiles: typeof displayFiles): TreeNode[] {
		const tree: TreeNode[] = [];
		const nodeMap = new Map<string, TreeNode>();

		// Sort files to ensure directories come before their contents
		const sortedFiles = [...flatFiles].sort((a, b) => {
			const aDepth = a.path.split('/').length;
			const bDepth = b.path.split('/').length;
			if (aDepth !== bDepth) return aDepth - bDepth;
			return a.path.localeCompare(b.path);
		});

		for (const file of sortedFiles) {
			const pathParts = file.path.split('/').filter(Boolean);
			let currentPath = '';

			for (let i = 0; i < pathParts.length; i++) {
				const part = pathParts[i];
				const parentPath = currentPath;
				currentPath = currentPath ? `${currentPath}/${part}` : part;

				if (!nodeMap.has(currentPath)) {
					const node: TreeNode = {
						name: part,
						path: currentPath,
						type:
							i === pathParts.length - 1
								? file.type === 'directory'
									? 'folder'
									: file.type
								: 'folder',
						children: [],
						file: i === pathParts.length - 1 ? file : undefined,
						isExpanded: expandedFolders.has(currentPath),
						level: i
					};

					nodeMap.set(currentPath, node);

					if (parentPath && nodeMap.has(parentPath)) {
						nodeMap.get(parentPath)!.children.push(node);
					} else {
						tree.push(node);
					}
				}
			}
		}

		return tree;
	}

	interface TreeNode {
		name: string;
		path: string;
		type: 'file' | 'folder';
		children: TreeNode[];
		file?: (typeof displayFiles)[0];
		isExpanded: boolean;
		level: number;
	}

	/**
	 * Get sync status for a specific file
	 */
	function getSyncStatusForFile(filePath: string): 'synced' | 'syncing' | 'error' | null {
		const recentEvent = fileEvents
			.filter((event) => event.filePath === filePath)
			.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

		return recentEvent?.syncStatus || null;
	}

	/**
	 * Handle real-time file events from the integrated sync manager
	 */
	function handleFileEvent(event: FileTreeEvent): void {
		console.log('File tree received event:', event);

		// Add to event history (keep last 50 events)
		fileEvents = [event, ...fileEvents].slice(0, 50);

		// Update sync status
		if (event.type === 'sync-status') {
			syncStatus = event.syncStatus === 'error' ? 'error' : 'idle';
		}

		// Refresh file list for file operations
		if (['file-created', 'file-updated', 'file-deleted'].includes(event.type)) {
			debounceRefresh();
		}
	}

	/**
	 * Debounced refresh to avoid too many API calls
	 */
	let refreshTimeout: NodeJS.Timeout;
	function debounceRefresh(): void {
		clearTimeout(refreshTimeout);
		refreshTimeout = setTimeout(refreshFiles, 1000);
	}

	/**
	 * Initialize integrated file sync
	 */
	async function initializeFileSync(): Promise<void> {
		if (!project || !userId) return;

		try {
			// Start automatic R2 file sync
			await AutomaticR2FileSyncManager.startProjectSync(userId, project, {
				enableAutoBackup: autoSyncEnabled,
				enableRealTimeSync: true,
				debounceMs: 2000
			});

			// Add file tree callback
			unsubscribeCallback = AutomaticR2FileSyncManager.addFileTreeCallback(
				userId,
				project.id,
				handleFileEvent
			);

			// Check watcher status
			const statusMap = AutomaticR2FileSyncManager.getSyncStatus();
			const syncKey = `${userId}:${project.id}`;
			const projectStatus = statusMap.get(syncKey);
			if (projectStatus) {
				watchersActive = {
					daytona: projectStatus.daytonaWatcherActive || false,
					r2: projectStatus.r2WatcherActive
				};
			}

			console.log('File sync initialized for project:', project.id);
		} catch (error) {
			console.error('Failed to initialize file sync:', error);
			syncStatus = 'error';
		}
	}

	/**
	 * Load files from R2
	 */
	async function refreshFiles(): Promise<void> {
		if (!project || !userId) return;

		isLoading = true;
		try {
			const response = await fetch(`/api/r2/files/list`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					userId,
					projectId: project.id
				})
			});

			if (response.ok) {
				const data = await response.json();
				files = data.files || [];
				lastSyncTime = new Date();
			} else {
				throw new Error(`Failed to load files: ${response.statusText}`);
			}
		} catch (error) {
			console.error('Error refreshing files:', error);
			syncStatus = 'error';
		} finally {
			isLoading = false;
		}
	}

	/**
	 * Toggle folder expansion
	 */
	function toggleFolder(folderPath: string): void {
		if (expandedFolders.has(folderPath)) {
			expandedFolders.delete(folderPath);
		} else {
			expandedFolders.add(folderPath);
		}
		expandedFolders = new Set(expandedFolders); // Trigger reactivity
	}

	/**
	 * Select file
	 */
	function selectFile(file: FileSystemItem): void {
		selectedFile = file.path;
		onFileSelect(file);
	}

	/**
	 * Manual sync operations
	 */
	async function syncFileToR2(filePath: string): Promise<void> {
		try {
			syncStatus = 'syncing';
			// Use createOrUpdateFile for syncing to R2
			const content = ''; // You might need to get the actual content
			await AutomaticR2FileSyncManager.createOrUpdateFile(userId, project.id, filePath, content);
			await refreshFiles();
			onFileAction('sync-to-r2', { path: filePath } as FileSystemItem);
		} catch (error) {
			console.error('Error syncing file to R2:', error);
			syncStatus = 'error';
		}
	}

	async function syncFileFromR2(filePath: string): Promise<void> {
		try {
			syncStatus = 'syncing';
			// Use readFile for reading from R2
			await AutomaticR2FileSyncManager.readFile(userId, project.id, filePath);
			onFileAction('sync-from-r2', { path: filePath } as FileSystemItem);
		} catch (error) {
			console.error('Error syncing file from R2:', error);
			syncStatus = 'error';
		}
	}

	/**
	 * Get file icon based on type and state
	 */
	function getFileIcon(node: TreeNode): any {
		if (node.type === 'folder') {
			return node.isExpanded ? FolderOpen : Folder;
		}

		// You can extend this with more specific file type icons
		return File;
	}

	/**
	 * Format file size
	 */
	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
	}

	/**
	 * Format timestamp
	 */
	function formatTime(date: Date): string {
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	// Lifecycle
	onMount(async () => {
		await refreshFiles();
		await initializeFileSync();
	});

	onDestroy(() => {
		if (unsubscribeCallback) {
			unsubscribeCallback();
		}
		if (project && userId) {
			AutomaticR2FileSyncManager.stopProjectSync(userId, project.id);
		}
		clearTimeout(refreshTimeout);
	});

	/**
	 * Render tree node recursively
	 */
	function renderTreeNode(node: TreeNode) {
		const IconComponent = getFileIcon(node);
		const hasChildren = node.children.length > 0;

		return {
			node,
			IconComponent,
			hasChildren,
			handleClick: () => {
				if (node.type === 'folder') {
					toggleFolder(node.path);
				} else if (node.file) {
					selectFile(node.file);
				}
			}
		};
	}
</script>

<div class="file-tree flex h-full flex-col bg-background">
	<!-- Header -->
	<div class="space-y-2 border-b p-3">
		<div class="flex items-center justify-between">
			<h3 class="text-sm font-semibold">Files</h3>
			<button
				class="rounded-md p-1 transition-colors hover:bg-muted"
				onclick={refreshFiles}
				disabled={isLoading}
			>
				{#if isLoading}
					<Loader2 class="h-4 w-4 animate-spin" />
				{:else}
					<RefreshCw class="h-4 w-4" />
				{/if}
			</button>
		</div>

		<!-- Sync Status -->
		<div class="flex items-center gap-2 text-xs">
			<div
				class={`rounded-full px-2 py-1 text-xs font-medium ${
					syncStatus === 'error'
						? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
						: syncStatus === 'syncing'
							? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
							: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
				}`}
			>
				{#if syncStatus === 'syncing'}
					<Loader2 class="mr-1 inline h-3 w-3 animate-spin" />
					Syncing
				{:else if syncStatus === 'error'}
					<XCircle class="mr-1 inline h-3 w-3" />
					Error
				{:else}
					<CheckCircle class="mr-1 inline h-3 w-3" />
					Synced
				{/if}
			</div>

			{#if lastSyncTime}
				<span class="text-muted-foreground">
					{formatTime(lastSyncTime)}
				</span>
			{/if}
		</div>

		<!-- Watcher Status -->
		<div class="flex gap-2 text-xs">
			<div
				class={`rounded px-2 py-1 text-xs ${
					watchersActive.daytona
						? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
						: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
				}`}
			>
				Daytona: {watchersActive.daytona ? 'Active' : 'Inactive'}
			</div>
			<div
				class={`rounded px-2 py-1 text-xs ${
					watchersActive.r2
						? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
						: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
				}`}
			>
				R2: {watchersActive.r2 ? 'Active' : 'Inactive'}
			</div>
		</div>
	</div>

	<!-- File Tree -->
	<div class="flex-1 overflow-auto p-2">
		{#if fileTree.length === 0}
			<div class="p-4 text-center text-sm text-muted-foreground">
				{#if isLoading}
					<Loader2 class="mx-auto mb-2 h-8 w-8 animate-spin" />
					Loading files...
				{:else}
					No files found
				{/if}
			</div>
		{:else}
			<TreeView>
				{#each fileTree as node (node.path)}
					{@const nodeData = renderTreeNode(node)}
					{@const IconComponent = nodeData.IconComponent}
					<TreeViewItem
						onclick={nodeData.handleClick}
						class={node.file?.isSelected ? 'selected' : ''}
					>
						<div
							class="group flex items-center gap-2 rounded px-2 py-1"
							style="padding-left: {node.level * 1.5 + 0.5}rem"
						>
							<!-- Expand/collapse chevron for folders -->
							{#if nodeData.hasChildren}
								<button
									class="rounded p-0 transition-colors hover:bg-muted"
									onclick={(e) => {
										e.stopPropagation();
										toggleFolder(node.path);
									}}
								>
									{#if node.isExpanded}
										<ChevronDown class="h-4 w-4" />
									{:else}
										<ChevronRight class="h-4 w-4" />
									{/if}
								</button>
							{:else}
								<div class="w-4"></div>
							{/if}

							<!-- File/folder icon -->
							<IconComponent class="h-4 w-4 flex-shrink-0 text-muted-foreground" />

							<!-- File name -->
							<span class="flex-1 truncate text-sm">{node.name}</span>

							<!-- File status indicators -->
							<div class="flex items-center gap-1">
								{#if node.file?.hasRecentActivity}
									<div class="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
								{/if}

								{#if node.file?.syncStatus === 'syncing'}
									<Loader2 class="h-3 w-3 animate-spin text-blue-500" />
								{:else if node.file?.syncStatus === 'error'}
									<XCircle class="h-3 w-3 text-red-500" />
								{:else if node.file?.syncStatus === 'synced'}
									<CheckCircle class="h-3 w-3 text-green-500" />
								{/if}

								{#if node.file?.isModified}
									<Clock class="h-3 w-3 text-yellow-500" />
								{/if}
							</div>

							<!-- Action buttons (visible on hover) -->
							{#if node.type === 'file'}
								<div class="hidden items-center gap-1 group-hover:flex">
									<button
										class="rounded p-1 transition-colors hover:bg-muted"
										onclick={(e) => {
											e.stopPropagation();
											syncFileToR2(node.path);
										}}
										title="Sync to R2"
									>
										<CloudUpload class="h-3 w-3" />
									</button>
									<button
										class="rounded p-1 transition-colors hover:bg-muted"
										onclick={(e) => {
											e.stopPropagation();
											syncFileFromR2(node.path);
										}}
										title="Sync from R2"
									>
										<CloudDownload class="h-3 w-3" />
									</button>
								</div>
							{/if}
						</div>

						<!-- File metadata -->
						{#if node.file?.size}
							<div
								class="ml-8 text-xs text-muted-foreground"
								style="padding-left: {node.level * 1.5}rem"
							>
								{formatFileSize(node.file.size)}
								{#if node.file.modifiedAt}
									• {node.file.modifiedAt.toLocaleDateString()}
								{/if}
							</div>
						{/if}

						<!-- Render children if expanded -->
						{#if node.isExpanded && node.children.length > 0}
							{#each node.children as childNode (childNode.path)}
								{@const childNodeData = renderTreeNode(childNode)}
								{@const IconComponent = childNodeData.IconComponent}
								<TreeViewItem
									onclick={childNodeData.handleClick}
									class={childNode.file?.isSelected ? 'selected' : ''}
								>
									<div
										class="group flex items-center gap-2 rounded px-2 py-1"
										style="padding-left: {childNode.level * 1.5 + 0.5}rem"
									>
										<!-- Expand/collapse chevron for folders -->
										{#if childNodeData.hasChildren}
											<button
												class="rounded p-0 transition-colors hover:bg-muted"
												onclick={(e) => {
													e.stopPropagation();
													toggleFolder(childNode.path);
												}}
											>
												{#if childNode.isExpanded}
													<ChevronDown class="h-4 w-4" />
												{:else}
													<ChevronRight class="h-4 w-4" />
												{/if}
											</button>
										{:else}
											<div class="w-4"></div>
										{/if}

										<!-- File/folder icon -->
										<IconComponent class="h-4 w-4 flex-shrink-0 text-muted-foreground" />

										<!-- File name -->
										<span class="flex-1 truncate text-sm">{childNode.name}</span>

										<!-- Status and actions (similar to parent) -->
										<div class="flex items-center gap-1">
											{#if childNode.file?.hasRecentActivity}
												<div class="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
											{/if}

											{#if childNode.file?.syncStatus === 'syncing'}
												<Loader2 class="h-3 w-3 animate-spin text-blue-500" />
											{:else if childNode.file?.syncStatus === 'error'}
												<XCircle class="h-3 w-3 text-red-500" />
											{:else if childNode.file?.syncStatus === 'synced'}
												<CheckCircle class="h-3 w-3 text-green-500" />
											{/if}
										</div>

										{#if childNode.type === 'file'}
											<div class="hidden items-center gap-1 group-hover:flex">
												<button
													class="rounded p-1 transition-colors hover:bg-muted"
													onclick={(e) => {
														e.stopPropagation();
														syncFileToR2(childNode.path);
													}}
													title="Sync to R2"
												>
													<CloudUpload class="h-3 w-3" />
												</button>
												<button
													class="rounded p-1 transition-colors hover:bg-muted"
													onclick={(e) => {
														e.stopPropagation();
														syncFileFromR2(childNode.path);
													}}
													title="Sync from R2"
												>
													<CloudDownload class="h-3 w-3" />
												</button>
											</div>
										{/if}
									</div>

									{#if childNode.file?.size}
										<div
											class="ml-8 text-xs text-muted-foreground"
											style="padding-left: {childNode.level * 1.5}rem"
										>
											{formatFileSize(childNode.file.size)}
											{#if childNode.file.modifiedAt}
												• {childNode.file.modifiedAt.toLocaleDateString()}
											{/if}
										</div>
									{/if}
								</TreeViewItem>
							{/each}
						{/if}
					</TreeViewItem>
				{/each}
			</TreeView>
		{/if}
	</div>

	<!-- Recent Activity Footer -->
	{#if fileEvents.length > 0}
		<div class="border-t p-2">
			<h4 class="mb-2 text-xs font-medium text-muted-foreground">Recent Activity</h4>
			<div class="max-h-24 space-y-1 overflow-auto">
				{#each fileEvents.slice(0, 3) as event (event.timestamp.getTime())}
					<div class="flex items-center gap-2 rounded bg-muted/30 p-1 text-xs">
						<div
							class={`rounded px-1 py-0.5 text-xs font-medium ${
								event.source === 'daytona'
									? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
									: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
							}`}
						>
							{event.source.toUpperCase()}
						</div>
						<span class="flex-1 truncate">
							{event.type.replace('-', ' ')} • {event.filePath.split('/').pop()}
						</span>
						<span class="text-muted-foreground">
							{formatTime(event.timestamp)}
						</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
