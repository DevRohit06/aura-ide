<script lang="ts">
	import { browser } from '$app/environment';
	import { activeFile } from '$lib/stores/editor.js';
	import { onMount } from 'svelte';

	let { project } = $props<{ project: any }>();

	// Status states
	let isOnline = $state(true);
	let gitBranch = $state('main');
	let gitStatus = $state('✓');
	let currentTime = $state(new Date().toLocaleTimeString());

	// Function to actually test network connectivity
	async function checkNetworkConnectivity() {
		try {
			// First check navigator.onLine as a quick check
			if (!navigator.onLine) {
				return false;
			}

			// Try to fetch a small resource with a timeout
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

			// Try multiple endpoints for better reliability
			const endpoints = [
				'/', // Current domain root
				'/api/health', // Health check endpoint if it exists
				'https://www.google.com/favicon.ico' // External fallback
			];

			for (const endpoint of endpoints) {
				try {
					const response = await fetch(endpoint, {
						method: 'HEAD',
						signal: controller.signal,
						cache: 'no-cache',
						mode: endpoint.startsWith('http') ? 'no-cors' : 'same-origin'
					});

					clearTimeout(timeoutId);
					// If we get any response (even 404), we're online
					return true;
				} catch (error) {
					// Continue to next endpoint
					continue;
				}
			}

			clearTimeout(timeoutId);
			return false;
		} catch (error) {
			// If all fetches fail, we're offline
			return false;
		}
	}

	// Update online status
	async function updateOnlineStatus() {
		const newStatus = await checkNetworkConnectivity();
		if (newStatus !== isOnline) {
			isOnline = newStatus;
		}
	}

	// Update time every second
	onMount(() => {
		const interval = setInterval(() => {
			currentTime = new Date().toLocaleTimeString();
		}, 1000);

		// Initialize online status
		if (browser) {
			// Start with navigator.onLine as initial state
			isOnline = navigator.onLine;

			// Then do a real connectivity check
			updateOnlineStatus();

			// Define event handlers for online/offline status
			const handleOnline = () => {
				// Set online immediately when browser reports online
				isOnline = true;
				// Then double-check with actual network test
				updateOnlineStatus();
			};

			const handleOffline = () => {
				// Immediately set offline when browser reports offline
				isOnline = false;
			};

			// Listen to browser events
			window.addEventListener('online', handleOnline);
			window.addEventListener('offline', handleOffline);

			// Also check connectivity periodically (less frequently to avoid spam)
			const connectivityInterval = setInterval(updateOnlineStatus, 30000); // Check every 30 seconds

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

	// Reactive language detection
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
</script>

<div class="flex h-6 items-center justify-between border-t bg-background px-2 text-xs text-white">
	<!-- Left side -->
	<div class="flex items-center space-x-4">
		<!-- Online/Offline Status -->
		<div class="flex items-center space-x-1">
			<div class="h-2 w-2 rounded-full {isOnline ? 'bg-green-400' : 'bg-red-400'}"></div>
			<span>{isOnline ? 'Online' : 'Offline'}</span>
		</div>

		<!-- Git Information -->
		<button
			onclick={handleGitClick}
			class="flex items-center space-x-1 rounded px-1 py-0.5 transition-colors hover:bg-primary"
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
			<span class="text-blue-200">{project.framework}</span>
		{/if}
	</div>

	<!-- Center - Current File Info -->
	{#if $activeFile}
		<div class="flex items-center space-x-4">
			<!-- Selection Count -->
			{#if selectionCount > 0}
				<span>({selectionCount} selected)</span>
			{/if}
		</div>
	{/if}

	<!-- Right side -->
	<div class="flex items-center space-x-4">
		<!-- Cursor Position -->
		{#if $activeFile}
			<button
				onclick={handleCursorClick}
				class="rounded px-1 py-0.5 transition-colors hover:bg-primary"
			>
				Ln {cursorPosition.line}, Col {cursorPosition.column}
			</button>
		{/if}

		<!-- Language -->
		{#if language}
			<button
				onclick={handleLanguageClick}
				class="rounded px-1 py-0.5 transition-colors hover:bg-primary"
			>
				{language}
			</button>
		{/if}

		<!-- Encoding -->
		<button
			onclick={handleEncodingClick}
			class="rounded px-1 py-0.5 transition-colors hover:bg-primary"
		>
			{encoding}
		</button>

		<!-- Line Ending -->
		<button
			onclick={handleLineEndingClick}
			class="rounded px-1 py-0.5 transition-colors hover:bg-primary"
		>
			{lineEnding}
		</button>

		<!-- Current Time -->
		<span class="tabular-nums">{currentTime}</span>
	</div>
</div>
