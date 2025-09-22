<script lang="ts">
	import {
		ContextMenu,
		ContextMenuContent,
		ContextMenuItem,
		ContextMenuSeparator,
		ContextMenuTrigger
	} from '$lib/components/ui/context-menu';
	import {
		File,
		Folder,
		Edit3,
		Trash2,
		Copy,
		Cut,
		Paste,
		Download,
		FileText,
		FolderPlus,
		FilePlus
	} from 'lucide-svelte';
	import type { FileSystemItem } from '$lib/types/files';

	// Props
	let {
		children,
		file = null as FileSystemItem | null,
		onCreateFile = () => {},
		onCreateDirectory = () => {},
		onRename = () => {},
		onDelete = () => {},
		onCopy = () => {},
		onCut = () => {},
		onPaste = () => {},
		onDownload = () => {},
		canPaste = false,
		disabled = false
	} = $props();

	// Handle menu item clicks
	const handleCreateFile = () => {
		onCreateFile();
	};

	const handleCreateDirectory = () => {
		onCreateDirectory();
	};

	const handleRename = () => {
		if (file) {
			onRename(file);
		}
	};

	const handleDelete = () => {
		if (file) {
			onDelete(file);
		}
	};

	const handleCopy = () => {
		if (file) {
			onCopy(file);
		}
	};

	const handleCut = () => {
		if (file) {
			onCut(file);
		}
	};

	const handlePaste = () => {
		onPaste();
	};

	const handleDownload = () => {
		if (file) {
			onDownload(file);
		}
	};
</script>

<ContextMenu>
	<ContextMenuTrigger class="w-full" {disabled}>
		{@render children()}
	</ContextMenuTrigger>

	<ContextMenuContent class="w-56">
		<!-- Create operations (always available) -->
		<ContextMenuItem onclick={handleCreateFile} class="flex items-center gap-2">
			<FilePlus class="h-4 w-4" />
			New File
		</ContextMenuItem>

		<ContextMenuItem onclick={handleCreateDirectory} class="flex items-center gap-2">
			<FolderPlus class="h-4 w-4" />
			New Directory
		</ContextMenuItem>

		{#if file}
			<ContextMenuSeparator />

			<!-- File-specific operations -->
			<ContextMenuItem onclick={handleRename} class="flex items-center gap-2">
				<Edit3 class="h-4 w-4" />
				Rename
			</ContextMenuItem>

			<ContextMenuItem onclick={handleCopy} class="flex items-center gap-2">
				<Copy class="h-4 w-4" />
				Copy
			</ContextMenuItem>

			<ContextMenuItem onclick={handleCut} class="flex items-center gap-2">
				<Cut class="h-4 w-4" />
				Cut
			</ContextMenuItem>
		{/if}

		{#if canPaste}
			<ContextMenuItem onclick={handlePaste} class="flex items-center gap-2">
				<Paste class="h-4 w-4" />
				Paste
			</ContextMenuItem>
		{/if}

		{#if file}
			<ContextMenuSeparator />

			<!-- Download operation -->
			<ContextMenuItem onclick={handleDownload} class="flex items-center gap-2">
				<Download class="h-4 w-4" />
				Download
			</ContextMenuItem>

			<ContextMenuSeparator />

			<!-- Destructive operations -->
			<ContextMenuItem
				onclick={handleDelete}
				class="flex items-center gap-2 text-destructive focus:text-destructive"
			>
				<Trash2 class="h-4 w-4" />
				Delete
			</ContextMenuItem>
		{/if}
	</ContextMenuContent>
</ContextMenu>
