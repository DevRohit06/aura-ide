<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import EmptyFileSate from '$lib/assets/file-not-opened.png?url';
	import { onMount } from 'svelte';
// PaneForge
	import { Pane } from 'paneforge';
	// Light components that can be imported directly
	import ActivityBar from '$lib/components/editor/activity-bar.svelte';
	import BottomStatusBar from '$lib/components/editor/bottom-status-bar.svelte';
	import BrowserBar from '$lib/components/editor/browser-bar.svelte';
	import EditorSkeleton from '$lib/components/editor/editor-skeleton.svelte';
	import FileTabs from '$lib/components/editor/file-tabs.svelte';
	import TerminalSkeleton from '$lib/components/editor/terminal-skeleton.svelte';
	import TopMenubar from '$lib/components/editor/top-menubar.svelte';
	import FileWatcher from '$lib/components/file-watcher.svelte';
	import CommandPalette from '$lib/components/shared/command-palette.svelte';
	import ComprehensiveSettingsDialog from '$lib/components/shared/comprehensive-settings-dialog.svelte';
	import EnhancedSidebar from '$lib/components/shared/enhanced-sidebar.svelte';
	import ProfileModal from '$lib/components/shared/profile-modal.svelte';
	import ChatSidebar from '@/components/chat/chat-sidebar.svelte';
// UI Components
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import * as Resizable from '$lib/components/ui/resizable/index.js';
	import { projectActions } from '$lib/stores/current-project.store.js';
	import { activeFileId, fileActions, filesStore } from '$lib/stores/editor.js';
	import { previewURLActions } from '$lib/stores/preview-url.store';
	import { sidebarPanelActions, sidebarPanelsStore } from '$lib/stores/sidebar-panels.store';
// Utils and Services
	import { terminalBridge } from '$lib/services/terminal-bridge.client';
	import { indexAllFilesFromStore } from '$lib/services/vector-indexer.client';
	import { createBreadcrumbs } from '$lib/utils/file-tree';
