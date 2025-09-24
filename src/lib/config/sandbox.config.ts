/**
 * Sandbox Configuration
 * Configuration for sandbox providers and settings
 */

import { env } from '$env/dynamic/private';

// Daytona Configuration
export const daytonaConfig = {
	apiUrl: env.DAYTONA_API_URL || 'https://app.daytona.io/api',
	apiKey: env.DAYTONA_API_KEY || '',
	teamId: env.DAYTONA_TEAM_ID,
	region: env.DAYTONA_REGION || 'us-east-1',
	limits: {
		maxConcurrentWorkspaces: parseInt(env.DAYTONA_MAX_WORKSPACES || '10'),
		maxConcurrentSessions: parseInt(env.DAYTONA_MAX_SESSIONS || '50'),
		maxFileSize: parseInt(env.DAYTONA_MAX_FILE_SIZE || '104857600'), // 100MB
		maxExecutionTime: parseInt(env.DAYTONA_MAX_EXEC_TIME || '300000'), // 5 minutes
		defaultTimeout: parseInt(env.DAYTONA_DEFAULT_TIMEOUT || '1800000') // 30 minutes
	},
	retry: {
		maxAttempts: parseInt(env.DAYTONA_RETRY_ATTEMPTS || '3'),
		backoffMs: parseInt(env.DAYTONA_RETRY_BACKOFF || '1000')
	},
	monitoring: {
		metricsInterval: parseInt(env.DAYTONA_METRICS_INTERVAL || '30000'), // 30 seconds
		healthCheckInterval: parseInt(env.DAYTONA_HEALTH_CHECK_INTERVAL || '60000') // 1 minute
	}
} as const;

// E2B Configuration
export const e2bConfig = {
	apiKey: env.E2B_API_KEY || '',
	baseUrl: env.E2B_API_URL || 'https://api.e2b.dev',
	region: env.E2B_REGION || 'us-east-1',
	limits: {
		maxConcurrentSandboxes: parseInt(env.E2B_MAX_SANDBOXES || '10'),
		maxConcurrentSessions: parseInt(env.E2B_MAX_SESSIONS || '20'),
		maxFileSize: parseInt(env.E2B_MAX_FILE_SIZE || '52428800'), // 50MB
		maxExecutionTime: parseInt(env.E2B_MAX_EXEC_TIME || '180000'), // 3 minutes
		defaultTimeout: parseInt(env.E2B_DEFAULT_TIMEOUT || '3600000') // 1 hour
	},
	templates: {
		node: env.E2B_NODE_TEMPLATE || 'nodejs',
		python: env.E2B_PYTHON_TEMPLATE || 'python',
		universal: env.E2B_UNIVERSAL_TEMPLATE || 'ubuntu'
	},
	retry: {
		maxAttempts: parseInt(env.E2B_RETRY_ATTEMPTS || '3'),
		backoffMs: parseInt(env.E2B_RETRY_BACKOFF || '1000')
	},
	monitoring: {
		metricsInterval: parseInt(env.E2B_METRICS_INTERVAL || '30000'), // 30 seconds
		healthCheckInterval: parseInt(env.E2B_HEALTH_CHECK_INTERVAL || '60000') // 1 minute
	}
} as const;

// Local Sandbox Configuration (for development)
export const localConfig = {
	enabled: env.LOCAL_SANDBOX_ENABLED === 'true',
	basePath: env.LOCAL_SANDBOX_PATH || '/tmp/aura-sandboxes',
	dockerEnabled: env.LOCAL_DOCKER_ENABLED === 'true',
	limits: {
		maxConcurrentSandboxes: parseInt(env.LOCAL_MAX_SANDBOXES || '5'),
		maxFileSize: parseInt(env.LOCAL_MAX_FILE_SIZE || '104857600'), // 100MB
		maxExecutionTime: parseInt(env.LOCAL_MAX_EXEC_TIME || '60000'), // 1 minute
		defaultTimeout: parseInt(env.LOCAL_DEFAULT_TIMEOUT || '300000') // 5 minutes
	},
	cleanup: {
		autoCleanup: env.LOCAL_AUTO_CLEANUP !== 'false',
		cleanupInterval: parseInt(env.LOCAL_CLEANUP_INTERVAL || '3600000'), // 1 hour
		maxAge: parseInt(env.LOCAL_MAX_AGE || '86400000') // 24 hours
	}
} as const;

