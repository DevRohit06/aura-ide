<script lang="ts">
	import { browser } from '$app/environment';
	import { activeFile } from '$lib/stores/editor.js';
	import { previewURLActions } from '$lib/stores/preview-url.store';
	import type { Framework } from '$lib/types/index.js';
	import { terminalBridge } from '@/services/terminal-bridge.client';
	import { onMount } from 'svelte';

	let { project, onOpenBrowserMode } = $props<{
		project: any;
		onOpenBrowserMode?: () => void;
	}>();

	// Status states
	let isOnline = $state(true);
	let gitBranch = $state('main');
	let gitStatus = $state('✓');
	let currentTime = $state(new Date().toLocaleTimeString());

	// Server states
	let serverStatus = $state<'idle' | 'starting' | 'running' | 'error'>('idle');
	let serverPort = $state<number | null>(null);
	let serverUrl = $state<string | null>(null);
	let isInstallingDeps = $state(false);

	async function checkNetworkConnectivity() {
		try {
			if (!navigator.onLine) {
				return false;
			}

			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 3000);

			const endpoints = ['/', '/api/health', 'https://www.google.com/favicon.ico'];

			for (const endpoint of endpoints) {
				try {
					const response = await fetch(endpoint, {
						method: 'HEAD',
						signal: controller.signal,
						cache: 'no-cache',
						mode: endpoint.startsWith('http') ? 'no-cors' : 'same-origin'
					});

					clearTimeout(timeoutId);
					return true;
				} catch (error) {
					continue;
				}
			}

			clearTimeout(timeoutId);
			return false;
		} catch (error) {
			return false;
		}
	}

	async function updateOnlineStatus() {
		const newStatus = await checkNetworkConnectivity();
		if (newStatus !== isOnline) {
			isOnline = newStatus;
		}
	}

	onMount(() => {
		const interval = setInterval(() => {
			currentTime = new Date().toLocaleTimeString();
		}, 1000);

		if (browser) {
			isOnline = navigator.onLine;
			updateOnlineStatus();

			const handleOnline = () => {
				isOnline = true;
				updateOnlineStatus();
			};

			const handleOffline = () => {
				isOnline = false;
			};

			window.addEventListener('online', handleOnline);
			window.addEventListener('offline', handleOffline);

			const connectivityInterval = setInterval(updateOnlineStatus, 30000);

			return () => {
				clearInterval(interval);
				clearInterval(connectivityInterval);
				window.removeEventListener('online', handleOnline);
				window.removeEventListener('offline', handleOffline);
			};
		}

		return () => {
			clearInterval(interval);
		};
	});

	// Editor states
	let cursorPosition = $state({ line: 1, column: 1 });
	let selectionCount = $state(0);
	let encoding = $state('UTF-8');
	let lineEnding = $state('LF');
	let language = $state('');
	let token = $state('');

	$effect(() => {
		if ($activeFile) {
			const file = $activeFile;
			if (file.path) {
				const ext = file.path.split('.').pop()?.toLowerCase() || '';
				switch (ext) {
					case 'js':
						language = 'JavaScript';
						break;
					case 'ts':
						language = 'TypeScript';
						break;
					case 'svelte':
						language = 'Svelte';
						break;
					case 'html':
						language = 'HTML';
						break;
					case 'css':
						language = 'CSS';
						break;
					case 'json':
						language = 'JSON';
						break;
					case 'md':
						language = 'Markdown';
						break;
					case 'py':
						language = 'Python';
						break;
					case 'rs':
						language = 'Rust';
						break;
					case 'go':
						language = 'Go';
						break;
					default:
						language = 'Plain Text';
				}
			}
		} else {
			language = '';
		}
	});

	function handleGitClick() {
		console.log('Git status clicked');
	}

	function handleLanguageClick() {
		console.log('Language clicked');
	}

	function handleEncodingClick() {
		console.log('Encoding clicked');
	}

	function handleLineEndingClick() {
		console.log('Line ending clicked');
	}

	function handleCursorClick() {
		console.log('Cursor position clicked');
	}

	function getServerCommand(framework: Framework): { install: string; dev: string; port: number } {
		const commands: Record<Framework, { install: string; dev: string; port: number }> = {
			react: { install: 'npm install', dev: 'npm run dev', port: 3000 },
			nextjs: { install: 'npm install', dev: 'npm run dev', port: 3000 },
			svelte: { install: 'npm install', dev: 'npm run dev', port: 5173 },
			vue: { install: 'npm install', dev: 'npm run dev', port: 5173 },
			angular: { install: 'npm install', dev: 'npm run start', port: 4200 },
			astro: { install: 'npm install', dev: 'npm run dev', port: 4321 },
			vite: { install: 'npm install', dev: 'npm run dev', port: 5173 },
			express: { install: 'npm install', dev: 'npm run dev', port: 3000 },
			node: { install: 'npm install', dev: 'npm run dev', port: 3000 },
			javascript: { install: 'npm install', dev: 'npm run dev', port: 3000 },
			typescript: { install: 'npm install', dev: 'npm run dev', port: 3000 },
			static: { install: '', dev: 'npx serve -s . -p 3000', port: 3000 },
			bootstrap: { install: '', dev: 'npx serve -s . -p 3000', port: 3000 }
		};

		return commands[framework] || { install: 'npm install', dev: 'npm run dev', port: 3000 };
	}

	async function startServer() {
		if (!project?.sandboxId || serverStatus !== 'idle') return;

		try {
			serverStatus = 'starting';
			const { install, dev, port } = getServerCommand(project.framework);

			// Show header in terminal
			terminalBridge.showSeparator();
			terminalBridge.showHeader(`Starting ${project.framework || 'Server'}`);
			terminalBridge.write('\n');

			// Environment check
			terminalBridge.showAction('Checking environment...');
			const checkResponse = await fetch(`/api/sandbox/${project.sandboxId}/execute?type=command`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					command: 'which npm && npm --version && pwd && ls -la package.json',
					timeout: 10000,
					workingDir: '/home/daytona'
				})
			});

			const checkResult = await checkResponse.json();

			if (!checkResult.success) {
				const errorMsg = checkResult.error || checkResult.stdout || 'npm not found';
				terminalBridge.showError(`Environment check failed: ${errorMsg}`);
				throw new Error(`Environment check failed: ${errorMsg}`);
			}

			// Display environment check output
			if (checkResult.stdout) {
				terminalBridge.write(checkResult.stdout + '\n');
			}
			terminalBridge.showSuccess('Environment check passed ✓');
			terminalBridge.write('\n');

			// Install dependencies
			if (install) {
				isInstallingDeps = true;
				terminalBridge.showAction(`Installing dependencies: ${install}`);
				terminalBridge.showCommand(install);

				const installResponse = await fetch(
					`/api/sandbox/${project.sandboxId}/execute?type=command`,
					{
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							command: install,
							timeout: 300000,
							workingDir: '/home/daytona'
						})
					}
				);

				const installResult = await installResponse.json();
				isInstallingDeps = false;

				if (!installResult.success) {
					const errorMsg =
						installResult.stderr ||
						installResult.error_message ||
						installResult.stdout ||
						'Installation failed';
					terminalBridge.showError(`Dependency installation failed: ${errorMsg}`);
					if (installResult.stderr) {
						terminalBridge.write(installResult.stderr + '\n');
					}
					throw new Error(`Dependency installation failed: ${errorMsg}`);
				}

				// Show installation output
				if (installResult.stdout) {
					terminalBridge.write(installResult.stdout + '\n');
				}
				terminalBridge.showSuccess('Dependencies installed successfully ✓');
				terminalBridge.write('\n');
			}

			// Start dev server
			terminalBridge.showAction(`Starting development server: ${dev}`);
			terminalBridge.showCommand(`nohup ${dev} > /tmp/dev-server.log 2>&1 &`);

			const startResponse = await fetch(`/api/sandbox/${project.sandboxId}/execute?type=command`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					command: `nohup ${dev} > /tmp/dev-server.log 2>&1 & echo "Dev server started"`,
					timeout: 10000,
					workingDir: '/home/daytona'
				})
			});

			const startResult = await startResponse.json();

			if (startResult.stdout) {
				terminalBridge.write(startResult.stdout + '\n');
			}
			if (startResult.stderr) {
				terminalBridge.write(startResult.stderr + '\n');
			}

			// Wait for server to initialize
			terminalBridge.showAction('Waiting for server to initialize...');
			await new Promise((resolve) => setTimeout(resolve, 3000));

			// Forward port
			terminalBridge.showAction(`Forwarding port ${port}...`);

			const portResponse = await fetch(`/api/sandbox/${project.sandboxId}/forward-port`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					internalPort: port,
					public: true
				})
			});

			if (portResponse.ok) {
				const portResult = await portResponse.json();
				serverPort = portResult.externalPort || port;
				token = portResult.token || '';
				serverUrl = portResult.url || `http://localhost:${serverPort}`;
				serverStatus = 'running';

				terminalBridge.showSuccess(`Server running at: ${serverUrl}`);
				terminalBridge.write(`\n  Port: ${serverPort}\n`);
				terminalBridge.write(`  Framework: ${project.framework || 'Unknown'}\n\n`);
				terminalBridge.showSeparator();
			} else {
				const portError = await portResponse.json();
				terminalBridge.showError(`Failed to forward port: ${portError.error || 'Unknown error'}`);
				throw new Error(`Failed to forward port: ${portError.error || 'Unknown error'}`);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			terminalBridge.showError(`Failed to start server: ${errorMessage}`);
			terminalBridge.showSeparator();
			serverStatus = 'error';
			isInstallingDeps = false;
			setTimeout(() => {
				serverStatus = 'idle';
			}, 5000);
		}
	}

	async function openServerUrl() {
		if (!serverUrl) return;

		try {
			terminalBridge.showAction(`Opening server URL: ${serverUrl}`);

			// Store the preview URL first
			if (project?.id && project?.sandboxId) {
				previewURLActions.setFromSandbox(
					project.id,
					project.sandboxId,
					serverUrl,
					`${project.framework || 'Server'} (Port ${serverPort})`
				);
			}

			// For browser mode, we need to handle the Daytona warning differently
			// The iframe will handle the cookie warning on first load
			if (onOpenBrowserMode) {
				terminalBridge.showSuccess('Opening in browser mode...');
				terminalBridge.write(
					'\nNote: If you see a security warning, click "Accept" in the preview.\n'
				);
				onOpenBrowserMode();
			} else {
				// For new tab, try to pre-accept the warning
				try {
					const acceptWarningUrl = `${serverUrl}/accept-daytona-preview-warning?redirect=${encodeURIComponent(serverUrl + '/')}`;

					// Open the accept URL directly in a new tab
					// This allows the cookie to be set in the proper context
					const newWindow = window.open(acceptWarningUrl, '_blank');

					if (newWindow) {
						terminalBridge.showSuccess('Opening in new tab...');
					} else {
						terminalBridge.showError('Popup blocked. Please allow popups for this site.');
						// Fallback: open the server URL directly
						window.open(serverUrl, '_blank');
					}
				} catch {
					// Fallback: open server URL directly
					terminalBridge.showSuccess('Opening in new tab...');
					window.open(serverUrl, '_blank');
				}
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			terminalBridge.showError(`Failed to open server URL: ${errorMsg}`);
			// Fallback to direct open
			if (onOpenBrowserMode) {
				onOpenBrowserMode();
			} else {
				window.open(serverUrl, '_blank');
			}
		}
	}
	function stopServer() {
		terminalBridge.showSeparator();
		terminalBridge.showAction('Stopping development server...');
		terminalBridge.write(`\n  Previous URL: ${serverUrl}\n`);
		terminalBridge.write(`  Port: ${serverPort}\n\n`);

		serverStatus = 'idle';
		serverPort = null;
		serverUrl = null;

		terminalBridge.showSuccess('Server stopped ✓');
		terminalBridge.showSeparator();
	}
</script>

<div
	class="flex h-6 items-center justify-between border-t border-border bg-muted/50 px-2 text-xs text-muted-foreground"
>
	<!-- Left side -->
	<div class="flex items-center space-x-4">
		<!-- Online/Offline Status -->
		<div class="flex items-center space-x-1">
			<div class="h-2 w-2 rounded-full {isOnline ? 'bg-emerald-500' : 'bg-destructive'}"></div>
			<span>{isOnline ? 'Online' : 'Offline'}</span>
		</div>

		<!-- Git Information -->
		<button
			onclick={handleGitClick}
			class="flex items-center space-x-1 rounded px-1 py-0.5 transition-colors hover:bg-accent hover:text-accent-foreground"
		>
			<svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
				<path
					fill-rule="evenodd"
					d="M10 2C5.58 2 2 5.58 2 10c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0018 10c0-4.42-3.58-8-8-8z"
					clip-rule="evenodd"
				></path>
			</svg>
			<span>{gitBranch}</span>
			<span>{gitStatus}</span>
		</button>

		<!-- Project Framework -->
		{#if project?.framework}
			<span class="text-primary">{project.framework}</span>
		{/if}

		<!-- Server Controls -->
		{#if project?.sandboxId}
			<div class="flex items-center space-x-2">
				{#if serverStatus === 'idle'}
					<button
						onclick={startServer}
						class="flex items-center space-x-1 rounded bg-emerald-600 px-2 py-1 text-xs text-primary-foreground transition-colors hover:bg-emerald-500"
						title="Start development server"
					>
						<svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
							<path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
								clip-rule="evenodd"
							></path>
						</svg>
						<span>Start Server</span>
					</button>
				{:else if serverStatus === 'starting'}
					<div
						class="flex items-center space-x-1 rounded bg-amber-600 px-2 py-1 text-xs text-primary-foreground"
					>
						<div
							class="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"
						></div>
						<span>{isInstallingDeps ? 'Installing...' : 'Starting...'}</span>
					</div>
				{:else if serverStatus === 'running'}
					<div class="flex items-center space-x-1">
						<button
							onclick={openServerUrl}
							class="flex items-center space-x-1 rounded bg-emerald-600 px-2 py-1 text-xs text-primary-foreground transition-colors hover:bg-emerald-500"
							title="Open server URL"
						>
							<div class="h-2 w-2 animate-pulse rounded-full bg-emerald-300"></div>
							<span>Server Running</span>
							<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
								></path>
							</svg>
						</button>
						<button
							onclick={stopServer}
							class="flex items-center space-x-1 rounded bg-destructive px-2 py-1 text-xs text-destructive-foreground transition-colors hover:bg-destructive/90"
							title="Stop server"
							aria-label="Stop development server"
						>
							<svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
								<path
									fill-rule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
									clip-rule="evenodd"
								></path>
							</svg>
						</button>
					</div>
				{:else if serverStatus === 'error'}
					<button
						onclick={startServer}
						class="flex items-center space-x-1 rounded bg-destructive px-2 py-1 text-xs text-destructive-foreground transition-colors hover:bg-destructive/90"
						title="Server error - click to retry"
					>
						<svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
							<path
								fill-rule="evenodd"
								d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
								clip-rule="evenodd"
							></path>
						</svg>
						<span>Error</span>
					</button>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Center - Current File Info -->
	{#if $activeFile}
		<div class="flex items-center space-x-4">
			{#if selectionCount > 0}
				<span>({selectionCount} selected)</span>
			{/if}
		</div>
	{/if}

	<!-- Right side -->
	<div class="flex items-center space-x-4">
		{#if $activeFile}
			<button
				onclick={handleCursorClick}
				class="rounded px-1 py-0.5 transition-colors hover:bg-accent hover:text-accent-foreground"
			>
				Ln {cursorPosition.line}, Col {cursorPosition.column}
			</button>
		{/if}

		{#if language}
			<button
				onclick={handleLanguageClick}
				class="rounded px-1 py-0.5 transition-colors hover:bg-accent hover:text-accent-foreground"
			>
				{language}
			</button>
		{/if}

		<button
			onclick={handleEncodingClick}
			class="rounded px-1 py-0.5 transition-colors hover:bg-accent hover:text-accent-foreground"
		>
			{encoding}
		</button>

		<button
			onclick={handleLineEndingClick}
			class="rounded px-1 py-0.5 transition-colors hover:bg-accent hover:text-accent-foreground"
		>
			{lineEnding}
		</button>

		<span class="tabular-nums">{currentTime}</span>
	</div>
</div>
