<script lang="ts" module>
	export interface CommandItem {
		id: string;
		title: string;
		description?: string;
		icon?: any;
		shortcut?: string;
		category?: string;
		action: () => void;
		keywords?: string[];
	}

	export interface CommandGroup {
		id: string;
		title: string;
		items: CommandItem[];
	}
</script>

<script lang="ts">
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';

	// Icons
	import FilePlusIcon from '@lucide/svelte/icons/file-plus';
	import FolderPlusIcon from '@lucide/svelte/icons/folder-plus';
	import SearchIcon from '@lucide/svelte/icons/search';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import TerminalIcon from '@lucide/svelte/icons/terminal';
	import RefreshIcon from '@lucide/svelte/icons/refresh-ccw';
	import SaveIcon from '@lucide/svelte/icons/save';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import PaletteIcon from '@lucide/svelte/icons/palette';
	import LayoutIcon from '@lucide/svelte/icons/layout';
	import ZapIcon from '@lucide/svelte/icons/zap';

	// Stores
	import { filesStore, tabActions, fileStateActions, tabsStore } from '$lib/stores/editor.js';
	import { layoutActions } from '$lib/stores/layout.store.js';
	import Icon from '@iconify/svelte';
	import { getFileIcon } from '../editor';

	// Props
	let {
		open = $bindable(false),
		placeholder = 'Type a command or search...',
		maxRecentFiles = 10
	} = $props();

	// State
	let searchValue = $state('');
	let selectedIndex = $state(0);

	// Get recent files from tabs store
	function getRecentFiles() {
		return $tabsStore.openFiles
			.slice(0, maxRecentFiles)
			.map((fileId) => {
				const file = $filesStore.get(fileId);
				if (!file) return null;
				return {
					id: `recent-${file.id}`,
					title: file.name,
					description: file.path,
					icon: getFileIcon(file.name),
					category: 'Recent Files',
					action: () => {
						tabActions.openFile(file.id);
						open = false;
					},
					keywords: [file.name, file.path, 'recent', 'file']
				};
			})
			.filter(Boolean); // Command definitions
	}
	const commandGroups: CommandGroup[] = [
		{
			id: 'file-actions',
			title: 'File Actions',
			items: [
				{
					id: 'new-file',
					title: 'New File',
					description: 'Create a new file',
					icon: FilePlusIcon,
					shortcut: '⌘N',
					category: 'file',
					keywords: ['create', 'file', 'new'],
					action: () => {
						// TODO: Implement new file creation
						console.log('Creating new file');
						open = false;
					}
				},
				{
					id: 'new-folder',
					title: 'New Folder',
					description: 'Create a new folder',
					icon: FolderPlusIcon,
					category: 'file',
					keywords: ['create', 'folder', 'directory', 'new'],
					action: () => {
						// TODO: Implement new folder creation
						console.log('Creating new folder');
						open = false;
					}
				},
				{
					id: 'save-file',
					title: 'Save File',
					description: 'Save the current file',
					icon: SaveIcon,
					shortcut: '⌘S',
					category: 'file',
					keywords: ['save', 'file'],
					action: () => {
						const activeFileId = $tabsStore.activeFileId;
						if (activeFileId) {
							fileStateActions.saveFile(activeFileId);
						}
						open = false;
					}
				}
			]
		},
		{
			id: 'navigation',
			title: 'Navigation',
			items: [
				{
					id: 'search-files',
					title: 'Search Files',
					description: 'Search for files in the project',
					icon: SearchIcon,
					shortcut: '⌘P',
					category: 'navigation',
					keywords: ['search', 'find', 'files'],
					action: () => {
						// TODO: Implement file search
						console.log('Opening file search');
						open = false;
					}
				},
				{
					id: 'go-to-line',
					title: 'Go to Line',
					description: 'Jump to a specific line number',
					icon: ZapIcon,
					shortcut: '⌘G',
					category: 'navigation',
					keywords: ['go', 'line', 'jump'],
					action: () => {
						// TODO: Implement go to line
						console.log('Go to line');
						open = false;
					}
				}
			]
		},
		{
			id: 'view',
			title: 'View',
			items: [
				{
					id: 'toggle-sidebar',
					title: 'Toggle Sidebar',
					description: 'Show or hide the sidebar',
					icon: LayoutIcon,
					shortcut: '⌘B',
					category: 'view',
					keywords: ['toggle', 'sidebar', 'panel'],
					action: () => {
						layoutActions.toggleSidebar();
						open = false;
					}
				},
				{
					id: 'toggle-terminal',
					title: 'Toggle Terminal',
					description: 'Show or hide the terminal',
					icon: TerminalIcon,
					shortcut: '⌘J',
					category: 'view',
					keywords: ['toggle', 'terminal', 'console'],
					action: () => {
						layoutActions.toggleTerminal();
						open = false;
					}
				},
				{
					id: 'command-palette',
					title: 'Command Palette',
					description: 'Show command palette',
					icon: PaletteIcon,
					shortcut: '⌘⇧P',
					category: 'view',
					keywords: ['command', 'palette'],
					action: () => {
						// Already open
					}
				}
			]
		},
		{
			id: 'tools',
			title: 'Tools',
			items: [
				{
					id: 'refresh-explorer',
					title: 'Refresh Explorer',
					description: 'Refresh the file explorer',
					icon: RefreshIcon,
					category: 'tools',
					keywords: ['refresh', 'reload', 'explorer'],
					action: () => {
						// TODO: Implement refresh
						console.log('Refreshing explorer');
						open = false;
					}
				},
				{
					id: 'settings',
					title: 'Settings',
					description: 'Open settings',
					icon: SettingsIcon,
					category: 'tools',
					keywords: ['settings', 'preferences', 'config'],
					action: () => {
						// TODO: Implement settings
						console.log('Opening settings');
						open = false;
					}
				}
			]
		}
	];

	// Filter commands and files based on search
	function filterCommands(query: string) {
		if (!query.trim()) return commandGroups;

		const searchLower = query.toLowerCase();
		return commandGroups
			.map((group) => ({
				...group,
				items: group.items.filter(
					(item) =>
						item.title.toLowerCase().includes(searchLower) ||
						item.description?.toLowerCase().includes(searchLower) ||
						item.keywords?.some((keyword) => keyword.toLowerCase().includes(searchLower))
				)
			}))
			.filter((group) => group.items.length > 0);
	}

	function filterFiles(query: string) {
		if (!query.trim()) return [];

		const searchLower = query.toLowerCase();
		return Array.from($filesStore.values())
			.filter(
				(file) =>
					file.type === 'file' &&
					(file.name.toLowerCase().includes(searchLower) ||
						file.path.toLowerCase().includes(searchLower))
			)
			.slice(0, 20); // Limit results
	}

	// Handle keyboard navigation
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			open = false;
			event.preventDefault();
		}
	}

	// Reset state when dialog opens/closes
	$effect(() => {
		if (open) {
			searchValue = '';
			selectedIndex = 0;
		}
	});

	// Reactive computed values
	const filteredCommands = $derived(filterCommands(searchValue));
	const filteredFiles = $derived(filterFiles(searchValue));
	const recentFiles = $derived(getRecentFiles());
	const showFiles = $derived(searchValue.length > 0);
	const showRecent = $derived(searchValue.length === 0);