// Provider Priority Configuration
export const providerConfig = {
	defaultProvider: (env.DEFAULT_SANDBOX_PROVIDER || 'daytona') as 'daytona' | 'e2b' | 'local',
	fallbackProvider: (env.FALLBACK_SANDBOX_PROVIDER || 'e2b') as 'daytona' | 'e2b' | 'local',
	loadBalancing: {
		enabled: env.SANDBOX_LOAD_BALANCING === 'true',
		strategy: (env.LOAD_BALANCING_STRATEGY || 'round-robin') as
			| 'round-robin'
			| 'least-loaded'
			| 'random',
		healthCheckRequired: env.HEALTH_CHECK_REQUIRED !== 'false'
	},
	failover: {
		enabled: env.SANDBOX_FAILOVER !== 'false',
		maxRetries: parseInt(env.SANDBOX_MAX_RETRIES || '2'),
		retryDelay: parseInt(env.SANDBOX_RETRY_DELAY || '2000')
	}
} as const;

// Resource Limits Configuration
export const resourceLimits = {
	cpu: {
		min: parseInt(env.MIN_CPU_CORES || '1'),
		max: parseInt(env.MAX_CPU_CORES || '8'),
		default: parseInt(env.DEFAULT_CPU_CORES || '2')
	},
	memory: {
		min: parseInt(env.MIN_MEMORY_MB || '512'),
		max: parseInt(env.MAX_MEMORY_MB || '16384'), // 16GB
		default: parseInt(env.DEFAULT_MEMORY_MB || '2048') // 2GB
	},
	storage: {
		min: parseInt(env.MIN_STORAGE_MB || '1024'), // 1GB
		max: parseInt(env.MAX_STORAGE_MB || '102400'), // 100GB
		default: parseInt(env.DEFAULT_STORAGE_MB || '10240') // 10GB
	},
	bandwidth: {
		min: parseInt(env.MIN_BANDWIDTH_MBPS || '10'),
		max: parseInt(env.MAX_BANDWIDTH_MBPS || '1000'),
		default: parseInt(env.DEFAULT_BANDWIDTH_MBPS || '100')
	},
	network: {
		maxBandwidth: parseInt(env.MAX_BANDWIDTH_MBPS || '1000')
	}
} as const;

// Security Configuration
export const securityConfig = {
	network: {
		allowedPorts: env.ALLOWED_PORTS?.split(',').map((p) => parseInt(p.trim())) || [
			3000, 8080, 8000, 5000, 4000
		],
		blockedPorts: env.BLOCKED_PORTS?.split(',').map((p) => parseInt(p.trim())) || [
			22, 80, 443, 3306, 5432
		],
		allowPublicAccess: env.ALLOW_PUBLIC_ACCESS === 'true',
		requireAuth: env.REQUIRE_SANDBOX_AUTH !== 'false'
	},
	files: {
		allowedExtensions: env.ALLOWED_FILE_EXTENSIONS?.split(',') || [
			'.js',
			'.ts',
			'.jsx',
			'.tsx',
			'.py',
			'.go',
			'.rs',
			'.java',
			'.cpp',
			'.c',
			'.html',
			'.css',
			'.scss',
			'.sass',
			'.less',
			'.json',
			'.xml',
			'.yaml',
			'.yml',
			'.md',
			'.txt',
			'.sh',
			'.bat',
			'.ps1',
			'.dockerfile',
			'.gitignore'
		],
		blockedExtensions: env.BLOCKED_FILE_EXTENSIONS?.split(',') || [
			'.exe',
			'.dll',
			'.so',
			'.dylib',
			'.app',
			'.deb',
			'.rpm'
		],
		maxFileSize: parseInt(env.MAX_SINGLE_FILE_SIZE || '52428800'), // 50MB
		quarantineEnabled: env.FILE_QUARANTINE_ENABLED === 'true'
	},
	execution: {
		allowShellAccess: env.ALLOW_SHELL_ACCESS !== 'false',
		allowNetworkAccess: env.ALLOW_NETWORK_ACCESS !== 'false',
		allowFileSystem: env.ALLOW_FILESYSTEM_ACCESS !== 'false',
		restrictedCommands: env.RESTRICTED_COMMANDS?.split(',') || [
			'rm -rf /',
			'sudo',
			'su',
			'passwd',
			'adduser',
			'deluser'
		]
	}
} as const;

