<script lang="ts">
	import CodemirrorEditor from '$lib/components/code-editor/codemirror-editor.svelte';
	import FileTabs from '$lib/components/editor/file-tabs.svelte';
	import FileWatcher from '$lib/components/file-watcher.svelte';
	import EnhancedSidebar from '$lib/components/shared/enhanced-sidebar.svelte';
	import * as Resizable from '$lib/components/ui/resizable/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { activeFileId, filesStore } from '$lib/stores/editor.js';
	import { fileActions } from '$lib/stores/files.store.js';
	import { sidebarPanelActions, sidebarPanelsStore } from '$lib/stores/sidebar-panels.store';
	// Icons
	import { TerminalManager } from '$lib/components/shared/terminal';
	// import ChatSidebar from '@/components/chat/chat-sidebar.svelte';

	let { data } = $props();
	const pageData = data as any;

	// Initialize files store with server-loaded data
	$effect(() => {
		if (pageData.files && pageData.files.length > 0) {
			fileActions.loadFiles(pageData.files);
			console.log(`Loaded ${pageData.files.length} files from server`);
		}
	});

	function onLayoutChange(sizes: number[]) {
		document.cookie = `PaneForge:layout=${JSON.stringify(sizes)}`;
	}

	function onVerticalLayoutChange(sizes: number[]) {
		document.cookie = `PaneForge:vertical-layout=${JSON.stringify(sizes)}`;
	}

	// Get current file and breadcrumbs
	let currentFile = $derived($activeFileId ? $filesStore.get($activeFileId) : null);

	// Subscribe to sidebar store for pane visibility
	let sidebarState = $state(sidebarPanelsStore);

	// Keyboard shortcut handlers
	function handleKeydown(event: KeyboardEvent) {
		const { key } = event;
		const cmdKey = event.ctrlKey || event.metaKey;

		// Panel toggle shortcuts
		if (cmdKey && key === 'b') {
			event.preventDefault();
			sidebarPanelActions.toggleLeftSidebar();
		} else if (cmdKey && key === '`') {
			event.preventDefault();
			sidebarPanelActions.toggleTerminal();
		} else if (cmdKey && event.shiftKey && key === 'E') {
			event.preventDefault();
			sidebarPanelActions.toggleRightSidebar();
		}
	}

	// import { indexAllFilesFromStore } from '$lib/services/vector-indexer.client';
	import { onMount } from 'svelte';

	// onMount(() => {
	// 	// Give the file loader a chance to populate the store then kick off indexing
	// 	setTimeout(async () => {
	// 		try {
	// 			await indexAllFilesFromStore({ projectId: 'default', async: true });
	// 			console.log('Triggered background indexing for current workspace files');
	// 		} catch (err) {
	// 			console.warn('Failed to trigger workspace indexing on mount:', err);
	// 		}
	// 	}, 50);
	// });
</script>

<svelte:head>
	<title>Editor - Aura</title>
</svelte:head>

<svelte:window on:keydown={handleKeydown} />

<Resizable.PaneGroup {onLayoutChange} direction="horizontal" class="max-h-dvh overflow-hidden">
	<Sidebar.Provider>
		<Resizable.Pane
			collapsible={!$sidebarState.panels.leftSidebarVisible}
			defaultSize={pageData.layout ? pageData.layout[0] : 20}
			maxSize={20}
			minSize={20}
		>
			<EnhancedSidebar />
		</Resizable.Pane>
		<Resizable.Handle />
		<Resizable.Handle />
		<Resizable.Pane defaultSize={pageData.layout ? pageData.layout[1] : 80} class="h-full">
			<Resizable.PaneGroup
				onLayoutChange={(layout: number[]) => onVerticalLayoutChange(layout)}
				direction="vertical"
				class="max-h-dvh overflow-hidden"
			>
				<Resizable.Pane
					defaultSize={$sidebarState.panels.terminalVisible
						? pageData.verticalLayout
							? pageData.verticalLayout[0]
							: 80
						: 100}
					class="flex h-full flex-col"
				>
					<div class="">
						<FileTabs />
					</div>
					{#if currentFile}
						<div class="!relative !h-[100%] !overflow-auto">
							<CodemirrorEditor />
						</div>
					{:else}
						<div class="flex flex-1 items-center justify-center">
							<div class="space-y-4 text-center">
								<div class="text-6xl">📝</div>
								<div>
									<h2 class="mb-2 text-xl font-semibold">No file selected</h2>
									<p class="text-muted-foreground">
										Choose a file from the sidebar to start editing
									</p>
									<p class="mt-2 text-xs text-muted-foreground">
										Try the enhanced sidebar for more features!
									</p>
								</div>
							</div>
						</div>
					{/if}
				</Resizable.Pane>
				<Resizable.Handle />
				<Resizable.Pane
					collapsible={!$sidebarState.panels.terminalVisible}
					defaultSize={pageData.verticalLayout ? pageData.verticalLayout[1] : 20}
				>
					<TerminalManager />
				</Resizable.Pane>
			</Resizable.PaneGroup>
		</Resizable.Pane>
		<Resizable.Handle />
		<Resizable.Pane
			collapsible={!$sidebarState.panels.rightSidebarVisible}
			defaultSize={pageData.layout ? pageData.layout[2] : 20}
			maxSize={40}
			minSize={20}
			class="h-full w-fit"
		>
			<!-- <ChatSidebar /> -->
		</Resizable.Pane>
	</Sidebar.Provider>
</Resizable.PaneGroup>

<!-- File Watcher for real-time updates -->
<FileWatcher enabled={true} />
