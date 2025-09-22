import type {
	ComprehensiveSettings,
	SettingValidationResult,
	SettingValidationError,
	SettingValidationWarning,
	SettingValue
} from '$lib/types/settings';

// Validation rules for each setting
const validationRules = {
	// Appearance validation
	'appearance.fontSize': {
		min: 8,
		max: 72,
		message: 'Font size must be between 8 and 72 pixels'
	},
	'appearance.lineHeight': {
		min: 1.0,
		max: 3.0,
		message: 'Line height must be between 1.0 and 3.0'
	},
	'appearance.transparency': {
		min: 0.1,
		max: 1.0,
		message: 'Transparency must be between 0.1 and 1.0'
	},
	'appearance.fontFamily': {
		required: true,
		minLength: 1,
		message: 'Font family is required'
	},

	// Editor validation
	'editor.tabSize': {
		min: 1,
		max: 8,
		message: 'Tab size must be between 1 and 8 spaces'
	},
	'editor.autoSaveDelay': {
		min: 100,
		max: 30000,
		message: 'Auto save delay must be between 100ms and 30 seconds'
	},
	'editor.scrollBeyondLastColumn': {
		min: 0,
		max: 100,
		message: 'Scroll beyond last column must be between 0 and 100'
	},
	'editor.cursorWidth': {
		min: 1,
		max: 10,
		message: 'Cursor width must be between 1 and 10 pixels'
	},

	// AI validation
	'ai.temperature': {
		min: 0.0,
		max: 2.0,
		message: 'AI temperature must be between 0.0 and 2.0'
	},
	'ai.maxTokens': {
		min: 1,
		max: 8192,
		message: 'Max tokens must be between 1 and 8192'
	},
	'ai.suggestDelay': {
		min: 0,
		max: 5000,
		message: 'Suggest delay must be between 0 and 5000ms'
	},
	'ai.contextLines': {
		min: 0,
		max: 1000,
		message: 'Context lines must be between 0 and 1000'
	},

	// Terminal validation
	'terminal.fontSize': {
		min: 8,
		max: 32,
		message: 'Terminal font size must be between 8 and 32 pixels'
	},
	'terminal.lineHeight': {
		min: 1.0,
		max: 3.0,
		message: 'Terminal line height must be between 1.0 and 3.0'
	},
	'terminal.scrollback': {
		min: 100,
		max: 100000,
		message: 'Scrollback must be between 100 and 100,000 lines'
	},

	// Performance validation
	'performance.maxMemoryUsage': {
		min: 128,
		max: 8192,
		message: 'Max memory usage must be between 128MB and 8GB'
	},
	'performance.maxRenderTime': {
		min: 8,
		max: 100,
		message: 'Max render time must be between 8 and 100ms'
	},
	'performance.maxFileSize': {
		min: 1,
		max: 1000,
		message: 'Max file size must be between 1MB and 1GB'
	},
	'performance.maxSearchResults': {
		min: 10,
		max: 10000,
		message: 'Max search results must be between 10 and 10,000'
	},
	'performance.searchTimeout': {
		min: 1000,
		max: 60000,
		message: 'Search timeout must be between 1 and 60 seconds'
	}
};

