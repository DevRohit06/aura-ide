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
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	// Icons
	import { fileActions, filesStore, tabActions, tabsStore } from '$lib/stores/editor.js';
	import { fileStateActions } from '$lib/stores/file-states.store.js';
	import { layoutActions } from '$lib/stores/layout.store.js';
	import Icon from '@iconify/svelte';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import LayoutIcon from '@lucide/svelte/icons/layout';
	import PaletteIcon from '@lucide/svelte/icons/palette';
	import RefreshIcon from '@lucide/svelte/icons/refresh-ccw';
	import SaveIcon from '@lucide/svelte/icons/save';
	import SearchIcon from '@lucide/svelte/icons/search';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import TerminalIcon from '@lucide/svelte/icons/terminal';
	import ZapIcon from '@lucide/svelte/icons/zap';
	import { getFileIcon } from '../editor';

	// Props
	let {
		open = $bindable(false),
		placeholder = 'Type a command or search...',
		maxRecentFiles = 10,
		project = undefined
	} = $props();

	// State
	let searchValue = $state('');
	let selectedIndex = $state(0);

	// Load file content helper function
	async function loadFileContent(filePath: string) {
		const file = $filesStore.get(filePath);
		if (!file || file.type !== 'file') return;

		try {
			fileStateActions.setFileLoading(filePath, true);

			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 10000);

			const response = await fetch('/api/files', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					operation: 'read',
					sandboxId: project?.sandboxId || 'current-sandbox',
					projectId: project?.id,
					path: file.path,
					sandboxProvider: project?.sandboxProvider
				}),
				signal: controller.signal
			});

			clearTimeout(timeoutId);

			if (response.ok) {
				const result = await response.json();
				if (result.success && result.data !== undefined) {
					const content =
						typeof result.data.content === 'string'
							? result.data.content
							: String(result.data.content || '');
					fileActions.updateFileContent(filePath, content);
				}
			}
		} catch (error) {
			console.error('Error loading file content:', error);
		} finally {
			fileStateActions.setFileLoading(filePath, false);
		}
	}

	// Handle file opening with proper loading
	async function handleFileOpen(filePath: string) {
		console.log('[Command Palette] Opening file:', filePath);

		const file = $filesStore.get(filePath);
		if (!file) {
			console.error('[Command Palette] File not found:', filePath);
			console.log(
				'[Command Palette] Available files:',
				Array.from($filesStore.keys()).slice(0, 10)
			);
			return;
		}

		if (file.type !== 'file') {
			console.error('[Command Palette] Not a file:', filePath, file.type);
			return;
		}

		console.log('[Command Palette] File details:', {
			id: file.id,
			name: file.name,
			path: file.path,
			hasContent: !!file.content
		});

		// Open tab immediately using file path (will show loading state)
		tabActions.openFile(filePath);
		console.log('[Command Palette] Tab opened for:', filePath);

		// Close dialog
		open = false;

		// Load content if not already loaded
		if (!file.content || file.content === '') {
			console.log('[Command Palette] Loading content for:', filePath);
			await loadFileContent(filePath);
		} else {
			console.log('[Command Palette] Content already loaded for:', filePath);
		}
	}

	// Get recent files from tabs store
	function getRecentFiles() {
		return $tabsStore.openFiles
			.slice(0, maxRecentFiles)
			.map((filePath) => {
				const file = $filesStore.get(filePath);
				if (!file) return null;
				return {
					id: `recent-${file.path}`,
					title: file.name,
					description: file.path,
					icon: getFileIcon(file.name),
					category: 'Recent Files',
					action: async () => {
						await handleFileOpen(file.path);
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
					id: 'save-file',
					title: 'Save File',
					description: 'Save the current file',
					icon: SaveIcon,
					shortcut: '⌘S',
					category: 'file',
					keywords: ['save', 'file'],
					action: async () => {
						const activeFileId = $tabsStore.activeFileId;
						if (activeFileId) {
							await fileStateActions.saveFile(activeFileId);
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
						{#if item}
							{@const filePath = item.id.replace('recent-', '')}
							<Command.Item
								value="recent-{item.id}"
								onSelect={() => {
									handleFileOpen(filePath);
								}}
							>
								<ClockIcon class="mr-2 h-4 w-4 text-muted-foreground" />
								<Icon icon={getFileIcon(item.title)} class="mr-2 h-4 w-4" />
								<div class="min-w-0 flex-1">
									<div class="truncate">{item.title}</div>
								</div>
							</Command.Item>
						{/if}
					{/each}
				</Command.Group>
			{/if}

			<!-- File Search Results -->
			{#if showFiles && filteredFiles.length > 0}
				<Command.Group heading="Files">
					{#each filteredFiles as file (file.path)}
						<Command.Item
							value="file-{file.path}"
							onSelect={() => {
								console.log('[Command Palette] File selected:', file.path, file.name);
								handleFileOpen(file.path);
							}}
						>
							<Icon icon={getFileIcon(file.name)} class="mr-2 h-4 w-4" />
							<div class="min-w-0 flex-1">
								<div class="truncate">{file.name}</div>
								<div class="truncate text-xs text-muted-foreground">{file.path}</div>
							</div>
							{#if fileStateActions.isFileDirty(file.path)}
								<Badge variant="secondary" class="ml-2 text-xs">Modified</Badge>
							{/if}
							{#if fileStateActions.isFileLoading(file.path)}
								<Badge variant="outline" class="ml-2 text-xs">Loading...</Badge>
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
