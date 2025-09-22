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
	import type { Project } from '$lib/types';

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
	let project = $derived(data.project as Project);
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

	// Template content variables to avoid string literal issues
	const svelteAppContent = "// Welcome to Svelte App\nconsole.log('Hello from Aura IDE!');";

	/**
	 * Load project files from R2 storage into the file store
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
				console.warn('No files returned from API, using demo files for:', project.framework);

				// Clear existing files and load demo files
				filesStore.set(new Map());

				// Fallback to demo files based on project framework
				const demoFiles = createDemoFilesForFramework(project.framework);
				demoFiles.forEach((file: any) => {
					fileActions.addFile(file);
				});

				filesLoaded = true;
				console.log('Loaded', demoFiles.length, 'demo files into file store');
			}
		} catch (error) {
			console.error('Failed to load project files:', error);

			// Clear existing files and load demo files as fallback
			filesStore.set(new Map());

			// Fallback to demo files on error
			const demoFiles = createDemoFilesForFramework(project.framework || 'react');
			demoFiles.forEach((file: any) => {
				fileActions.addFile(file);
			});

			filesLoaded = true;
			console.log('Loaded', demoFiles.length, 'demo files into file store (fallback)');
		} finally {
			filesLoading = false;
		}
	}

	// Create demo files based on project framework
	function createDemoFilesForFramework(framework: string) {
		const baseFiles = [
			{
				id: 'package_json',
				name: 'package.json',
				path: 'package.json',
				content: JSON.stringify(
					{
						name: project?.name || 'my-project',
						version: '1.0.0',
						type: 'module',
						scripts: {
							dev:
								framework === 'react' ? 'vite' : framework === 'svelte' ? 'vite dev' : 'npm start',
							build: framework === 'react' ? 'vite build' : 'npm run build',
							preview: 'vite preview'
						},
						dependencies: getFrameworkDependencies(framework),
						devDependencies: getFrameworkDevDependencies(framework)
					},
					null,
					2
				),
				parentId: null,
				type: 'file' as const,
				createdAt: new Date(),
				modifiedAt: new Date(),
				size: 500,
				permissions: {
					read: true,
					write: true,
					execute: false,
					delete: true,
					share: false,
					owner: 'user',
					collaborators: []
				},
				language: 'json',
				encoding: 'utf-8' as const,
				mimeType: 'application/json',
				isDirty: false,
				isReadOnly: false,
				metadata: {
					extension: 'json',
					lineCount: 20,
					characterCount: 500,
					wordCount: 50,
					lastCursor: null,
					bookmarks: [],
					breakpoints: [],
					folds: [],
					searchHistory: []
				}
			},
			{
				id: 'readme_md',
				name: 'README.md',
				path: 'README.md',
				content: `# ${project?.name || 'My Project'}\n\nA ${framework} project built with Aura IDE.\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\n## Features\n\n- Modern ${framework} setup\n- Fast development with Vite\n- TypeScript support\n- Hot module replacement\n\nEnjoy coding! 🚀`,
				parentId: null,
				type: 'file' as const,
				createdAt: new Date(),
				modifiedAt: new Date(),
				size: 200,
				permissions: {
					read: true,
					write: true,
					execute: false,
					delete: true,
					share: false,
					owner: 'user',
					collaborators: []
				},
				language: 'markdown',
				encoding: 'utf-8' as const,
				mimeType: 'text/markdown',
				isDirty: false,
				isReadOnly: false,
				metadata: {
					extension: 'md',
					lineCount: 15,
					characterCount: 200,
					wordCount: 30,
					lastCursor: null,
					bookmarks: [],
					breakpoints: [],
					folds: [],
					searchHistory: []
				}
			}
		];

		// Add framework-specific files
		if (framework === 'react') {
			baseFiles.push(
				{
					id: 'src_app_tsx',
					name: 'App.tsx',
					path: 'src/App.tsx',
					content: `import React from 'react';\nimport './App.css';\n\nfunction App() {\n  return (\n    <div className="App">\n      <header className="App-header">\n        <h1>Welcome to ${project?.name || 'React App'}</h1>\n        <p>Built with Aura IDE</p>\n      </header>\n    </div>\n  );\n}\n\nexport default App;`,
					parentId: 'src',
					type: 'file' as const,
					createdAt: new Date(),
					modifiedAt: new Date(),
					size: 300,
					permissions: {
						read: true,
						write: true,
						execute: false,
						delete: true,
						share: false,
						owner: 'user',
						collaborators: []
					},
					language: 'typescript',
					encoding: 'utf-8' as const,
					mimeType: 'text/typescript',
					isDirty: false,
					isReadOnly: false,
					metadata: {
						extension: 'tsx',
						lineCount: 15,
						characterCount: 300,
						wordCount: 40,
						lastCursor: null,
						bookmarks: [],
						breakpoints: [],
						folds: [],
						searchHistory: []
					}
				},
				{
					id: 'src_main_tsx',
					name: 'main.tsx',
					path: 'src/main.tsx',
					content: `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App.tsx';\nimport './index.css';\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n);`,
					parentId: 'src',
					type: 'file' as const,
					createdAt: new Date(),
					modifiedAt: new Date(),
					size: 250,
					permissions: {
						read: true,
						write: true,
						execute: false,
						delete: true,
						share: false,
						owner: 'user',
						collaborators: []
					},
					language: 'typescript',
					encoding: 'utf-8' as const,
					mimeType: 'text/typescript',
					isDirty: false,
					isReadOnly: false,
					metadata: {
						extension: 'tsx',
						lineCount: 10,
						characterCount: 250,
						wordCount: 30,
						lastCursor: null,
						bookmarks: [],
						breakpoints: [],
						folds: [],
						searchHistory: []
					}
				}
			);
		} else if (framework === 'svelte') {
			baseFiles.push({
				id: 'src_app_svelte',
				name: 'App.svelte',
				path: 'src/App.svelte',
				content: svelteAppContent,
				parentId: 'src',
				type: 'file' as const,
				createdAt: new Date(),
				modifiedAt: new Date(),
				size: 400,
				permissions: {
					read: true,
					write: true,
					execute: false,
					delete: true,
					share: false,
					owner: 'user',
					collaborators: []
				},
				language: 'svelte',
				encoding: 'utf-8' as const,
				mimeType: 'text/svelte',
				isDirty: false,
				isReadOnly: false,
				metadata: {
					extension: 'svelte',
					lineCount: 20,
					characterCount: 400,
					wordCount: 50,
					lastCursor: null,
					bookmarks: [],
					breakpoints: [],
					folds: [],
					searchHistory: []
				}
			});
		}

		// Add src directory
		baseFiles.push({
			id: 'src',
			name: 'src',
			path: 'src',
			content: '',
			parentId: null,
			type: 'directory' as const,
			createdAt: new Date(),
			modifiedAt: new Date(),
			permissions: {
				read: true,
				write: true,
				execute: true,
				delete: true,
				share: false,
				owner: 'user',
				collaborators: []
			},
			children: baseFiles.filter((f) => f.parentId === 'src').map((f) => f.id),
			isExpanded: true,
			isRoot: false
		});

		return baseFiles;
	}

	function getFrameworkDependencies(framework: string) {
		switch (framework) {
			case 'react':
				return { react: '^18.2.0', 'react-dom': '^18.2.0' };
			case 'svelte':
				return {};
			default:
				return {};
		}
	}

	function getFrameworkDevDependencies(framework: string) {
		switch (framework) {
			case 'react':
				return {
					'@types/react': '^18.2.66',
					'@types/react-dom': '^18.2.22',
					'@vitejs/plugin-react': '^4.2.1',
					typescript: '^5.2.2',
					vite: '^5.2.0'
				};
			case 'svelte':
				return {
					'@sveltejs/adapter-auto': '^3.0.0',
					'@sveltejs/kit': '^2.0.0',
					'@sveltejs/vite-plugin-svelte': '^3.0.0',
					svelte: '^4.2.7',
					typescript: '^5.0.0',
					vite: '^5.0.3'
				};
			default:
				return { typescript: '^5.2.2', vite: '^5.2.0' };
		}
	}

	async function registerDaytonaConnection() {
		if (!project?.id || daytonaConnectionRegistered) return;

		// Store project ID in a local variable to avoid issues with derived values
		const projectId = project.id;

		try {
			const response = await fetch('/api/daytona/register-connection', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ projectId })
			});

			if (response.ok) {
				daytonaConnectionRegistered = true;
				console.log('Daytona connection registered for project:', projectId);

				// Start Daytona bridge
				await startDaytonaBridge();
			}
		} catch (error) {
			console.error('Failed to register Daytona connection:', error);
		}
	}

	async function startDaytonaBridge() {
		if (!project?.id || !data.user?.id) return;

		try {
			const response = await fetch('/api/daytona/bridge', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'start',
					projectId: project.id,
					userId: data.user.id
				})
			});

			if (response.ok) {
				daytonaBridgeActive = true;
				console.log('Daytona bridge started for project:', project.id);
			} else {
				console.warn('Failed to start Daytona bridge:', await response.text());
			}
		} catch (error) {
			console.error('Failed to start Daytona bridge:', error);
		}
	}

	async function stopDaytonaBridge() {
		if (!project?.id || !data.user?.id) return;

		try {
			const response = await fetch('/api/daytona/bridge', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'stop',
					projectId: project.id,
					userId: data.user.id
				})
			});

			if (response.ok) {
				daytonaBridgeActive = false;
				console.log('Daytona bridge stopped for project:', project.id);
			}
		} catch (error) {
			console.error('Failed to stop Daytona bridge:', error);
		}
	}

	async function unregisterDaytonaConnection() {
		if (!project?.id || !daytonaConnectionRegistered) return;

		// Store project ID in a local variable to avoid issues with derived values during cleanup
		const projectId = project.id;

		try {
			// Stop Daytona bridge first
			await stopDaytonaBridge();

			const response = await fetch('/api/daytona/bridge', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'stop',
					projectId,
					userId: data.user?.id
				})
			});

			if (response.ok) {
				daytonaConnectionRegistered = false;
				console.log('Daytona connection unregistered for project:', projectId);
			}
		} catch (error) {
			console.error('Failed to unregister Daytona connection:', error);
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

		// Register Daytona connection for this project
		registerDaytonaConnection();

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
		// Cleanup E2B connection and event listeners
		unregisterDaytonaConnection();

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
				<ChatSidebar {project} />
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
