/**
 * Environment Configuration
 * Manages environment-specific configuration loading and defaults
 */

import { env } from '$env/dynamic/private';
import type {
	AppConfig,
	AuthConfig,
	ConfigEnvironment,
	DatabaseConfig,
	DaytonaConfig,
	E2BConfig,
	EnvironmentConfig,
	HeliconeConfig,
	R2Config,
	SandboxExecutionConfig,
	SandboxProviderConfig,
	TemplateConfig
} from './types.js';

export class EnvironmentConfigManager {
	private readonly environment: ConfigEnvironment;

	constructor() {
		this.environment = this.detectEnvironment();
	}

	getEnvironment(): ConfigEnvironment {
		return this.environment;
	}

	private loadConfiguration(): SandboxExecutionConfig {
		return {
			daytona: this.loadDaytonaConfig(),
			r2: this.loadR2Config(),
			database: this.loadDatabaseConfig(),
			auth: this.loadAuthConfig(),
			helicone: this.loadHeliconeConfig(),
			app: this.loadAppConfig(),
			e2b: this.loadE2BConfig(),
			templates: this.loadTemplateConfig(),
			sandboxProvider: this.loadSandboxProviderConfig()
		};
	}

	private loadE2BConfig(): E2BConfig {
		return {
			enabled: env.E2B_ENABLED === 'true',
			retryAttempts: parseInt(env.E2B_RETRY_ATTEMPTS || '3'),
			timeout: parseInt(env.E2B_TIMEOUT || '30000'),
			apiKey: env.E2B_API_KEY || '',
			templateId: env.E2B_TEMPLATE_ID || 'code-interpreter',
			defaultEnvironment: env.E2B_DEFAULT_ENVIRONMENT || 'node',
			enableFilesystem: env.E2B_ENABLE_FILESYSTEM !== 'false',
			enableNetwork: env.E2B_ENABLE_NETWORK !== 'false',
			resourceLimits: {
				cpu: parseInt(env.E2B_CPU_LIMIT || '1000'),
				memory: parseInt(env.E2B_MEMORY_LIMIT || '2048'),
				disk: parseInt(env.E2B_DISK_LIMIT || '10240')
			},
			sessionDefaults: {
				timeout: parseInt(env.E2B_SESSION_TIMEOUT || '3600000'),
				maxExecutionTime: parseInt(env.E2B_MAX_EXECUTION_TIME || '60000'),
				keepAlive: env.E2B_KEEP_ALIVE === 'true'
			}
		};
	}

	private loadTemplateConfig(): TemplateConfig {
		return {
			enabled: env.TEMPLATE_ENABLED !== 'false',
			stackblitz: {
				apiBaseUrl: env.STACKBLITZ_API_URL || 'https://api.stackblitz.com',
				startersRepository: env.STACKBLITZ_STARTERS_REPO || 'stackblitz/starters',
				cacheTimeout: parseInt(env.STACKBLITZ_CACHE_TIMEOUT || '3600000'),
				maxConcurrentDownloads: parseInt(env.STACKBLITZ_MAX_DOWNLOADS || '5')
			},
			github: {
				token: env.GITHUB_TOKEN || '',
				rateLimitPerHour: parseInt(env.GITHUB_RATE_LIMIT || '5000'),
				defaultBranch: env.GITHUB_DEFAULT_BRANCH || 'main'
			},
			cache: {
				enabled: env.TEMPLATE_CACHE_ENABLED !== 'false',
				ttlHours: parseInt(env.TEMPLATE_CACHE_TTL_HOURS || '24'),
				maxSize: parseInt(env.TEMPLATE_CACHE_MAX_SIZE || '1000'),
				compressionEnabled: env.TEMPLATE_CACHE_COMPRESSION !== 'false'
			}
		};
	}

