<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import CodemirrorEditor from '$lib/components/code-editor/codemirror-editor.svelte';
	import FileTabs from '$lib/components/editor/file-tabs.svelte';
	import EnhancedSidebar from '$lib/components/shared/enhanced-sidebar.svelte';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import * as Resizable from '$lib/components/ui/resizable/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { activeFileId, fileActions, filesStore } from '$lib/stores/editor.js';
	import { createBreadcrumbs } from '$lib/utils/file-tree';
	import { onDestroy, onMount } from 'svelte';
	// Icons
	import { TerminalManager } from '$lib/components/shared/terminal';
	import ChatSidebar from '@/components/chat/chat-sidebar.svelte';
	import AlertCircleIcon from '@lucide/svelte/icons/alert-circle';
	import FolderIcon from '@lucide/svelte/icons/folder';
	import LoaderIcon from '@lucide/svelte/icons/loader-2';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	// Types

	let { data } = $props();

	// Enhanced sidebar state
	let useEnhancedSidebar = $state(false);

	function onLayoutChange(sizes: number[]) {
		document.cookie = `PaneForge:layout=${JSON.stringify(sizes)}`;
	}

	function onVerticalLayoutChange(sizes: number[]) {
		document.cookie = `PaneForge:vertical-layout=${JSON.stringify(sizes)}`;
	}

	// Get current file and breadcrumbs
	let currentFile = $derived($activeFileId ? $filesStore.get($activeFileId) : null);
	let breadcrumbs = $derived(currentFile ? createBreadcrumbs(currentFile.path) : []);

	// Project data
	let project = $derived(data.project);
	let setupStatus = $derived(data.setupStatus);
	let isProjectReady = $derived(project?.status === 'ready');
	let isProjectInitializing = $derived(project?.status === 'initializing');
	let isProjectError = $derived(project?.status === 'error');

	// Setup status polling for initializing projects
	let pollInterval: NodeJS.Timeout | null = $state(null);

	// Daytona connection management
	let daytonaConnectionRegistered = $state(false);
	let daytonaBridgeActive = $state(false);

	// Project files loading state
	let filesLoading = $state(false);
	let filesLoaded = $state(false);

	/**
	 * Load project files from R2 storage or sandbox into the file store
	 */
	async function loadProjectFiles() {
		if (filesLoading || filesLoaded || !project?.id) return;

		try {
			filesLoading = true;
			console.log('Loading project files for project:', project.id);

			const response = await fetch(`/api/projects/${project.id}/files`);

			if (!response.ok) {
				throw new Error(`Failed to fetch project files: ${response.status}`);
			}

			const result = await response.json();

			if (result.success && result.data?.files && result.data.files.length > 0) {
				// Clear existing files and load new ones
				filesStore.set(new Map());

				// Add each file to the store
				result.data.files.forEach((file: any) => {
					fileActions.addFile(file);
				});

				filesLoaded = true;
				console.log(`Loaded ${result.data.files.length} files into file store`);
			} else {
				console.warn('No files found for project:', project.id);
				filesLoaded = true;
			}
		} catch (error) {
			console.error('Failed to load project files:', error);
			filesLoaded = true;
		} finally {
			filesLoading = false;
		}
	}

	// Handle page unload to cleanup Daytona connections
	function handleBeforeUnload() {
		if (browser && daytonaConnectionRegistered && project?.id) {
			// Store project ID in a local variable to avoid issues with derived values
			const projectId = project.id;
			// Send a synchronous request to stop the bridge
			navigator.sendBeacon(
				'/api/daytona/bridge',
				JSON.stringify({
					action: 'stop',
					projectId,
					userId: data.user?.id
				})
			);
		}
	}

	onMount(() => {
		// Load project files when the project is ready
		if (isProjectReady) {
			loadProjectFiles();
		}

		// Add event listeners for page unload (only in browser)
		if (browser) {
			window.addEventListener('beforeunload', handleBeforeUnload);
			window.addEventListener('unload', handleBeforeUnload);
		}

		// If project is initializing, poll for status updates
		if (isProjectInitializing && setupStatus) {
			pollInterval = setInterval(async () => {
				try {
					const response = await fetch(`/api/projects/${project.id}/status`);
					if (response.ok) {
						const statusData = await response.json();

						// Check the nested data structure
						if (statusData.success && statusData.data) {
							if (statusData.data.status === 'completed') {
								// Project is ready, reload the page
								if (browser) {
									window.location.reload();
								}
							} else if (statusData.data.status === 'error') {
								// Project failed, stop polling
								if (pollInterval) {
									clearInterval(pollInterval);
									pollInterval = null;
								}
							}
						}
					}
				} catch (error) {
					console.error('Failed to poll project status:', error);
				}
			}, 2000); // Poll every 2 seconds
		}

		// Cleanup polling on unmount
		return () => {
			if (pollInterval) {
				clearInterval(pollInterval);
			}
		};
	});

	onDestroy(() => {
		if (browser) {
			window.removeEventListener('beforeunload', handleBeforeUnload);
			window.removeEventListener('unload', handleBeforeUnload);
		}

		if (pollInterval) {
			clearInterval(pollInterval);
		}
	});

	function handleRetrySetup() {
		// Navigate back to project setup
		goto(`/project-setup?retry=${project.id}`);
	}

	function handleGoToDashboard() {
		goto('/dashboard');
	}
