<script lang="ts">
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
		component?: any;
	}

	interface Props {
		views: SidebarViewData[];
		onSettingsClick: () => void;
	}

	let { views, onSettingsClick }: Props = $props();

	// Subscribe to the sidebar store
	let sidebarState = $state(sidebarPanelsStore);

	// Handle view toggle
	function handleViewToggle(viewId: SidebarView) {
		sidebarPanelActions.toggleView(viewId);
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

<div class="flex w-12 flex-col border-r border-border bg-sidebar-accent">
	{#each views as view (view.id)}
		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger class="">
					<Button
						variant={$sidebarState.currentView === view.id &&
						$sidebarState.panels.leftSidebarVisible
							? 'default'
							: 'secondary'}
						class="w-full"
						onclick={() => handleViewToggle(view.id)}
					>
						{@const IconComponent = getIconComponent(view.icon)}
						<IconComponent />
					</Button>
				</Tooltip.Trigger>
				<Tooltip.Content side="right">
					{view.name}
				</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
	{/each}

	<div class="mt-auto">
		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger>
					<Button
						variant="ghost"
						size="icon"
						class="h-12 w-12 rounded-none"
						onclick={onSettingsClick}
					>
						<SettingsIcon size={20} />
					</Button>
				</Tooltip.Trigger>
				<Tooltip.Content side="right">Settings</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
	</div>
</div>
