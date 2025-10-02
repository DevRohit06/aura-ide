<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	// Component imports
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import ThemeToggle from '$lib/components/theme-toggle.svelte';
	import * as Avatar from '$lib/components/ui/avatar/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	// Store imports
	import { user } from '$lib/stores/auth';

	// Icon imports
	import {
		Bell,
		Code,
		Command as CommandIcon,
		FolderOpen,
		HelpCircle,
		Home,
		Plus,
		Search,
		Settings,
		Terminal,
		X
	} from 'lucide-svelte';

	let { children } = $props();

	// State variables
	let searchOpen = $state(false);
	let commandOpen = $state(false);
	let notificationsOpen = $state(false);
	let searchValue = $state('');

	// Mock notifications
	let notifications = $state([
		{
			id: '1',
			title: 'Project deployed successfully',
			message: 'Your React app is now live on production',
			time: '2m ago',
			type: 'success',
			unread: true
		},
		{
			id: '2',
			title: 'Build failed',
			message: 'TypeScript compilation error in components/Header.tsx',
			time: '15m ago',
			type: 'error',
			unread: true
		},
		{
			id: '3',
			title: 'New collaborator added',
			message: 'John Doe joined your workspace',
			time: '1h ago',
			type: 'info',
			unread: false
		}
	]);

	// Command palette items
	const commands = [
		{ label: 'Go to Dashboard', value: 'dashboard', icon: Home, action: () => goto('/dashboard') },
		{
			label: 'New Project',
			value: 'new-project',
			icon: Plus,
			action: () => goto('/project-setup')
		},
		{ label: 'Open Editor', value: 'editor', icon: Code, action: () => goto('/editor') },
		{
			label: 'View Projects',
			value: 'projects',
			icon: FolderOpen,
			action: () => goto('/projects')
		},
		{ label: 'Open Terminal', value: 'terminal', icon: Terminal, action: () => goto('/terminal') },
		{ label: 'Settings', value: 'settings', icon: Settings, action: () => goto('/settings') },
		{ label: 'Help & Documentation', value: 'help', icon: HelpCircle, action: () => goto('/docs') }
	];

	// Generate breadcrumbs based on current route
	// Derived state using Svelte 5 $derived runes
	const breadcrumbs = $derived.by(() => {
		const segments = $page.url.pathname.split('/').filter(Boolean);
		const items = [{ label: 'Dashboard', href: '/dashboard' }];

		if (segments.length > 1) {
			for (let i = 1; i < segments.length; i++) {
				const segment = segments[i];
				const href = '/' + segments.slice(0, i + 1).join('/');
				const label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
				items.push({ label, href });
			}
		}

		return items;
	});

	const unreadCount = $derived(notifications.filter((n) => n.unread).length);
	const filteredCommands = $derived(
		commands.filter((cmd) => cmd.label.toLowerCase().includes(searchValue.toLowerCase()))
	);

	// Enhanced keyboard shortcuts with proper Svelte 5 patterns
	onMount(() => {
		const handleKeydown = (e: KeyboardEvent) => {
			// Command palette shortcut
			if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
				e.preventDefault();
				commandOpen = true;
				searchValue = '';
				return;
			}

			// Search shortcut
			if ((e.metaKey || e.ctrlKey) && e.key === '/') {
				e.preventDefault();
				searchOpen = true;
				return;
			}

			// Escape to close modals
			if (e.key === 'Escape') {
				if (commandOpen || searchOpen || notificationsOpen) {
					e.preventDefault();
					commandOpen = false;
					searchOpen = false;
					notificationsOpen = false;
					searchValue = '';
				}
				return;
			}
		};

		document.addEventListener('keydown', handleKeydown);

		return () => {
			document.removeEventListener('keydown', handleKeydown);
		};
	});

	// Enhanced notification management
	function markAllAsRead(): void {
		notifications = notifications.map((n) => ({ ...n, unread: false }));
	}

	function removeNotification(id: string): void {
		if (!id) return;
		notifications = notifications.filter((n) => n.id !== id);
	}

	function clearAllNotifications(): void {
		notifications = [];
	}

	// Enhanced command execution with error handling
	function executeCommand(command: (typeof commands)[0]): void {
		if (!command?.action) return;

		try {
			commandOpen = false;
			searchValue = '';
			command.action();
		} catch (error) {
			console.error('Failed to execute command:', error);
			// Could add a toast notification here
		}
	}

	// Close all modals
	function closeAllModals(): void {
		commandOpen = false;
		searchOpen = false;
		notificationsOpen = false;
		searchValue = '';
	}