// Icons
	import AlertCircleIcon from '@lucide/svelte/icons/alert-circle';
	import FolderIcon from '@lucide/svelte/icons/folder';
	import LoaderIcon from '@lucide/svelte/icons/loader-2';

	// Lazy imports for heavy components
	let CodemirrorEditor: any = $state(null);
	let TerminalManager: any = $state(null);

	// Terminal manager reference for programmatic access
	let terminalManagerRef: any = $state(null);

	let { data } = $props();
	const pageData = data as any;

	// Pane state management
	let leftPane = $state<ReturnType<typeof Pane> | undefined>();
	let rightPane = $state<ReturnType<typeof Pane> | undefined>();
	let terminalPane = $state<ReturnType<typeof Pane> | undefined>();
	let leftPaneCollapsed = $state(false);
	let rightPaneCollapsed = $state(false);
	let terminalCollapsed = $state(false);

	// Browser mode state
	let browserMode = $state(false);

	// Reactive current file and breadcrumbs using $derived helper
	let currentFile = $derived($activeFileId ? $filesStore.get($activeFileId) : null);
	let breadcrumbs = $derived(currentFile ? createBreadcrumbs(currentFile.path) : []);

	// Subscribe to sidebar store for pane visibility
	let sidebarState = $derived($sidebarPanelsStore);

	// Sync pane states with store
	$effect(() => {
		const state = $sidebarPanelsStore;

		// Left sidebar sync
		if (!state.panels.leftSidebarVisible && !leftPaneCollapsed) {
			leftPane?.collapse();
		} else if (state.panels.leftSidebarVisible && leftPaneCollapsed) {
			leftPane?.expand();
		}

		// Right sidebar sync
		if (!state.panels.rightSidebarVisible && !rightPaneCollapsed) {
			rightPane?.collapse();
		} else if (state.panels.rightSidebarVisible && rightPaneCollapsed) {
			rightPane?.expand();
		}

		// Terminal sync
		if (!state.panels.terminalVisible && !terminalCollapsed) {
			terminalPane?.collapse();
		} else if (state.panels.terminalVisible && terminalCollapsed) {
			terminalPane?.expand();
		}
	});

	// Project data (derived from page `data` prop)
	let project = $derived(pageData.project);
	let user = $derived(pageData.user);
	let setupStatus = $derived(pageData.setupStatus);
	let isProjectReady = $derived(project?.status === 'ready' && !pageData.isInitializing);
	let isProjectInitializing = $derived(pageData.isInitializing === true);
	let isProjectError = $derived(project?.status === 'error');

	// Loading state for initialization
	let initProgress = $state(0);
	let initStatus = $state('Initializing...');
	let initSteps = $state<
		Array<{ name: string; status: 'pending' | 'loading' | 'complete' | 'error'; message?: string }>
	>([
		{ name: 'Loading project', status: 'loading' },
		{ name: 'Starting sandbox', status: 'pending' },
		{ name: 'Loading files', status: 'pending' },
		{ name: 'Indexing workspace', status: 'pending' }
	]);

	// Daytona connection management
	let daytonaConnectionRegistered = $state(false);
	let daytonaBridgeActive = $state(false);

	// Command palette state
	let commandPaletteOpen = $state(false);

	// Settings dialog state
	let settingsOpen = $state(false);
	let profileOpen = $state(false);

	// Merged keyboard event handling
	function handleKeydownMerged(event: KeyboardEvent) {
		const { key } = event;
		const cmdKey = event.ctrlKey || event.metaKey;
		const shiftKey = event.shiftKey;

		// Panel toggle shortcuts
		if (cmdKey && key === 'b') {
			event.preventDefault();
			sidebarPanelActions.toggleLeftSidebar();
		} else if (cmdKey && key === '`') {
			event.preventDefault();
			sidebarPanelActions.toggleTerminal();
		} else if (cmdKey && event.shiftKey && key === 'E') {
			event.preventDefault();
			sidebarPanelActions.toggleRightSidebar();
		}
		// Command Palette shortcuts
		else if ((cmdKey && shiftKey && key === 'P') || key === 'F1' || (cmdKey && key === 'k')) {
			event.preventDefault();
			commandPaletteOpen = true;
		}
	}

	/**
	 * Spin up Daytona sandbox for Daytona projects
	 */
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

	$effect(() => {
		console.log('📊 Page data received:', {
			hasProjectFiles: !!pageData.projectFiles,
			projectFilesLength: pageData.projectFiles?.length || 0,
			projectFilesType: typeof pageData.projectFiles,
			projectId: project?.id
		});

		if (pageData.projectFiles && pageData.projectFiles.length > 0) {
			console.log('📁 Sample project files:', pageData.projectFiles.slice(0, 3));
			fileActions.loadFiles(pageData.projectFiles);
			console.log(`📁 Loaded ${pageData.projectFiles.length} files from server`);
		} else {
			console.warn('⚠️ No project files received from server');
			console.log('Available pageData keys:', Object.keys(pageData));
		}

		// Initialize preview URLs from project data
		if (project?.id && project?.sandboxId) {
			console.log('🌐 Initializing preview URLs for project:', project.id);

			// Extract tokens from forwarded ports metadata
			const forwardedPorts = project.metadata?.forwardedPorts || [];
			const getTokenForPort = (port: number) => {
				const portInfo = forwardedPorts.find(
					(p: any) => p.internalPort === port || p.externalPort === port
				);
				return portInfo?.token;
			};

			// Check if project has Daytona-specific URLs
			if (project.sandboxProvider === 'daytona' && project.daytonaUrls) {
				// Add tokens to Daytona URLs if available
				const urlsWithTokens = project.daytonaUrls.map((urlInfo: any) => ({
					...urlInfo,
					token: urlInfo.token || getTokenForPort(urlInfo.port) || project.daytonaToken
				}));

				previewURLActions.setFromDaytona(project.id, project.sandboxId, {
					urls: urlsWithTokens,
					primaryUrl: project.previewUrl,
					ports: project.ports,
					token: project.daytonaToken || getTokenForPort(3000) // Global token fallback
				});

				console.log(
					'✅ Set Daytona preview URLs with tokens:',
					urlsWithTokens.map((u: any) => ({ url: u.url, hasToken: !!u.token }))
				);
			} else if (project.previewUrl) {
				// Fallback to generic preview URL
				const port = parseInt(new URL(project.previewUrl).port) || 3000;
				const token = getTokenForPort(port) || project.daytonaToken;

				previewURLActions.setFromSandbox(
					project.id,
					project.sandboxId,
					project.previewUrl,
					project.framework || 'Application',
					token
				);

				console.log('✅ Set preview URL with token:', {
					url: project.previewUrl,
					hasToken: !!token
				});
			} else if (project.port) {
				// Fallback to port-based URL
				const url = `http://localhost:${project.port}`;
				const token = getTokenForPort(project.port) || project.daytonaToken;

				previewURLActions.setFromSandbox(
					project.id,
					project.sandboxId,
					url,
					project.framework || 'Application',
					token
				);

				console.log('✅ Set port-based URL with token:', {
					url,
					port: project.port,
					hasToken: !!token
				});
			}
		}
	});

	// Lazy load heavy components
	async function loadEditor() {
		if (!CodemirrorEditor) {
			try {
				const module = await import('$lib/components/code-editor/codemirror-editor.svelte');
				CodemirrorEditor = module.default;
			} catch (error) {
				console.error('Failed to load CodeMirror editor:', error);
			}
		}
	}

	async function loadTerminal() {
		if (!TerminalManager) {
			try {
				const module = await import('$lib/components/shared/terminal');
				TerminalManager = module.TerminalManager;
			} catch (error) {
				console.error('Failed to load terminal manager:', error);
			}
		}
	}

	// Poll initialization status if project is initializing
	async function pollInitStatus() {
		if (!isProjectInitializing) return;

		try {
			const response = await fetch(`/api/projects/${project.id}/init-status`);
			if (response.ok) {
				const data = await response.json();
				console.log('📊 Init status poll:', data);

				initProgress = data.progress || 0;
				initStatus = data.message || 'Initializing...';
				if (data.steps) {
					initSteps = data.steps;
				}

				// If complete or ready, reload the page
				if (data.complete || data.phase === 'ready' || initProgress >= 100) {
					console.log('✅ Project ready, reloading page...');
					setTimeout(() => {
						window.location.reload();
					}, 500);
				} else if (data.error) {
					console.error('❌ Initialization error:', data.error);
					// Stop polling on error
				} else {
					// Continue polling
					setTimeout(pollInitStatus, 1500);
				}
			} else {
				console.error('❌ Init status poll failed:', response.status);
				// Retry with longer delay
				setTimeout(pollInitStatus, 3000);
			}
		} catch (error) {
			console.error('Failed to poll init status:', error);
			setTimeout(pollInitStatus, 3000);
		}
	}

	// Load components immediately - remove lazy loading for critical components
	async function loadComponents() {
		try {
			// Load editor
			if (!CodemirrorEditor) {
				const editorModule = await import('$lib/components/code-editor/codemirror-editor.svelte');
				CodemirrorEditor = editorModule.default;
			}

			// Load terminal
			if (!TerminalManager) {
				const terminalModule = await import('$lib/components/shared/terminal');
				TerminalManager = terminalModule.TerminalManager;
			}
		} catch (error) {
			console.error('Failed to load components:', error);
		}
	}

	onMount(() => {
		// If project is initializing, start polling
		if (isProjectInitializing) {
			pollInitStatus();
			return;
		}

		// Load components immediately
		loadEditor();
		loadTerminal();

		// Single initialization block: set project and load files, register listeners, and kick off indexing
		try {
			const pid = project?.id || pageData?.project?.id || 'default';
			if (pid) {
				projectActions.setCurrentProject(pid);
			}

			// Load files from server only once
			const serverFiles: any[] = pageData?.projectFiles || [];
			console.log('🔍 Server files data:', {
				hasServerFiles: !!serverFiles,
				serverFilesLength: serverFiles.length,
				firstFile: serverFiles[0] || null
			});

			if (serverFiles && serverFiles.length > 0) {
				filesStore.set(new Map());
				for (const file of serverFiles) fileActions.addFile(file);
				console.log(`📁 Loaded ${serverFiles.length} files from server into file store`);

				// Debug: check what's actually in the store
				setTimeout(() => {
					console.log('📂 Files store after loading:', {
						storeSize: $filesStore.size,
						fileKeys: Array.from($filesStore.keys()).slice(0, 5)
					});
				}, 100);
			} else {
				console.warn('⚠️ No server files to load into file store');
			}

			// Register lifecycle listeners (only in browser)
			if (browser) {
				window.addEventListener('beforeunload', handleBeforeUnload);
				window.addEventListener('unload', handleBeforeUnload);
				window.addEventListener('keydown', handleKeydownMerged);
			}

			// Kick off background indexing (non-blocking). Use actual project id when possible.
			(async () => {
				try {
					const indexingProjectId = project?.id || pageData?.project?.id || 'default';
					console.log(`🔍 Triggering background indexing for project: ${indexingProjectId}`);
					const result = await indexAllFilesFromStore({
						projectId: indexingProjectId,
						async: true
					});
					console.log('✅ Background indexing result:', result);
				} catch (err) {
					console.error('❌ Failed to trigger workspace indexing on mount:', err);
				}
			})();
		} catch (err) {
			console.error('Editor page mount error:', err);
		}

		return () => {
			if (browser) {
				window.removeEventListener('beforeunload', handleBeforeUnload);
				window.removeEventListener('unload', handleBeforeUnload);
				window.removeEventListener('keydown', handleKeydownMerged);
			}
		};
	});

	// Initialize terminal bridge when terminal manager is ready
	$effect(() => {
		if (terminalManagerRef) {
			console.log('🔌 Connecting terminal bridge...', terminalManagerRef);
			console.log('🔍 Terminal manager methods:', {
				hasWriteOutput: typeof terminalManagerRef?.writeOutput,
				hasGetActiveSessionId: typeof terminalManagerRef?.getActiveSessionId,
				hasIsReady: typeof terminalManagerRef?.isReady
			});

			terminalBridge.setTerminalManager(terminalManagerRef);

			// Check if ready and wait for initialization
			const checkAndInit = () => {
				if (terminalManagerRef?.isReady && terminalManagerRef.isReady()) {
					console.log('✅ Terminal is ready, showing welcome');
					if (project?.name) {
						terminalBridge.showWelcome(project.name);
						terminalBridge.showSuccess('Terminal initialized successfully!');
						terminalBridge.write('\nReady to display command outputs and AI responses.\n\n');
					}
				} else {
					console.log('⏳ Terminal not ready yet, checking again...');
					setTimeout(checkAndInit, 200);
				}
			};

			// Start checking after a short delay
			setTimeout(checkAndInit, 300);
		}
	});

	function handleRetrySetup() {
		// Navigate back to project setup
		goto(`/project-setup?retry=${project.id}`);
	}

	function handleGoToDashboard() {
		goto('/dashboard');
	}

	// Sync pane states with store
	$effect(() => {
		const state = sidebarState;
		if (!state.panels.leftSidebarVisible && !leftPaneCollapsed) {
			leftPane?.collapse();
		} else if (state.panels.leftSidebarVisible && leftPaneCollapsed) {
			leftPane?.expand();
		}

		if (!state.panels.rightSidebarVisible && !rightPaneCollapsed) {
			rightPane?.collapse();
		} else if (state.panels.rightSidebarVisible && rightPaneCollapsed) {
			rightPane?.expand();
		}

		if (!state.panels.terminalVisible && !terminalCollapsed) {
			terminalPane?.collapse();
		} else if (state.panels.terminalVisible && terminalCollapsed) {
			terminalPane?.expand();
		}
	});

	// Sync pane states with store
	$effect(() => {
		const state = sidebarState;
		if (!state.panels.leftSidebarVisible && !leftPaneCollapsed) {
			leftPane?.collapse();
		} else if (state.panels.leftSidebarVisible && leftPaneCollapsed) {
			leftPane?.expand();
		}

		if (!state.panels.rightSidebarVisible && !rightPaneCollapsed) {
			rightPane?.collapse();
		} else if (state.panels.rightSidebarVisible && rightPaneCollapsed) {
			rightPane?.expand();
		}

		if (!state.panels.terminalVisible && !terminalCollapsed) {
			terminalPane?.collapse();
		} else if (state.panels.terminalVisible && terminalCollapsed) {
			terminalPane?.expand();
		}
	});

	function handleSettingsClick() {
		settingsOpen = true;
	}

	function handleProfileClick() {
		profileOpen = true;
	}
