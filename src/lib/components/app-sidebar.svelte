<script lang="ts">
	import { goto } from '$app/navigation';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import {
		BarChart3,
		Cloud,
		Code,
		FileText,
		FolderOpen,
		Home,
		LogOut,
		Search,
		Settings,
		Terminal,
		User
	} from 'lucide-svelte';

	// Menu items for the sidebar
	const mainItems = [
		{
			title: 'Dashboard',
			url: '/dashboard',
			icon: Home
		},
		{
			title: 'Projects',
			url: '/projects',
			icon: FolderOpen
		},
		{
			title: 'Sessions',
			url: '/sessions',
			icon: Cloud
		},
		{
			title: 'Editor',
			url: '/editor',
			icon: Code
		},
		{
			title: 'Terminal',
			url: '/terminal',
			icon: Terminal
		},
		{
			title: 'Search',
			url: '/search',
			icon: Search
		}
	];

	const toolsItems = [
		{
			title: 'Analytics',
			url: '/analytics',
			icon: BarChart3
		},
		{
			title: 'Documentation',
			url: '/docs',
			icon: FileText
		},
		{
			title: 'Settings',
			url: '/settings',
			icon: Settings
		}
	];

	function logout() {
		localStorage.removeItem('accessToken');
		goto('/auth/login');
	}
</script>

<Sidebar.Root>
	<Sidebar.Header>
		<div class="flex items-center gap-2 px-4 py-2">
			<div
				class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
			>
				<Code class="h-4 w-4" />
			</div>
			<div class="flex flex-col">
				<span class="text-sm font-semibold">Aura IDE</span>
				<span class="text-xs text-muted-foreground">v1.0.0</span>
			</div>
		</div>
	</Sidebar.Header>

	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.GroupLabel>Main</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each mainItems as item (item.title)}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton onclick={() => goto(item.url)}>
								{#snippet child({ props })}
									<a href={item.url} {...props}>
										<item.icon />
										<span>{item.title}</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>

		<Sidebar.Separator />

		<Sidebar.Group>
			<Sidebar.GroupLabel>Tools</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each toolsItems as item (item.title)}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton onclick={() => goto(item.url)}>
								{#snippet child({ props })}
									<a href={item.url} {...props}>
										<item.icon />
										<span>{item.title}</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>

	<Sidebar.Footer>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton>
					{#snippet child({ props })}
						<button {...props} class="w-full">
							<User />
							<span>Profile</span>
						</button>
					{/snippet}
				</Sidebar.MenuButton>
				<Sidebar.MenuAction onclick={logout}>
					<LogOut />
					<span class="sr-only">Logout</span>
				</Sidebar.MenuAction>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Footer>
</Sidebar.Root>
