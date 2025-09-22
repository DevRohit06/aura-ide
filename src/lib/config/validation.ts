/**
 * Configuration Validation
 * Validates configuration objects and environment variables
 */

import type {
	AppConfig,
	AuthConfig,
	ConfigValidationError,
	ConfigValidationResult,
	DatabaseConfig,
	DaytonaConfig,
	HeliconeConfig,
	R2Config,
	SandboxExecutionConfig
} from './types.js';

export class ConfigValidator {
	private errors: ConfigValidationError[] = [];
	private warnings: ConfigValidationError[] = [];

	validate(config: SandboxExecutionConfig): ConfigValidationResult {
		this.errors = [];
		this.warnings = [];

		this.validateDaytonaConfig(config.daytona);
		this.validateR2Config(config.r2);
		this.validateDatabaseConfig(config.database);
		this.validateAuthConfig(config.auth);
		this.validateHeliconeConfig(config.helicone);
		this.validateAppConfig(config.app);

		return {
			isValid: this.errors.length === 0,
			errors: this.errors,
			warnings: this.warnings
		};
	}

	private validateDaytonaConfig(config: DaytonaConfig): void {
		if (!config.enabled) {
			this.warnings.push({
				field: 'daytona.enabled',
				message: 'Daytona is disabled'
			});
			return;
		}

		this.validateRequired('daytona.apiKey', config.apiKey);
		this.validateRequired('daytona.baseUrl', config.baseUrl);
		this.validateRequired('daytona.workspaceTemplate', config.workspaceTemplate);

		if (config.timeout < 1000) {
			this.errors.push({
				field: 'daytona.timeout',
				message: 'Timeout must be at least 1000ms',
				value: config.timeout
			});
		}

		if (config.retryAttempts < 1 || config.retryAttempts > 10) {
			this.errors.push({
				field: 'daytona.retryAttempts',
				message: 'Retry attempts must be between 1 and 10',
				value: config.retryAttempts
			});
		}

		// Validate URL format
		if (config.baseUrl && !this.isValidUrl(config.baseUrl)) {
			this.errors.push({
				field: 'daytona.baseUrl',
				message: 'Base URL must be a valid URL',
				value: config.baseUrl
			});
		}

		// Validate workspace defaults
		if (config.workspaceDefaults) {
			this.validateWorkspaceDefaults(config.workspaceDefaults);
		}
	}

	private validateR2Config(config: R2Config): void {
		this.validateRequired('r2.accessKeyId', config.accessKeyId);
		this.validateRequired('r2.secretAccessKey', config.secretAccessKey);
		this.validateRequired('r2.accountId', config.accountId);
		this.validateRequired('r2.defaultBucket', config.defaultBucket);
		this.validateRequired('r2.endpoint', config.endpoint);

		if (config.maxFileSize < 1024 || config.maxFileSize > 5 * 1024 * 1024 * 1024) {
			this.errors.push({
				field: 'r2.maxFileSize',
				message: 'Max file size must be between 1KB and 5GB',
				value: config.maxFileSize
			});
		}

		if (config.multipartThreshold < 1024 || config.multipartThreshold > config.maxFileSize) {
			this.errors.push({
				field: 'r2.multipartThreshold',
				message: 'Multipart threshold must be between 1KB and max file size',
				value: config.multipartThreshold
			});
		}

		// Validate bucket name format
		if (config.defaultBucket && !this.isValidBucketName(config.defaultBucket)) {
			this.errors.push({
				field: 'r2.defaultBucket',
				message: 'Bucket name must be valid (3-63 chars, lowercase, no special chars)',
				value: config.defaultBucket
			});
		}

		// Validate endpoint URL
		if (config.endpoint && !this.isValidUrl(config.endpoint)) {
			this.errors.push({
				field: 'r2.endpoint',
				message: 'Endpoint must be a valid URL',
				value: config.endpoint
			});
		}
	}

	private validateDatabaseConfig(config: DatabaseConfig): void {
		this.validateRequired('database.url', config.url);

		if (config.maxPoolSize < 1 || config.maxPoolSize > 100) {
			this.errors.push({
				field: 'database.maxPoolSize',
				message: 'Max pool size must be between 1 and 100',
				value: config.maxPoolSize
			});
		}

		if (config.minPoolSize < 0 || config.minPoolSize > config.maxPoolSize) {
			this.errors.push({
				field: 'database.minPoolSize',
				message: 'Min pool size must be between 0 and max pool size',
				value: config.minPoolSize
			});
		}

		// Validate MongoDB URL format
		if (
			config.url &&
			!config.url.startsWith('mongodb://') &&
			!config.url.startsWith('mongodb+srv://')
		) {
			this.errors.push({
				field: 'database.url',
				message: 'Database URL must be a valid MongoDB connection string',
				value: config.url.substring(0, 20) + '...'
			});
		}
	}

