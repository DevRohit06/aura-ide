<script lang="ts" module>
	import type { FileSystemItem, File, Directory } from '@/types/files';
</script>

<script lang="ts">
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import FileIcon from '@lucide/svelte/icons/file';
	import FolderIcon from '@lucide/svelte/icons/folder';
	import type { ComponentProps } from 'svelte';

	// Import our stores and data
	import { filesStore, tabActions, fileStateActions, tabsStore } from '$lib/stores/editor.js';
	import { gitChanges } from '$lib/data/dummy-files.js';
	import { initializeDummyData } from '$lib/data/initialize-dummy-data.js';

	let { ref = $bindable(null), ...restProps }: ComponentProps<typeof Sidebar.Root> = $props();

	// Track if we've initialized to prevent infinite loops
	let initialized = $state(false);

	// Initialize dummy data when component mounts - using $effect with guard
	$effect(() => {
		if (!initialized && $filesStore.size === 0) {
			console.log('Sidebar initializing, files before:', $filesStore.size);
			initialized = true;
			initializeDummyData();
			console.log('Sidebar initialized, files after:', $filesStore.size);
		}
	});

	// Build file tree from flat file structure
	function buildFileTree(files: Map<string, FileSystemItem>): FileSystemItem[] {
		const rootItems: FileSystemItem[] = [];
		const itemsArray = Array.from(files.values());

		// Get root items (no parent)
		const roots = itemsArray.filter((item) => item.parentId === null);

		// Sort: directories first, then files, both alphabetically
		roots.sort((a, b) => {
			if (a.type !== b.type) {
				return a.type === 'directory' ? -1 : 1;
			}
			return a.name.localeCompare(b.name);
		});

		return roots;
	}

	function getChildren(parentId: string, files: Map<string, FileSystemItem>): FileSystemItem[] {
		const itemsArray = Array.from(files.values());
		const children = itemsArray.filter((item) => item.parentId === parentId);

		// Sort: directories first, then files, both alphabetically
		children.sort((a, b) => {
			if (a.type !== b.type) {
				return a.type === 'directory' ? -1 : 1;
			}
			return a.name.localeCompare(b.name);
		});

		return children;
	}

	function handleFileClick(fileId: string) {
		console.log('File clicked:', fileId);
		console.log('Files store:', $filesStore);
		console.log('Tabs store before:', $tabsStore);
		tabActions.openFile(fileId);
		console.log('Tabs store after:', $tabsStore);
	}

	function isFileDirty(fileId: string): boolean {
		return fileStateActions.isFileDirty(fileId);
	}

	// Reactive file tree using $derived instead of $:
	const fileTree = $derived(buildFileTree($filesStore));
</script>

<Sidebar.Root bind:ref {...restProps}>
	<Sidebar.Content>
		<!-- <Sidebar.Group>
			<Sidebar.GroupLabel>Changes</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each Object.entries(gitChanges) as [fileName, state]}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton
								onclick={() => {
									// Find the file by name and open it
									const file = Array.from($filesStore.values()).find((f) => f.name === fileName);
									if (file) handleFileClick(file.id);
								}}
							>
								<FileIcon />
								{fileName}
							</Sidebar.MenuButton>
							<Sidebar.MenuBadge>{state}</Sidebar.MenuBadge>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group> -->
		<Sidebar.Group>
			<Sidebar.GroupLabel>Files</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each fileTree as item (item.id)}
						{@render FileTreeNode({ item, level: 0 })}
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>
	<Sidebar.Rail />
</Sidebar.Root>
{#snippet FileTreeNode({ item, level }: { item: FileSystemItem; level: number })}
	{#if item.type === 'directory'}
		{@const children = getChildren(item.id, $filesStore)}
		{@const hasChanges = children.some(
			(child) =>
				child.type === 'file' &&
				(gitChanges[child.name as keyof typeof gitChanges] || isFileDirty(child.id))
		)}
		<Sidebar.MenuItem>
			<Collapsible.Root
				class="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
				open={item.name === 'src' || item.name === 'lib'}
			>
				<Collapsible.Trigger class="w-full">
					{#snippet child({ props })}
						<Sidebar.MenuButton {...props}>
							<ChevronRightIcon className="transition-transform" />
							<FolderIcon />
							{item.name}
							{#if hasChanges}
								<div class="ml-auto h-1 w-1 rounded-full bg-blue-500"></div>
							{/if}
						</Sidebar.MenuButton>
					{/snippet}
				</Collapsible.Trigger>
				<Collapsible.Content class="">
					<Sidebar.MenuSub>
						{#each children as child (child.id)}
							{@render FileTreeNode({ item: child, level: level + 1 })}
						{/each}
					</Sidebar.MenuSub>
				</Collapsible.Content>
			</Collapsible.Root>
		</Sidebar.MenuItem>
	{:else}
		{@const isChanged = gitChanges[item.name as keyof typeof gitChanges] || false}
		{@const isDirty = isFileDirty(item.id)}
		<Sidebar.MenuButton onclick={() => handleFileClick(item.id)} class="relative">
			<FileIcon />
			{item.name}
			{#if isChanged}
				<Sidebar.MenuBadge class="ml-auto"
					>{gitChanges[item.name as keyof typeof gitChanges]}</Sidebar.MenuBadge
				>
			{/if}
			{#if isDirty}
				<div class="ml-auto h-1 w-1 rounded-full bg-white"></div>
			{/if}
		</Sidebar.MenuButton>
	{/if}
{/snippet}
