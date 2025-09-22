// Theme initialization - loads saved theme preferences and initializes mode-watcher
import { onMount } from 'svelte';
import { themeActions } from '$lib/stores/theme.store.js';
import { settingsActions } from '$lib/stores/settings.store.js';

export function initializeTheme() {
	onMount(() => {
		// Restore theme and settings from localStorage
		themeActions.loadTheme();
		settingsActions.restoreSettings();
	});
}
