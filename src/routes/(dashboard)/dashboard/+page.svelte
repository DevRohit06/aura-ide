<script lang="ts">
	import { goto } from '$app/navigation';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { authActions, isLoading, user } from '$lib/stores/auth';
	import { Activity, Code, FolderOpen, LogOut, Plus, Server, Settings } from 'lucide-svelte';
	import { onMount } from 'svelte';

	interface Project {
		id: string;
		name: string;
		description?: string;
		framework: string;
		status: 'ready' | 'initializing' | 'error';
		configuration: {
			typescript: boolean;
		};
	}

	let projects = $state<Project[]>([]);
	let loadingProjects = $state(true);

	onMount(async () => {
		await loadProjects();
	});

	async function loadProjects(): Promise<void> {
		try {
			loadingProjects = true;

			const response = await fetch('/api/projects');

			if (response.ok) {
				const data = await response.json();
				projects = data.projects || [];
			} else if (response.status === 401) {
				// Not authenticated, redirect to login
				await goto('/auth/login');
			}
		} catch (error) {
			console.error('Error loading projects:', error);
		} finally {
			loadingProjects = false;
		}
	}

	async function logout(): Promise<void> {
		await authActions.logout();
	}

	function createNewProject(): void {
		goto('/project-setup');
	}

	function openProject(projectId: string): void {
		goto(`/editor/${projectId}`);
	}

	function getFrameworkColor(framework: string): string {
		const colors = {
			react: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
			nextjs: 'bg-black text-white dark:bg-gray-800 dark:text-gray-200',
			svelte: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
			vue: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
			angular: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
		};
		return colors[framework] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
	}
</script>

