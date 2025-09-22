<script lang="ts">
	import { onMount } from 'svelte';
	import {
		comprehensiveSettingsStore,
		comprehensiveSettingsActions
	} from '$lib/stores/comprehensive-settings.store.js';
	import { initializeCSSVariables } from '$lib/utils/css-variables.js';

	// Initialize settings on mount
	onMount(async () => {
		// Restore settings from storage
		await comprehensiveSettingsActions.restoreSettings();

		// Get current settings and apply CSS variables
		const settings = comprehensiveSettingsActions.getCurrentSettings();
		initializeCSSVariables(settings);

		// Subscribe to settings changes to update CSS variables
		const unsubscribe = comprehensiveSettingsStore.subscribe((settings) => {
			if (typeof window !== 'undefined') {
				// Apply CSS variables whenever settings change
				import('$lib/utils/css-variables.js').then(({ updateCSSVariables }) => {
					updateCSSVariables(settings);
				});
			}
		});

		// Cleanup subscription on component destroy
		return () => {
			unsubscribe();
		};
	});
</script>

<!-- This component has no visual output, it just initializes settings -->
