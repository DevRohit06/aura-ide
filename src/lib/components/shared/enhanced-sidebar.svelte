<script lang="ts">
	import { initializeDummyData } from '$lib/data/initialize-dummy-data.js';
	import { filesStore } from '$lib/stores/editor.ts';
	import {
		sidebarPanelActions,
		sidebarPanelsStore,
		type SidebarView
	} from '$lib/stores/sidebar-panels.store';
	import { onMount } from 'svelte';
	import SidebarViewManager from './sidebar/sidebar-view-manager.svelte';

	// Props
	interface Props {
		class?: string;
		defaultView?: string;
		project?: { id: string; sandboxId?: string; sandboxProvider?: string };
	}

	let { class: className = '', defaultView = 'explorer', project = undefined }: Props = $props();

	// State
	let searchQuery = $state('');
	let initialized = $state(false);

	// Initialize default view if specified
	$effect(() => {
		if (defaultView && defaultView !== 'explorer') {
			sidebarPanelActions.setCurrentView(defaultView as SidebarView);
		}
	});

	// Initialize dummy data only if no real project is provided
	$effect(() => {
		const filesStoreValue = $filesStore;
		if (!initialized && filesStoreValue.size === 0) {
			initialized = true;
			if (!project) {
				// Load dummy data for development when no project is provided
				initializeDummyData();
			}
			// Files are now loaded server-side for real projects
		}
	});

	onMount(() => {
		// Ensure proper initialization on mount
		if (!initialized) {
			initialized = true;
		}
	});
</script>

<!-- Enhanced Sidebar -->
<div class="flex h-full max-h-dvh {className}">
	<SidebarViewManager currentView={$sidebarPanelsStore.currentView} {searchQuery} {project} />
</div>