{#if $isLoading}
	<div class="flex min-h-screen items-center justify-center">
		<div class="text-center">
			<div class="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
			<p class="mt-4 text-gray-600 dark:text-gray-400">Loading your dashboard...</p>
		</div>
	</div>
{:else}
	<header class="flex h-16 shrink-0 items-center gap-2 border-b px-4">
		<Sidebar.Trigger class="-ml-1" />
		<div class="flex items-center gap-2">
			<h1 class="text-lg font-semibold">Dashboard</h1>
		</div>
		<div class="ml-auto flex items-center gap-2">
			<span class="text-sm text-muted-foreground">
				Welcome back, {$user?.profile?.firstName || $user?.name || $user?.username || 'User'}!
			</span>
			<Button variant="outline" size="sm" onclick={logout}>
				<LogOut class="mr-2 h-4 w-4" />
				Logout
			</Button>
		</div>
	</header>

	<main class="flex-1 space-y-6 p-6">
		<!-- Welcome Section -->
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-3xl font-bold tracking-tight">Welcome to Aura IDE</h2>
				<p class="text-muted-foreground">
					Manage your projects and start building amazing applications.
				</p>
			</div>
			<Button onclick={createNewProject} size="lg">
				<Plus class="mr-2 h-4 w-4" />
				New Project
			</Button>
		</div>

		<!-- Stats Cards -->
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			<Card>
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium">Total Projects</CardTitle>
					<FolderOpen class="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold">{projects.length}</div>
					<p class="text-xs text-muted-foreground">
						{projects.filter((p) => p.status === 'ready').length} active
					</p>
				</CardContent>
			</Card>
			<Card>
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium">Active Sessions</CardTitle>
					<Activity class="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold">
						{projects.filter((p) => p.status === 'ready').length}
					</div>
					<p class="text-xs text-muted-foreground">Currently running</p>
				</CardContent>
			</Card>
			<Card>
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium">Default Framework</CardTitle>
					<Code class="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold">
						{$user?.preferences?.defaultFramework || 'React'}
					</div>
					<p class="text-xs text-muted-foreground">Your preference</p>
				</CardContent>
			</Card>
			<Card>
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium">Storage Used</CardTitle>
					<Server class="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold">2.4GB</div>
					<p class="text-xs text-muted-foreground">Of 10GB available</p>
				</CardContent>
			</Card>
		</div>

		<!-- Projects Section -->
		<div class="space-y-4">
			<div class="flex items-center justify-between">
				<h3 class="text-2xl font-bold tracking-tight">Your Projects</h3>
				<Button variant="outline" onclick={() => goto('/projects')}>View All</Button>
			</div>

			{#if projects.length === 0}
				<Card class="py-12">
					<CardContent class="text-center">
						<FolderOpen class="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
						<h3 class="mb-2 text-lg font-medium">No projects yet</h3>
						<p class="mb-6 text-muted-foreground">
							Create your first project to start building amazing applications
						</p>
						<Button onclick={createNewProject}>
							<Plus class="mr-2 h-4 w-4" />
							Create Your First Project
						</Button>
					</CardContent>
				</Card>
			{:else}
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each projects.slice(0, 6) as project (project.id)}
						<Card
							class="cursor-pointer transition-shadow hover:shadow-md"
							onclick={() => openProject(project.id)}
						>
							<CardHeader>
								<div class="flex items-start justify-between">
									<div class="space-y-1">
										<CardTitle class="text-lg">{project.name}</CardTitle>
										{#if project.description}
											<CardDescription class="line-clamp-2">{project.description}</CardDescription>
										{/if}
									</div>
									<Badge class={getFrameworkColor(project.framework)} variant="secondary">
										{project.framework}
									</Badge>
								</div>
							</CardHeader>
							<CardContent>
								<div class="flex items-center justify-between">
									<div class="flex gap-2">
										{#if project.configuration.typescript}
											<Badge variant="outline">TypeScript</Badge>
										{/if}
									</div>
									<div class="text-sm text-muted-foreground">
										{#if project.status === 'ready'}
											<span class="inline-flex items-center gap-1 text-green-600">
												<div class="h-2 w-2 rounded-full bg-green-600"></div>
												Ready
											</span>
										{:else if project.status === 'initializing'}
											<span class="inline-flex items-center gap-1 text-yellow-600">
												<div class="h-2 w-2 rounded-full bg-yellow-600"></div>
												Setting up
											</span>
										{:else}
											<span class="inline-flex items-center gap-1 text-red-600">
												<div class="h-2 w-2 rounded-full bg-red-600"></div>
												Error
											</span>
										{/if}
									</div>
								</div>
							</CardContent>
						</Card>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Quick Actions -->
		<div class="space-y-4">
			<h3 class="text-2xl font-bold tracking-tight">Quick Actions</h3>
			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Card class="cursor-pointer transition-colors hover:bg-muted/50" onclick={createNewProject}>
					<CardContent class="flex flex-col items-center justify-center p-6">
						<Plus class="mb-2 h-8 w-8 text-muted-foreground" />
						<span class="text-sm font-medium">New Project</span>
					</CardContent>
				</Card>
				<Card
					class="cursor-pointer transition-colors hover:bg-muted/50"
					onclick={() => goto('/templates')}
				>
					<CardContent class="flex flex-col items-center justify-center p-6">
						<Code class="mb-2 h-8 w-8 text-muted-foreground" />
						<span class="text-sm font-medium">Browse Templates</span>
					</CardContent>
				</Card>
				<Card
					class="cursor-pointer transition-colors hover:bg-muted/50"
					onclick={() => goto('/settings')}
				>
					<CardContent class="flex flex-col items-center justify-center p-6">
						<Settings class="mb-2 h-8 w-8 text-muted-foreground" />
						<span class="text-sm font-medium">Settings</span>
					</CardContent>
				</Card>
				<Card
					class="cursor-pointer transition-colors hover:bg-muted/50"
					onclick={() => goto('/docs')}
				>
					<CardContent class="flex flex-col items-center justify-center p-6">
						<Server class="mb-2 h-8 w-8 text-muted-foreground" />
						<span class="text-sm font-medium">Documentation</span>
					</CardContent>
				</Card>
			</div>
		</div>
	</main>
{/if}