</script>

<div class="flex h-screen bg-background">
	<Sidebar.Provider>
		<AppSidebar />

		<Sidebar.Inset class="flex flex-col">
			<!-- Enhanced Professional Header -->
			<header
				class="sticky top-0 z-50 w-full border-b bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/60"
			>
				<div class="flex items-center px-6 py-2">
					<div class="flex flex-1 items-center gap-4">
						<Sidebar.Trigger class="lg:hidden" />

						<!-- Enhanced Breadcrumbs -->
						<Breadcrumb.Root class="hidden md:flex">
							<Breadcrumb.List>
								{#each breadcrumbs as item, index (item.href)}
									{#if index > 0}
										<Breadcrumb.Separator class="text-muted-foreground/50" />
									{/if}
									<Breadcrumb.Item>
										{#if index === breadcrumbs.length - 1}
											<Breadcrumb.Page class="font-medium">{item.label}</Breadcrumb.Page>
										{:else}
											<Breadcrumb.Link
												href={item.href}
												class="text-muted-foreground transition-colors hover:text-foreground"
											>
												{item.label}
											</Breadcrumb.Link>
										{/if}
									</Breadcrumb.Item>
								{/each}
							</Breadcrumb.List>
						</Breadcrumb.Root>
					</div>

					<!-- Enhanced Right side controls -->
					<div class="flex items-center gap-2">
						<!-- Command Palette -->
						<Tooltip.Provider>
							<Tooltip.Root>
								<Tooltip.Trigger>
									<Button
										variant="ghost"
										size="sm"
										class="relative h-9 w-9 p-0 transition-colors hover:bg-accent"
										onclick={() => {
											commandOpen = true;
											searchValue = '';
										}}
									>
										<CommandIcon class="h-4 w-4" />
										<span class="sr-only">Command palette</span>
									</Button>
								</Tooltip.Trigger>
								<Tooltip.Content>
									<p>
										Command Palette <kbd
											class="pointer-events-none inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground select-none"
											>⌘K</kbd
										>
									</p>
								</Tooltip.Content>
							</Tooltip.Root>
						</Tooltip.Provider>

						<!-- Quick Search -->
						<Tooltip.Provider>
							<Tooltip.Root>
								<Tooltip.Trigger>
									<Button
										variant="ghost"
										size="sm"
										class="relative h-9 w-9 p-0 transition-colors hover:bg-accent"
										onclick={() => {
											searchOpen = true;
										}}
									>
										<Search class="h-4 w-4" />
										<span class="sr-only">Search</span>
									</Button>
								</Tooltip.Trigger>
								<Tooltip.Content>
									<p>
										Search <kbd
											class="pointer-events-none inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground select-none"
											>⌘/</kbd
										>
									</p>
								</Tooltip.Content>
							</Tooltip.Root>
						</Tooltip.Provider>

						<!-- Enhanced Notifications -->
						<DropdownMenu.Root bind:open={notificationsOpen}>
							<DropdownMenu.Trigger>
								<Button
									variant="ghost"
									size="sm"
									class="relative h-9 w-9 p-0 transition-colors hover:bg-accent"
								>
									<Bell class="h-4 w-4" />
									{#if unreadCount > 0}
										<Badge
											variant="destructive"
											class="absolute -top-1 -right-1 h-5 w-5 animate-pulse rounded-full p-0 text-xs"
										>
											{unreadCount}
										</Badge>
									{/if}
									<span class="sr-only">Notifications</span>
								</Button>
							</DropdownMenu.Trigger>
							<DropdownMenu.Content align="end" class="w-80">
								<div class="flex items-center justify-between p-4">
									<h4 class="font-semibold">Notifications</h4>
									{#if unreadCount > 0}
										<Button variant="ghost" size="sm" onclick={markAllAsRead} class="text-xs">
											Mark all read
										</Button>
									{/if}
								</div>
								<Separator />
								<div class="max-h-80 overflow-y-auto">
									{#each notifications as notification (notification.id)}
										<div
											class="flex items-start gap-3 p-4 transition-colors hover:bg-accent/50 {notification.unread
												? 'bg-accent/20'
												: ''}"
										>
											<div class="mt-1 flex-shrink-0">
												{#if notification.type === 'success'}
													<div class="h-2 w-2 rounded-full bg-green-500"></div>
												{:else if notification.type === 'error'}
													<div class="h-2 w-2 rounded-full bg-red-500"></div>
												{:else}
													<div class="h-2 w-2 rounded-full bg-blue-500"></div>
												{/if}
											</div>
											<div class="flex-1 space-y-1">
												<p class="text-sm leading-none font-medium">{notification.title}</p>
												<p class="text-sm text-muted-foreground">{notification.message}</p>
												<p class="text-xs text-muted-foreground">{notification.time}</p>
											</div>
											<Button
												variant="ghost"
												size="sm"
												class="h-6 w-6 p-0 opacity-50 hover:opacity-100"
												onclick={() => removeNotification(notification.id)}
											>
												<X class="h-3 w-3" />
											</Button>
										</div>
									{/each}
									{#if notifications.length === 0}
										<div class="p-8 text-center text-muted-foreground">
											<Bell class="mx-auto mb-2 h-8 w-8 opacity-50" />
											<p class="text-sm">No notifications</p>
										</div>
									{/if}
								</div>
							</DropdownMenu.Content>
						</DropdownMenu.Root>

						<!-- Theme Toggle -->
						<ThemeToggle />

						<Separator orientation="vertical" class="h-6" />

						<!-- Enhanced User Avatar -->
						<Tooltip.Provider>
							<Tooltip.Root>
								<Tooltip.Trigger>
									<Avatar.Root
										class="h-8 w-8 cursor-pointer transition-all hover:ring-2 hover:ring-primary/20"
									>
										<Avatar.Image src={$user?.profile?.avatar} alt={$user?.name || 'User'} />
										<Avatar.Fallback class="bg-primary/10 text-xs font-medium text-primary">
											{($user?.name || $user?.username || 'U').charAt(0).toUpperCase()}
										</Avatar.Fallback>
									</Avatar.Root>
								</Tooltip.Trigger>
								<Tooltip.Content>
									<p>{$user?.profile?.firstName || $user?.name || $user?.username || 'User'}</p>
								</Tooltip.Content>
							</Tooltip.Root>
						</Tooltip.Provider>
					</div>
				</div>
			</header>

			<!-- Main Content Area -->
			<main class="flex-1 overflow-auto bg-muted/20">
				{@render children?.()}
			</main>
		</Sidebar.Inset>
	</Sidebar.Provider>
</div>

<!-- Enhanced Command Palette -->
<Dialog.Root bind:open={commandOpen}>
	<Dialog.Content class="max-w-lg p-0">
		<Command.Root class="rounded-lg border shadow-md">
			<Command.Input
				bind:value={searchValue}
				placeholder="Type a command or search..."
				class="border-0 focus:ring-0"
			/>
			<Command.List class="max-h-80">
				<Command.Empty>No results found.</Command.Empty>
				<Command.Group heading="Navigation">
					{#each filteredCommands as command (command.value)}
						<Command.Item
							value={command.value}
							onSelect={() => executeCommand(command)}
							class="flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors hover:bg-accent"
						>
							{@const Icon = command.icon}
							<Icon class="h-4 w-4" />
							<span>{command.label}</span>
							<kbd
								class="pointer-events-none ml-auto inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 select-none"
							>
								{#if command.value === 'dashboard'}
									⌘H
								{:else if command.value === 'new-project'}
									⌘N
								{:else if command.value === 'editor'}
									⌘E
								{:else if command.value === 'terminal'}
									⌘T
								{:else if command.value === 'settings'}
									⌘,
								{/if}
							</kbd>
						</Command.Item>
					{/each}
				</Command.Group>
			</Command.List>
		</Command.Root>
	</Dialog.Content>
</Dialog.Root>

<!-- Quick Search Dialog -->
<Dialog.Root bind:open={searchOpen}>
	<Dialog.Content class="max-w-2xl">
		<Dialog.Header>
			<Dialog.Title>Search Workspace</Dialog.Title>
			<Dialog.Description>
				Search across your projects, files, and documentation.
			</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4">
			<Input placeholder="Search projects, files, code..." class="w-full" autofocus />
			<div class="text-sm text-muted-foreground">
				<p>
					Use <kbd
						class="pointer-events-none inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium select-none"
						>↑</kbd
					>
					<kbd
						class="pointer-events-none inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium select-none"
						>↓</kbd
					> to navigate
				</p>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