// Custom validation functions
const customValidators = {
	// Validate font family format
	validateFontFamily: (fontFamily: string): string | null => {
		if (!fontFamily || fontFamily.trim().length === 0) {
			return 'Font family cannot be empty';
		}

		// Check for basic font family format
		const validFontPattern = /^[a-zA-Z0-9\s,"'-]+$/;
		if (!validFontPattern.test(fontFamily)) {
			return 'Font family contains invalid characters';
		}

		return null;
	},

	// Validate API key format (basic check)
	validateApiKey: (apiKey: string): string | null => {
		if (!apiKey) return null; // API key is optional

		if (apiKey.length < 10) {
			return 'API key appears to be too short';
		}

		if (apiKey.includes(' ')) {
			return 'API key should not contain spaces';
		}

		return null;
	},

	// Validate shell path
	validateShellPath: (shellPath: string): string | null => {
		if (!shellPath || shellPath.trim().length === 0) {
			return 'Shell path is required';
		}

		// Basic path validation
		if (!shellPath.startsWith('/') && !shellPath.match(/^[A-Za-z]:\\/)) {
			return 'Shell path must be an absolute path';
		}

		return null;
	},

	// Validate file patterns
	validateFilePattern: (pattern: string): string | null => {
		if (!pattern) return 'File pattern cannot be empty';

		try {
			// Test if it's a valid glob pattern by creating a simple regex
			new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
			return null;
		} catch (error) {
			return 'Invalid file pattern format';
		}
	},

	// Validate color hex code
	validateHexColor: (color: string): string | null => {
		if (!color) return 'Color is required';

		const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
		if (!hexPattern.test(color)) {
			return 'Color must be a valid hex code (e.g., #FF0000)';
		}

		return null;
	},

	// Validate URL format
	validateUrl: (url: string): string | null => {
		if (!url) return null; // URL might be optional

		try {
			new URL(url);
			return null;
		} catch (error) {
			return 'Invalid URL format';
		}
	},

	// Validate port number
	validatePort: (port: number): string | null => {
		if (port < 1 || port > 65535) {
			return 'Port must be between 1 and 65535';
		}
		return null;
	}
};

// Get nested property value
function getNestedValue(obj: any, path: string): any {
	return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Set nested property value
function setNestedValue(obj: any, path: string, value: any): void {
	const keys = path.split('.');
	const lastKey = keys.pop()!;
	const target = keys.reduce((current, key) => {
		if (!current[key]) current[key] = {};
		return current[key];
	}, obj);
	target[lastKey] = value;
}

// Validate a single setting
export function validateSetting(
	settingPath: string,
	value: SettingValue,
	settings: ComprehensiveSettings
): SettingValidationError | null {
	const rule = validationRules[settingPath as keyof typeof validationRules];

	if (!rule) return null; // No validation rule defined

	// Required validation
	if (rule.required && (value === null || value === undefined || value === '')) {
		return {
			settingId: settingPath,
			message: rule.message || `${settingPath} is required`,
			code: 'REQUIRED'
		};
	}

	// Skip further validation if value is empty and not required
	if (!rule.required && (value === null || value === undefined || value === '')) {
		return null;
	}

	// Number validation
	if (typeof value === 'number') {
		if (rule.min !== undefined && value < rule.min) {
			return {
				settingId: settingPath,
				message: rule.message || `${settingPath} must be at least ${rule.min}`,
				code: 'MIN_VALUE'
			};
		}

		if (rule.max !== undefined && value > rule.max) {
			return {
				settingId: settingPath,
				message: rule.message || `${settingPath} must be at most ${rule.max}`,
				code: 'MAX_VALUE'
			};
		}
	}

	// String validation
	if (typeof value === 'string') {
		if (rule.minLength !== undefined && value.length < rule.minLength) {
			return {
				settingId: settingPath,
				message: rule.message || `${settingPath} must be at least ${rule.minLength} characters`,
				code: 'MIN_LENGTH'
			};
		}

		if (rule.maxLength !== undefined && value.length > rule.maxLength) {
			return {
				settingId: settingPath,
				message: rule.message || `${settingPath} must be at most ${rule.maxLength} characters`,
				code: 'MAX_LENGTH'
			};
		}
	}

	// Custom validation
	const customValidationResult = runCustomValidation(settingPath, value);
	if (customValidationResult) {
		return {
			settingId: settingPath,
			message: customValidationResult,
			code: 'CUSTOM_VALIDATION'
		};
	}

	return null;
}

// Run custom validation for specific settings
function runCustomValidation(settingPath: string, value: SettingValue): string | null {
	switch (settingPath) {
		case 'appearance.fontFamily':
			return customValidators.validateFontFamily(value as string);

		case 'appearance.accentColor':
			return customValidators.validateHexColor(value as string);

		case 'ai.apiKey':
			return customValidators.validateApiKey(value as string);

		case 'terminal.shell':
			return customValidators.validateShellPath(value as string);

		case 'privacy.proxySettings.port':
			return customValidators.validatePort(value as number);

		default:
			return null;
	}
}

// Validate all settings
export function validateAllSettings(settings: ComprehensiveSettings): SettingValidationResult {
	const errors: SettingValidationError[] = [];
	const warnings: SettingValidationWarning[] = [];

	// Validate each setting with a rule
	Object.keys(validationRules).forEach((settingPath) => {
		const value = getNestedValue(settings, settingPath);
		const error = validateSetting(settingPath, value, settings);

		if (error) {
			errors.push(error);
		}
	});

	// Cross-setting validation
	const crossValidationResults = validateCrossSettings(settings);
	errors.push(...crossValidationResults.errors);
	warnings.push(...crossValidationResults.warnings);

	return {
		isValid: errors.length === 0,
		errors,
		warnings
	};
}

// Validate settings that depend on each other
function validateCrossSettings(settings: ComprehensiveSettings): {
	errors: SettingValidationError[];
	warnings: SettingValidationWarning[];
} {
	const errors: SettingValidationError[] = [];
	const warnings: SettingValidationWarning[] = [];

	// AI settings validation
	if (settings.ai.enabled && !settings.ai.apiKey && settings.ai.provider !== 'local') {
		warnings.push({
			settingId: 'ai.apiKey',
			message: 'AI is enabled but no API key is configured',
			code: 'MISSING_API_KEY'
		});
	}

	// Performance vs feature conflicts
	if (settings.performance.enableGPUAcceleration && settings.appearance.transparency < 1.0) {
		warnings.push({
			settingId: 'appearance.transparency',
			message: 'Transparency effects may impact GPU acceleration performance',
			code: 'PERFORMANCE_WARNING'
		});
	}

	// Memory usage warnings
	if (settings.performance.maxMemoryUsage < 256 && settings.editor.miniMap) {
		warnings.push({
			settingId: 'performance.maxMemoryUsage',
			message: 'Low memory limit with minimap enabled may cause performance issues',
			code: 'MEMORY_WARNING'
		});
	}

	// Accessibility warnings
	if (settings.appearance.theme === 'high-contrast' && settings.appearance.transparency < 1.0) {
		warnings.push({
			settingId: 'appearance.transparency',
			message: 'Transparency effects may reduce accessibility in high contrast mode',
			code: 'ACCESSIBILITY_WARNING'
		});
	}

	// Terminal shell validation
	if (settings.terminal.shell && !settings.terminal.shell.startsWith('/')) {
		if (typeof window !== 'undefined' && !navigator.platform.toLowerCase().includes('win')) {
			errors.push({
				settingId: 'terminal.shell',
				message: 'Shell path must be absolute on Unix-like systems',
				code: 'INVALID_SHELL_PATH'
			});
		}
	}

	return { errors, warnings };
}

// Sanitize settings to ensure they're within valid ranges
export function sanitizeSettings(settings: ComprehensiveSettings): ComprehensiveSettings {
	const sanitized = JSON.parse(JSON.stringify(settings)); // Deep clone

	// Sanitize numeric values
	Object.entries(validationRules).forEach(([path, rule]) => {
		const value = getNestedValue(sanitized, path);

		if (typeof value === 'number') {
			let sanitizedValue = value;

			if (rule.min !== undefined && value < rule.min) {
				sanitizedValue = rule.min;
			}

			if (rule.max !== undefined && value > rule.max) {
				sanitizedValue = rule.max;
			}

			if (sanitizedValue !== value) {
				setNestedValue(sanitized, path, sanitizedValue);
			}
		}
	});

	return sanitized;
}

// Get validation summary
export function getValidationSummary(result: SettingValidationResult): string {
	if (result.isValid) {
		return 'All settings are valid';
	}

	const errorCount = result.errors.length;
	const warningCount = result.warnings.length;

	let summary = '';

	if (errorCount > 0) {
		summary += `${errorCount} error${errorCount !== 1 ? 's' : ''}`;
	}

	if (warningCount > 0) {
		if (summary) summary += ', ';
		summary += `${warningCount} warning${warningCount !== 1 ? 's' : ''}`;
	}

	return summary || 'No issues found';
}

// Export validation utilities
export const settingsValidation = {
	validateSetting,
	validateAllSettings,
	sanitizeSettings,
	getValidationSummary,
	customValidators
};
