import { describe, it, expect } from 'vitest';
import {
	validateSetting,
	validateAllSettings,
	sanitizeSettings,
	getValidationSummary,
	settingsValidation
} from '../settings-validation';
import type { ComprehensiveSettings } from '$lib/types/settings';

// Mock settings for testing
const mockValidSettings: ComprehensiveSettings = {
	appearance: {
		theme: 'dark',
		colorScheme: 'onedark',
		accentColor: '#007acc',
		fontSize: 14,
		fontFamily: 'Monaco, Menlo, monospace',
		lineHeight: 1.4,
		iconTheme: 'vscode-icons',
		compactMode: false,
		animations: true,
		transparency: 1.0,
		customCSS: ''
	},
	editor: {
		lineNumbers: true,
		lineNumbersRelative: false,
		wordWrap: false,
		miniMap: true,
		breadcrumbs: true,
		rulers: [],
		renderWhitespace: 'none',
		renderControlCharacters: false,
		autoSave: true,
		autoSaveDelay: 1000,
		formatOnSave: true,
		formatOnPaste: false,
		trimTrailingWhitespace: true,
		insertFinalNewline: true,
		tabSize: 2,
		insertSpaces: true,
		detectIndentation: true,
		multiCursorModifier: 'ctrlCmd',
		selectionHighlight: true,
		occurrencesHighlight: true,
		codeCompletion: true,
		quickSuggestions: true,
		parameterHints: true,
		codeLens: true,
		inlayHints: false,
		folding: true,
		foldingStrategy: 'auto',
		showFoldingControls: 'mouseover',
		smoothScrolling: true,
		scrollBeyondLastLine: true,
		scrollBeyondLastColumn: 5,
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
		apiKey: 'test-key-1234567890',
		model: 'gpt-4',
		temperature: 0.7,
		maxTokens: 2048,
		codeCompletion: true,
		codeGeneration: true,
		codeExplanation: true,
		errorAnalysis: true,
		refactoring: true,
		autoSuggest: true,
		suggestDelay: 500,
		contextLines: 50,
		includeComments: true,
		includeTests: false,
		sendTelemetry: false,
		storeConversations: true,
		shareCodeContext: true
	},
	terminal: {
		shell: '/bin/bash',
		fontSize: 14,
		fontFamily: 'Monaco, Menlo, monospace',
		lineHeight: 1.2,
		cursorBlinking: true,
		cursorStyle: 'block',
		scrollback: 1000,
		confirmOnExit: true,
		copyOnSelection: false,
		pasteOnRightClick: true,
		wordSeparators: ' ()[]{}\'"`─',
		env: {},
		cwd: '',
		enableBell: false,
		bellSound: 'default',
		rightClickSelectsWord: true
	},
	files: {
		associations: {},
		autoReveal: true,
		confirmDelete: true,
		confirmDragAndDrop: false,
		enableTrash: true,
		watcherExclude: [],
		watcherInclude: [],
		usePolling: false,
		defaultEncoding: 'utf8',
		autoGuessEncoding: true,
		enableBackup: false,
		backupLocation: '.aura/backups',
		maxBackups: 10
	},
	performance: {
		enableGPUAcceleration: true,
		maxRenderTime: 16,
		virtualScrolling: true,
		maxMemoryUsage: 512,
		garbageCollectionInterval: 30000,
		maxFileSize: 50,
		largeFileThreshold: 1,
		enableFileCache: true,
		maxSearchResults: 1000,
		searchTimeout: 5000,
		indexingEnabled: true
	},
	privacy: {
		telemetry: false,
		crashReporting: false,
		usageStatistics: false,
		improveProduct: false,
		clearDataOnExit: false,
		encryptLocalData: false,
		allowRemoteConnections: false,
		proxySettings: {
			enabled: false,
			host: '',
			port: 8080,
			bypassList: []
		}
	},
	advanced: {
		enableDebugMode: false,
		logLevel: 'info',
		enableDevTools: false,
		experimentalFeatures: [],
		autoUpdate: true,
		updateChannel: 'stable',
		enableExtensions: true,
		extensionTimeout: 10000,
		enableSandbox: true,
		allowUnsafeEval: false
	}
};

