<script lang="ts">
	import ProfileDropdown from '$lib/components/shared/profile-dropdown.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import {
		sidebarPanelActions,
		sidebarPanelsStore,
		type SidebarView
	} from '$lib/stores/sidebar-panels.store';
	import BugIcon from '@lucide/svelte/icons/bug';
	import DatabaseIcon from '@lucide/svelte/icons/database';
	import FilesIcon from '@lucide/svelte/icons/folder-tree';
	import GitBranchIcon from '@lucide/svelte/icons/git-branch';
	import ExtensionIcon from '@lucide/svelte/icons/package';
	import SearchIcon from '@lucide/svelte/icons/search';
	import SettingsIcon from '@lucide/svelte/icons/settings';

	export interface SidebarViewData {
		id: SidebarView;
		name: string;
		icon: string;
	}

	type Props = {
		onSettingsClick?: () => void;
		onProfileClick?: () => void;
		user?: {
			id: string;
			email: string;
			username?: string;
			name?: string;
			image?: string;
		};
	};

	let { onSettingsClick, onProfileClick, user }: Props = $props();

	// Sidebar views configuration
	const sidebarViews: SidebarViewData[] = [
		{ id: 'explorer', name: 'Explorer', icon: 'folder-tree' },
		{ id: 'search', name: 'Search', icon: 'search' },
		{ id: 'source-control', name: 'Source Control', icon: 'git-branch' },
		{ id: 'debug', name: 'Run and Debug', icon: 'bug' },
		{ id: 'extensions', name: 'Extensions', icon: 'package' },
		{ id: 'vector-indexing', name: 'Vector Indexing', icon: 'database' }
	];

	// Handle view toggle
	function handleViewToggle(viewId: SidebarView) {
		sidebarPanelActions.toggleView(viewId);
	}

	function handleSettingsClick() {
		onSettingsClick?.();
	}

	function getIconComponent(iconName: string) {
		switch (iconName) {
			case 'folder-tree':
				return FilesIcon;
			case 'search':
				return SearchIcon;
			case 'git-branch':
				return GitBranchIcon;
			case 'bug':
				return BugIcon;
			case 'package':
				return ExtensionIcon;
			case 'database':
				return DatabaseIcon;
			default:
				return FilesIcon;
		}
	}
</script>

<!-- Activity Bar -->
<div class="flex w-12 flex-col border-r border-border bg-sidebar-accent">
	{#each sidebarViews as view (view.id)}
		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger>
					<Button
						variant={$sidebarPanelsStore.currentView === view.id &&
						$sidebarPanelsStore.panels.leftSidebarVisible
							? 'default'
							: 'secondary'}
						size="icon"
						class="h-12 w-12 rounded-none"
						onclick={() => handleViewToggle(view.id)}
					>
						{@const IconComponent = getIconComponent(view.icon)}
						<IconComponent size={20} />
					</Button>
				</Tooltip.Trigger>
				<Tooltip.Content side="right">
					{view.name}
				</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
	{/each}

	<!-- Settings Button -->
	<div class="mt-auto space-y-0">
		<!-- Profile Dropdown -->
		{#if user}
			<div class="flex justify-center p-2">
				<ProfileDropdown {user} {onProfileClick} />
			</div>
		{/if}

		<!-- Settings Button -->
		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger>
					<Button
						variant="ghost"
						size="icon"
						class="h-12 w-12 rounded-none"
						onclick={handleSettingsClick}
					>
						<SettingsIcon size={20} />
					</Button>
				</Tooltip.Trigger>
				<Tooltip.Content side="right">Settings</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
	</div>
</div>
