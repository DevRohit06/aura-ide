<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { AlertTriangle, File, Folder, Trash2 } from 'lucide-svelte';
	import type { FileSystemItem } from '$lib/types/files';

	// Props
	let {
		// Delete confirmation dialog
		showDeleteDialog = $bindable(false),
		fileToDelete = $bindable(null as FileSystemItem | null),
		onConfirmDelete = () => {},

		// Rename dialog
		showRenameDialog = $bindable(false),
		fileToRename = $bindable(null as FileSystemItem | null),
		onConfirmRename = (newName: string) => {},

		// Create file/folder dialog
		showCreateDialog = $bindable(false),
		createType = $bindable('file' as 'file' | 'directory'),
		parentPath = $bindable('/'),
		onConfirmCreate = (name: string, type: 'file' | 'directory') => {}
	} = $props();

	// Local state
	let newFileName = '';
	let renameInput: HTMLInputElement;
	let createInput: HTMLInputElement;
	let isProcessing = false;

	// Reset state when dialogs open
	$effect(() => {
		if (showRenameDialog && fileToRename) {
			newFileName = fileToRename.name;
			setTimeout(() => {
				if (renameInput) {
					renameInput.focus();
					renameInput.select();
				}
			}, 100);
		}
	});

	$effect(() => {
		if (showCreateDialog) {
			newFileName = '';
			setTimeout(() => {
				if (createInput) {
					createInput.focus();
				}
			}, 100);
		}
	});

	// Handle delete confirmation
	const handleDeleteConfirm = async () => {
		if (!fileToDelete) return;

		isProcessing = true;
		try {
			await onConfirmDelete();
			showDeleteDialog = false;
			fileToDelete = null;
		} finally {
			isProcessing = false;
		}
	};

	// Handle rename confirmation
	const handleRenameConfirm = async () => {
		if (!fileToRename || !newFileName.trim()) return;

		isProcessing = true;
		try {
			await onConfirmRename(newFileName.trim());
			showRenameDialog = false;
			fileToRename = null;
			newFileName = '';
		} finally {
			isProcessing = false;
		}
	};

	// Handle create confirmation
	const handleCreateConfirm = async () => {
		if (!newFileName.trim()) return;

		isProcessing = true;
		try {
			await onConfirmCreate(newFileName.trim(), createType);
			showCreateDialog = false;
			newFileName = '';
		} finally {
			isProcessing = false;
		}
	};

	// Handle keyboard events
	const handleRenameKeydown = (event: KeyboardEvent) => {
		if (event.key === 'Enter') {
			event.preventDefault();
			handleRenameConfirm();
		} else if (event.key === 'Escape') {
			showRenameDialog = false;
		}
	};

	const handleCreateKeydown = (event: KeyboardEvent) => {
		if (event.key === 'Enter') {
			event.preventDefault();
			handleCreateConfirm();
		} else if (event.key === 'Escape') {
			showCreateDialog = false;
		}
	};
</script>

<!-- Delete Confirmation Dialog -->
<Dialog bind:open={showDeleteDialog}>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<AlertTriangle class="h-5 w-5 text-destructive" />
				Confirm Delete
			</DialogTitle>
			<DialogDescription>
				{#if fileToDelete}
					Are you sure you want to delete
					<span class="font-medium">"{fileToDelete.name}"</span>?
					{#if fileToDelete.type === 'directory'}
						<br />
						<span class="font-medium text-destructive">
							This will permanently delete the directory and all its contents.
						</span>
					{/if}
					<br />
					This action cannot be undone.
				{/if}
			</DialogDescription>
		</DialogHeader>
		<DialogFooter class="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
			<Button
				variant="outline"
				onclick={() => {
					showDeleteDialog = false;
				}}
				disabled={isProcessing}
			>
				Cancel
			</Button>
			<Button
				variant="destructive"
				onclick={handleDeleteConfirm}
				disabled={isProcessing}
				class="flex items-center gap-2"
			>
				<Trash2 class="h-4 w-4" />
				{isProcessing ? 'Deleting...' : 'Delete'}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

<!-- Rename Dialog -->
<Dialog bind:open={showRenameDialog}>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				{#if fileToRename?.type === 'file'}
					<File class="h-5 w-5" />
				{:else}
					<Folder class="h-5 w-5" />
				{/if}
				Rename {fileToRename?.type === 'file' ? 'File' : 'Directory'}
			</DialogTitle>
			<DialogDescription>
				Enter a new name for "{fileToRename?.name}"
			</DialogDescription>
		</DialogHeader>
		<div class="grid gap-4 py-4">
			<div class="grid gap-2">
				<Label for="rename-input">Name</Label>
				<Input
					id="rename-input"
					bind:this={renameInput}
					bind:value={newFileName}
					onkeydown={handleRenameKeydown}
					placeholder="Enter new name..."
					disabled={isProcessing}
				/>
			</div>
		</div>
		<DialogFooter class="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
			<Button
				variant="outline"
				onclick={() => {
					showRenameDialog = false;
				}}
				disabled={isProcessing}
			>
				Cancel
			</Button>
			<Button onclick={handleRenameConfirm} disabled={isProcessing || !newFileName.trim()}>
				{isProcessing ? 'Renaming...' : 'Rename'}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

<!-- Create File/Directory Dialog -->
<Dialog bind:open={showCreateDialog}>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				{#if createType === 'file'}
					<File class="h-5 w-5" />
					Create New File
				{:else}
					<Folder class="h-5 w-5" />
					Create New Directory
				{/if}
			</DialogTitle>
			<DialogDescription>
				Create a new {createType} in "{parentPath}"
			</DialogDescription>
		</DialogHeader>
		<div class="grid gap-4 py-4">
			<div class="grid gap-2">
				<Label for="create-input">Name</Label>
				<Input
					id="create-input"
					bind:this={createInput}
					bind:value={newFileName}
					onkeydown={handleCreateKeydown}
					placeholder={createType === 'file' ? 'filename.ext' : 'directory-name'}
					disabled={isProcessing}
				/>
			</div>
		</div>
		<DialogFooter class="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
			<Button
				variant="outline"
				onclick={() => {
					showCreateDialog = false;
				}}
				disabled={isProcessing}
			>
				Cancel
			</Button>
			<Button onclick={handleCreateConfirm} disabled={isProcessing || !newFileName.trim()}>
				{isProcessing ? 'Creating...' : 'Create'}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

<style>
	:global(.dialog-content) {
		max-width: 28rem;
	}
</style>
