// Comprehensive settings types for Aura IDE

export interface SettingsCategory {
	id: string;
	name: string;
	description: string;
	icon: string;
	sections: SettingsSection[];
}

export interface SettingsSection {
	id: string;
	name: string;
	description?: string;
	settings: SettingSetting[];
}

export interface SettingSetting {
	id: string;
	name: string;
	description?: string;
	type: SettingType;
	category: string;
	section: string;
	defaultValue: SettingValue;
	validation?: SettingValidation;
	dependencies?: SettingDependency[];
	tags?: string[];
}

export type SettingType =
	| 'boolean'
	| 'number'
	| 'string'
	| 'select'
	| 'multiselect'
	| 'color'
	| 'font'
	| 'keybinding'
	| 'file'
	| 'directory';

export type SettingValue = boolean | number | string | string[] | { [key: string]: any };

export interface SettingValidation {
	required?: boolean;
	min?: number;
	max?: number;
	minLength?: number;
	maxLength?: number;
	pattern?: string;
	options?: SettingOption[];
	custom?: (value: SettingValue) => string | null;
}

export interface SettingOption {
	value: string | number;
	label: string;
	description?: string;
	disabled?: boolean;
}

export interface SettingDependency {
	settingId: string;
	condition: 'equals' | 'not-equals' | 'greater-than' | 'less-than' | 'contains';
	value: SettingValue;
}

// Comprehensive settings interface
export interface ComprehensiveSettings {
	// Appearance settings
	appearance: AppearanceSettings;

	// Editor settings
	editor: EditorSettings;

	// Keyboard settings
	keyboard: KeyboardSettings;

	// AI settings
	ai: AISettings;

	// Terminal settings
	terminal: TerminalSettings;

	// File settings
	files: FileSettings;

	// Performance settings
	performance: PerformanceSettings;

	// Privacy settings
	privacy: PrivacySettings;

	// Advanced settings
	advanced: AdvancedSettings;
}

export interface AppearanceSettings {
	theme: 'light' | 'dark' | 'system'; // Compatible with mode-watcher
	colorScheme: string;
	accentColor: string;
	fontSize: number;
	fontFamily: string;
	lineHeight: number;
	iconTheme: string;
	compactMode: boolean;
	animations: boolean;
	transparency: number;
	customCSS: string;
	highContrast: boolean; // Separate flag for high contrast mode
}

export interface EditorSettings {
	// Display
	lineNumbers: boolean;
	lineNumbersRelative: boolean;
	wordWrap: boolean;
	miniMap: boolean;
	breadcrumbs: boolean;
	rulers: number[];
	renderWhitespace: 'none' | 'boundary' | 'selection' | 'all';
	renderControlCharacters: boolean;

	// Behavior
	autoSave: boolean;
	autoSaveDelay: number;
	formatOnSave: boolean;
	formatOnPaste: boolean;
	trimTrailingWhitespace: boolean;
	insertFinalNewline: boolean;

	// Indentation
	tabSize: number;
	insertSpaces: boolean;
	detectIndentation: boolean;

	// Selection
	multiCursorModifier: 'ctrlCmd' | 'alt';
	selectionHighlight: boolean;
	occurrencesHighlight: boolean;

	// Code features
	codeCompletion: boolean;
	quickSuggestions: boolean;
	parameterHints: boolean;
	codeLens: boolean;
	inlayHints: boolean;

	// Folding
	folding: boolean;
	foldingStrategy: 'auto' | 'indentation';
	showFoldingControls: 'always' | 'mouseover';

	// Scrolling
	smoothScrolling: boolean;
	scrollBeyondLastLine: boolean;
	scrollBeyondLastColumn: number;

	// Cursor
	cursorBlinking: 'blink' | 'smooth' | 'phase' | 'expand' | 'solid';
	cursorStyle: 'line' | 'block' | 'underline' | 'line-thin' | 'block-outline' | 'underline-thin';
	cursorWidth: number;
}

export interface KeyboardSettings {
	keyMap: 'default' | 'vim' | 'emacs';
	customKeybindings: KeyBinding[];
	enableMultiCursor: boolean;
	enableBracketMatching: boolean;
	enableAutoClosingBrackets: boolean;
	enableAutoClosingQuotes: boolean;
	enableAutoSurround: boolean;
}

export interface KeyBinding {
	id: string;
	command: string;
	key: string;
	when?: string;
	args?: any;
}

