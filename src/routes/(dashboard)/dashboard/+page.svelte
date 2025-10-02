<script lang="ts">
	import { goto } from '$app/navigation';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { isLoading, user } from '$lib/stores/auth';
	import Icon from '@iconify/svelte';
	import {
		AlertCircle,
		AlertTriangle,
		CheckCircle,
		Eye,
		FileText,
		FolderOpen,
		Loader2,
		Plus,
		RefreshCw,
		Settings
	} from 'lucide-svelte';
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
		createdAt: string;
		updatedAt: string;
	}

	// State management with Svelte 5
	let projects = $state<Project[]>([]);
	let loadingProjects = $state(true);
	let error = $state<string | null>(null);
	let refreshing = $state(false);

	// Derived state using Svelte 5 $derived
	const hasProjects = $derived(projects.length > 0);
	const activeProjectsCount = $derived(projects.filter((p) => p.status === 'ready').length);
	const errorProjectsCount = $derived(projects.filter((p) => p.status === 'error').length);

	// Load data on mount
	onMount(async () => {
		try {
			await loadProjects();
		} catch (err) {
			console.error('Error loading dashboard data:', err);
			error = 'Failed to load dashboard data. Please try refreshing.';
		}
	});

	// Auto-refresh functionality - removed as it's not needed for projects
	async function refreshData() {
		refreshing = true;
		error = null;

		try {
			await loadProjects();
		} catch (err) {
			console.error('Error refreshing data:', err);
			error = 'Failed to refresh data. Please try again.';
		} finally {
			refreshing = false;
		}
	}

	async function loadProjects(): Promise<void> {
		try {
			if (!refreshing) loadingProjects = true;
			const response = await fetch('/api/projects', {
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (response.ok) {
				const data = await response.json();
				projects =
					data.projects?.map((p: any) => ({
						...p,
						id: p.id || crypto.randomUUID()
					})) || [];
			} else if (response.status === 401) {
				await goto('/auth/login');
				return;
			} else {
				throw new Error(`Failed to fetch projects: ${response.status}`);
			}
		} catch (err) {
			console.error('Error loading projects:', err);
			if (!refreshing) {
				error = 'Failed to load projects. Please check your connection.';
			}
		} finally {
			loadingProjects = false;
		}
	}

	function createNewProject(): void {
		goto('/project-setup');
	}

	function openProject(projectId: string): void {
		goto(`/editor/${projectId}`);
	}

	function getFrameworkIcon(framework: string) {
		const icons = {
			react: 'logos:react',
			'react-ts': 'logos:react',
			nextjs: 'logos:nextjs-icon',
			'nextjs-ts': 'logos:nextjs-icon',
			svelte: 'logos:svelte-icon',
			sveltekit: 'logos:svelte-kit',
			vue: 'logos:vue',
			'vue-ts': 'logos:vue',
			angular: 'logos:angular-icon',
			node: 'logos:nodejs-icon',
			express: 'simple-icons:express',
			astro: 'logos:astro-icon',
			vite: 'logos:vitejs',
			vanilla: 'logos:javascript',
			'vanilla-ts': 'logos:typescript-icon',
			javascript: 'logos:javascript',
			typescript: 'logos:typescript-icon',
			static: 'material-symbols:web'
		};
		return icons[framework] || 'material-symbols:code';
	}

	function getFrameworkColor(framework: string): string {
		const colors = {
			react: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
			'react-ts': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
			nextjs: 'bg-black text-white dark:bg-gray-800 dark:text-gray-200',
			'nextjs-ts': 'bg-black text-white dark:bg-gray-800 dark:text-gray-200',
			svelte: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
			sveltekit: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
			vue: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
			'vue-ts': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
			angular: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
			node: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
			express: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
			astro: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
			vite: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
			vanilla: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
			'vanilla-ts': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
			javascript: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
			typescript: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
		};
		return colors[framework] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
	}

	function getActivityIcon(type: string) {
		switch (type) {
			case 'commit':
				return FileText;
			case 'deploy':
				return Settings;
			case 'create':
				return Plus;
			case 'update':
				return RefreshCw;
			default:
				return FileText;
		}
	}

	function formatTimeAgo(timestamp: string): string {
		const now = new Date();
		const time = new Date(timestamp);
		const diff = now.getTime() - time.getTime();

		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);

		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		return `${days}d ago`;
	}
</script>

{#if $isLoading}
	<div class="flex min-h-screen items-center justify-center">
		<div class="space-y-4 text-center">
			<div class="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
			<div class="space-y-2">
				<p class="text-lg font-medium">Loading your dashboard...</p>
				<p class="text-sm text-muted-foreground">Setting up your workspace</p>
			</div>
		</div>
	</div>
{:else}
	<div class="container mx-auto max-w-6xl space-y-8 p-6">
		<!-- Professional Header -->
		<div class="space-y-6">
			<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div class="space-y-2">
					<div class="flex items-center gap-3">
						<h1 class="text-3xl font-bold tracking-tight">
							Welcome back, {$user?.name || $user?.email?.split('@')[0] || 'Developer'}
						</h1>
						{#if refreshing}
							<Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
						{/if}
					</div>
					<p class="text-lg text-muted-foreground">
						Manage your development projects and start building.
					</p>
				</div>
				<div class="flex gap-2">
					<Tooltip.Provider>
						<Tooltip.Root>
							<Tooltip.Trigger>
								<Button
									variant="outline"
									size="lg"
									onclick={() => refreshData()}
									disabled={refreshing}
									class="shadow-sm"
								>
									{#if refreshing}
										<Loader2 class="mr-2 h-4 w-4 animate-spin" />
									{:else}
										<RefreshCw class="mr-2 h-4 w-4" />
									{/if}
									Refresh
								</Button>
							</Tooltip.Trigger>
							<Tooltip.Content>
								<p>Refresh projects</p>
							</Tooltip.Content>
						</Tooltip.Root>
					</Tooltip.Provider>
					<Button onclick={createNewProject} size="lg" class="shadow-lg">
						<Plus class="mr-2 h-5 w-5" />
						New Project
					</Button>
				</div>
			</div>

			<!-- Error Alert -->
			{#if error}
				<Alert.Root variant="destructive">
					<AlertCircle class="h-4 w-4" />
					<Alert.Title>Error</Alert.Title>
					<Alert.Description>{error}</Alert.Description>
				</Alert.Root>
			{/if}
		</div>

		<!-- Summary Cards -->
		<div class="grid gap-6 md:grid-cols-3">
			<!-- Total Projects -->
			<Card class="transition-all duration-200 hover:shadow-md">
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium">Total Projects</CardTitle>
					<FolderOpen class="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					{#if loadingProjects}
						<div class="space-y-3">
							<Skeleton class="h-8 w-16" />
							<Skeleton class="h-4 w-24" />
						</div>
					{:else}
						<div class="text-2xl font-bold">{projects.length}</div>
						<div class="flex items-center space-x-2 text-xs text-muted-foreground">
							<CheckCircle class="h-3 w-3 text-green-500" />
							<span>{activeProjectsCount} active</span>
							{#if errorProjectsCount > 0}
								<span class="text-red-500">• {errorProjectsCount} errors</span>
							{/if}
						</div>
					{/if}
				</CardContent>
			</Card>

			<!-- Active Projects -->
			<Card class="transition-all duration-200 hover:shadow-md">
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium">Ready Projects</CardTitle>
					<CheckCircle class="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					{#if loadingProjects}
						<div class="space-y-3">
							<Skeleton class="h-8 w-8" />
							<Skeleton class="h-4 w-28" />
						</div>
					{:else}
						<div class="text-2xl font-bold text-green-600">{activeProjectsCount}</div>
						<div class="text-xs text-muted-foreground">Projects ready for development</div>
					{/if}
				</CardContent>
			</Card>

			<!-- Quick Actions -->
			<Card class="transition-all duration-200 hover:shadow-md">
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium">Quick Start</CardTitle>
					<Plus class="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div class="space-y-2">
						<Button
							onclick={createNewProject}
							variant="outline"
							size="sm"
							class="w-full justify-start"
						>
							<Plus class="mr-2 h-4 w-4" />
							Create Project
						</Button>
						<Button
							onclick={() => goto('/docs')}
							variant="outline"
							size="sm"
							class="w-full justify-start"
						>
							<FileText class="mr-2 h-4 w-4" />
							Documentation
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>

		<!-- Projects Section -->
		<div class="space-y-6">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<h2 class="text-2xl font-bold tracking-tight">Your Projects</h2>
					{#if loadingProjects}
						<Loader2 class="h-5 w-5 animate-spin text-muted-foreground" />
					{:else if hasProjects}
						<Badge variant="secondary" class="text-xs">{projects.length}</Badge>
					{/if}
				</div>
				{#if hasProjects}
					<Button variant="outline" onclick={() => goto('/projects')} disabled={loadingProjects}>
						View All
						<Eye class="ml-2 h-4 w-4" />
					</Button>
				{/if}
			</div>

			<!-- Projects Grid -->
			{#if loadingProjects}
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each Array(6) as _, i}
						<Card class="p-6">
							<div class="space-y-4">
								<div class="flex items-start justify-between">
									<div class="flex-1 space-y-2">
										<Skeleton class="h-6 w-32" />
										<Skeleton class="h-4 w-48" />
									</div>
									<Skeleton class="h-6 w-16" />
								</div>
								<div class="flex items-center justify-between">
									<div class="flex gap-2">
										<Skeleton class="h-5 w-20" />
									</div>
									<Skeleton class="h-5 w-12" />
								</div>
								<Skeleton class="h-4 w-24" />
							</div>
						</Card>
					{/each}
				</div>
			{:else if !hasProjects}
				<Card class="py-16 transition-all duration-200 hover:shadow-md">
					<CardContent class="space-y-6 text-center">
						<div
							class="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5"
						>
							<FolderOpen class="h-10 w-10 text-primary" />
						</div>
						<div class="space-y-3">
							<h3 class="text-xl font-semibold">No projects yet</h3>
							<p class="mx-auto max-w-md text-muted-foreground">
								Create your first project to start building applications. Choose from React,
								Next.js, Svelte, Vue, Node.js, and more frameworks.
							</p>
						</div>
						<div class="flex flex-col justify-center gap-3 sm:flex-row">
							<Button onclick={createNewProject} size="lg" class="shadow-lg">
								<Plus class="mr-2 h-5 w-5" />
								Create Your First Project
							</Button>
							<Button variant="outline" onclick={() => goto('/docs')} size="lg">
								<FileText class="mr-2 h-5 w-5" />
								View Documentation
							</Button>
						</div>
					</CardContent>
				</Card>
			{:else}
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each projects.slice(0, 6) as project (project.id)}
						<Card
							class="group cursor-pointer border-2 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg active:scale-[0.98]"
							onclick={() => openProject(project.id)}
						>
							<CardHeader class="pb-3">
								<div class="flex items-start gap-3">
									<!-- Framework Icon -->
									<div
										class="flex h-12 w-12 items-center justify-center rounded-lg bg-muted/50 transition-colors group-hover:bg-primary/10"
									>
										<Icon icon={getFrameworkIcon(project.framework)} class="h-8 w-8" />
									</div>

									<div class="flex-1 space-y-1">
										<div class="flex items-center justify-between">
											<CardTitle
												class="flex items-center gap-2 text-lg transition-colors group-hover:text-primary"
											>
												{project.name}
												{#if project.status === 'ready'}
													<CheckCircle class="h-4 w-4 text-green-500" />
												{:else if project.status === 'initializing'}
													<Loader2 class="h-4 w-4 animate-spin text-yellow-500" />
												{:else}
													<AlertTriangle class="h-4 w-4 text-red-500" />
												{/if}
											</CardTitle>
											<Badge
												class={getFrameworkColor(project.framework)}
												variant="secondary"
												size="sm"
											>
												{project.framework}
											</Badge>
										</div>
										{#if project.description}
											<CardDescription class="line-clamp-2 text-sm leading-relaxed">
												{project.description}
											</CardDescription>
										{/if}
									</div>
								</div>
							</CardHeader>
							<CardContent class="pt-0">
								<div class="flex items-center justify-between text-sm">
									<div class="flex items-center gap-4">
										{#if project.configuration.typescript}
											<Badge
												variant="outline"
												class="bg-blue-50 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300"
											>
												TypeScript
											</Badge>
										{/if}
									</div>
									<div class="flex items-center gap-2">
										{#if project.status === 'ready'}
											<div class="flex items-center gap-1 text-green-600">
												<div class="h-2 w-2 rounded-full bg-green-600"></div>
												<span class="text-xs font-medium">Ready</span>
											</div>
										{:else if project.status === 'initializing'}
											<div class="flex items-center gap-1 text-yellow-600">
												<div class="h-2 w-2 animate-pulse rounded-full bg-yellow-600"></div>
												<span class="text-xs font-medium">Setting up</span>
											</div>
										{:else}
											<div class="flex items-center gap-1 text-red-600">
												<AlertTriangle class="h-3 w-3" />
												<span class="text-xs font-medium">Error</span>
											</div>
										{/if}
									</div>
								</div>
								<div class="mt-3 flex items-center justify-between text-xs text-muted-foreground">
									<span>Updated {formatTimeAgo(project.updatedAt || project.createdAt)}</span>
									<div
										class="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
									>
										Click to open →
									</div>
								</div>
							</CardContent>
						</Card>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}
