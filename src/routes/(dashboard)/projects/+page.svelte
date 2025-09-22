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
	import { FolderOpen, LogOut, Plus, Search } from 'lucide-svelte';
	import { onMount } from 'svelte';

	let user = $state(null);
	let projects = $state([]);
	let loading = $state(true);
	let searchTerm = $state('');
	let selectedFramework = $state('');

	onMount(async () => {
		await loadUserData();
		await loadProjects();
		loading = false;
	});

	async function loadUserData() {
		try {
			const accessToken = localStorage.getItem('accessToken');
			if (!accessToken) {
				goto('/auth/login');
				return;
			}

			const response = await fetch('/api/auth/profile', {
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.ok) {
				const userData = await response.json();
				user = userData.user;
			} else {
				localStorage.removeItem('accessToken');
				goto('/auth/login');
			}
		} catch (error) {
			console.error('Error loading user data:', error);
			goto('/auth/login');
		}
	}

	async function loadProjects() {
		try {
			const accessToken = localStorage.getItem('accessToken');
			if (!accessToken) return;

			const params = new URLSearchParams();
			if (searchTerm) params.append('search', searchTerm);
			if (selectedFramework) params.append('language', selectedFramework);

			const response = await fetch(`/api/projects?${params}`, {
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.ok) {
				const data = await response.json();
				projects = data.projects || [];
			}
		} catch (error) {
			console.error('Error loading projects:', error);
		}
	}

	async function logout() {
		try {
			await fetch('/api/auth/logout', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${localStorage.getItem('accessToken')}`
				}
			});
		} catch (error) {
			console.error('Logout error:', error);
		} finally {
			localStorage.removeItem('accessToken');
			goto('/auth/login');
		}
	}

	function createNewProject() {
		goto('/project-setup');
	}

	function openProject(projectId: string) {
		goto(`/editor/${projectId}`);
	}

	function getFrameworkColor(framework: string) {
		const colors = {
			react: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
			nextjs: 'bg-black text-white dark:bg-gray-800 dark:text-gray-200',
			svelte: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
			vue: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
			angular: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
		};
		return colors[framework] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
	}

	function handleSearch() {
		loadProjects();
	}

	function handleFrameworkFilter(framework: string) {
		selectedFramework = framework === selectedFramework ? '' : framework;
		loadProjects();
	}

	const filteredProjects = $derived.by(() => {
		return projects.filter((project) => {
			const matchesSearch =
				!searchTerm ||
				project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
				project.description?.toLowerCase().includes(searchTerm.toLowerCase());
			const matchesFramework = !selectedFramework || project.framework === selectedFramework;
			return matchesSearch && matchesFramework;
		});
	});
</script>

{#if loading}
	<div class="flex min-h-screen items-center justify-center">
		<div class="text-center">
			<div class="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
			<p class="mt-4 text-gray-600 dark:text-gray-400">Loading your projects...</p>
		</div>
	</div>
{:else}
	<header class="flex h-16 shrink-0 items-center gap-2 border-b px-4">
		<Sidebar.Trigger class="-ml-1" />
		<div class="flex items-center gap-2">
			<h1 class="text-lg font-semibold">Projects</h1>
		</div>
		<div class="ml-auto flex items-center gap-2">
			<span class="text-sm text-muted-foreground">
				{projects.length} project{projects.length !== 1 ? 's' : ''}
			</span>
			<Button variant="outline" size="sm" onclick={logout}>
				<LogOut class="mr-2 h-4 w-4" />
				Logout
			</Button>
		</div>
	</header>

	<main class="flex-1 space-y-6 p-6">
		<!-- Header Section -->
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-3xl font-bold tracking-tight">Your Projects</h2>
				<p class="text-muted-foreground">Manage and organize all your development projects.</p>
			</div>
			<Button onclick={createNewProject} size="lg">
				<Plus class="mr-2 h-4 w-4" />
				New Project
			</Button>
		</div>

		<!-- Search and Filters -->
		<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
			<div class="flex flex-1 items-center gap-2">
				<div class="relative max-w-sm flex-1">
					<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<input
						bind:value={searchTerm}
						oninput={handleSearch}
						placeholder="Search projects..."
						class="flex h-10 w-full rounded-md border border-input bg-background py-2 pr-3 pl-10 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					/>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<Button
					variant={selectedFramework === '' ? 'default' : 'outline'}
					size="sm"
					onclick={() => handleFrameworkFilter('')}
				>
					All
				</Button>
				<Button
					variant={selectedFramework === 'react' ? 'default' : 'outline'}
					size="sm"
					onclick={() => handleFrameworkFilter('react')}
				>
					React
				</Button>
				<Button
					variant={selectedFramework === 'nextjs' ? 'default' : 'outline'}
					size="sm"
					onclick={() => handleFrameworkFilter('nextjs')}
				>
					Next.js
				</Button>
				<Button
					variant={selectedFramework === 'svelte' ? 'default' : 'outline'}
					size="sm"
					onclick={() => handleFrameworkFilter('svelte')}
				>
					Svelte
				</Button>
				<Button
					variant={selectedFramework === 'vue' ? 'default' : 'outline'}
					size="sm"
					onclick={() => handleFrameworkFilter('vue')}
				>
					Vue
				</Button>
			</div>
		</div>

		<!-- Projects Grid -->
		{#if filteredProjects.length === 0}
			<Card class="py-12">
				<CardContent class="text-center">
					<FolderOpen class="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
					<h3 class="mb-2 text-lg font-medium">
						{projects.length === 0 ? 'No projects yet' : 'No projects match your filters'}
					</h3>
					<p class="mb-6 text-muted-foreground">
						{projects.length === 0
							? 'Create your first project to start building amazing applications'
							: 'Try adjusting your search or filter criteria'}
					</p>
					{#if projects.length === 0}
						<Button onclick={createNewProject}>
							<Plus class="mr-2 h-4 w-4" />
							Create Your First Project
						</Button>
					{/if}
				</CardContent>
			</Card>
		{:else}
			<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				{#each filteredProjects as project (project.id)}
					<Card
						class="cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg"
						onclick={() => openProject(project.id)}
					>
						<CardHeader>
							<div class="flex items-start justify-between">
								<div class="min-w-0 flex-1 space-y-1">
									<CardTitle class="truncate text-lg">{project.name}</CardTitle>
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
							<div class="space-y-3">
								<div class="flex items-center justify-between text-sm">
									<div class="flex gap-2">
										{#if project.configuration?.typescript}
											<Badge variant="outline">TypeScript</Badge>
										{/if}
									</div>
									<div class="text-muted-foreground">
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
								<div class="flex items-center justify-between text-xs text-muted-foreground">
									<span>Created {new Date(project.createdAt).toLocaleDateString()}</span>
									<span>{project.fileCount || 0} files</span>
								</div>
							</div>
						</CardContent>
					</Card>
				{/each}
			</div>
		{/if}
	</main>
{/if}
