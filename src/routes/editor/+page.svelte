<script lang="ts">
	import CodemirrorEditor from '$lib/components/code-editor/codemirror-editor.svelte';
	import FileTabs from '$lib/components/editor/file-tabs.svelte';
	import EnhancedSidebar from '$lib/components/shared/enhanced-sidebar.svelte';
	import * as Resizable from '$lib/components/ui/resizable/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { activeFileId, fileActions, filesStore, tabActions } from '$lib/stores/editor.js';
	import { createBreadcrumbs } from '$lib/utils/file-tree';
	// Icons
	import { TerminalManager } from '$lib/components/shared/terminal';
	import ChatSidebar from '@/components/chat/chat-sidebar.svelte';

	// Enhanced sidebar state
	let useEnhancedSidebar = $state(false);

	let { data } = $props();

	function onLayoutChange(sizes: number[]) {
		document.cookie = `PaneForge:layout=${JSON.stringify(sizes)}`;
	}

	function onVerticalLayoutChange(sizes: number[]) {
		document.cookie = `PaneForge:vertical-layout=${JSON.stringify(sizes)}`;
	}

	// Get current file and breadcrumbs
	let currentFile = $derived($activeFileId ? $filesStore.get($activeFileId) : null);
	let breadcrumbs = $derived(currentFile ? createBreadcrumbs(currentFile.path) : []);

	// Load files from current session
	async function loadSessionFiles(sessionId: string) {
		try {
			const response = await fetch(`/api/sessions/${sessionId}/files?source=sandbox`, {
				method: 'GET'
			});

			if (!response.ok) {
				console.error('Failed to load session files:', response.statusText);
				return;
			}

			const result = await response.json();
			if (result.success && result.data.files) {
				// Convert API files to FileSystemItem format
				const fileItems = result.data.files
					.filter((file: any) => file.path && !file.path.endsWith('/'))
					.map((file: any) => ({
						id: file.path,
						name: file.path.split('/').pop() || file.path,
						path: file.path,
						type: 'file' as const,
						content: file.content || '',
						size: file.size || 0,
						modifiedAt: file.lastModified ? new Date(file.lastModified) : new Date(),
						isDirty: false
					}));

				// Load files into the store
				fileActions.loadFiles(fileItems);

				// Open the first file if no file is currently open
				if (fileItems.length > 0 && !$activeFileId) {
					const firstFile =
						fileItems.find((f) => f.name.includes('index') || f.name.includes('main')) ||
						fileItems[0];
					tabActions.openFile(firstFile.id);
				}
			}
		} catch (error) {
			console.error('Failed to load session files:', error);
		}
	}
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
			<ChatSidebar />
		</Resizable.Pane>
	</Sidebar.Provider>
</Resizable.PaneGroup>