// Monitoring Configuration
export const monitoringConfig = {
	metrics: {
		enabled: env.SANDBOX_METRICS_ENABLED !== 'false',
		interval: parseInt(env.METRICS_COLLECTION_INTERVAL || '30000'), // 30 seconds
		retention: parseInt(env.METRICS_RETENTION_HOURS || '168') // 7 days
	},
	logging: {
		level: (env.SANDBOX_LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error',
		maxLogSize: parseInt(env.MAX_LOG_SIZE_MB || '100'),
		logRetention: parseInt(env.LOG_RETENTION_DAYS || '30')
	},
	alerts: {
		enabled: env.SANDBOX_ALERTS_ENABLED === 'true',
		cpuThreshold: parseInt(env.CPU_ALERT_THRESHOLD || '80'),
		memoryThreshold: parseInt(env.MEMORY_ALERT_THRESHOLD || '90'),
		storageThreshold: parseInt(env.STORAGE_ALERT_THRESHOLD || '85')
	}
} as const;

// Template Configuration
export const templateConfig = {
	stackblitz: {
		enabled: env.STACKBLITZ_INTEGRATION_ENABLED !== 'false',
		cacheEnabled: env.TEMPLATE_CACHE_ENABLED !== 'false',
		cacheTtl: parseInt(env.TEMPLATE_CACHE_TTL || '3600000'), // 1 hour
		maxCacheSize: parseInt(env.MAX_TEMPLATE_CACHE_SIZE || '1000')
	},
	github: {
		enabled: env.GITHUB_TEMPLATE_ENABLED !== 'false',
		rateLimit: parseInt(env.GITHUB_RATE_LIMIT || '5000'),
		cacheTtl: parseInt(env.GITHUB_CACHE_TTL || '1800000') // 30 minutes
	},
	validation: {
		required: env.TEMPLATE_VALIDATION_REQUIRED !== 'false',
		maxSize: parseInt(env.MAX_TEMPLATE_SIZE_MB || '500'),
		allowedTypes: env.ALLOWED_TEMPLATE_TYPES?.split(',') || [
			'node',
			'react',
			'vue',
			'angular',
			'svelte',
			'next',
			'nuxt',
			'python',
			'django',
			'flask',
			'fastapi',
			'go',
			'gin',
			'echo',
			'rust',
			'actix',
			'warp',
			'java',
			'spring',
			'maven',
			'gradle'
		]
	}
} as const;

// Combined sandbox configuration
export const sandboxConfig = {
	daytona: daytonaConfig,
	e2b: e2bConfig,
	local: localConfig,
	provider: providerConfig,
	resources: resourceLimits,
	security: securityConfig,
	monitoring: monitoringConfig,
	templates: templateConfig,
	session: {
		maxDuration: parseInt(env.SESSION_MAX_DURATION || '7200000'), // 2 hours
		idleTimeout: parseInt(env.SESSION_IDLE_TIMEOUT || '1800000'), // 30 minutes
		maxConcurrentSessions: parseInt(env.MAX_CONCURRENT_SESSIONS || '5'),
		cleanupInterval: parseInt(env.SESSION_CLEANUP_INTERVAL || '300000'), // 5 minutes
		gracePeriod: parseInt(env.SESSION_GRACE_PERIOD || '60000') // 1 minute
	}
} as const;

export type SandboxConfig = typeof sandboxConfig;
