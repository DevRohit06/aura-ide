<script lang="ts">
	import { getFileIcon } from '$lib/components/editor';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import { getDirectoryIcon } from '$lib/utils/file-icons.js';
	import type { FileSystemItem } from '@/types/files';
	import Icon from '@iconify/svelte';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import PasteIcon from '@lucide/svelte/icons/clipboard';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import EditIcon from '@lucide/svelte/icons/edit';
	import FilePlusIcon from '@lucide/svelte/icons/file-plus';
	import FolderPlusIcon from '@lucide/svelte/icons/folder-plus';
	import CutIcon from '@lucide/svelte/icons/scissors';
	import TrashIcon from '@lucide/svelte/icons/trash';

	interface Props {
		item: FileSystemItem;
		level: number;
		isRoot?: boolean;
		isExpanded?: boolean;
		children?: FileSystemItem[];
		isSelected?: boolean;
		hasChanges?: boolean;
		hasChildChanges?: boolean;
		changeType?: string;
		isDirty?: boolean;
		canPaste?: boolean;
		onToggleFolder?: (item: FileSystemItem) => void;
		onFileClick?: (item: FileSystemItem) => void;
		onDragStart?: (event: DragEvent, item: FileSystemItem) => void;
		onDrop?: (event: DragEvent, item: FileSystemItem) => void;
		onCreateFile?: (parentId?: string) => void;
		onCreateFolder?: (parentId?: string) => void;
		onRename?: (item: FileSystemItem) => void;
		onCopy?: (item: FileSystemItem) => void;
		onCut?: (item: FileSystemItem) => void;
		onPaste?: (targetItem?: FileSystemItem) => void;
		onDelete?: (item: FileSystemItem) => void;
	}

	let {
		item,
		level,
		isRoot = false,
		isExpanded = false,
		children = [],
		isSelected = false,
		hasChanges = false,
		hasChildChanges = false,
		changeType,
		isDirty = false,
		canPaste = false,
		onToggleFolder,
		onFileClick,
		onDragStart,
		onDrop,
		onCreateFile,
		onCreateFolder,
		onRename,
		onCopy,
		onCut,
		onPaste,
		onDelete
	}: Props = $props();
</script>

<ContextMenu.Root>
	<ContextMenu.Trigger>
		<div class="group">
			{#if item.type === 'directory'}
				<button
					class="group flex w-full items-center px-2 py-1 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
					class:bg-accent={isSelected}
					style="padding-left: 4px"
					onclick={() => onToggleFolder?.(item)}
					draggable="true"
					ondragstart={(e) => onDragStart?.(e, item)}
					ondragover={(e) => e.preventDefault()}
					ondrop={(e) => onDrop?.(e, item)}
				>
					<div class="flex min-w-0 flex-1 items-center">
						{#if isExpanded}
							<ChevronDownIcon size={14} class="mr-1 shrink-0" />
							{@const DirIcon = getDirectoryIcon(true)}
							<DirIcon size={14} class="mr-2 shrink-0" style="color: #3b82f6" />
						{:else}
							<ChevronRightIcon size={14} class="mr-1 shrink-0" />
							{@const DirIcon = getDirectoryIcon(false)}
							<DirIcon size={14} class="mr-2 shrink-0" style="color: #3b82f6" />
						{/if}
						<span class="truncate text-sm">{item.name}</span>
						{#if hasChildChanges}
							<div class="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500"></div>
						{/if}
					</div>
				</button>
			{:else}
				{@const FileIcon = getFileIcon(item.name)}
				<button
					class="group flex w-full items-center px-2 py-1 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
					class:bg-accent={isSelected}
					style="padding-left: 4px"
					onclick={() => onFileClick?.(item)}
					draggable="true"
					ondragstart={(e) => onDragStart?.(e, item)}
				>
					<div class="flex min-w-0 flex-1 items-center">
						<Icon icon={FileIcon} class="mr-2 h-3.5 w-3.5 shrink-0" style="color: #3b82f6" />
						<span
							class="truncate text-sm"
							class:text-green-400={changeType === 'A'}
							class:text-orange-400={changeType === 'M'}
							class:text-red-400={changeType === 'D'}
						>
							{item.name}
						</span>
						{#if changeType}
							<Badge variant="secondary" class="ml-auto h-4 px-1 text-xs">
								{changeType}
							</Badge>
						{/if}
						{#if isDirty}
							<div class="ml-1 h-1.5 w-1.5 shrink-0 rounded-full bg-white"></div>
						{/if}
					</div>
				</button>
			{/if}
		</div>
	</ContextMenu.Trigger>
	<ContextMenu.Content>
		{#if item.type === 'directory'}
			<ContextMenu.Item onclick={() => onCreateFile?.(item.id)}>
				<FilePlusIcon class="mr-2 h-4 w-4" />
				New File
			</ContextMenu.Item>
			<ContextMenu.Item onclick={() => onCreateFolder?.(item.id)}>
				<FolderPlusIcon class="mr-2 h-4 w-4" />
				New Folder
			</ContextMenu.Item>
			<ContextMenu.Separator />
		{/if}
		<ContextMenu.Item onclick={() => onRename?.(item)}>
			<EditIcon class="mr-2 h-4 w-4" />
			Rename
		</ContextMenu.Item>
		<ContextMenu.Item onclick={() => onCopy?.(item)}>
			<CopyIcon class="mr-2 h-4 w-4" />
			Copy
		</ContextMenu.Item>
		<ContextMenu.Item onclick={() => onCut?.(item)}>
			<CutIcon class="mr-2 h-4 w-4" />
			Cut
		</ContextMenu.Item>
		{#if canPaste}
			<ContextMenu.Item onclick={() => onPaste?.(item.type === 'directory' ? item : undefined)}>
				<PasteIcon class="mr-2 h-4 w-4" />
				Paste
			</ContextMenu.Item>
		{/if}
		<ContextMenu.Separator />
		<ContextMenu.Item onclick={() => onDelete?.(item)} class="text-destructive">
			<TrashIcon class="mr-2 h-4 w-4" />
			Delete
		</ContextMenu.Item>
	</ContextMenu.Content>
</ContextMenu.Root>
