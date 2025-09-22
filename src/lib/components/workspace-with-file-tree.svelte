<script lang="ts">
	import FileTree from '$lib/components/file-tree.svelte';

	import type { Project } from '$lib/types';
	import type { FileSystemItem } from '$lib/types/files';
	import { onDestroy, onMount } from 'svelte';

	// Props for the workspace component
	let {
		project,
		userId
	}: {
		project: Project;
		userId: string;
	} = $props();

	// State
	let sandbox = $state<any>(null);
	let isInitializing = $state(true);
	let selectedFile = $state<FileSystemItem | null>(null);
	let fileContent = $state<string>('');
	let isLoadingContent = $state(false);

	/**
	 * Initialize E2B sandbox for the project
	 */
	async function initializeSandbox(): Promise<void> {
		try {
			isInitializing = true;

			// Create or get existing sandbox session
			// TODO: Implement Daytona session creation
			const sessionData = null; // Placeholder for future implementation
			});

			sandbox = sessionData.sandbox;

			console.log('E2B sandbox initialized for project:', project.id);
		} catch (error) {
			console.error('Failed to initialize E2B sandbox:', error);
		} finally {
			isInitializing = false;
		}
	}

	/**
	 * Handle file selection from the file tree
	 */
	async function handleFileSelect(file: FileSystemItem): Promise<void> {
		if (file.type === 'file') {
			selectedFile = file;
			await loadFileContent(file);
		}
	}

	/**
	 * Load file content for editing/viewing
	 */
	async function loadFileContent(file: FileSystemItem): Promise<void> {
		if (!sandbox) return;

		try {
			isLoadingContent = true;

			// Read file from sandbox
			const result = await sandbox.filesystem.read(file.path);
			fileContent = result;
		} catch (error) {
			console.error('Failed to load file content:', error);
			fileContent = `Error loading file: ${error}`;
		} finally {
			isLoadingContent = false;
		}
	}

	/**
	 * Save file content back to sandbox
	 */
	async function saveFileContent(): Promise<void> {
		if (!sandbox || !selectedFile) return;

		try {
			// Write file to E2B sandbox
			await sandbox.filesystem.write(selectedFile.path, fileContent);
			console.log('File saved:', selectedFile.path);
		} catch (error) {
			console.error('Failed to save file:', error);
		}
	}

	/**
	 * Handle file actions from the file tree
	 */
	function handleFileAction(action: string, file: FileSystemItem): void {
		console.log('File action:', action, file);

		switch (action) {
			case 'sync-to-r2':
				// File was synced to R2 - you could show a notification
				console.log('File backed up to R2:', file.path);
				break;
			case 'sync-from-r2':
				// File was synced from R2 - you might want to reload if it's currently open
				if (selectedFile?.path === file.path) {
					loadFileContent(file);
				}
				break;
		}
	}

	// Lifecycle
	onMount(async () => {
		await initializeSandbox();
	});

	onDestroy(() => {
		// Cleanup is handled by the FileTree component and E2B service
		console.log('Workspace component destroyed');
	});
</script>

<div class="flex h-full bg-background">
	<!-- File Tree Sidebar -->
	<div class="w-80 flex-shrink-0 border-r">
		{#if isInitializing}
			<div class="p-4 text-center">
				<div class="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
				<p class="text-sm text-muted-foreground">Initializing workspace...</p>
			</div>
		{:else}
			<FileTree
				{project}
				{userId}
				{sandbox}
				onFileSelect={handleFileSelect}
				onFileAction={handleFileAction}
			/>
		{/if}
	</div>

	<!-- Main Content Area -->
	<div class="flex flex-1 flex-col">
		{#if selectedFile}
			<!-- File Editor Header -->
			<div class="flex items-center justify-between border-b p-3">
				<div>
					<h3 class="font-medium">{selectedFile.name}</h3>
					<p class="text-sm text-muted-foreground">{selectedFile.path}</p>
				</div>
				<button
					class="rounded bg-primary px-3 py-1 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
					onclick={saveFileContent}
					disabled={isLoadingContent}
				>
					Save
				</button>
			</div>

			<!-- File Content Editor -->
			<div class="flex-1 p-4">
				{#if isLoadingContent}
					<div class="flex h-full items-center justify-center">
						<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
					</div>
				{:else}
					<textarea
						bind:value={fileContent}
						class="h-full w-full resize-none rounded-lg border p-4 font-mono text-sm focus:ring-2 focus:ring-primary focus:outline-none"
						placeholder="File content will appear here..."
					></textarea>
				{/if}
			</div>
		{:else}
			<!-- Welcome/Empty State -->
			<div class="flex flex-1 items-center justify-center p-8 text-center">
				<div>
					<h2 class="mb-2 text-xl font-semibold">Welcome to Your Workspace</h2>
					<p class="mb-4 text-muted-foreground">
						Select a file from the tree to start editing, or create a new file.
					</p>
					<div class="space-y-2 text-sm text-muted-foreground">
						<p>✨ Files are automatically synced between E2B and CloudFlare R2</p>
						<p>🔄 Real-time file watching keeps everything in sync</p>
						<p>☁️ Optimized for CloudFlare's free tier</p>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	/* Custom scrollbar for the editor */
	textarea::-webkit-scrollbar {
		width: 8px;
		height: 8px;
	}

	textarea::-webkit-scrollbar-track {
		background: hsl(var(--muted));
		border-radius: 4px;
	}

	textarea::-webkit-scrollbar-thumb {
		background: hsl(var(--muted-foreground) / 0.3);
		border-radius: 4px;
	}

	textarea::-webkit-scrollbar-thumb:hover {
		background: hsl(var(--muted-foreground) / 0.5);
	}
</style>
