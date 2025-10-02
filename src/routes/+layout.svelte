<script lang="ts">
	import { initializeApp } from '$lib/app-init.js';
	import SettingsInitializer from '$lib/components/shared/settings-initializer.svelte';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import { initializeTheme } from '$lib/config/theme-init.js';
	import { cleanupFileStorage } from '$lib/utils/storage-cleanup.js';
	import { ModeWatcher } from 'mode-watcher';
	import { onMount } from 'svelte';
	import '../app.css';

	let { children } = $props();

	let loading = $state(true);
	let appHealthy = $state(true);

	// Initialize theme system
	initializeTheme();

	// Clean up file-related localStorage on app start
	cleanupFileStorage();

	onMount(async () => {
		try {
			// Initialize comprehensive error handling and validation
			initializeApp({
				enableGlobalErrorHandler: true,
				enableHttpInterceptor: true,
				httpInterceptorConfig: {
					enableLogging: import.meta.env.DEV,
					defaultTimeout: 30000,
					retryAttempts: 2
				}
			});

			// Perform app health check
			const { performAppHealthCheck } = await import('$lib/app-init.js');
			const healthCheck = await performAppHealthCheck();

			if (healthCheck.status === 'unhealthy') {
				console.error('App health check failed:', healthCheck.checks);
				appHealthy = false;
			} else if (healthCheck.status === 'degraded') {
				console.warn('App health check degraded:', healthCheck.checks);
			}

			loading = false;
		} catch (error) {
			console.error('Failed to initialize app:', error);
			appHealthy = false;
			loading = false;
		}
	});
</script>

{#if loading}
	<div
		class="fixed inset-0 z-50 flex h-dvh w-dvw items-center justify-center bg-background dark:bg-black"
	>
		<div class="loader"></div>
	</div>
{:else if !appHealthy}
	<div
		class="fixed inset-0 z-50 flex h-dvh w-dvw items-center justify-center bg-background dark:bg-black"
	>
		<div class="max-w-md space-y-4 text-center">
			<div class="text-6xl">⚠️</div>
			<h1 class="text-2xl font-bold text-foreground">App Initialization Failed</h1>
			<p class="text-muted-foreground">
				The application failed to initialize properly. Please refresh the page or contact support if
				the problem persists.
			</p>
			<button
				onclick={() => window.location.reload()}
				class="rounded-md bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
			>
				Refresh Page
			</button>
		</div>
	</div>
{:else}
	<ModeWatcher />
	<SettingsInitializer />
	<Toaster richColors position="top-right" />
	{@render children?.()}
{/if}

<style>
	.loader {
		width: 60px;
		aspect-ratio: 1;
		--g: conic-gradient(from -90deg at 10px 10px, var(--primary) 90deg, #0000 0);
		background: var(--g), var(--g), var(--g);
		background-size: 50% 50%;
		animation: l18 1s infinite;
		transform: translate(-50%, -50%);
	}
	@keyframes l18 {
		0% {
			background-position:
				0 0,
				10px 10px,
				20px 20px;
		}
		33% {
			background-position:
				-30px 0,
				10px 10px,
				20px 20px;
		}
		66% {
			background-position:
				-30px 0,
				10px 40px,
				20px 20px;
		}
		100% {
			background-position:
				-30px 0,
				10px 40px,
				50px 20px;
		}
	}
</style>