	private validateAuthConfig(config: AuthConfig): void {
		this.validateRequired('auth.secret', config.secret);
		this.validateRequired('auth.origin', config.origin);
		this.validateRequired('auth.publicOrigin', config.publicOrigin);

		if (config.secret && config.secret.length < 32) {
			this.errors.push({
				field: 'auth.secret',
				message: 'Auth secret must be at least 32 characters long',
				value: `${config.secret.length} characters`
			});
		}

		// Validate URLs
		if (config.origin && !this.isValidUrl(config.origin)) {
			this.errors.push({
				field: 'auth.origin',
				message: 'Origin must be a valid URL',
				value: config.origin
			});
		}

		if (config.publicOrigin && !this.isValidUrl(config.publicOrigin)) {
			this.errors.push({
				field: 'auth.publicOrigin',
				message: 'Public origin must be a valid URL',
				value: config.publicOrigin
			});
		}

		// OAuth validation
		if (config.google.clientId && !config.google.clientSecret) {
			this.warnings.push({
				field: 'auth.google.clientSecret',
				message: 'Google OAuth client secret is missing'
			});
		}

		if (config.github.clientId && !config.github.clientSecret) {
			this.warnings.push({
				field: 'auth.github.clientSecret',
				message: 'GitHub OAuth client secret is missing'
			});
		}
	}

	private validateHeliconeConfig(config: HeliconeConfig): void {
		if (!config.apiKey) {
			this.warnings.push({
				field: 'helicone.apiKey',
				message: 'Helicone API key is missing - AI features may not work'
			});
		}

		if (config.openaiBaseUrl && !this.isValidUrl(config.openaiBaseUrl)) {
			this.errors.push({
				field: 'helicone.openaiBaseUrl',
				message: 'OpenAI base URL must be a valid URL',
				value: config.openaiBaseUrl
			});
		}

		if (config.anthropicBaseUrl && !this.isValidUrl(config.anthropicBaseUrl)) {
			this.errors.push({
				field: 'helicone.anthropicBaseUrl',
				message: 'Anthropic base URL must be a valid URL',
				value: config.anthropicBaseUrl
			});
		}

		if (config.defaultTemperature < 0 || config.defaultTemperature > 2) {
			this.errors.push({
				field: 'helicone.defaultTemperature',
				message: 'Default temperature must be between 0 and 2',
				value: config.defaultTemperature
			});
		}
	}

	private validateAppConfig(config: AppConfig): void {
		if (config.port < 1 || config.port > 65535) {
			this.errors.push({
				field: 'app.port',
				message: 'Port must be between 1 and 65535',
				value: config.port
			});
		}

		if (config.maxConcurrentSessions < 1 || config.maxConcurrentSessions > 1000) {
			this.errors.push({
				field: 'app.maxConcurrentSessions',
				message: 'Max concurrent sessions must be between 1 and 1000',
				value: config.maxConcurrentSessions
			});
		}

		if (config.sessionTimeoutMs < 60000) {
			this.errors.push({
				field: 'app.sessionTimeoutMs',
				message: 'Session timeout must be at least 60 seconds',
				value: config.sessionTimeoutMs
			});
		}

		if (config.fileUploadLimitMb < 1 || config.fileUploadLimitMb > 1000) {
			this.errors.push({
				field: 'app.fileUploadLimitMb',
				message: 'File upload limit must be between 1MB and 1000MB',
				value: config.fileUploadLimitMb
			});
		}

		const validEnvironments = ['development', 'production', 'test'];
		if (!validEnvironments.includes(config.environment)) {
			this.errors.push({
				field: 'app.environment',
				message: 'Environment must be one of: development, production, test',
				value: config.environment
			});
		}

		const validLogLevels = ['debug', 'info', 'warn', 'error'];
		if (!validLogLevels.includes(config.logLevel)) {
			this.errors.push({
				field: 'app.logLevel',
				message: 'Log level must be one of: debug, info, warn, error',
				value: config.logLevel
			});
		}
	}

	private validateWorkspaceDefaults(defaults: {
		cpu: string;
		memory: string;
		storage: string;
	}): void {
		// Validate CPU format (e.g., "2", "0.5", "4")
		if (!/^\d+(\.\d+)?$/.test(defaults.cpu)) {
			this.errors.push({
				field: 'daytona.workspaceDefaults.cpu',
				message: 'CPU must be a valid number (e.g., "2", "0.5")',
				value: defaults.cpu
			});
		}

		// Validate memory format (e.g., "4Gi", "512Mi")
		if (!/^\d+[GM]i$/.test(defaults.memory)) {
			this.errors.push({
				field: 'daytona.workspaceDefaults.memory',
				message: 'Memory must be in format like "4Gi" or "512Mi"',
				value: defaults.memory
			});
		}

		// Validate storage format (e.g., "10Gi", "500Mi")
		if (!/^\d+[GM]i$/.test(defaults.storage)) {
			this.errors.push({
				field: 'daytona.workspaceDefaults.storage',
				message: 'Storage must be in format like "10Gi" or "500Mi"',
				value: defaults.storage
			});
		}
	}

	private validateRequired(field: string, value: any): void {
		if (value === undefined || value === null || value === '') {
			this.errors.push({
				field,
				message: 'This field is required',
				value
			});
		}
	}

	private isValidUrl(url: string): boolean {
		try {
			new URL(url);
			return true;
		} catch {
			return false;
		}
	}

	private isValidBucketName(name: string): boolean {
		// Basic S3/R2 bucket name validation
		const bucketNameRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
		return name.length >= 3 && name.length <= 63 && bucketNameRegex.test(name);
	}
}

export const configValidator = new ConfigValidator();