	private loadSandboxProviderConfig(): SandboxProviderConfig {
		return {
			defaultProvider: (env.SANDBOX_DEFAULT_PROVIDER as 'daytona' | 'e2b' | 'local') || 'daytona',
			maxConcurrentSessions: parseInt(env.SANDBOX_MAX_CONCURRENT_SESSIONS || '10'),
			sessionTimeoutMinutes: parseInt(env.SANDBOX_SESSION_TIMEOUT_MINUTES || '60'),
			autoCleanupEnabled: env.SANDBOX_AUTO_CLEANUP !== 'false',
			resourceMonitoring: {
				enabled: env.SANDBOX_RESOURCE_MONITORING !== 'false',
				intervalSeconds: parseInt(env.SANDBOX_MONITORING_INTERVAL || '30'),
				alertThresholds: {
					cpu: parseInt(env.SANDBOX_CPU_ALERT_THRESHOLD || '80'),
					memory: parseInt(env.SANDBOX_MEMORY_ALERT_THRESHOLD || '85'),
					disk: parseInt(env.SANDBOX_DISK_ALERT_THRESHOLD || '90')
				}
			}
		};
	}
	private detectEnvironment(): ConfigEnvironment {
		const nodeEnv = env.NODE_ENV?.toLowerCase();

		if (nodeEnv === 'production') return 'production';
		if (nodeEnv === 'test') return 'test';
		return 'development';
	}

	private loadDaytonaConfig(): DaytonaConfig {
		return {
			enabled: env.DAYTONA_ENABLED === 'true',
			apiKey: env.DAYTONA_API_KEY || '',
			timeout: parseInt(env.DAYTONA_TIMEOUT || '30000'),
			retryAttempts: parseInt(env.DAYTONA_RETRY_ATTEMPTS || '3'),
			workspaceTemplate: env.DAYTONA_WORKSPACE_TEMPLATE || 'universal',
			defaultLanguage: env.DAYTONA_DEFAULT_LANGUAGE || 'typescript',
			enableGitIntegration: env.DAYTONA_ENABLE_GIT !== 'false',
			enablePortForwarding: env.DAYTONA_ENABLE_PORT_FORWARDING !== 'false',
			workspaceDefaults: {
				cpu: env.DAYTONA_DEFAULT_CPU || '2',
				memory: env.DAYTONA_DEFAULT_MEMORY || '4Gi',
				storage: env.DAYTONA_DEFAULT_STORAGE || '10Gi'
			}
		};
	}

