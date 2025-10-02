<script lang="ts">
	import { goto } from '$app/navigation';
	import * as Menubar from '$lib/components/ui/menubar/index.js';
	import { fileActions, tabActions } from '$lib/stores/editor.js';
	import { sidebarPanelActions } from '$lib/stores/sidebar-panels.store';

	let { project } = $props<{ project: any }>();

	// Menu state
	let showSidebarChecked = $state(true);
	let showTerminalChecked = $state(true);
	let showRightSidebarChecked = $state(true);

	function handleNewFile() {
		// Create a new untitled file
		const now = new Date();
		const newFile = {
			id: `untitled-${Date.now()}`,
			name: 'Untitled',
			path: 'Untitled',
			content: '',
			parentId: null,
			type: 'file' as const,
			createdAt: now,
			modifiedAt: now,
			permissions: {
				read: true,
				write: true,
				execute: false,
				delete: true,
				share: false,
				owner: 'current-user',
				collaborators: []
			}
		};
		fileActions.addFile(newFile);
		// Use tab actions to open the file
		tabActions.openFile(newFile.id);
	}

	function handleOpenFolder() {
		// Trigger file explorer or folder picker
		console.log('Open folder clicked');
	}

	function handleSave() {
		// Save current file
		console.log('Save file');
	}

	function handleSaveAs() {
		// Save current file as
		console.log('Save file as');
	}

	function handleUndo() {
		// Undo action
		console.log('Undo');
	}

	function handleRedo() {
		// Redo action
		console.log('Redo');
	}

	function handleFind() {
		// Open find dialog
		console.log('Find');
	}

	function handleReplace() {
		// Open replace dialog
		console.log('Replace');
	}

	function handleToggleSidebar() {
		showSidebarChecked = !showSidebarChecked;
		sidebarPanelActions.toggleLeftSidebar();
	}

	function handleToggleTerminal() {
		showTerminalChecked = !showTerminalChecked;
		sidebarPanelActions.toggleTerminal();
	}

	function handleToggleRightSidebar() {
		showRightSidebarChecked = !showRightSidebarChecked;
		sidebarPanelActions.toggleRightSidebar();
	}

	function handleGoToDashboard() {
		goto('/dashboard');
	}

	function handleProjectSettings() {
		console.log('Project settings');
	}
</script>

