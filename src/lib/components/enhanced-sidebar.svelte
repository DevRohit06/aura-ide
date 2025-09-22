<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { TreeView, TreeViewItem } from '$lib/components/ui/tree-view';
	import {
		AutomaticR2FileSyncManager,
		type FileTreeEvent
	} from '$lib/services/automatic-r2-file-sync.service';
	import type { Project } from '$lib/types';
	import type { FileSystemItem } from '$lib/types/files';
	import { onDestroy, onMount } from 'svelte';
	import { writable } from 'svelte/store';
	// Icons
	import {
		CheckCircle,
		Clock,
		CloudDownload,
		CloudUpload,
		Eye,
		EyeOff,
		File,
		Folder,
		Loader2,
		RefreshCw,
		XCircle
	} from 'lucide-svelte';

	// Props
	export let project: Project;
	export let userId: string;
	export let isVisible = true;

	// State
	const files = writable<FileSystemItem[]>([]);
	const isLoading = writable(false);
	const syncStatus = writable<'idle' | 'syncing' | 'error'>('idle');
	const lastSyncTime = writable<Date | null>(null);
	const fileEvents = writable<FileTreeEvent[]>([]);

	// Real-time event state
	let unsubscribeCallback: (() => void) | null = null;
	let autoSyncEnabled = true;
	let watchersActive = { e2b: false, r2: false };

	// Reactive state for file tree display
	$: displayFiles = $files.map((file) => ({
		...file,
		hasRecentActivity: $fileEvents.some(
			(event) => event.filePath === file.path && Date.now() - event.timestamp.getTime() < 30000 // 30 seconds
		),
		syncStatus: getSyncStatusForFile(file.path),
		isModified: file.modifiedAt ? Date.now() - file.modifiedAt.getTime() < 60000 : false // 1 minute
	}));

	/**
	 * Get sync status for a specific file
	 */
	function getSyncStatusForFile(filePath: string): 'synced' | 'syncing' | 'error' | null {
		const recentEvent = $fileEvents
			.filter((event) => event.filePath === filePath)
			.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

		return recentEvent?.syncStatus || null;
	}

	/**
	 * Handle real-time file events from the sync manager
	 */
	function handleFileEvent(event: FileTreeEvent): void {
		console.log('Sidebar received file event:', event);

		// Add to event history (keep last 50 events)
		fileEvents.update((events) => {
			const newEvents = [event, ...events].slice(0, 50);
			return newEvents;
		});

		// Update sync status
		if (event.type === 'sync-status') {
			syncStatus.set(event.syncStatus === 'error' ? 'error' : 'idle');
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
	 * Initialize file sync
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

			// Check sync status
			const statusMap = AutomaticR2FileSyncManager.getSyncStatus();
			const syncKey = `${userId}:${project.id}`;
			const projectStatus = statusMap.get(syncKey);
			if (projectStatus) {
				watchersActive = {
					e2b: false, // E2B functionality not available in AutomaticR2FileSyncManager
					r2: projectStatus.r2WatcherActive
				};
			}

			console.log('File sync initialized for project:', project.id);
		} catch (error) {
			console.error('Failed to initialize file sync:', error);
			syncStatus.set('error');
		}
	}

	/**
	 * Load files from R2
	 */
	async function refreshFiles(): Promise<void> {
		if (!project || !userId) return;

		isLoading.set(true);
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
				files.set(data.files || []);
				lastSyncTime.set(new Date());
			} else {
				throw new Error(`Failed to load files: ${response.statusText}`);
			}
		} catch (error) {
			console.error('Error refreshing files:', error);
			syncStatus.set('error');
		} finally {
			isLoading.set(false);
		}
	}

	/**
	 * Manual sync operations
	 */
	async function syncFileToR2(filePath: string): Promise<void> {
		try {
			syncStatus.set('syncing');
			// Use the available createOrUpdateFile method to sync to R2
			const fileContent = await fetch(`/api/r2/files/read`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId, projectId: project.id, filePath })
			});

			if (fileContent.ok) {
				const data = await fileContent.json();
				await AutomaticR2FileSyncManager.createOrUpdateFile(
					userId,
					project.id,
					filePath,
					data.content
				);
			}
			await refreshFiles();
		} catch (error) {
			console.error('Error syncing file to R2:', error);
			syncStatus.set('error');
		}
	}

	async function syncFileFromR2(filePath: string): Promise<void> {
		try {
			syncStatus.set('syncing');
			// Use the available readFile method to get from R2
			await AutomaticR2FileSyncManager.readFile(userId, project.id, filePath);
		} catch (error) {
			console.error('Error syncing file from R2:', error);
			syncStatus.set('error');
		}
	}

	/**
	 * Toggle auto-sync
	 */
	async function toggleAutoSync(): Promise<void> {
		autoSyncEnabled = !autoSyncEnabled;

		// Restart sync with new settings
		await AutomaticR2FileSyncManager.stopProjectSync(userId, project.id);
		await initializeFileSync();
	}

	/**
	 * Get file icon based on extension
	 */
	function getFileIcon(file: FileSystemItem): any {
		if (file.type === 'directory') return Folder;

		const ext = file.name.split('.').pop()?.toLowerCase();
		// You can extend this with more specific icons
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
		if (isVisible) {
			await refreshFiles();
			await initializeFileSync();
		}
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

	// Reactive updates
	$: if (isVisible && project && userId) {
		refreshFiles();
		initializeFileSync();
	}
</script>

<div class="flex h-full flex-col border-r bg-background">
	<!-- Header -->
	<div class="space-y-3 border-b p-4">
		<div class="flex items-center justify-between">
			<h3 class="text-sm font-semibold">Project Files</h3>
			<Button variant="ghost" size="sm" onclick={refreshFiles} disabled={$isLoading}>
				{#if $isLoading}
					<Loader2 class="h-4 w-4 animate-spin" />
				{:else}
					<RefreshCw class="h-4 w-4" />
				{/if}
			</Button>
		</div>

		<!-- Sync Status -->
		<div class="flex items-center gap-2 text-xs">
			<Badge variant={$syncStatus === 'error' ? 'destructive' : 'default'}>
				{#if $syncStatus === 'syncing'}
					<Loader2 class="mr-1 h-3 w-3 animate-spin" />
					Syncing
				{:else if $syncStatus === 'error'}
					<XCircle class="mr-1 h-3 w-3" />
					Error
				{:else}
					<CheckCircle class="mr-1 h-3 w-3" />
					Synced
				{/if}
			</Badge>

			{#if $lastSyncTime}
				<span class="text-muted-foreground">
					{formatTime($lastSyncTime)}
				</span>
			{/if}
		</div>

		<!-- Watcher Status -->
		<div class="flex gap-2 text-xs">
			<Badge variant={watchersActive.e2b ? 'default' : 'secondary'}>
				E2B: {watchersActive.e2b ? 'Active' : 'Inactive'}
			</Badge>
			<Badge variant={watchersActive.r2 ? 'default' : 'secondary'}>
				R2: {watchersActive.r2 ? 'Active' : 'Inactive'}
			</Badge>
		</div>

		<!-- Auto-sync toggle -->
		<div class="flex items-center justify-between">
			<span class="text-xs text-muted-foreground">Auto-sync</span>
			<Button variant="ghost" size="sm" onclick={toggleAutoSync}>
				{#if autoSyncEnabled}
					<Eye class="h-4 w-4" />
				{:else}
					<EyeOff class="h-4 w-4" />
				{/if}
			</Button>
		</div>
	</div>

	<!-- File Tree -->
	<div class="flex-1 overflow-auto p-2">
		{#if displayFiles.length === 0}
			<div class="p-4 text-center text-sm text-muted-foreground">
				{#if $isLoading}
					<Loader2 class="mx-auto mb-2 h-8 w-8 animate-spin" />
					Loading files...
				{:else}
					No files found
				{/if}
			</div>
		{:else}
			<TreeView>
				{#each displayFiles as file (file.path)}
					{@const Icon = getFileIcon(file)}
					<TreeViewItem class="group">
						<div class="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/50">
							<Icon class="h-4 w-4 text-muted-foreground" />

							<span class="flex-1 truncate text-sm">{file.name}</span>

							<!-- File status indicators -->
							<div class="flex items-center gap-1">
								{#if file.hasRecentActivity}
									<div
										class="h-2 w-2 animate-pulse rounded-full bg-green-500"
										title="Recent activity"
									></div>
								{/if}

								{#if file.syncStatus === 'syncing'}
									<Loader2 class="h-3 w-3 animate-spin text-blue-500" />
								{:else if file.syncStatus === 'error'}
									<XCircle class="h-3 w-3 text-red-500" />
								{:else if file.syncStatus === 'synced'}
									<CheckCircle class="h-3 w-3 text-green-500" />
								{/if}

								{#if file.isModified}
									<div class="h-3 w-3 text-yellow-500" title="Recently modified">
										<Clock class="h-3 w-3" />
									</div>
								{/if}
							</div>

							<!-- Action buttons (visible on hover) -->
							<div class="hidden items-center gap-1 group-hover:flex">
								{#if file.type === 'file'}
									<Button
										variant="ghost"
										size="sm"
										class="h-6 w-6 p-0"
										onclick={() => syncFileToR2(file.path)}
										title="Sync to R2"
									>
										<CloudUpload class="h-3 w-3" />
									</Button>
									<Button
										variant="ghost"
										size="sm"
										class="h-6 w-6 p-0"
										onclick={() => syncFileFromR2(file.path)}
										title="Sync from R2"
									>
										<CloudDownload class="h-3 w-3" />
									</Button>
								{/if}
							</div>
						</div>

						<!-- File metadata -->
						{#if file.size}
							<div class="ml-6 text-xs text-muted-foreground">
								{formatFileSize(file.size)}
								{#if file.modifiedAt}
									• {file.modifiedAt.toLocaleDateString()}
								{/if}
							</div>
						{/if}
					</TreeViewItem>
				{/each}
			</TreeView>
		{/if}
	</div>

	<!-- Recent Activity -->
	{#if $fileEvents.length > 0}
		<div class="border-t p-2">
			<h4 class="mb-2 text-xs font-medium text-muted-foreground">Recent Activity</h4>
			<div class="max-h-32 space-y-1 overflow-auto">
				{#each $fileEvents.slice(0, 5) as event (event.timestamp.getTime())}
					<div class="flex items-center gap-2 rounded bg-muted/30 p-1 text-xs">
						<Badge variant="outline" class="text-xs">
							{event.source.toUpperCase()}
						</Badge>
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
