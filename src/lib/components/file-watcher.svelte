<!-- 
  File Watcher Component
  Automatically connects to file change SSE and updates stores in real-time
-->
<script lang="ts">
	import { browser } from '$app/environment';
	import { fileWatcher, type FileChangeEvent } from '$lib/services/file-watcher.client';
	import { fileStateActions } from '$lib/stores/file-states.store';
	import { fileActions } from '$lib/stores/files.store';
	import { activeFileId, tabActions } from '$lib/stores/tabs.store';
	import { onDestroy, onMount } from 'svelte';
	import { get } from 'svelte/store';

	interface Props {
		projectId?: string;
		sandboxId?: string;
		enabled?: boolean;
	}

	let { projectId, sandboxId, enabled = true }: Props = $props();

	let unsubscribe: (() => void) | null = null;
	let connectionStatus = $state<{
		isConnected: boolean;
		isConnecting: boolean;
		reconnectAttempts: number;
	}>({ isConnected: false, isConnecting: false, reconnectAttempts: 0 });

	// Handle file change events
	function handleFileChange(event: FileChangeEvent) {
		console.log('📡 [FileWatcher] Processing file change:', event);
		console.log('📡 [FileWatcher] Event details:', {
			type: event.type,
			path: event.path,
			hasContent: event.content !== undefined,
			contentLength: event.content?.length,
			timestamp: new Date(event.timestamp).toISOString()
		});

		// Ignore our own changes (optional: you can track userId to filter)
		// if (event.userId === currentUserId) return;

		switch (event.type) {
			case 'created':
				if (event.content !== undefined) {
					console.log('📡 [FileWatcher] Calling handleRemoteFileCreated for:', event.path);
					fileActions.handleRemoteFileCreated(event.path, event.content, event.metadata);
				} else {
					console.warn('📡 [FileWatcher] Created event missing content for:', event.path);
				}
				break;

			case 'modified':
				if (event.content !== undefined) {
					console.log('📡 [FileWatcher] Calling handleRemoteFileModified for:', event.path);
					fileActions.handleRemoteFileModified(event.path, event.content);

					// If the modified file is currently open, update editor
					const currentFileId = get(activeFileId);
					if (currentFileId === event.path) {
						console.log('📡 [FileWatcher] File is currently open, updating editor state');
						// Mark that we should reload the file content in the editor
						fileStateActions.updateFileState(event.path, {
							isLoading: false,
							isDirty: false // Reset dirty flag since content is from server
						});
					}
				} else {
					console.warn('📡 [FileWatcher] Modified event missing content for:', event.path);
				}
				break;

			case 'deleted':
				console.log('📡 [FileWatcher] Calling handleRemoteFileDeleted for:', event.path);
				fileActions.handleRemoteFileDeleted(event.path);

				// Close the tab if the deleted file is open
				const currentFileId = get(activeFileId);
				if (currentFileId === event.path) {
					tabActions.closeFile(event.path);
				}
				break;

			case 'renamed':
				if (event.newPath) {
					fileActions.handleRemoteFileRenamed(event.path, event.newPath);

					// Update tab if the renamed file is open
					const currentFileId = get(activeFileId);
					if (currentFileId === event.path) {
						tabActions.closeFile(event.path);
						tabActions.openFile(event.newPath);
					}
				}
				break;
		}
	}

	// Update connection status periodically
	function updateConnectionStatus() {
		connectionStatus = fileWatcher.getStatus();
	}

	onMount(() => {
		if (!browser || !enabled) return;

		console.log('📡 Starting file watcher...', { projectId, sandboxId });

		// Start watching for file changes
		fileWatcher.watch({ projectId, sandboxId });

		// Subscribe to file change events
		unsubscribe = fileWatcher.subscribe(handleFileChange);

		// Update connection status every 5 seconds
		const statusInterval = setInterval(updateConnectionStatus, 5000);
		updateConnectionStatus();

		return () => {
			clearInterval(statusInterval);
		};
	});

	onDestroy(() => {
		if (unsubscribe) {
			unsubscribe();
			unsubscribe = null;
		}
		// Don't unwatch here - let other components use the same connection
	});
</script>