<div class="border-b bg-background">
	<Menubar.Root class="flex items-center">
		<!-- File Menu -->

		<img class="h-5 px-2" src="/aura.png" alt="Aura Ide" />
		<Menubar.Menu>
			<Menubar.Trigger class="px-3 py-1 text-xs">File</Menubar.Trigger>
			<Menubar.Content>
				<Menubar.Item onclick={handleNewFile}>
					New File <Menubar.Shortcut>⌘N</Menubar.Shortcut>
				</Menubar.Item>
				<Menubar.Item onclick={handleOpenFolder}>
					Open Folder <Menubar.Shortcut>⌘O</Menubar.Shortcut>
				</Menubar.Item>
				<Menubar.Separator />
				<Menubar.Item onclick={handleSave}>
					Save <Menubar.Shortcut>⌘S</Menubar.Shortcut>
				</Menubar.Item>
				<Menubar.Item onclick={handleSaveAs}>
					Save As... <Menubar.Shortcut>⇧⌘S</Menubar.Shortcut>
				</Menubar.Item>
				<Menubar.Separator />
				<Menubar.Item onclick={handleGoToDashboard}>Go to Dashboard</Menubar.Item>
			</Menubar.Content>
		</Menubar.Menu>

		<!-- Edit Menu -->
		<Menubar.Menu>
			<Menubar.Trigger class="px-3 py-1 text-xs">Edit</Menubar.Trigger>
			<Menubar.Content>
				<Menubar.Item onclick={handleUndo}>
					Undo <Menubar.Shortcut>⌘Z</Menubar.Shortcut>
				</Menubar.Item>
				<Menubar.Item onclick={handleRedo}>
					Redo <Menubar.Shortcut>⇧⌘Z</Menubar.Shortcut>
				</Menubar.Item>
				<Menubar.Separator />
				<Menubar.Item onclick={handleFind}>
					Find <Menubar.Shortcut>⌘F</Menubar.Shortcut>
				</Menubar.Item>
				<Menubar.Item onclick={handleReplace}>
					Replace <Menubar.Shortcut>⌘H</Menubar.Shortcut>
				</Menubar.Item>
				<Menubar.Separator />
				<Menubar.Item>
					Cut <Menubar.Shortcut>⌘X</Menubar.Shortcut>
				</Menubar.Item>
				<Menubar.Item>
					Copy <Menubar.Shortcut>⌘C</Menubar.Shortcut>
				</Menubar.Item>
				<Menubar.Item>
					Paste <Menubar.Shortcut>⌘V</Menubar.Shortcut>
				</Menubar.Item>
			</Menubar.Content>
		</Menubar.Menu>

		<!-- View Menu -->
		<Menubar.Menu>
			<Menubar.Trigger class="px-3 py-1 text-xs">View</Menubar.Trigger>
			<Menubar.Content>
				<Menubar.CheckboxItem bind:checked={showSidebarChecked} onclick={handleToggleSidebar}>
					Show Sidebar <Menubar.Shortcut>⌘B</Menubar.Shortcut>
				</Menubar.CheckboxItem>
				<Menubar.CheckboxItem bind:checked={showTerminalChecked} onclick={handleToggleTerminal}>
					Show Terminal <Menubar.Shortcut>⌘`</Menubar.Shortcut>
				</Menubar.CheckboxItem>
				<Menubar.CheckboxItem
					bind:checked={showRightSidebarChecked}
					onclick={handleToggleRightSidebar}
				>
					Show Chat <Menubar.Shortcut>⇧⌘E</Menubar.Shortcut>
				</Menubar.CheckboxItem>
				<Menubar.Separator />
				<Menubar.Item>
					Command Palette <Menubar.Shortcut>⇧⌘P</Menubar.Shortcut>
				</Menubar.Item>
				<Menubar.Separator />
				<Menubar.Item>
					Toggle Zen Mode <Menubar.Shortcut>⌘K Z</Menubar.Shortcut>
				</Menubar.Item>
			</Menubar.Content>
		</Menubar.Menu>

		<!-- Project Menu -->
		<Menubar.Menu>
			<Menubar.Trigger class="px-3 py-1 text-xs">Project</Menubar.Trigger>
			<Menubar.Content>
				<Menubar.Item onclick={handleProjectSettings}>Project Settings</Menubar.Item>
				<Menubar.Separator />
				<Menubar.Item>
					Build Project <Menubar.Shortcut>⌘⇧B</Menubar.Shortcut>
				</Menubar.Item>
				<Menubar.Item>
					Run Project <Menubar.Shortcut>⌘R</Menubar.Shortcut>
				</Menubar.Item>
				<Menubar.Separator />
				<Menubar.Item>Clean Cache</Menubar.Item>
			</Menubar.Content>
		</Menubar.Menu>

		<!-- Help Menu -->
		<Menubar.Menu>
			<Menubar.Trigger class="px-3 py-1 text-xs">Help</Menubar.Trigger>
			<Menubar.Content>
				<Menubar.Item>Documentation</Menubar.Item>
				<Menubar.Item>Keyboard Shortcuts</Menubar.Item>
				<Menubar.Separator />
				<Menubar.Item>About Aura IDE</Menubar.Item>
			</Menubar.Content>
		</Menubar.Menu>

		<!-- Project Name Display -->
		<div class="ml-auto flex items-center px-4 text-xs text-muted-foreground">
			{project?.name || 'Untitled Project'}
		</div>
	</Menubar.Root>
</div>
