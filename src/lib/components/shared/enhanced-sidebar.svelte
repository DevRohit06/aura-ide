<script lang="ts">
	import { initializeDummyData } from '$lib/data/initialize-dummy-data.js';
	import { filesStore } from '$lib/stores/editor.ts';
	import {
		sidebarPanelActions,
		sidebarPanelsStore,
		type SidebarView
	} from '$lib/stores/sidebar-panels.store';
	import CommandPalette from './command-palette.svelte';
	import ComprehensiveSettingsDialog from './comprehensive-settings-dialog.svelte';
	import SidebarActivityBar from './sidebar/sidebar-activity-bar.svelte';
	import SidebarViewManager from './sidebar/sidebar-view-manager.svelte';

	// Props
	let {
		class: className = '',
		defaultView = 'explorer',
		project = undefined
	}: {
		class?: string;
		defaultView?: string;
		project?: { id: string; sandboxId?: string; sandboxProvider?: string };
	} = $props();

	// State
	let searchQuery = $state('');
	let commandPaletteOpen = $state(false);
	let settingsOpen = $state(false);

	// Subscribe to sidebar store
	let sidebarState = $state(sidebarPanelsStore);

	// Track initialization
	let initialized = $state(false);

	// Keyboard event handling
	function handleKeydown(event: KeyboardEvent) {
		const { key } = event;
		const cmdKey = event.ctrlKey || event.metaKey;
		const shiftKey = event.shiftKey;

		// Command Palette shortcuts
		if ((cmdKey && shiftKey && key === 'P') || key === 'F1' || (cmdKey && key === 'k')) {
			event.preventDefault();
			commandPaletteOpen = true;
		}
	}

	// Sidebar views configuration
	const sidebarViews = [
		{ id: 'explorer' as SidebarView, name: 'Explorer', icon: 'folder-tree' },
		{ id: 'search' as SidebarView, name: 'Search', icon: 'search' },
		{ id: 'source-control' as SidebarView, name: 'Source Control', icon: 'git-branch' },
		{ id: 'debug' as SidebarView, name: 'Run and Debug', icon: 'bug' },
		{ id: 'extensions' as SidebarView, name: 'Extensions', icon: 'package' },
		{ id: 'vector-indexing' as SidebarView, name: 'Vector Indexing', icon: 'database' }
	];

	// Event handlers
	function handleSettingsClick() {
		settingsOpen = true;
	}

	// Initialize default view if specified
	$effect(() => {
		if (defaultView && defaultView !== 'explorer') {
			sidebarPanelActions.setCurrentView(defaultView as SidebarView);
		}
	});

	// Initialize dummy data only if no real project is provided
	$effect(() => {
		if (!initialized && $filesStore.size === 0) {
			initialized = true;
			if (!project) {
				// Load dummy data for development when no project is provided
				initializeDummyData();
			}
			// Files are now loaded server-side for real projects
		}
	});
</script>

<!-- Enhanced Sidebar -->
<div class="flex h-full max-h-dvh {className}">
	<SidebarActivityBar views={sidebarViews} onSettingsClick={handleSettingsClick} />

	{#if $sidebarState.panels.leftSidebarVisible}
		<SidebarViewManager currentView={$sidebarState.currentView} {searchQuery} {project} />
	{/if}
</div>

<!-- Command Palette -->
<CommandPalette bind:open={commandPaletteOpen} {project} />

<!-- Settings Dialog -->
<ComprehensiveSettingsDialog bind:open={settingsOpen} />