</script>

<svelte:head>
	<title>{project ? `${project.name} - Aura Editor` : 'Loading - Aura Editor'}</title>
</svelte:head>

<svelte:window on:keydown={handleKeydownMerged} />

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
	<div class="flex h-screen items-center justify-center bg-background p-4">
		<div class="w-full max-w-2xl space-y-6">
			<!-- Header -->
			<div class="text-center">
				<h1 class="text-2xl font-bold">Aura IDE</h1>
				<p class="mt-2 text-sm text-muted-foreground">Preparing {project.name}</p>
			</div>

			<!-- Progress Bar -->
			<div class="space-y-2">
				<div class="flex justify-between text-sm">
					<span class="font-medium">Overall Progress</span>
					<span class="text-muted-foreground">{Math.round(initProgress)}%</span>
				</div>
				<Progress value={initProgress} class="h-2" />
			</div>

			<!-- Current Status -->
			<div class="text-center">
				<div class="flex items-center justify-center gap-2">
					<LoaderIcon class="h-4 w-4 animate-spin" />
					<p class="text-sm font-medium">{initStatus}</p>
				</div>
			</div>

			<!-- Steps -->
			<div class="space-y-3">
				{#each initSteps as step}
					<div
						class="flex items-start gap-3 rounded-lg border p-3 transition-colors {step.status ===
						'complete'
							? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20'
							: step.status === 'loading'
								? 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20'
								: step.status === 'error'
									? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20'
									: 'bg-muted/50'}"
					>
						<!-- Status Icon -->
						<div class="flex-shrink-0 pt-0.5">
							{#if step.status === 'complete'}
								<div
									class="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white"
								>
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M5 13l4 4L19 7"
										></path>
									</svg>
								</div>
							{:else if step.status === 'loading'}
								<div
									class="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"
								></div>
							{:else if step.status === 'error'}
								<div
									class="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white"
								>
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M6 18L18 6M6 6l12 12"
										></path>
									</svg>
								</div>
							{:else}
								<div class="h-6 w-6 rounded-full border-2 border-muted"></div>
							{/if}
						</div>

						<!-- Step Info -->
						<div class="min-w-0 flex-1">
							<p class="text-sm font-medium">{step.name}</p>
							{#if step.message}
								<p class="mt-1 text-xs text-muted-foreground">{step.message}</p>
							{/if}
						</div>
					</div>
				{/each}
			</div>

			<!-- Files Being Processed -->
			{#if initProgress > 5 && initProgress < 100}
				<div class="space-y-2 rounded-lg border bg-muted/30 p-4">
					<p class="flex items-center gap-2 text-sm font-semibold">
						<FolderIcon class="h-4 w-4" />
						Files being processed
					</p>
					{#if initSteps && initSteps[0]?.status === 'loading'}
						<div class="space-y-1">
							{#each initSteps as step}
								{#if step.status === 'loading' || step.status === 'complete'}
									<div class="flex items-center justify-between text-xs text-muted-foreground">
										<span>{step.name}</span>
										{#if step.status === 'complete'}
											<span class="text-green-600 dark:text-green-400">✓</span>
										{:else}
											<div
												class="h-3 w-3 animate-spin rounded-full border border-primary border-t-transparent"
											></div>
										{/if}
									</div>
								{/if}
							{/each}
						</div>
					{:else if initSteps && initSteps[1]?.status === 'loading'}
						<div class="space-y-1">
							<div class="text-xs text-muted-foreground">Uploading files to storage...</div>
							<Progress value={Math.min(initProgress - 40, 30)} max={30} class="h-1.5" />
						</div>
					{:else if initSteps && initSteps[2]?.status === 'loading'}
						<div class="space-y-1">
							<div class="text-xs text-muted-foreground">Creating sandbox environment...</div>
							<Progress value={Math.min(initProgress - 80, 20)} max={20} class="h-1.5" />
						</div>
					{:else}
						<div class="text-xs text-muted-foreground">Finalizing setup...</div>
					{/if}
				</div>
			{/if}

			<!-- Tip -->
			<div class="rounded-lg bg-muted/50 p-4 text-center">
				<p class="text-xs text-muted-foreground">
					This typically takes 30-60 seconds. Please don't close this window.
				</p>
			</div>

			<div class="text-center">
				<Button onclick={handleGoToDashboard} variant="outline" size="sm">Go to Dashboard</Button>
			</div>
		</div>
	</div>
{:else if isProjectReady}
	<div class="flex h-dvh flex-col overflow-hidden">
		<!-- Top Menubar -->
		<TopMenubar
			{project}
			bind:browserMode
			onOpenCommandPalette={() => (commandPaletteOpen = true)}
		/>

		<!-- Main Content Area -->

		<div class="flex h-full flex-1 overflow-hidden">
			<!-- Activity Bar - Always Visible -->
			<ActivityBar
				onSettingsClick={handleSettingsClick}
				onProfileClick={handleProfileClick}
				{user}
			/>
			<!-- Main Layout -->
			<Resizable.PaneGroup direction="horizontal" class=" flex-1">
				<!-- Left Sidebar -->
				<Resizable.Pane
					defaultSize={20}
					collapsedSize={0}
					collapsible={true}
					minSize={15}
					maxSize={30}
					bind:this={leftPane}
					onCollapse={() => {
						leftPaneCollapsed = true;
						sidebarPanelActions.hideLeftSidebar();
					}}
					onExpand={() => {
						leftPaneCollapsed = false;
						sidebarPanelActions.showLeftSidebar();
					}}
				>
					<EnhancedSidebar {project} />
				</Resizable.Pane>
				<Resizable.Handle />

				<!-- Main Content Area -->
				<Resizable.Pane defaultSize={60}>
					<Resizable.PaneGroup direction="vertical">
						<!-- Editor or Browser -->
						<Resizable.Pane defaultSize={80} class="flex h-full flex-col">
							{#if browserMode}
								<!-- Browser Preview Mode -->
								<BrowserBar {project} onClose={() => (browserMode = false)} />
							{:else}
								<!-- File Tabs -->
								<div class="border-b">
									<FileTabs {project} />
								</div>

								<!-- Editor Content -->
								{#if currentFile}
									<div class="!relative !h-[100%] !overflow-auto">
										{#if CodemirrorEditor}
											<CodemirrorEditor {project} />
										{:else}
											<EditorSkeleton />
										{/if}
									</div>
								{:else}
									<div class="flex flex-1 items-center justify-center">
										<div class="space-y-4 text-center">
											<img src={EmptyFileSate} alt="Welcome" class="mx-auto size-86" />
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
							{/if}
						</Resizable.Pane>
						<Resizable.Handle />

						<!-- Terminal -->
						<Resizable.Pane
							defaultSize={20}
							collapsedSize={0}
							collapsible={true}
							minSize={10}
							maxSize={50}
							bind:this={terminalPane}
							onCollapse={() => {
								terminalCollapsed = true;
								sidebarPanelActions.hideTerminal();
							}}
							onExpand={() => {
								terminalCollapsed = false;
								sidebarPanelActions.showTerminal();
							}}
						>
							{#if TerminalManager}
								<TerminalManager bind:this={terminalManagerRef} {project} />
							{:else}
								<TerminalSkeleton />
							{/if}
						</Resizable.Pane>
					</Resizable.PaneGroup>
				</Resizable.Pane>
				<Resizable.Handle />

				<!-- Right Sidebar (Chat) -->
				<Resizable.Pane
					defaultSize={20}
					collapsedSize={0}
					collapsible={true}
					minSize={15}
					maxSize={40}
					bind:this={rightPane}
					onCollapse={() => {
						rightPaneCollapsed = true;
						sidebarPanelActions.hideRightSidebar();
					}}
					onExpand={() => {
						rightPaneCollapsed = false;
						sidebarPanelActions.showRightSidebar();
					}}
				>
					{#if browser}
						<ChatSidebar {project} {user} />
					{/if}
				</Resizable.Pane>
			</Resizable.PaneGroup>
		</div>

		<!-- Bottom Status Bar -->
		<BottomStatusBar
			{project}
			onOpenBrowserMode={() => {
				browserMode = true;
			}}
		/>
	</div>

	<!-- Settings Dialog -->
	<ComprehensiveSettingsDialog bind:open={settingsOpen} />
	<!-- Profile Modal -->
	<ProfileModal bind:open={profileOpen} {user} />
	<CommandPalette bind:open={commandPaletteOpen} {project} />
	<!-- File Watcher for real-time updates -->
	<FileWatcher projectId={project?.id} sandboxId={project?.sandboxId} enabled={true} />
{:else}
	<div class="flex h-screen items-center justify-center">
		<div class="space-y-4 text-center">
			<LoaderIcon class="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
			<p class="text-muted-foreground">Loading project...</p>
		</div>
	</div>
{/if}