</script>

<svelte:head>
	<title>{project ? `${project.name} - Aura Editor` : 'Loading - Aura Editor'}</title>
</svelte:head>

{#if isProjectError}
	<div class="flex h-screen items-center justify-center p-4">
		<div class="w-full max-w-md space-y-4">
			<Alert.Root variant="destructive">
				<AlertCircleIcon class="h-4 w-4" />
				<Alert.Title>Project Setup Failed</Alert.Title>
				<Alert.Description>
					{project.name} could not be initialized properly. This might be due to configuration issues
					or temporary service problems.
				</Alert.Description>
			</Alert.Root>
			<div class="flex gap-2">
				<Button onclick={handleRetrySetup} variant="outline" class="flex-1">
					<FolderIcon class="mr-2 h-4 w-4" />
					Retry Setup
				</Button>
				<Button onclick={handleGoToDashboard} variant="outline" class="flex-1">
					Go to Dashboard
				</Button>
			</div>
		</div>
	</div>
{:else if isProjectInitializing}
	<div class="flex h-screen items-center justify-center p-4">
		<div class="w-full max-w-md space-y-4">
			<div class="text-center">
				<LoaderIcon class="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
				<h2 class="mt-4 text-xl font-semibold">Setting up {project.name}</h2>
				<p class="mt-2 text-sm text-muted-foreground">
					{setupStatus?.message || 'Initializing project environment...'}
				</p>
			</div>

			{#if setupStatus}
				<div class="space-y-2">
					<div class="flex justify-between text-sm">
						<span>Progress</span>
						<span>{setupStatus.progress}%</span>
					</div>
					<Progress value={setupStatus.progress} class="w-full" />
				</div>
			{/if}

			<div class="text-center">
				<Button onclick={handleGoToDashboard} variant="outline" size="sm">Go to Dashboard</Button>
			</div>
		</div>
	</div>
{:else if isProjectReady}
	<Resizable.PaneGroup {onLayoutChange} direction="horizontal" class="max-h-dvh overflow-hidden">
		<Sidebar.Provider>
			<Resizable.Pane
				collapsible
				defaultSize={data.layout && typeof data.layout[0] === 'number' ? data.layout[0] : 20}
				maxSize={20}
				minSize={20}
			>
				<EnhancedSidebar {project} />
			</Resizable.Pane>
			<Resizable.Handle />
			<Resizable.Pane
				defaultSize={data.layout && typeof data.layout[1] === 'number' ? data.layout[1] : 80}
				class="h-full"
			>
				<Resizable.PaneGroup
					onLayoutChange={(layout: number[]) => onVerticalLayoutChange(layout)}
					direction="vertical"
					class="max-h-dvh overflow-hidden"
				>
					<Resizable.Pane
						defaultSize={data.verticalLayout && typeof data.verticalLayout[0] === 'number'
							? data.verticalLayout[0]
							: 80}
						class="flex h-full flex-col"
					>
						<!-- Project Header -->
						<div
							class="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
						>
							<div class="flex h-14 items-center gap-4 px-4">
								<Breadcrumb.Root>
									<Breadcrumb.List>
										<Breadcrumb.Item>
											<Breadcrumb.Link href="/dashboard">Projects</Breadcrumb.Link>
										</Breadcrumb.Item>
										<Breadcrumb.Separator />
										<Breadcrumb.Item>
											<Breadcrumb.Page class="font-medium">{project.name}</Breadcrumb.Page>
										</Breadcrumb.Item>
										{#if currentFile}
											<Breadcrumb.Separator />
											{#each breadcrumbs as breadcrumb, i}
												<Breadcrumb.Item>
													{#if i === breadcrumbs.length - 1}
														<Breadcrumb.Page>{breadcrumb.name}</Breadcrumb.Page>
													{:else}
														<Breadcrumb.Link
															href="#"
															onclick={() => console.log('Navigate to', breadcrumb.path)}
														>
															{breadcrumb.name}
														</Breadcrumb.Link>
													{/if}
												</Breadcrumb.Item>
												{#if i < breadcrumbs.length - 1}
													<Breadcrumb.Separator />
												{/if}
											{/each}
										{/if}
									</Breadcrumb.List>
								</Breadcrumb.Root>

								<div class="ml-auto flex items-center gap-2">
									<Badge variant="outline">{project.framework}</Badge>
									{#if project.configuration.typescript}
										<Badge variant="secondary">TypeScript</Badge>
									{/if}
									<Tooltip.Root>
										<Tooltip.Trigger>
											<Button variant="ghost" size="sm">
												<SparklesIcon class="h-4 w-4" />
											</Button>
										</Tooltip.Trigger>
										<Tooltip.Content>
											<p>AI Assistant</p>
										</Tooltip.Content>
									</Tooltip.Root>
								</div>
							</div>
						</div>

						<!-- File Tabs -->
						<div class="border-b">
							<FileTabs />
						</div>

						<!-- Editor Content -->
						{#if currentFile}
							<div class="!relative !h-[100%] !overflow-auto">
								<CodemirrorEditor {project} />
							</div>
						{:else}
							<div class="flex flex-1 items-center justify-center">
								<div class="space-y-4 text-center">
									<div class="text-6xl">📝</div>
									<div>
										<h2 class="mb-2 text-xl font-semibold">Welcome to {project.name}</h2>
										<p class="text-muted-foreground">
											Choose a file from the sidebar to start editing
										</p>
										<p class="mt-2 text-xs text-muted-foreground">
											Framework: {project.framework}
										</p>
									</div>
								</div>
							</div>
						{/if}
					</Resizable.Pane>
					<Resizable.Handle />
					<Resizable.Pane
						defaultSize={data.verticalLayout && typeof data.verticalLayout[1] === 'number'
							? data.verticalLayout[1]
							: 20}
					>
						<TerminalManager {project} />
					</Resizable.Pane>
				</Resizable.PaneGroup>
			</Resizable.Pane>
			<Resizable.Handle />
			<Resizable.Pane
				collapsible
				defaultSize={data.layout && typeof data.layout[2] === 'number' ? data.layout[2] : 20}
				maxSize={40}
				minSize={20}
				class="h-full w-fit"
			>
				{#if browser}
					<ChatSidebar {project} />
				{/if}
			</Resizable.Pane>
		</Sidebar.Provider>
	</Resizable.PaneGroup>
{:else}
	<div class="flex h-screen items-center justify-center">
		<div class="space-y-4 text-center">
			<LoaderIcon class="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
			<p class="text-muted-foreground">Loading project...</p>
		</div>
	</div>
{/if}
