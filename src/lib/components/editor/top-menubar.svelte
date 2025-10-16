<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Menubar from '$lib/components/ui/menubar/index.js';
	import { Switch } from '$lib/components/ui/switch';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { fileActions, tabActions } from '$lib/stores/editor.js';
	import { sidebarPanelActions, sidebarPanelsStore } from '$lib/stores/sidebar-panels.store';
	import GlobeIcon from '@lucide/svelte/icons/globe';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
	import SearchIcon from '@lucide/svelte/icons/search';

	let {
		project,
		browserMode = $bindable(false),
		onOpenCommandPalette
	} = $props<{
		project: any;
		browserMode?: boolean;
		onOpenCommandPalette?: () => void;
	}>();

	// Menu state
	let showSidebarChecked = $state(true);
	let showTerminalChecked = $state(true);
	let showRightSidebarChecked = $state(true);

	// Reactive state for chat sidebar visibility
	let chatSidebarVisible = $derived($sidebarPanelsStore.panels.rightSidebarVisible);

	function toggleBrowserMode() {
		browserMode = !browserMode;
	}

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

	function handleOpenCommandPalette() {
		onOpenCommandPalette?.();
	}

	function handleToggleChatSidebar() {
		sidebarPanelActions.toggleRightSidebar();
	}

	function handleProjectSettings() {
		console.log('Project settings');
	}
</script>

<div class="flex w-full justify-between border-b bg-background">
	<Menubar.Root class="flex items-center border-none">
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
	</Menubar.Root>

	<!-- Central Search Button -->
	<div class="mx-4 flex max-w-lg flex-1 items-center justify-center">
		<Button
			variant="outline"
			size="sm"
			onclick={handleOpenCommandPalette}
			class="h-6 min-w-[320px] justify-start px-3 text-xs text-muted-foreground hover:text-foreground"
			title="Open Command Palette (⇧⌘P)"
		>
			<SearchIcon class="mr-2 h-2 w-2" />
			Search files, symbols, and code...
		</Button>
	</div>

	<!-- Right Side Controls -->
	<div class="flex items-center gap-2">
		<!-- Chat Toggle Button -->
		<Button
			variant={chatSidebarVisible ? 'default' : 'ghost'}
			size="sm"
			onclick={handleToggleChatSidebar}
			class="h-8 px-2"
			title="Toggle Chat Sidebar"
		>
			<MessageSquareIcon class="h-4 w-4" />
		</Button>

		<!-- Project Name Display -->
		<div class="px-4 text-xs text-muted-foreground">
			{project?.name || 'Untitled Project'}
		</div>

		<!-- Browser Mode Toggle -->
		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger>
					<div class="flex items-center gap-2 border-l pl-3">
						<GlobeIcon class="h-3.5 w-3.5 text-muted-foreground" />
						<Switch checked={browserMode} onCheckedChange={toggleBrowserMode} />
					</div>
				</Tooltip.Trigger>
				<Tooltip.Content>
					<p>Toggle Browser Preview Mode</p>
				</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
	</div>
</div>
