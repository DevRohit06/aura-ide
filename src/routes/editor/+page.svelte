<script lang="ts">
	import { onMount } from 'svelte';
	import AppSidebar from '$lib/components/shared/app-sidebar.svelte';
	import EnhancedSidebar from '$lib/components/shared/enhanced-sidebar.svelte';
	import FileTabs from '$lib/components/editor/file-tabs.svelte';
	import CodemirrorEditor from '$lib/components/code-editor/codemirror-editor.svelte';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Resizable from '$lib/components/ui/resizable/index.js';
	import {
		filesStore,
		tabsStore,
		activeFileId,
		fileActions,
		tabActions,
		fileStateActions
	} from '$lib/stores/editor.js';
	import { createBreadcrumbs } from '$lib/utils/file-tree';

	// Icons
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import LayoutIcon from '@lucide/svelte/icons/layout';
	import ChatSidebar from '@/components/chat/chat-sidebar.svelte';

	// Enhanced sidebar state
	let useEnhancedSidebar = $state(false);

	// Get current file and breadcrumbs
	let currentFile = $derived($activeFileId ? $filesStore.get($activeFileId) : null);
	let breadcrumbs = $derived(currentFile ? createBreadcrumbs(currentFile.path) : []);
</script>

<svelte:head>
	<title>Editor - Aura</title>
</svelte:head>

<Resizable.PaneGroup direction="horizontal" class="max-h-dvh overflow-hidden">
	<Sidebar.Provider>
		<Resizable.Pane maxSize={20} minSize={10}>
			<EnhancedSidebar />
		</Resizable.Pane>
		<Resizable.Handle />
		<Resizable.Pane class="h-full">
			<!-- <Sidebar.Inset> -->
			<div class="">
				<FileTabs />
			</div>
			{#if currentFile}
				<div class="!relative !h-[100%] !overflow-auto pb-10">
					<CodemirrorEditor />
				</div>
			{:else}
				<div class="flex flex-1 items-center justify-center">
					<div class="space-y-4 text-center">
						<div class="text-6xl">📝</div>
						<div>
							<h2 class="mb-2 text-xl font-semibold">No file selected</h2>
							<p class="text-muted-foreground">Choose a file from the sidebar to start editing</p>
							<p class="mt-2 text-xs text-muted-foreground">
								Try the enhanced sidebar for more features!
							</p>
						</div>
					</div>
				</div>
			{/if}
			<!-- </Sidebar.Inset> -->
		</Resizable.Pane>
		<Resizable.Handle />
		<Resizable.Pane maxSize={40} minSize={20} class="h-full w-fit">
			<ChatSidebar />
		</Resizable.Pane>
	</Sidebar.Provider>
</Resizable.PaneGroup>
