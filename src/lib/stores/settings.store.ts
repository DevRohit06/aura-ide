import { writable, get, derived } from 'svelte/store';
import type { EditorSettings } from '@/types/editor-state';
import type { ComprehensiveSettings } from '@/types/settings';
import {
	comprehensiveSettingsStore,
	comprehensiveSettingsActions
} from './comprehensive-settings.store.js';

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

// Settings store derived from comprehensive settings for backward compatibility
export const settingsStore = derived(comprehensiveSettingsStore, ($comprehensive) => {
	// Map comprehensive theme to legacy theme format
	let legacyTheme: 'light' | 'dark' | 'system' = 'system';
	switch ($comprehensive.appearance.theme) {
		case 'light':
			legacyTheme = 'light';
			break;
		case 'dark':
			legacyTheme = 'dark';
			break;
		case 'system':
			legacyTheme = 'system';
			break;
		case 'high-contrast':
			// Map high-contrast to dark for backward compatibility
			legacyTheme = 'dark';
			break;
		default:
			legacyTheme = 'dark';
	}

	return {
		theme: legacyTheme,
		fontSize: $comprehensive.appearance.fontSize,
		fontFamily: $comprehensive.appearance.fontFamily,
		lineHeight: $comprehensive.appearance.lineHeight,
		tabSize: $comprehensive.editor.tabSize,
		insertSpaces: $comprehensive.editor.insertSpaces,
		wordWrap: $comprehensive.editor.wordWrap,
		lineNumbers: $comprehensive.editor.lineNumbers,
		miniMap: $comprehensive.editor.miniMap,
		autoSave: $comprehensive.editor.autoSave,
		autoSaveDelay: $comprehensive.editor.autoSaveDelay,
		formatOnSave: $comprehensive.editor.formatOnSave,
		vim: $comprehensive.keyboard.keyMap === 'vim',
		emacs: $comprehensive.keyboard.keyMap === 'emacs'
	};
});

