import { writable, derived, get } from 'svelte/store';
import { setMode } from 'mode-watcher';
import type {
	ComprehensiveSettings,
	SettingsCategory,
	SettingSetting,
	SettingValue,
	SettingValidationResult,
	SettingValidationError,
	SettingValidationWarning,
	SettingsExport,
	SettingsImportResult,
	SettingsChangeEvent,
	SettingsPreset,
	AppearanceSettings,
	EditorSettings,
	KeyboardSettings,
	AISettings,
	TerminalSettings,
	FileSettings,
	PerformanceSettings,
	PrivacySettings,
	AdvancedSettings
} from '$lib/types/settings';
import { settingsValidation } from '$lib/utils/settings-validation';
import { defaultSettingsSync } from '$lib/utils/settings-sync';
import { updateCSSVariables, initializeCSSVariables } from '$lib/utils/css-variables';

// Default settings
const defaultSettings: ComprehensiveSettings = {
	appearance: {
		theme: 'dark', // Only 'light', 'dark', 'system' supported by mode-watcher
		colorScheme: 'onedark',
		accentColor: '#007acc',
		fontSize: 14,
		fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
		lineHeight: 1.4,
		iconTheme: 'vscode-icons',
		compactMode: false,
		animations: true,
		transparency: 1.0,
		customCSS: '',
		highContrast: false // Separate flag for high contrast mode
	},
	editor: {
		// Display
		lineNumbers: true,
		lineNumbersRelative: false,
		wordWrap: false,
		miniMap: true,
		breadcrumbs: true,
		rulers: [],
		renderWhitespace: 'none',
		renderControlCharacters: false,

		// Behavior
		autoSave: true,
		autoSaveDelay: 1000,
		formatOnSave: true,
		formatOnPaste: false,
		trimTrailingWhitespace: true,
		insertFinalNewline: true,

		// Indentation
		tabSize: 2,
		insertSpaces: true,
		detectIndentation: true,

		// Selection
		multiCursorModifier: 'ctrlCmd',
		selectionHighlight: true,
		occurrencesHighlight: true,

		// Code features
		codeCompletion: true,
		quickSuggestions: true,
		parameterHints: true,
		codeLens: true,
		inlayHints: false,

		// Folding
		folding: true,
		foldingStrategy: 'auto',
		showFoldingControls: 'mouseover',

		// Scrolling
		smoothScrolling: true,
		scrollBeyondLastLine: true,
		scrollBeyondLastColumn: 5,

		// Cursor
		cursorBlinking: 'blink',
		cursorStyle: 'line',
		cursorWidth: 2
	},
	keyboard: {
		keyMap: 'default',
		customKeybindings: [],
		enableMultiCursor: true,
		enableBracketMatching: true,
		enableAutoClosingBrackets: true,
		enableAutoClosingQuotes: true,
		enableAutoSurround: true
	},
	ai: {
		enabled: true,
		provider: 'openai',
		apiKey: '',
		model: 'gpt-4',
		temperature: 0.7,
		maxTokens: 2048,

		// Features
		codeCompletion: true,
		codeGeneration: true,
		codeExplanation: true,
		errorAnalysis: true,
		refactoring: true,

		// Behavior
		autoSuggest: true,
		suggestDelay: 500,
		contextLines: 50,
		includeComments: true,
		includeTests: false,

		// Privacy
		sendTelemetry: false,
		storeConversations: true,
		shareCodeContext: true
	},
	terminal: {
		shell: '/bin/bash',
		fontSize: 14,
		fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
		lineHeight: 1.2,
		cursorBlinking: true,
		cursorStyle: 'block',
		scrollback: 1000,

		// Behavior
		confirmOnExit: true,
		copyOnSelection: false,
		pasteOnRightClick: true,
		wordSeparators: ' ()[]{}\'"`─',

		// Environment
		env: {},
		cwd: '',

		// Integration
		enableBell: false,
		bellSound: 'default',
		rightClickSelectsWord: true
	},
	files: {
		// Associations
		associations: {
			'*.js': 'javascript',
			'*.ts': 'typescript',
			'*.svelte': 'svelte',
			'*.json': 'json',
			'*.md': 'markdown'
		},

		// Behavior
		autoReveal: true,
		confirmDelete: true,
		confirmDragAndDrop: false,
		enableTrash: true,

		// Watching
		watcherExclude: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
		watcherInclude: ['**/*'],
		usePolling: false,

		// Encoding
		defaultEncoding: 'utf8',
		autoGuessEncoding: true,

		// Backup
		enableBackup: false,
		backupLocation: '.aura/backups',
		maxBackups: 10
	},
	performance: {
		// Rendering
		enableGPUAcceleration: true,
		maxRenderTime: 16,
		virtualScrolling: true,

		// Memory
		maxMemoryUsage: 512,
		garbageCollectionInterval: 30000,

		// File handling
		maxFileSize: 50,
		largeFileThreshold: 1,
		enableFileCache: true,

		// Search
		maxSearchResults: 1000,
		searchTimeout: 5000,
		indexingEnabled: true
	},
	privacy: {
		telemetry: false,
		crashReporting: false,
		usageStatistics: false,
		improveProduct: false,

		// Data
		clearDataOnExit: false,
		encryptLocalData: false,

		// Network
		allowRemoteConnections: false,
		proxySettings: {
			enabled: false,
			host: '',
			port: 8080,
			bypassList: ['localhost', '127.0.0.1']
		}
	},
	advanced: {
		// Debug
		enableDebugMode: false,
		logLevel: 'info',
		enableDevTools: false,

		// Experimental
		experimentalFeatures: [],

		// Updates
		autoUpdate: true,
		updateChannel: 'stable',

		// Extensions
		enableExtensions: true,
		extensionTimeout: 10000,

		// Security
		enableSandbox: true,
		allowUnsafeEval: false
	}
};

