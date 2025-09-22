/**
 * Configuration Types
 * Centralized type definitions for all configuration objects
 */

export interface BaseConfig {
	enabled: boolean;
	retryAttempts: number;
	timeout: number;
}

export interface DaytonaConfig extends BaseConfig {
	apiKey: string;
	defaultLanguage: string;
	workspaceTemplate: string;
	enableGitIntegration: boolean;
	enablePortForwarding: boolean;
	workspaceDefaults: {
		cpu: string;
		memory: string;
		storage: string;
	};
}

// E2B Sandbox Configuration
export interface E2BConfig extends BaseConfig {
	apiKey: string;
	templateId: string;
	defaultEnvironment: string;
	enableFilesystem: boolean;
	enableNetwork: boolean;
	resourceLimits: {
		cpu: number;
		memory: number;
		disk: number;
	};
	sessionDefaults: {
		timeout: number;
		maxExecutionTime: number;
		keepAlive: boolean;
	};
}

// Template Management Configuration
export interface TemplateConfig {
	enabled: boolean;
	stackblitz: {
		apiBaseUrl: string;
		startersRepository: string;
		cacheTimeout: number;
		maxConcurrentDownloads: number;
	};
	github: {
		token: string;
		rateLimitPerHour: number;
		defaultBranch: string;
	};
	cache: {
		enabled: boolean;
		ttlHours: number;
		maxSize: number;
		compressionEnabled: boolean;
	};
}

// Sandbox Provider Configuration
export interface SandboxProviderConfig {
	defaultProvider: 'daytona' | 'e2b' | 'local';
	maxConcurrentSessions: number;
	sessionTimeoutMinutes: number;
	autoCleanupEnabled: boolean;
	resourceMonitoring: {
		enabled: boolean;
		intervalSeconds: number;
		alertThresholds: {
			cpu: number;
			memory: number;
			disk: number;
		};
	};
}

export interface R2Config {
	accessKeyId: string;
	secretAccessKey: string;
	accountId: string;
	defaultBucket: string;
	region: string;
	maxFileSize: number;
	multipartThreshold: number;
	mountPath: string;
	endpoint: string;
	// Enhanced for project storage
	projectStorage: {
		enabled: boolean;
		compressionEnabled: boolean;
		versioningEnabled: boolean;
		maxVersions: number;
		cleanupIntervalHours: number;
	};
}

export interface DatabaseConfig {
	url: string;
	dbName: string;
	maxPoolSize: number;
	minPoolSize: number;
	maxIdleTimeMs: number;
	serverSelectionTimeoutMs: number;
	socketTimeoutMs: number;
	connectTimeoutMs: number;
	// Sandbox-specific database config
	collections: {
		autoIndexing: boolean;
		textSearchEnabled: boolean;
		analyticsRetentionDays: number;
		backupEnabled: boolean;
	};
}

export interface AuthConfig {
	secret: string;
	origin: string;
	publicOrigin: string;
	sessionDuration: number;
	google: {
		clientId: string;
		clientSecret: string;
	};
	github: {
		clientId: string;
		clientSecret: string;
	};
	// Enhanced security
	rateLimit: {
		windowMs: number;
		maxRequests: number;
		skipSuccessfulRequests: boolean;
	};
}

export interface HeliconeConfig {
	apiKey: string;
	enableCaching: boolean;
	openaiBaseUrl: string;
	anthropicBaseUrl: string;
	defaultModel: string;
	defaultTemperature: number;
	// Enhanced AI configuration
	usage: {
		trackingEnabled: boolean;
		costMonitoring: boolean;
		monthlyBudget: number;
		alertThreshold: number;
	};
}

export interface AppConfig {
	environment: 'development' | 'production' | 'test';
	port: number;
	logLevel: 'debug' | 'info' | 'warn' | 'error';
	enableMetrics: boolean;
	enableHealthChecks: boolean;
	maxConcurrentSessions: number;
	sessionTimeoutMs: number;
	fileUploadLimitMb: number;
	// Enhanced app configuration
	features: {
		collaborationEnabled: boolean;
		analyticsEnabled: boolean;
		debugModeEnabled: boolean;
		experimentalFeaturesEnabled: boolean;
	};
}

// Enhanced main configuration interface
export interface SandboxExecutionConfig {
	daytona: DaytonaConfig;
	e2b: E2BConfig;
	templates: TemplateConfig;
	sandboxProvider: SandboxProviderConfig;
	r2: R2Config;
	database: DatabaseConfig;
	auth: AuthConfig;
	helicone: HeliconeConfig;
	app: AppConfig;
}

export interface ConfigValidationError {
	field: string;
	message: string;
	value?: any;
}

export interface ConfigValidationResult {
	isValid: boolean;
	errors: ConfigValidationError[];
	warnings: ConfigValidationError[];
}

export type ConfigEnvironment = 'development' | 'production' | 'test';

export interface EnvironmentConfig {
	name: ConfigEnvironment;
	requiredFields: string[];
	optionalFields: string[];
	defaults: Partial<SandboxExecutionConfig>;
}
