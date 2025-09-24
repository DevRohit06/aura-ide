import { setMode } from 'mode-watcher';
import { derived } from 'svelte/store';
import {
	comprehensiveSettingsActions,
	comprehensiveSettingsStore
} from './comprehensive-settings.store.js';

// Theme types - support light, dark, and system
export type ThemeMode = 'light' | 'dark' | 'system';

// Helper function to map comprehensive theme to supported theme
const mapThemeToSupported = (theme: string): ThemeMode => {
	switch (theme) {
		case 'light':
			return 'light';
		case 'dark':
			return 'dark';
		case 'system':
			return 'system';
		default:
			return 'dark';
	}
};

// Theme store derived from comprehensive settings with proper mapping
export const themeStore = derived(comprehensiveSettingsStore, ($settings) => ({
	mode: mapThemeToSupported($settings.appearance.theme)
}));

// Available theme options
export const themeOptions = {
	modes: [
		{ value: 'light', label: 'Light', description: 'Light theme' },
		{ value: 'dark', label: 'Dark', description: 'Dark theme' },
		{ value: 'system', label: 'System', description: 'Follow system preference' }
	] as const,
	colorSchemes: [
		{ value: 'onedark', label: 'OneDark', description: 'Classic OneDark colors' },
		{ value: 'dracula', label: 'Dracula', description: 'Dracula theme colors' }
	] as const
};

// Theme actions
export const themeActions = {
	setThemeMode: (newMode: ThemeMode) => {
		// Update comprehensive settings
		comprehensiveSettingsActions.updateSetting('appearance', 'theme', newMode);

		// Update mode-watcher
		setMode(newMode);
	},

	toggleTheme: () => {
		const currentSettings = comprehensiveSettingsActions.getCurrentSettings();
		const currentMappedMode = mapThemeToSupported(currentSettings.appearance.theme);

		// Toggle between light and dark (skip system for simple toggle)
		const newMode = currentMappedMode === 'light' ? 'dark' : 'light';

		themeActions.setThemeMode(newMode);
	},

	// Preset configurations
	applyLightPreset: () => {
		themeActions.setThemeMode('light');
	},

	applyDarkPreset: () => {
		themeActions.setThemeMode('dark');
	},

	// Persistence
	saveTheme: () => {
		if (typeof window === 'undefined') return;

		const currentSettings = comprehensiveSettingsActions.getCurrentSettings();
		const themeData = {
			mode: currentSettings.appearance.theme,
			colorScheme: currentSettings.appearance.colorScheme
		};
		localStorage.setItem('aura-theme', JSON.stringify(themeData));
	},

	loadTheme: () => {
		if (typeof window === 'undefined') return;

		const savedTheme = localStorage.getItem('aura-theme');
		if (savedTheme) {
			try {
				const theme = JSON.parse(savedTheme);
				// Update through comprehensive settings
				comprehensiveSettingsActions.updateSetting('appearance', 'theme', theme.mode);
				comprehensiveSettingsActions.updateSetting(
					'appearance',
					'colorScheme',
					theme.colorScheme || 'onedark'
				);
				themeActions.setThemeMode(theme.mode);
			} catch (error) {
				console.warn('Failed to load saved theme:', error);
			}
		}
	},

	// Color scheme actions
	setColorScheme: (colorScheme: string) => {
		comprehensiveSettingsActions.updateSetting('appearance', 'colorScheme', colorScheme);
	},

	applyDraculaPreset: () => {
		themeActions.setThemeMode('dark');
		themeActions.setColorScheme('dracula');
	},

	// Reset to defaults
	resetTheme: () => {
		comprehensiveSettingsActions.updateSetting('appearance', 'theme', 'dark');
		comprehensiveSettingsActions.updateSetting('appearance', 'colorScheme', 'onedark');
		themeActions.setThemeMode('dark');
	}
};

// Sync theme changes between comprehensive settings and mode-watcher
if (typeof window !== 'undefined') {
	// Subscribe to comprehensive settings theme changes
	comprehensiveSettingsStore.subscribe((settings) => {
		const themeMode = mapThemeToSupported(settings.appearance.theme);
		setMode(themeMode);
	});

	// Auto-persist theme changes
	themeStore.subscribe(() => {
		clearTimeout((globalThis as any).themePersistTimeout);
		(globalThis as any).themePersistTimeout = setTimeout(() => {
			themeActions.saveTheme();
		}, 500);
	});

	// Load theme on initialization
	themeActions.loadTheme();
}
