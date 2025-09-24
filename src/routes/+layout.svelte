<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import SettingsInitializer from '$lib/components/shared/settings-initializer.svelte';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import { initializeTheme } from '$lib/config/theme-init.js';
	import { webSocketActions } from '$lib/stores/websocket.store';
	import { cleanupFileStorage } from '$lib/utils/storage-cleanup.js';
	import { ModeWatcher } from 'mode-watcher';
	import { onMount } from 'svelte';
	import '../app.css';
	// Initialize authentication

	let { children } = $props();

	let loading = $state(true);

	// Initialize theme system
	initializeTheme();

	// Clean up file-related localStorage on app start
	cleanupFileStorage();

	// Initialize WebSocket connection for real-time updates

	onMount(async () => {
		await webSocketActions.connect();
		loading = false;
		return () => {
			// Cleanup on component unmount
			webSocketActions.disconnect();
		};
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if loading}
	<div
		class="fixed inset-0 z-50 flex h-dvh w-dvw items-center justify-center bg-background dark:bg-black"
	>
		<div class="loader"></div>
	</div>
{:else}
	<ModeWatcher />
	<SettingsInitializer />
	<Toaster />
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