	private loadR2Config(): R2Config {
		const accountId = env.R2_ACCOUNT_ID || '';
		return {
			accessKeyId: env.R2_ACCESS_KEY_ID || '',
			secretAccessKey: env.R2_SECRET_ACCESS_KEY || '',
			accountId,
			defaultBucket: env.R2_DEFAULT_BUCKET || 'aura-projects',
			region: env.R2_REGION || 'auto',
			maxFileSize: parseInt(env.R2_MAX_FILE_SIZE || '104857600'), // 100MB
			multipartThreshold: parseInt(env.R2_MULTIPART_THRESHOLD || '10485760'), // 10MB
			mountPath: env.R2_MOUNT_PATH || '/home/user/project-data',
			endpoint:
				env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : ''),
			projectStorage: {
				enabled: env.R2_PROJECT_STORAGE_ENABLED !== 'false',
				compressionEnabled: env.R2_COMPRESSION_ENABLED !== 'false',
				versioningEnabled: env.R2_VERSIONING_ENABLED !== 'false',
				maxVersions: parseInt(env.R2_MAX_VERSIONS || '10'),
				cleanupIntervalHours: parseInt(env.R2_CLEANUP_INTERVAL_HOURS || '24')
			}
		};
	}

	private loadDatabaseConfig(): DatabaseConfig {
		return {
			url: env.DATABASE_URL || env.MONGODB_URI || 'mongodb://localhost:27017/aura_intellicode',
			dbName: env.DATABASE_NAME || env.MONGODB_DB_NAME || 'aura_intellicode',
			maxPoolSize: parseInt(env.MONGODB_MAX_POOL_SIZE || '10'),
			minPoolSize: parseInt(env.MONGODB_MIN_POOL_SIZE || '2'),
			maxIdleTimeMs: parseInt(env.MONGODB_MAX_IDLE_TIME_MS || '30000'),
			serverSelectionTimeoutMs: parseInt(env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || '5000'),
			socketTimeoutMs: parseInt(env.MONGODB_SOCKET_TIMEOUT_MS || '45000'),
			connectTimeoutMs: parseInt(env.MONGODB_CONNECT_TIMEOUT_MS || '10000'),
			collections: {
				autoIndexing: env.DB_AUTO_INDEXING !== 'false',
				textSearchEnabled: env.DB_TEXT_SEARCH_ENABLED !== 'false',
				analyticsRetentionDays: parseInt(env.DB_ANALYTICS_RETENTION_DAYS || '90'),
				backupEnabled: env.DB_BACKUP_ENABLED !== 'false'
			}
		};
	}

	private loadAuthConfig(): AuthConfig {
		return {
			secret: env.BETTER_AUTH_SECRET || env.AUTH_SECRET || '',
			origin: env.ORIGIN || 'http://localhost:5173',
			publicOrigin: env.PUBLIC_ORIGIN || env.ORIGIN || 'http://localhost:5173',
			sessionDuration: parseInt(env.AUTH_SESSION_DURATION || '86400000'), // 24 hours
			google: {
				clientId: env.GOOGLE_CLIENT_ID || '',
				clientSecret: env.GOOGLE_CLIENT_SECRET || ''
			},
			github: {
				clientId: env.GITHUB_CLIENT_ID || '',
				clientSecret: env.GITHUB_CLIENT_SECRET || ''
			},
			rateLimit: {
				windowMs: parseInt(env.AUTH_RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
				maxRequests: parseInt(env.AUTH_RATE_LIMIT_MAX_REQUESTS || '100'),
				skipSuccessfulRequests: env.AUTH_RATE_LIMIT_SKIP_SUCCESS === 'true'
			}
		};
	}

	private loadHeliconeConfig(): HeliconeConfig {
		return {
			apiKey: env.HELICONE_API_KEY || '',
			enableCaching: env.HELICONE_ENABLE_CACHING === 'true',
			openaiBaseUrl: env.HELICONE_OPENAI_BASE_URL || 'https://oai.helicone.ai/v1',
			anthropicBaseUrl: env.HELICONE_ANTHROPIC_BASE_URL || 'https://anthropic.helicone.ai',
			defaultModel: env.DEFAULT_LLM_MODEL || env.DEFAULT_AI_MODEL || 'gpt-4o',
			defaultTemperature: parseFloat(env.DEFAULT_TEMPERATURE || '0'),
			usage: {
				trackingEnabled: env.HELICONE_USAGE_TRACKING !== 'false',
				costMonitoring: env.HELICONE_COST_MONITORING !== 'false',
				monthlyBudget: parseFloat(env.HELICONE_MONTHLY_BUDGET || '100'),
				alertThreshold: parseFloat(env.HELICONE_ALERT_THRESHOLD || '80')
			}
		};
	}

	private loadAppConfig(): AppConfig {
		return {
			environment: this.environment,
			port: parseInt(env.PORT || '5173'),
			logLevel: (env.LOG_LEVEL as any) || 'info',
			enableMetrics: env.ENABLE_METRICS !== 'false',
			enableHealthChecks: env.ENABLE_HEALTH_CHECKS !== 'false',
			maxConcurrentSessions: parseInt(env.MAX_CONCURRENT_SESSIONS || '50'),
			sessionTimeoutMs: parseInt(env.SESSION_TIMEOUT_MS || '1800000'), // 30 minutes
			fileUploadLimitMb: parseInt(env.FILE_UPLOAD_LIMIT_MB || '100'),
			features: {
				collaborationEnabled: env.APP_COLLABORATION_ENABLED !== 'false',
				analyticsEnabled: env.APP_ANALYTICS_ENABLED !== 'false',
				debugModeEnabled: env.APP_DEBUG_MODE_ENABLED === 'true',
				experimentalFeaturesEnabled: env.APP_EXPERIMENTAL_FEATURES_ENABLED === 'true'
			}
		};
	}

	private applyEnvironmentDefaults(config: SandboxExecutionConfig): SandboxExecutionConfig {
		const environmentConfig = this.getEnvironmentConfig();

		// Apply environment-specific defaults
		if (environmentConfig.defaults) {
			return this.mergeConfigs(config, environmentConfig.defaults);
		}

		return config;
	}

	private getEnvironmentConfig(): EnvironmentConfig {
		const configs: Record<ConfigEnvironment, EnvironmentConfig> = {
			development: {
				name: 'development',
				requiredFields: ['auth.secret', 'database.url'],
				optionalFields: ['e2b.apiKey', 'daytona.apiKey', 'r2.accessKeyId', 'helicone.apiKey'],
				defaults: {
					app: {
						environment: 'development',
						port: 5173,
						logLevel: 'debug',
						enableMetrics: true,
						enableHealthChecks: true,
						maxConcurrentSessions: 10,
						sessionTimeoutMs: 3600000, // 1 hour
						fileUploadLimitMb: 50,
						features: {
							collaborationEnabled: true,
							analyticsEnabled: true,
							debugModeEnabled: true,
							experimentalFeaturesEnabled: true
						}
					}
				}
			},
			production: {
				name: 'production',
				requiredFields: ['auth.secret', 'database.url', 'r2.accessKeyId', 'r2.secretAccessKey'],
				optionalFields: ['e2b.apiKey', 'daytona.apiKey', 'helicone.apiKey'],
				defaults: {
					app: {
						environment: 'production',
						port: 3000,
						logLevel: 'info',
						enableMetrics: true,
						enableHealthChecks: true,
						maxConcurrentSessions: 100,
						sessionTimeoutMs: 1800000, // 30 minutes
						fileUploadLimitMb: 100,
						features: {
							collaborationEnabled: true,
							analyticsEnabled: true,
							debugModeEnabled: false,
							experimentalFeaturesEnabled: false
						}
					}
				}
			},
			test: {
				name: 'test',
				requiredFields: ['auth.secret'],
				optionalFields: [],
				defaults: {
					app: {
						environment: 'test',
						port: 5174,
						logLevel: 'warn',
						enableMetrics: false,
						enableHealthChecks: false,
						maxConcurrentSessions: 5,
						sessionTimeoutMs: 300000, // 5 minutes
						fileUploadLimitMb: 10,
						features: {
							collaborationEnabled: false,
							analyticsEnabled: false,
							debugModeEnabled: true,
							experimentalFeaturesEnabled: true
						}
					}
				}
			}
		};

		return configs[this.environment];
	}

	private mergeConfigs(
		base: SandboxExecutionConfig,
		defaults: Partial<SandboxExecutionConfig>
	): SandboxExecutionConfig {
		return {
			daytona: { ...base.daytona, ...defaults.daytona },
			e2b: { ...base.e2b, ...defaults.e2b },
			templates: { ...base.templates, ...defaults.templates },
			sandboxProvider: { ...base.sandboxProvider, ...defaults.sandboxProvider },
			r2: { ...base.r2, ...defaults.r2 },
			database: { ...base.database, ...defaults.database },
			auth: { ...base.auth, ...defaults.auth },
			helicone: { ...base.helicone, ...defaults.helicone },
			app: { ...base.app, ...defaults.app }
		};
	}

	getRequiredFields(): string[] {
		return this.getEnvironmentConfig().requiredFields;
	}

	getOptionalFields(): string[] {
		return this.getEnvironmentConfig().optionalFields;
	}
}

export const environmentConfigManager = new EnvironmentConfigManager();