export interface AISettings {
	enabled: boolean;
	provider: 'openai' | 'anthropic' | 'local' | 'custom';
	apiKey: string;
	model: string;
	temperature: number;
	maxTokens: number;

	// Features
	codeCompletion: boolean;
	codeGeneration: boolean;
	codeExplanation: boolean;
	errorAnalysis: boolean;
	refactoring: boolean;

	// Behavior
	autoSuggest: boolean;
	suggestDelay: number;
	contextLines: number;
	includeComments: boolean;
	includeTests: boolean;

	// Privacy
	sendTelemetry: boolean;
	storeConversations: boolean;
	shareCodeContext: boolean;
}

export interface TerminalSettings {
	shell: string;
	fontSize: number;
	fontFamily: string;
	lineHeight: number;
	cursorBlinking: boolean;
	cursorStyle: 'block' | 'underline' | 'bar';
	scrollback: number;

	// Behavior
	confirmOnExit: boolean;
	copyOnSelection: boolean;
	pasteOnRightClick: boolean;
	wordSeparators: string;

	// Environment
	env: { [key: string]: string };
	cwd: string;

	// Integration
	enableBell: boolean;
	bellSound: string;
	rightClickSelectsWord: boolean;
}

export interface FileSettings {
	// Associations
	associations: { [pattern: string]: string };

	// Behavior
	autoReveal: boolean;
	confirmDelete: boolean;
	confirmDragAndDrop: boolean;
	enableTrash: boolean;

	// Watching
	watcherExclude: string[];
	watcherInclude: string[];
	usePolling: boolean;

	// Encoding
	defaultEncoding: string;
	autoGuessEncoding: boolean;

	// Backup
	enableBackup: boolean;
	backupLocation: string;
	maxBackups: number;
}

export interface PerformanceSettings {
	// Rendering
	enableGPUAcceleration: boolean;
	maxRenderTime: number;
	virtualScrolling: boolean;

	// Memory
	maxMemoryUsage: number;
	garbageCollectionInterval: number;

	// File handling
	maxFileSize: number;
	largeFileThreshold: number;
	enableFileCache: boolean;

	// Search
	maxSearchResults: number;
	searchTimeout: number;
	indexingEnabled: boolean;
}

export interface PrivacySettings {
	telemetry: boolean;
	crashReporting: boolean;
	usageStatistics: boolean;
	improveProduct: boolean;

	// Data
	clearDataOnExit: boolean;
	encryptLocalData: boolean;

	// Network
	allowRemoteConnections: boolean;
	proxySettings: ProxySettings;
}

export interface ProxySettings {
	enabled: boolean;
	host: string;
	port: number;
	username?: string;
	password?: string;
	bypassList: string[];
}

export interface AdvancedSettings {
	// Debug
	enableDebugMode: boolean;
	logLevel: 'error' | 'warn' | 'info' | 'debug' | 'trace';
	enableDevTools: boolean;

	// Experimental
	experimentalFeatures: string[];

	// Updates
	autoUpdate: boolean;
	updateChannel: 'stable' | 'beta' | 'alpha';

	// Extensions
	enableExtensions: boolean;
	extensionTimeout: number;

	// Security
	enableSandbox: boolean;
	allowUnsafeEval: boolean;
}

// Settings validation result
export interface SettingValidationResult {
	isValid: boolean;
	errors: SettingValidationError[];
	warnings: SettingValidationWarning[];
}

export interface SettingValidationError {
	settingId: string;
	message: string;
	code: string;
}

export interface SettingValidationWarning {
	settingId: string;
	message: string;
	code: string;
}

// Settings export/import
export interface SettingsExport {
	version: string;
	timestamp: string;
	settings: Partial<ComprehensiveSettings>;
	metadata: {
		exportedBy: string;
		description?: string;
		tags?: string[];
	};
}

export interface SettingsImportResult {
	success: boolean;
	imported: string[];
	skipped: string[];
	errors: SettingValidationError[];
	warnings: SettingValidationWarning[];
}

// Settings change event
export interface SettingsChangeEvent {
	settingId: string;
	oldValue: SettingValue;
	newValue: SettingValue;
	category: string;
	section: string;
	timestamp: Date;
}

// Settings preset
export interface SettingsPreset {
	id: string;
	name: string;
	description: string;
	settings: Partial<ComprehensiveSettings>;
	tags: string[];
	author?: string;
	version?: string;
}
