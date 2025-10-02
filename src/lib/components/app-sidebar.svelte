<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import * as Avatar from '$lib/components/ui/avatar/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { authActions, user } from '$lib/stores/auth';
	import {
		BarChart3,
		ChevronDown,
		Cloud,
		Code,
		CreditCard,
		Database,
		FileText,
		FolderOpen,
		GitBranch,
		HelpCircle,
		Home,
		LogOut,
		Settings,
		Terminal,
		User,
		Zap
	} from 'lucide-svelte';

	// Main navigation items
	const mainItems = [
		{
			title: 'Dashboard',
			url: '/dashboard',
			icon: Home,
			description: 'Overview and analytics'
		},
		{
			title: 'Projects',
			url: '/projects',
			icon: FolderOpen,
			description: 'Manage your projects'
		},
		{
			title: 'Editor',
			url: '/editor',
			icon: Code,
			description: 'Code editor workspace'
		},
		{
			title: 'Terminal',
			url: '/terminal',
			icon: Terminal,
			description: 'Command line interface'
		}
	];

	// Development tools
	const devTools = [
		{
			title: 'Sessions',
			url: '/sessions',
			icon: Cloud,
			description: 'Active development sessions'
		},
		{
			title: 'Database',
			url: '/database',
			icon: Database,
			description: 'Database management'
		},
		{
			title: 'Git',
			url: '/git',
			icon: GitBranch,
			description: 'Version control'
		},
		{
			title: 'Analytics',
			url: '/analytics',
			icon: BarChart3,
			description: 'Performance metrics'
		}
	];

	// System and settings
	const systemItems = [
		{
			title: 'Documentation',
			url: '/docs',
			icon: FileText,
			description: 'Help and guides'
		},
		{
			title: 'Settings',
			url: '/settings',
			icon: Settings,
			description: 'Application settings'
		}
	];

	// Check if current path is active
	function isActive(url: string): boolean {
		return $page.url.pathname === url || $page.url.pathname.startsWith(url + '/');
	}

	async function logout(): Promise<void> {
		await authActions.logout();
		goto('/auth/login');
	}

	function navigateTo(url: string): void {
		goto(url);
	}
</script>