</script>

<svelte:window on:keydown={handleKeyDown} />

<Command.Dialog bind:open class="">
	<Command.Root class="rounded-lg border-0 shadow-none">
		<Command.Input
			bind:value={searchValue}
			{placeholder}
			class="rounded-none border-0 border-b shadow-none focus-visible:ring-0"
		/>
		<Command.List class="max-h-96 overflow-y-auto">
			<Command.Empty>
				<div class="p-6 text-center">
					<SearchIcon class="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
					<p class="text-sm text-muted-foreground">No commands or files found.</p>
					<p class="mt-1 text-xs text-muted-foreground">Try searching with different keywords.</p>
				</div>
			</Command.Empty>

			<!-- Recent Files (when no search) -->
			{#if showRecent && recentFiles.length > 0}
				<Command.Group heading="Recent Files">
					{#each recentFiles as item (item?.id)}
						<Command.Item
							value="recent-{item?.id}"
							onSelect={() => {
								tabActions.openFile(item?.id);
								open = false;
							}}
						>
							<ClockIcon class="mr-2 h-4 w-4 text-muted-foreground" />
							<Icon icon={getFileIcon(item?.title)} class="mr-2 h-4 w-4" />
							<div class="min-w-0 flex-1">
								<div class="truncate">{item?.title}</div>
							</div>
						</Command.Item>
					{/each}
				</Command.Group>
			{/if}

			<!-- File Search Results -->
			{#if showFiles && filteredFiles.length > 0}
				<Command.Group heading="Files">
					{#each filteredFiles as file (file.id)}
						<Command.Item
							value="file-{file.id}"
							onSelect={() => {
								tabActions.openFile(file.id);
								open = false;
							}}
						>
							<Icon icon={getFileIcon(file.name)} class="mr-2 h-4 w-4" />
							<div class="min-w-0 flex-1">
								<div class="truncate">{file.name}</div>
								<div class="truncate text-xs text-muted-foreground">{file.path}</div>
							</div>
							{#if fileStateActions.isFileDirty(file.id)}
								<Badge variant="secondary" class="ml-2 text-xs">Modified</Badge>
							{/if}
						</Command.Item>
					{/each}
				</Command.Group>
			{/if}

			<!-- Commands -->
			{#each filteredCommands as group (group.id)}
				<Command.Group heading={group.title}>
					{#each group.items as command (command.id)}
						<Command.Item value="command-{command.id}" onSelect={() => command.action()}>
							{#if command.icon}
								{@const Icon = command.icon}
								<Icon class="mr-2 h-4 w-4" />
							{/if}
							<div class="flex-1">
								<div>{command.title}</div>
								{#if command.description}
									<div class="text-xs text-muted-foreground">{command.description}</div>
								{/if}
							</div>
							{#if command.shortcut}
								<Command.Shortcut>{command.shortcut}</Command.Shortcut>
							{/if}
						</Command.Item>
					{/each}
				</Command.Group>
			{/each}
		</Command.List>
	</Command.Root>
</Command.Dialog>