// Settings actions
export const settingsActions = {
	// Update settings
	updateSettings: (updates: Partial<EditorSettings>) => {
		// Convert legacy settings to comprehensive settings format
		const comprehensiveUpdates: Partial<ComprehensiveSettings> = {};

		if (updates.theme !== undefined) {
			comprehensiveUpdates.appearance = {
				...get(comprehensiveSettingsStore).appearance,
				theme: updates.theme
			};
		}
		if (updates.fontSize !== undefined) {
			comprehensiveUpdates.appearance = {
				...(comprehensiveUpdates.appearance || get(comprehensiveSettingsStore).appearance),
				fontSize: updates.fontSize
			};
		}
		if (updates.fontFamily !== undefined) {
			comprehensiveUpdates.appearance = {
				...(comprehensiveUpdates.appearance || get(comprehensiveSettingsStore).appearance),
				fontFamily: updates.fontFamily
			};
		}
		if (updates.lineHeight !== undefined) {
			comprehensiveUpdates.appearance = {
				...(comprehensiveUpdates.appearance || get(comprehensiveSettingsStore).appearance),
				lineHeight: updates.lineHeight
			};
		}

		if (
			updates.tabSize !== undefined ||
			updates.insertSpaces !== undefined ||
			updates.wordWrap !== undefined ||
			updates.lineNumbers !== undefined ||
			updates.miniMap !== undefined ||
			updates.autoSave !== undefined ||
			updates.autoSaveDelay !== undefined ||
			updates.formatOnSave !== undefined
		) {
			comprehensiveUpdates.editor = { ...get(comprehensiveSettingsStore).editor };
			if (updates.tabSize !== undefined) comprehensiveUpdates.editor.tabSize = updates.tabSize;
			if (updates.insertSpaces !== undefined)
				comprehensiveUpdates.editor.insertSpaces = updates.insertSpaces;
			if (updates.wordWrap !== undefined) comprehensiveUpdates.editor.wordWrap = updates.wordWrap;
			if (updates.lineNumbers !== undefined)
				comprehensiveUpdates.editor.lineNumbers = updates.lineNumbers;
			if (updates.miniMap !== undefined) comprehensiveUpdates.editor.miniMap = updates.miniMap;
			if (updates.autoSave !== undefined) comprehensiveUpdates.editor.autoSave = updates.autoSave;
			if (updates.autoSaveDelay !== undefined)
				comprehensiveUpdates.editor.autoSaveDelay = updates.autoSaveDelay;
			if (updates.formatOnSave !== undefined)
				comprehensiveUpdates.editor.formatOnSave = updates.formatOnSave;
		}

		if (updates.vim !== undefined || updates.emacs !== undefined) {
			comprehensiveUpdates.keyboard = { ...get(comprehensiveSettingsStore).keyboard };
			if (updates.vim) {
				comprehensiveUpdates.keyboard.keyMap = 'vim';
			} else if (updates.emacs) {
				comprehensiveUpdates.keyboard.keyMap = 'emacs';
			} else {
				comprehensiveUpdates.keyboard.keyMap = 'default';
			}
		}

		comprehensiveSettingsActions.updateSettings(comprehensiveUpdates);
	},

	// Theme settings
	setTheme: (theme: 'light' | 'dark' | 'auto') => {
		comprehensiveSettingsActions.updateSetting('appearance', 'theme', theme);
	},

	toggleTheme: () => {
		const current = comprehensiveSettingsActions.getCurrentSettings();
		const newTheme = current.appearance.theme === 'light' ? 'dark' : 'light';
		comprehensiveSettingsActions.updateSetting('appearance', 'theme', newTheme);
	},

	// Font settings
	setFontSize: (fontSize: number) => {
		const clampedSize = Math.max(8, Math.min(72, fontSize));
		comprehensiveSettingsActions.updateSetting('appearance', 'fontSize', clampedSize);
	},

	increaseFontSize: () => {
		const current = comprehensiveSettingsActions.getCurrentSettings();
		const newSize = Math.min(72, current.appearance.fontSize + 1);
		comprehensiveSettingsActions.updateSetting('appearance', 'fontSize', newSize);
	},

	decreaseFontSize: () => {
		const current = comprehensiveSettingsActions.getCurrentSettings();
		const newSize = Math.max(8, current.appearance.fontSize - 1);
		comprehensiveSettingsActions.updateSetting('appearance', 'fontSize', newSize);
	},

	setFontFamily: (fontFamily: string) => {
		comprehensiveSettingsActions.updateSetting('appearance', 'fontFamily', fontFamily);
	},

	setLineHeight: (lineHeight: number) => {
		const clampedHeight = Math.max(1.0, Math.min(3.0, lineHeight));
		comprehensiveSettingsActions.updateSetting('appearance', 'lineHeight', clampedHeight);
	},

	// Tab settings
	setTabSize: (tabSize: number) => {
		const clampedSize = Math.max(1, Math.min(8, tabSize));
		comprehensiveSettingsActions.updateSetting('editor', 'tabSize', clampedSize);
	},

	toggleInsertSpaces: () => {
		const current = comprehensiveSettingsActions.getCurrentSettings();
		comprehensiveSettingsActions.updateSetting(
			'editor',
			'insertSpaces',
			!current.editor.insertSpaces
		);
	},

	// Editor behavior
	toggleWordWrap: () => {
		const current = comprehensiveSettingsActions.getCurrentSettings();
		comprehensiveSettingsActions.updateSetting('editor', 'wordWrap', !current.editor.wordWrap);
	},

	toggleLineNumbers: () => {
		const current = comprehensiveSettingsActions.getCurrentSettings();
		comprehensiveSettingsActions.updateSetting(
			'editor',
			'lineNumbers',
			!current.editor.lineNumbers
		);
	},

	toggleMiniMap: () => {
		const current = comprehensiveSettingsActions.getCurrentSettings();
		comprehensiveSettingsActions.updateSetting('editor', 'miniMap', !current.editor.miniMap);
	},

	// Auto-save settings
	toggleAutoSave: () => {
		const current = comprehensiveSettingsActions.getCurrentSettings();
		comprehensiveSettingsActions.updateSetting('editor', 'autoSave', !current.editor.autoSave);
	},

	setAutoSaveDelay: (delay: number) => {
		const clampedDelay = Math.max(100, Math.min(10000, delay));
		comprehensiveSettingsActions.updateSetting('editor', 'autoSaveDelay', clampedDelay);
	},

	toggleFormatOnSave: () => {
		const current = comprehensiveSettingsActions.getCurrentSettings();
		comprehensiveSettingsActions.updateSetting(
			'editor',
			'formatOnSave',
			!current.editor.formatOnSave
		);
	},

	// Editor modes
	toggleVimMode: () => {
		const current = comprehensiveSettingsActions.getCurrentSettings();
		const newKeyMap = current.keyboard.keyMap === 'vim' ? 'default' : 'vim';
		comprehensiveSettingsActions.updateSetting('keyboard', 'keyMap', newKeyMap);
	},

	toggleEmacsMode: () => {
		const current = comprehensiveSettingsActions.getCurrentSettings();
		const newKeyMap = current.keyboard.keyMap === 'emacs' ? 'default' : 'emacs';
		comprehensiveSettingsActions.updateSetting('keyboard', 'keyMap', newKeyMap);
	},

	disableAllModes: () => {
		comprehensiveSettingsActions.updateSetting('keyboard', 'keyMap', 'default');
	},

	// Utility methods
	getCurrentSettings: (): EditorSettings => {
		return get(settingsStore);
	},

	getSetting: <K extends keyof EditorSettings>(key: K): EditorSettings[K] => {
		const state = get(settingsStore);
		return state[key];
	},

	// Preset configurations - updated to use comprehensive settings
	setLightThemePreset: () => {
		comprehensiveSettingsActions.updateSettings({
			appearance: {
				...get(comprehensiveSettingsStore).appearance,
				theme: 'light',
				fontSize: 14,
				lineHeight: 1.4
			}
		});
	},

	setDarkThemePreset: () => {
		comprehensiveSettingsActions.updateSettings({
			appearance: {
				...get(comprehensiveSettingsStore).appearance,
				theme: 'dark',
				fontSize: 14,
				lineHeight: 1.4
			}
		});
	},

	setCompactPreset: () => {
		comprehensiveSettingsActions.updateSettings({
			appearance: {
				...get(comprehensiveSettingsStore).appearance,
				fontSize: 12,
				lineHeight: 1.2
			},
			editor: {
				...get(comprehensiveSettingsStore).editor,
				tabSize: 2,
				miniMap: false
			}
		});
	},

	setAccessiblePreset: () => {
		comprehensiveSettingsActions.updateSettings({
			appearance: {
				...get(comprehensiveSettingsStore).appearance,
				fontSize: 16,
				lineHeight: 1.6
			},
			editor: {
				...get(comprehensiveSettingsStore).editor,
				tabSize: 4,
				lineNumbers: true,
				wordWrap: true
			}
		});
	},

	setPerformancePreset: () => {
		comprehensiveSettingsActions.updateSettings({
			editor: {
				...get(comprehensiveSettingsStore).editor,
				miniMap: false,
				autoSave: false,
				formatOnSave: false
			}
		});
	},

	// Import/Export settings
	exportSettings: (): string => {
		const state = settingsActions.getCurrentSettings();
		return JSON.stringify(state, null, 2);
	},

	importSettings: (settingsJson: string): boolean => {
		try {
			const parsed = JSON.parse(settingsJson);
			settingsActions.updateSettings({ ...defaultSettings, ...parsed });
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
				// Use comprehensive settings actions to restore settings
				comprehensiveSettingsActions.updateSettings({
					appearance: {
						...get(comprehensiveSettingsStore).appearance,
						theme: parsed.theme || defaultSettings.theme,
						fontSize: parsed.fontSize || defaultSettings.fontSize,
						fontFamily: parsed.fontFamily || defaultSettings.fontFamily,
						lineHeight: parsed.lineHeight || defaultSettings.lineHeight
					},
					editor: {
						...get(comprehensiveSettingsStore).editor,
						tabSize: parsed.tabSize || defaultSettings.tabSize,
						insertSpaces: parsed.insertSpaces ?? defaultSettings.insertSpaces,
						wordWrap: parsed.wordWrap ?? defaultSettings.wordWrap,
						lineNumbers: parsed.lineNumbers ?? defaultSettings.lineNumbers,
						miniMap: parsed.miniMap ?? defaultSettings.miniMap,
						autoSave: parsed.autoSave ?? defaultSettings.autoSave,
						autoSaveDelay: parsed.autoSaveDelay || defaultSettings.autoSaveDelay,
						formatOnSave: parsed.formatOnSave ?? defaultSettings.formatOnSave
					},
					keyboard: {
						...get(comprehensiveSettingsStore).keyboard,
						keyMap: parsed.vim ? 'vim' : parsed.emacs ? 'emacs' : 'default'
					}
				});
			} catch (error) {
				console.warn('Failed to restore settings:', error);
			}
		}
	},

	// Reset to default
	reset: () => {
		settingsActions.updateSettings({ ...defaultSettings });
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