// Settings store
export const comprehensiveSettingsStore = writable<ComprehensiveSettings>(defaultSettings);

// Change history store
export const settingsChangeHistory = writable<SettingsChangeEvent[]>([]);

// Validation errors store
export const settingsValidationErrors = writable<SettingValidationError[]>([]);

// Settings categories configuration
export const settingsCategories: SettingsCategory[] = [
	{
		id: 'appearance',
		name: 'Appearance',
		description: 'Customize the look and feel of the editor',
		icon: 'paintbrush',
		sections: [
			{
				id: 'theme',
				name: 'Theme',
				description: 'Color theme and visual appearance',
				settings: []
			},
			{
				id: 'fonts',
				name: 'Fonts',
				description: 'Font family, size, and styling',
				settings: []
			},
			{
				id: 'layout',
				name: 'Layout',
				description: 'UI layout and spacing options',
				settings: []
			}
		]
	},
	{
		id: 'editor',
		name: 'Editor',
		description: 'Code editor behavior and features',
		icon: 'code',
		sections: [
			{
				id: 'display',
				name: 'Display',
				description: 'Editor display options',
				settings: []
			},
			{
				id: 'behavior',
				name: 'Behavior',
				description: 'Editor behavior settings',
				settings: []
			},
			{
				id: 'formatting',
				name: 'Formatting',
				description: 'Code formatting options',
				settings: []
			}
		]
	},
	{
		id: 'keyboard',
		name: 'Keyboard',
		description: 'Keyboard shortcuts and input methods',
		icon: 'keyboard',
		sections: [
			{
				id: 'keymaps',
				name: 'Key Maps',
				description: 'Editor key binding modes',
				settings: []
			},
			{
				id: 'shortcuts',
				name: 'Shortcuts',
				description: 'Custom keyboard shortcuts',
				settings: []
			}
		]
	},
	{
		id: 'ai',
		name: 'AI Assistant',
		description: 'AI-powered development features',
		icon: 'brain',
		sections: [
			{
				id: 'provider',
				name: 'Provider',
				description: 'AI service configuration',
				settings: []
			},
			{
				id: 'features',
				name: 'Features',
				description: 'AI feature toggles',
				settings: []
			},
			{
				id: 'privacy',
				name: 'Privacy',
				description: 'AI privacy settings',
				settings: []
			}
		]
	},
	{
		id: 'terminal',
		name: 'Terminal',
		description: 'Integrated terminal settings',
		icon: 'terminal',
		sections: [
			{
				id: 'appearance',
				name: 'Appearance',
				description: 'Terminal visual settings',
				settings: []
			},
			{
				id: 'behavior',
				name: 'Behavior',
				description: 'Terminal behavior options',
				settings: []
			}
		]
	},
	{
		id: 'files',
		name: 'Files',
		description: 'File management and associations',
		icon: 'folder',
		sections: [
			{
				id: 'associations',
				name: 'Associations',
				description: 'File type associations',
				settings: []
			},
			{
				id: 'behavior',
				name: 'Behavior',
				description: 'File operation behavior',
				settings: []
			}
		]
	},
	{
		id: 'performance',
		name: 'Performance',
		description: 'Performance and optimization settings',
		icon: 'zap',
		sections: [
			{
				id: 'rendering',
				name: 'Rendering',
				description: 'UI rendering performance',
				settings: []
			},
			{
				id: 'memory',
				name: 'Memory',
				description: 'Memory usage settings',
				settings: []
			}
		]
	},
	{
		id: 'privacy',
		name: 'Privacy',
		description: 'Privacy and data collection settings',
		icon: 'shield',
		sections: [
			{
				id: 'telemetry',
				name: 'Telemetry',
				description: 'Data collection preferences',
				settings: []
			},
			{
				id: 'security',
				name: 'Security',
				description: 'Security and privacy options',
				settings: []
			}
		]
	},
	{
		id: 'advanced',
		name: 'Advanced',
		description: 'Advanced configuration options',
		icon: 'settings',
		sections: [
			{
				id: 'debug',
				name: 'Debug',
				description: 'Debug and development settings',
				settings: []
			},
			{
				id: 'experimental',
				name: 'Experimental',
				description: 'Experimental features',
				settings: []
			}
		]
	}
];