describe('Settings Validation', () => {
	describe('Individual Setting Validation', () => {
		it('should validate font size within range', () => {
			const error = validateSetting('appearance.fontSize', 14, mockValidSettings);
			expect(error).toBeNull();
		});

		it('should reject font size below minimum', () => {
			const error = validateSetting('appearance.fontSize', 5, mockValidSettings);
			expect(error).toBeDefined();
			expect(error?.code).toBe('MIN_VALUE');
		});

		it('should reject font size above maximum', () => {
			const error = validateSetting('appearance.fontSize', 100, mockValidSettings);
			expect(error).toBeDefined();
			expect(error?.code).toBe('MAX_VALUE');
		});

		it('should validate line height within range', () => {
			const error = validateSetting('appearance.lineHeight', 1.4, mockValidSettings);
			expect(error).toBeNull();
		});

		it('should reject line height below minimum', () => {
			const error = validateSetting('appearance.lineHeight', 0.5, mockValidSettings);
			expect(error).toBeDefined();
			expect(error?.code).toBe('MIN_VALUE');
		});

		it('should validate tab size within range', () => {
			const error = validateSetting('editor.tabSize', 4, mockValidSettings);
			expect(error).toBeNull();
		});

		it('should reject invalid tab size', () => {
			const error = validateSetting('editor.tabSize', 0, mockValidSettings);
			expect(error).toBeDefined();
			expect(error?.code).toBe('MIN_VALUE');
		});

		it('should validate AI temperature within range', () => {
			const error = validateSetting('ai.temperature', 0.7, mockValidSettings);
			expect(error).toBeNull();
		});

		it('should reject AI temperature above maximum', () => {
			const error = validateSetting('ai.temperature', 3.0, mockValidSettings);
			expect(error).toBeDefined();
			expect(error?.code).toBe('MAX_VALUE');
		});
	});

	describe('Custom Validation', () => {
		it('should validate font family format', () => {
			const { validateFontFamily } = settingsValidation.customValidators;

			expect(validateFontFamily('Monaco, Menlo, monospace')).toBeNull();
			expect(validateFontFamily('Arial')).toBeNull();
			expect(validateFontFamily('')).toBeDefined();
			expect(validateFontFamily('Invalid<>Font')).toBeDefined();
		});

		it('should validate API key format', () => {
			const { validateApiKey } = settingsValidation.customValidators;

			expect(validateApiKey('sk-1234567890abcdef')).toBeNull();
			expect(validateApiKey('')).toBeNull(); // Optional
			expect(validateApiKey('short')).toBeDefined();
			expect(validateApiKey('key with spaces')).toBeDefined();
		});

		it('should validate shell path format', () => {
			const { validateShellPath } = settingsValidation.customValidators;

			expect(validateShellPath('/bin/bash')).toBeNull();
			expect(validateShellPath('/usr/local/bin/zsh')).toBeNull();
			expect(validateShellPath('')).toBeDefined();
			expect(validateShellPath('relative/path')).toBeDefined();
		});

		it('should validate hex color format', () => {
			const { validateHexColor } = settingsValidation.customValidators;

			expect(validateHexColor('#FF0000')).toBeNull();
			expect(validateHexColor('#f00')).toBeNull();
			expect(validateHexColor('#123ABC')).toBeNull();
			expect(validateHexColor('')).toBeDefined();
			expect(validateHexColor('red')).toBeDefined();
			expect(validateHexColor('#GG0000')).toBeDefined();
		});

		it('should validate URL format', () => {
			const { validateUrl } = settingsValidation.customValidators;

			expect(validateUrl('https://example.com')).toBeNull();
			expect(validateUrl('http://localhost:3000')).toBeNull();
			expect(validateUrl('')).toBeNull(); // Optional
			expect(validateUrl('not-a-url')).toBeDefined();
			expect(validateUrl('ftp://invalid')).toBeDefined();
		});

		it('should validate port number', () => {
			const { validatePort } = settingsValidation.customValidators;

			expect(validatePort(8080)).toBeNull();
			expect(validatePort(80)).toBeNull();
			expect(validatePort(65535)).toBeNull();
			expect(validatePort(0)).toBeDefined();
			expect(validatePort(65536)).toBeDefined();
		});
	});

	describe('Complete Settings Validation', () => {
		it('should validate complete valid settings', () => {
			const result = validateAllSettings(mockValidSettings);

			expect(result.isValid).toBe(true);
			expect(result.errors.length).toBe(0);
		});

		it('should detect multiple validation errors', () => {
			const invalidSettings = {
				...mockValidSettings,
				appearance: {
					...mockValidSettings.appearance,
					fontSize: 5, // Too small
					lineHeight: 0.5, // Too small
					fontFamily: '' // Empty
				},
				editor: {
					...mockValidSettings.editor,
					tabSize: 0, // Too small
					autoSaveDelay: 50 // Too small
				}
			};

			const result = validateAllSettings(invalidSettings);

			expect(result.isValid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});

		it('should generate warnings for conflicting settings', () => {
			const conflictingSettings = {
				...mockValidSettings,
				ai: {
					...mockValidSettings.ai,
					enabled: true,
					apiKey: '' // AI enabled but no API key
				},
				performance: {
					...mockValidSettings.performance,
					maxMemoryUsage: 128 // Low memory with features enabled
				}
			};

			const result = validateAllSettings(conflictingSettings);

			expect(result.warnings.length).toBeGreaterThan(0);
		});
	});

	describe('Settings Sanitization', () => {
		it('should sanitize invalid numeric values', () => {
			const invalidSettings = {
				...mockValidSettings,
				appearance: {
					...mockValidSettings.appearance,
					fontSize: 5, // Too small, should be clamped to 8
					lineHeight: 5.0 // Too large, should be clamped to 3.0
				},
				editor: {
					...mockValidSettings.editor,
					tabSize: 0, // Too small, should be clamped to 1
					autoSaveDelay: 50 // Too small, should be clamped to 100
				}
			};

			const sanitized = sanitizeSettings(invalidSettings);

			expect(sanitized.appearance.fontSize).toBe(8);
			expect(sanitized.appearance.lineHeight).toBe(3.0);
			expect(sanitized.editor.tabSize).toBe(1);
			expect(sanitized.editor.autoSaveDelay).toBe(100);
		});

		it('should preserve valid values during sanitization', () => {
			const sanitized = sanitizeSettings(mockValidSettings);

			expect(sanitized.appearance.fontSize).toBe(14);
			expect(sanitized.editor.tabSize).toBe(2);
			expect(sanitized.ai.temperature).toBe(0.7);
		});
	});

	describe('Validation Summary', () => {
		it('should generate summary for valid settings', () => {
			const result = validateAllSettings(mockValidSettings);
			const summary = getValidationSummary(result);

			expect(summary).toBe('All settings are valid');
		});

		it('should generate summary for invalid settings', () => {
			const invalidSettings = {
				...mockValidSettings,
				appearance: {
					...mockValidSettings.appearance,
					fontSize: 5
				}
			};

			const result = validateAllSettings(invalidSettings);
			const summary = getValidationSummary(result);

			expect(summary).toContain('error');
		});

		it('should generate summary with both errors and warnings', () => {
			const problematicSettings = {
				...mockValidSettings,
				appearance: {
					...mockValidSettings.appearance,
					fontSize: 5 // Error
				},
				ai: {
					...mockValidSettings.ai,
					enabled: true,
					apiKey: '' // Warning
				}
			};

			const result = validateAllSettings(problematicSettings);
			const summary = getValidationSummary(result);

			expect(summary).toContain('error');
			expect(summary).toContain('warning');
		});
	});
});
