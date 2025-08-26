import { writable, get } from 'svelte/store';
import type { EditorSettings } from '@/types/editor-state';

// Default settings
const defaultSettings: EditorSettings = {
	theme: 'dark',
	fontSize: 14,
	fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
	lineHeight: 1.4,
	tabSize: 2,
	insertSpaces: true,
	wordWrap: false,
	lineNumbers: true,
	miniMap: true,
	autoSave: true,
	autoSaveDelay: 1000,
	formatOnSave: true,
	vim: false,
	emacs: false
};

// Settings store
export const settingsStore = writable<EditorSettings>(defaultSettings);

// Settings actions
export const settingsActions = {
	// Update settings
	updateSettings: (updates: Partial<EditorSettings>) => {
		settingsStore.update((state) => ({ ...state, ...updates }));
	},

	// Theme settings
	setTheme: (theme: 'light' | 'dark' | 'auto') => {
		settingsStore.update((state) => ({ ...state, theme }));
	},

	toggleTheme: () => {
		settingsStore.update((state) => ({
			...state,
			theme: state.theme === 'light' ? 'dark' : 'light'
		}));
	},

	// Font settings
	setFontSize: (fontSize: number) => {
		settingsStore.update((state) => ({
			...state,
			fontSize: Math.max(8, Math.min(72, fontSize)) // Clamp between 8-72
		}));
	},

	increaseFontSize: () => {
		settingsStore.update((state) => ({
			...state,
			fontSize: Math.min(72, state.fontSize + 1)
		}));
	},

	decreaseFontSize: () => {
		settingsStore.update((state) => ({
			...state,
			fontSize: Math.max(8, state.fontSize - 1)
		}));
	},

	setFontFamily: (fontFamily: string) => {
		settingsStore.update((state) => ({ ...state, fontFamily }));
	},

	setLineHeight: (lineHeight: number) => {
		settingsStore.update((state) => ({
			...state,
			lineHeight: Math.max(1.0, Math.min(3.0, lineHeight)) // Clamp between 1.0-3.0
		}));
	},

	// Tab settings
	setTabSize: (tabSize: number) => {
		settingsStore.update((state) => ({
			...state,
			tabSize: Math.max(1, Math.min(8, tabSize)) // Clamp between 1-8
		}));
	},

	toggleInsertSpaces: () => {
		settingsStore.update((state) => ({
			...state,
			insertSpaces: !state.insertSpaces
		}));
	},

	// Editor behavior
	toggleWordWrap: () => {
		settingsStore.update((state) => ({
			...state,
			wordWrap: !state.wordWrap
		}));
	},

	toggleLineNumbers: () => {
		settingsStore.update((state) => ({
			...state,
			lineNumbers: !state.lineNumbers
		}));
	},

	toggleMiniMap: () => {
		settingsStore.update((state) => ({
			...state,
			miniMap: !state.miniMap
		}));
	},

	// Auto-save settings
	toggleAutoSave: () => {
		settingsStore.update((state) => ({
			...state,
			autoSave: !state.autoSave
		}));
	},

	setAutoSaveDelay: (delay: number) => {
		settingsStore.update((state) => ({
			...state,
			autoSaveDelay: Math.max(100, Math.min(10000, delay)) // Clamp between 100ms-10s
		}));
	},

	toggleFormatOnSave: () => {
		settingsStore.update((state) => ({
			...state,
			formatOnSave: !state.formatOnSave
		}));
	},

	// Editor modes
	toggleVimMode: () => {
		settingsStore.update((state) => ({
			...state,
			vim: !state.vim,
			emacs: false // Disable emacs when enabling vim
		}));
	},

	toggleEmacsMode: () => {
		settingsStore.update((state) => ({
			...state,
			emacs: !state.emacs,
			vim: false // Disable vim when enabling emacs
		}));
	},

	disableAllModes: () => {
		settingsStore.update((state) => ({
			...state,
			vim: false,
			emacs: false
		}));
	},

	// Utility methods
	getCurrentSettings: (): EditorSettings => {
		return get(settingsStore);
	},

	getSetting: <K extends keyof EditorSettings>(key: K): EditorSettings[K] => {
		const state = get(settingsStore);
		return state[key];
	},

	// Preset configurations
	setLightThemePreset: () => {
		settingsStore.update((state) => ({
			...state,
			theme: 'light',
			fontSize: 14,
			lineHeight: 1.4
		}));
	},

	setDarkThemePreset: () => {
		settingsStore.update((state) => ({
			...state,
			theme: 'dark',
			fontSize: 14,
			lineHeight: 1.4
		}));
	},

	setCompactPreset: () => {
		settingsStore.update((state) => ({
			...state,
			fontSize: 12,
			lineHeight: 1.2,
			tabSize: 2,
			miniMap: false
		}));
	},

	setAccessiblePreset: () => {
		settingsStore.update((state) => ({
			...state,
			fontSize: 16,
			lineHeight: 1.6,
			tabSize: 4,
			lineNumbers: true,
			wordWrap: true
		}));
	},

	setPerformancePreset: () => {
		settingsStore.update((state) => ({
			...state,
			miniMap: false,
			autoSave: false,
			formatOnSave: false
		}));
	},

	// Import/Export settings
	exportSettings: (): string => {
		const state = get(settingsStore);
		return JSON.stringify(state, null, 2);
	},

	importSettings: (settingsJson: string): boolean => {
		try {
			const parsed = JSON.parse(settingsJson);
			settingsStore.set({ ...defaultSettings, ...parsed });
			return true;
		} catch (error) {
			console.warn('Failed to import settings:', error);
			return false;
		}
	},

	// Persistence
	persistSettings: () => {
		if (typeof window === 'undefined') return;

		const state = get(settingsStore);
		localStorage.setItem('aura-settings', JSON.stringify(state));
	},

	restoreSettings: () => {
		if (typeof window === 'undefined') return;

		const saved = localStorage.getItem('aura-settings');
		if (saved) {
			try {
				const parsed = JSON.parse(saved);
				settingsStore.set({ ...defaultSettings, ...parsed });
			} catch (error) {
				console.warn('Failed to restore settings:', error);
			}
		}
	},

	// Reset to default
	reset: () => {
		settingsStore.set({ ...defaultSettings });
	}
};

// Auto-persist settings changes
if (typeof window !== 'undefined') {
	settingsStore.subscribe(() => {
		clearTimeout((globalThis as any).settingsPersistTimeout);
		(globalThis as any).settingsPersistTimeout = setTimeout(() => {
			settingsActions.persistSettings();
		}, 500);
	});

	// Restore settings on load
	settingsActions.restoreSettings();
}
