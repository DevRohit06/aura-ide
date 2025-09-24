<script lang="ts">
	import CodemirrorEditor from '$lib/components/code-editor/codemirror-editor.svelte';
	import FileTabs from '$lib/components/editor/file-tabs.svelte';
	import EnhancedSidebar from '$lib/components/shared/enhanced-sidebar.svelte';
	import * as Resizable from '$lib/components/ui/resizable/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { activeFileId, filesStore } from '$lib/stores/editor.js';
	import { fileActions } from '$lib/stores/files.store.js';
	// Icons
	import { TerminalManager } from '$lib/components/shared/terminal';
	// import ChatSidebar from '@/components/chat/chat-sidebar.svelte';

	let { data } = $props();

	// Initialize files store with server-loaded data
	$effect(() => {
		if (data.files && data.files.length > 0) {
			fileActions.loadFiles(data.files);
			console.log(`Loaded ${data.files.length} files from server`);
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
</script>

<svelte:head>
	<title>Editor - Aura</title>
</svelte:head>

<Resizable.PaneGroup {onLayoutChange} direction="horizontal" class="max-h-dvh overflow-hidden">
	<Sidebar.Provider>
		<Resizable.Pane
			collapsible
			defaultSize={data.layout ? data.layout[0] : 20}
			maxSize={20}
			minSize={20}
		>
			<EnhancedSidebar />
		</Resizable.Pane>
		<Resizable.Handle />
		<Resizable.Pane defaultSize={data.layout ? data.layout[1] : 80} class="h-full">
			<Resizable.PaneGroup
				onLayoutChange={(layout: number[]) => onVerticalLayoutChange(layout)}
				direction="vertical"
				class="max-h-dvh overflow-hidden"
			>
				<Resizable.Pane
					defaultSize={data.verticalLayout ? data.verticalLayout[0] : 80}
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
				<Resizable.Pane defaultSize={data.verticalLayout ? data.verticalLayout[1] : 20}>
					<TerminalManager />
				</Resizable.Pane>
			</Resizable.PaneGroup>
		</Resizable.Pane>
		<Resizable.Handle />
		<Resizable.Pane
			collapsible
			defaultSize={data.layout ? data.layout[2] : 20}
			maxSize={40}
			minSize={20}
			class="h-full w-fit"
		>
			<!-- <ChatSidebar /> -->
		</Resizable.Pane>
	</Sidebar.Provider>
</Resizable.PaneGroup>