<Sidebar.Root class="border-r">
	<!-- Header with Logo and Branding -->
	<Sidebar.Header class="border-b bg-sidebar/50">
		<div class="flex items-center gap-2.5 px-3 py-2">
			<img src="/aura.png" alt="Logo" class="h-5 w-5" />
			<div class="flex flex-col">
				<span class="text-sm font-semibold tracking-tight">Aura IDE</span>
			</div>
		</div>
	</Sidebar.Header>

	<Sidebar.Content class="flex flex-col gap-1 p-2">
		<!-- Main Navigation -->
		<Sidebar.Group>
			<Sidebar.GroupLabel
				class="mb-1 px-2 text-xs font-medium tracking-wide text-muted-foreground/70 uppercase"
			>
				Main
			</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each mainItems as item (item.title)}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton
								class="group relative w-full transition-all duration-200 {isActive(item.url)
									? 'border border-primary/20 bg-primary/10 text-primary'
									: 'hover:bg-accent/50'}"
								onclick={() => navigateTo(item.url)}
							>
								{#snippet child({ props })}
									<a
										href={item.url}
										{...props}
										class="flex w-full items-center gap-2.5 rounded-lg p-2"
									>
										<item.icon class="h-4 w-4 shrink-0" />
										<span class="truncate text-sm font-medium">{item.title}</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>

		<Sidebar.Separator class="my-1" />

		<!-- Development Tools -->
		<Sidebar.Group>
			<Sidebar.GroupLabel
				class="mb-1 px-2 text-xs font-medium tracking-wide text-muted-foreground/70 uppercase"
			>
				Development
			</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each devTools as item (item.title)}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton
								class="group w-full transition-all duration-200 {isActive(item.url)
									? 'border border-primary/20 bg-primary/10 text-primary'
									: 'hover:bg-accent/50'}"
								onclick={() => navigateTo(item.url)}
							>
								{#snippet child({ props })}
									<a
										href={item.url}
										{...props}
										class="flex w-full items-center gap-2.5 rounded-lg p-2"
									>
										<item.icon class="h-4 w-4 shrink-0" />
										<span class="truncate text-sm font-medium">{item.title}</span>
										{#if item.title === 'Sessions'}
											<Badge variant="secondary" class="ml-auto shrink-0 text-xs">3</Badge>
										{/if}
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>

		<Sidebar.Separator class="my-1" />

		<!-- System & Settings -->
		<Sidebar.Group>
			<Sidebar.GroupLabel
				class="mb-1 px-2 text-xs font-medium tracking-wide text-muted-foreground/70 uppercase"
			>
				System
			</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each systemItems as item (item.title)}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton
								class="group w-full transition-all duration-200 {isActive(item.url)
									? 'border border-primary/20 bg-primary/10 text-primary'
									: 'hover:bg-accent/50'}"
								onclick={() => navigateTo(item.url)}
							>
								{#snippet child({ props })}
									<a
										href={item.url}
										{...props}
										class="flex w-full items-center gap-2.5 rounded-lg p-2"
									>
										<item.icon class="h-4 w-4 shrink-0" />
										<span class="truncate text-sm font-medium">{item.title}</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>

		<!-- Spacer -->
		<div class="flex-1"></div>

		<!-- Upgrade Section -->
		<div class="mx-2 mb-1">
			<div
				class="rounded-lg border border-primary/20 bg-gradient-to-r from-primary/10 to-primary/5 p-2.5"
			>
				<div class="mb-1.5 flex items-center gap-2">
					<Zap class="h-3.5 w-3.5 text-primary" />
					<span class="text-xs font-semibold">Upgrade to Pro</span>
				</div>
				<p class="mb-2 text-xs leading-tight text-muted-foreground">
					Unlimited projects & features
				</p>
				<Button size="sm" class="h-7 w-full text-xs">Upgrade Now</Button>
			</div>
		</div>
	</Sidebar.Content>

	<!-- Enhanced Footer with User Profile -->
	<Sidebar.Footer class="border-t bg-sidebar/50 p-1.5">
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger class="w-full">
						<Sidebar.MenuButton class="w-full ">
							{#snippet child({ props })}
								<button
									{...props}
									class="flex w-full items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-accent/50"
								>
									<Avatar.Root class="h-7 w-7">
										<Avatar.Image src={$user?.image} alt={$user?.name || 'User'} />
										<Avatar.Fallback class="bg-primary/10 text-xs font-medium text-primary">
											{($user?.name || $user?.username || 'U').charAt(0).toUpperCase()}
										</Avatar.Fallback>
									</Avatar.Root>
									<div class="flex w-full flex-1 flex-col items-start">
										<span class="truncate text-sm font-medium">
											{$user?.profile?.firstName || $user?.name || $user?.username || 'User'}
										</span>
										<!-- <span class="truncate text-xs text-muted-foreground">
											{$user?.email || 'user@example.com'}
										</span> -->
									</div>
									<ChevronDown class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
								</button>
							{/snippet}
						</Sidebar.MenuButton>
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" sideOffset={8} class="w-56">
						<DropdownMenu.Label class="font-normal">
							<div class="flex flex-col space-y-1">
								<p class="text-sm leading-none font-medium">
									{$user?.profile?.firstName || $user?.name || $user?.username || 'User'}
								</p>
								<p class="text-xs leading-none text-muted-foreground">
									{$user?.email || 'user@example.com'}
								</p>
							</div>
						</DropdownMenu.Label>
						<DropdownMenu.Separator />
						<DropdownMenu.Item onclick={() => navigateTo('/profile')} class="cursor-pointer">
							<User class="mr-2 h-4 w-4" />
							Profile
						</DropdownMenu.Item>
						<DropdownMenu.Item onclick={() => navigateTo('/billing')} class="cursor-pointer">
							<CreditCard class="mr-2 h-4 w-4" />
							Billing
						</DropdownMenu.Item>
						<DropdownMenu.Item onclick={() => navigateTo('/settings')} class="cursor-pointer">
							<Settings class="mr-2 h-4 w-4" />
							Settings
						</DropdownMenu.Item>
						<DropdownMenu.Item onclick={() => navigateTo('/help')} class="cursor-pointer">
							<HelpCircle class="mr-2 h-4 w-4" />
							Help & Support
						</DropdownMenu.Item>
						<DropdownMenu.Separator />
						<DropdownMenu.Item
							onclick={logout}
							class="cursor-pointer text-red-600 focus:text-red-600"
						>
							<LogOut class="mr-2 h-4 w-4" />
							Log out
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Footer>
</Sidebar.Root>
