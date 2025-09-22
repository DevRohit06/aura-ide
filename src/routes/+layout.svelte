<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import SettingsInitializer from '$lib/components/shared/settings-initializer.svelte';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import { initializeTheme } from '$lib/config/theme-init.js';
	import { ModeWatcher } from 'mode-watcher';
	import '../app.css';
	// Initialize authentication

	let { children } = $props();

	// Initialize theme system
	initializeTheme();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<ModeWatcher />
<SettingsInitializer />
<Toaster />
{@render children?.()}