// Initialize settings from storage
let initialSettings = defaultSettings;
if (typeof window !== 'undefined') {
	// Load settings asynchronously
	defaultSettingsSync.loadSettings(defaultSettings).then((loadedSettings) => {
		comprehensiveSettingsStore.set(loadedSettings);
	});
}

// Settings actions
export const comprehensiveSettingsActions = {
	// Get current settings
	getCurrentSettings: (): ComprehensiveSettings => {
		return get(comprehensiveSettingsStore);
	},

	// Get specific setting value
	getSetting: <T extends keyof ComprehensiveSettings>(
		category: T,
		key: keyof ComprehensiveSettings[T]
	): ComprehensiveSettings[T][keyof ComprehensiveSettings[T]] => {
		const settings = get(comprehensiveSettingsStore);
		return settings[category][key];
	},

	// Update settings with validation
	updateSetting: <T extends keyof ComprehensiveSettings>(
		category: T,
		key: keyof ComprehensiveSettings[T],
		value: ComprehensiveSettings[T][keyof ComprehensiveSettings[T]]
	): boolean => {
		const currentSettings = get(comprehensiveSettingsStore);
		const oldValue = currentSettings[category][key];

		// Create change event
		const changeEvent: SettingsChangeEvent = {
			settingId: `${String(category)}.${String(key)}`,
			oldValue: oldValue as SettingValue,
			newValue: value as SettingValue,
			category: String(category),
			section: String(key),
			timestamp: new Date()
		};

		// Update settings
		comprehensiveSettingsStore.update((settings) => ({
			...settings,
			[category]: {
				...settings[category],
				[key]: value
			}
		}));

		// Add to change history
		settingsChangeHistory.update((history) => [...history, changeEvent]);

		// Handle theme changes with mode-watcher
		if (category === 'appearance' && key === 'theme') {
			const themeValue = value as string;
			if (typeof window !== 'undefined') {
				if (themeValue === 'auto') {
					// Let mode-watcher handle auto detection
					setMode('system');
				} else if (themeValue === 'light' || themeValue === 'dark') {
					setMode(themeValue);
				}
			}
		}

		// Validate and persist
		comprehensiveSettingsActions.validateSettings();
		comprehensiveSettingsActions.persistSettings();

		// Apply CSS variables
		const updatedSettings = get(comprehensiveSettingsStore);
		updateCSSVariables(updatedSettings);

		return true;
	},

	// Update multiple settings at once
	updateSettings: (updates: Partial<ComprehensiveSettings>): boolean => {
		comprehensiveSettingsStore.update((settings) => ({
			...settings,
			...updates
		}));

		comprehensiveSettingsActions.validateSettings();
		comprehensiveSettingsActions.persistSettings();

		// Apply CSS variables
		const updatedSettings = get(comprehensiveSettingsStore);
		updateCSSVariables(updatedSettings);

		return true;
	},

	// Validate current settings
	validateSettings: (): SettingValidationResult => {
		const settings = get(comprehensiveSettingsStore);
		const result = settingsValidation.validateAllSettings(settings);

		settingsValidationErrors.set(result.errors);

		return result;
	},

	// Reset to defaults
	resetToDefaults: (): void => {
		comprehensiveSettingsStore.set({ ...defaultSettings });
		settingsChangeHistory.set([]);
		settingsValidationErrors.set([]);
		comprehensiveSettingsActions.persistSettings();
	},

	// Reset specific category
	resetCategory: <T extends keyof ComprehensiveSettings>(category: T): void => {
		comprehensiveSettingsStore.update((settings) => ({
			...settings,
			[category]: { ...defaultSettings[category] }
		}));
		comprehensiveSettingsActions.persistSettings();
	},

	// Persistence
	persistSettings: async (): Promise<boolean> => {
		if (typeof window === 'undefined') return false;

		const settings = get(comprehensiveSettingsStore);
		return await defaultSettingsSync.saveSettings(settings);
	},

	restoreSettings: async (): Promise<void> => {
		if (typeof window === 'undefined') return;

		try {
			const loadedSettings = await defaultSettingsSync.loadSettings(defaultSettings);
			comprehensiveSettingsStore.set(loadedSettings);
			comprehensiveSettingsActions.validateSettings();
		} catch (error) {
			console.error('Failed to restore settings:', error);
		}
	},

	// Import/Export
	exportSettings: async (includeSecrets = false): Promise<SettingsExport | null> => {
		return await defaultSettingsSync.exportSettings(true);
	},

	importSettings: async (settingsExport: SettingsExport): Promise<SettingsImportResult> => {
		const result: SettingsImportResult = {
			success: false,
			imported: [],
			skipped: [],
			errors: [],
			warnings: []
		};

		try {
			const importResult = await defaultSettingsSync.importSettings(
				settingsExport,
				defaultSettings
			);

			if (importResult.success && importResult.settings) {
				comprehensiveSettingsStore.set(importResult.settings);
				result.success = true;
				result.imported = Object.keys(settingsExport.settings || {});
			} else {
				result.errors.push({
					settingId: 'import',
					message: importResult.error || 'Import failed',
					code: 'IMPORT_ERROR'
				});
			}
		} catch (error) {
			result.errors.push({
				settingId: 'import',
				message: `Import failed: ${error}`,
				code: 'IMPORT_ERROR'
			});
		}

		return result;
	},

	// Presets
	applyPreset: (preset: SettingsPreset): boolean => {
		try {
			comprehensiveSettingsActions.updateSettings(preset.settings);
			return true;
		} catch (error) {
			console.error('Failed to apply preset:', error);
			return false;
		}
	},

	// Built-in presets
	getBuiltInPresets: (): SettingsPreset[] => [
		{
			id: 'default',
			name: 'Default',
			description: 'Default Aura IDE settings',
			settings: defaultSettings,
			tags: ['default', 'recommended']
		},
		{
			id: 'minimal',
			name: 'Minimal',
			description: 'Minimal UI with essential features only',
			settings: {
				appearance: {
					...defaultSettings.appearance,
					compactMode: true,
					animations: false
				},
				editor: {
					...defaultSettings.editor,
					miniMap: false,
					breadcrumbs: false,
					codeLens: false
				}
			},
			tags: ['minimal', 'performance']
		},
		{
			id: 'accessibility',
			name: 'Accessibility',
			description: 'Optimized for accessibility and screen readers',
			settings: {
				appearance: {
					...defaultSettings.appearance,
					fontSize: 16,
					lineHeight: 1.6,
					highContrast: true,
					animations: false
				},
				editor: {
					...defaultSettings.editor,
					renderWhitespace: 'all',
					cursorBlinking: 'solid',
					cursorStyle: 'block'
				}
			},
			tags: ['accessibility', 'high-contrast']
		},
		{
			id: 'performance',
			name: 'Performance',
			description: 'Optimized for maximum performance',
			settings: {
				appearance: {
					...defaultSettings.appearance,
					animations: false,
					transparency: 1.0
				},
				editor: {
					...defaultSettings.editor,
					miniMap: false,
					smoothScrolling: false,
					codeLens: false,
					inlayHints: false
				},
				performance: {
					...defaultSettings.performance,
					virtualScrolling: true,
					enableFileCache: true,
					maxRenderTime: 8
				}
			},
			tags: ['performance', 'fast']
		}
	],

	// Search settings
	searchSettings: (query: string): SettingSetting[] => {
		// This would search through all settings definitions
		// For now, return empty array
		return [];
	},

	// Live preview for theme changes
	previewThemeChange: (theme: string): void => {
		// Temporarily apply theme without persisting
		document.documentElement.setAttribute('data-theme-preview', theme);
	},

	applyThemePreview: (): void => {
		const previewTheme = document.documentElement.getAttribute('data-theme-preview');
		if (previewTheme) {
			comprehensiveSettingsActions.updateSetting('appearance', 'theme', previewTheme as any);
			document.documentElement.removeAttribute('data-theme-preview');
		}
	},

	cancelThemePreview: (): void => {
		document.documentElement.removeAttribute('data-theme-preview');
	}
};

// Derived stores
export const currentTheme = derived(
	comprehensiveSettingsStore,
	($settings) => $settings.appearance.theme
);

export const editorConfig = derived(comprehensiveSettingsStore, ($settings) => $settings.editor);

export const aiConfig = derived(comprehensiveSettingsStore, ($settings) => $settings.ai);

export const hasValidationErrors = derived(
	settingsValidationErrors,
	($errors) => $errors.length > 0
);

// Auto-persistence with sync utility and CSS application
if (typeof window !== 'undefined') {
	// Use the sync utility's auto-sync feature and apply CSS variables
	comprehensiveSettingsStore.subscribe((settings) => {
		defaultSettingsSync.scheduleAutoSync(settings, 500);
		updateCSSVariables(settings);
	});

	// Restore settings on load and initialize CSS
	comprehensiveSettingsActions.restoreSettings().then(() => {
		const settings = get(comprehensiveSettingsStore);
		initializeCSSVariables(settings);
	});
}
