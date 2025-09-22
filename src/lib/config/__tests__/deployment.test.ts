/**
 * Deployment Configuration Tests
 * Tests for deployment-specific configuration and health checks
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { configManager } from '../manager.js';

describe('Deployment Configuration', () => {
	beforeEach(async () => {
		// Initialize configuration for each test
		await configManager.initialize();
	});

	describe('Configuration Validation', () => {
		it('should have valid configuration structure', () => {
			const config = configManager.getConfig();

			// Verify all required sections exist
			expect(config).toHaveProperty('e2b');
			expect(config).toHaveProperty('daytona');
			expect(config).toHaveProperty('r2');
			expect(config).toHaveProperty('database');
			expect(config).toHaveProperty('auth');
			expect(config).toHaveProperty('helicone');
			expect(config).toHaveProperty('app');
		});

		it('should have valid app configuration for deployment', () => {
			const appConfig = configManager.getAppConfig();

			// Port should be valid
			expect(appConfig.port).toBeGreaterThan(0);
			expect(appConfig.port).toBeLessThanOrEqual(65535);

			// Environment should be valid
			expect(['development', 'production', 'test']).toContain(appConfig.environment);

			// Log level should be valid
			expect(['debug', 'info', 'warn', 'error']).toContain(appConfig.logLevel);

			// Session limits should be reasonable
			expect(appConfig.maxConcurrentSessions).toBeGreaterThan(0);
			expect(appConfig.sessionTimeoutMs).toBeGreaterThan(0);
			expect(appConfig.fileUploadLimitMb).toBeGreaterThan(0);
		});

		it('should have valid database configuration', () => {
			const dbConfig = configManager.getDatabaseConfig();

			// URL should be present
			expect(dbConfig.url).toBeTruthy();

			// Pool settings should be valid
			expect(dbConfig.maxPoolSize).toBeGreaterThan(0);
			expect(dbConfig.minPoolSize).toBeGreaterThanOrEqual(0);
			expect(dbConfig.minPoolSize).toBeLessThanOrEqual(dbConfig.maxPoolSize);

			// Timeout settings should be positive
			expect(dbConfig.maxIdleTimeMs).toBeGreaterThan(0);
			expect(dbConfig.serverSelectionTimeoutMs).toBeGreaterThan(0);
			expect(dbConfig.socketTimeoutMs).toBeGreaterThan(0);
			expect(dbConfig.connectTimeoutMs).toBeGreaterThan(0);
		});

		it('should have valid auth configuration', () => {
			const authConfig = configManager.getAuthConfig();

			// Secret should be present and long enough
			expect(authConfig.secret).toBeTruthy();
			if (authConfig.secret) {
				expect(authConfig.secret.length).toBeGreaterThanOrEqual(32);
			}

			// URLs should be valid
			expect(authConfig.origin).toBeTruthy();
			expect(authConfig.publicOrigin).toBeTruthy();

			// OAuth configs should have consistent structure
			expect(authConfig.google).toHaveProperty('clientId');
			expect(authConfig.google).toHaveProperty('clientSecret');
			expect(authConfig.github).toHaveProperty('clientId');
			expect(authConfig.github).toHaveProperty('clientSecret');
		});
	});

	describe('Service Availability', () => {
		it('should report service enablement status', () => {
			const e2bEnabled = configManager.isE2BEnabled();
			const daytonaEnabled = configManager.isDaytonaEnabled();
			const r2Enabled = configManager.isR2Enabled();
			const heliconeEnabled = configManager.isHeliconeEnabled();

			// These should be boolean values
			expect(typeof e2bEnabled).toBe('boolean');
			expect(typeof daytonaEnabled).toBe('boolean');
			expect(typeof r2Enabled).toBe('boolean');
			expect(typeof heliconeEnabled).toBe('boolean');
		});

		it('should provide available providers list', () => {
			const providers = configManager.getAvailableProviders();

			expect(Array.isArray(providers)).toBe(true);

			// Each provider should be a valid string
			providers.forEach((provider) => {
				expect(typeof provider).toBe('string');
				expect(['e2b', 'daytona']).toContain(provider);
			});
		});

		it('should determine preferred provider', () => {
			const preferred = configManager.getPreferredProvider();

			if (preferred !== null) {
				expect(['e2b', 'daytona']).toContain(preferred);
			}
		});
	});

	describe('Configuration Summary', () => {
		it('should provide comprehensive configuration summary', () => {
			const summary = configManager.getConfigSummary();

			// Should have all required properties
			expect(summary).toHaveProperty('environment');
			expect(summary).toHaveProperty('isValid');
			expect(summary).toHaveProperty('providers');
			expect(summary).toHaveProperty('preferredProvider');
			expect(summary).toHaveProperty('errors');
			expect(summary).toHaveProperty('warnings');

			// Environment should be valid
			expect(['development', 'production', 'test']).toContain(summary.environment);

			// Validation status should be boolean
			expect(typeof summary.isValid).toBe('boolean');

			// Providers should be an object with boolean values
			expect(typeof summary.providers).toBe('object');
			expect(typeof summary.providers.e2b).toBe('boolean');
			expect(typeof summary.providers.daytona).toBe('boolean');
			expect(typeof summary.providers.r2).toBe('boolean');
			expect(typeof summary.providers.helicone).toBe('boolean');

			// Error and warning counts should be numbers
			expect(typeof summary.errors).toBe('number');
			expect(typeof summary.warnings).toBe('number');
			expect(summary.errors).toBeGreaterThanOrEqual(0);
			expect(summary.warnings).toBeGreaterThanOrEqual(0);
		});
	});

	describe('Environment-Specific Configuration', () => {
		it('should have appropriate settings for current environment', () => {
			const environment = configManager.getEnvironment();
			const appConfig = configManager.getAppConfig();

			switch (environment) {
				case 'development':
					expect(appConfig.logLevel).toBe('debug');
					expect(appConfig.maxConcurrentSessions).toBeLessThanOrEqual(10);
					break;
				case 'production':
					expect(appConfig.logLevel).toBe('info');
					expect(appConfig.maxConcurrentSessions).toBeGreaterThanOrEqual(50);
					break;
				case 'test':
					expect(appConfig.logLevel).toBe('warn');
					expect(appConfig.maxConcurrentSessions).toBeLessThanOrEqual(5);
					break;
			}
		});
	});

	describe('Configuration Reload', () => {
		it('should be able to reload configuration', async () => {
			const initialSummary = configManager.getConfigSummary();

			const reloadResult = await configManager.reload();

			expect(reloadResult).toHaveProperty('isValid');
			expect(reloadResult).toHaveProperty('errors');
			expect(reloadResult).toHaveProperty('warnings');

			const newSummary = configManager.getConfigSummary();
			expect(newSummary.environment).toBe(initialSummary.environment);
		});
	});
});

describe('Health Check Configuration', () => {
	it('should have health check endpoints available', async () => {
		// This would typically test the actual health endpoints
		// For now, we'll just verify the configuration supports health checks
		const appConfig = configManager.getAppConfig();
		expect(typeof appConfig.enableHealthChecks).toBe('boolean');
	});

	it('should have metrics configuration', async () => {
		const appConfig = configManager.getAppConfig();
		expect(typeof appConfig.enableMetrics).toBe('boolean');
	});
});

describe('Security Configuration', () => {
	it('should have secure authentication configuration', () => {
		const authConfig = configManager.getAuthConfig();

		// Auth secret should be sufficiently long
		if (authConfig.secret) {
			expect(authConfig.secret.length).toBeGreaterThanOrEqual(32);
		}

		// URLs should use HTTPS in production
		const environment = configManager.getEnvironment();
		if (environment === 'production') {
			if (authConfig.origin.startsWith('http')) {
				expect(authConfig.origin).toMatch(/^https:/);
			}
			if (authConfig.publicOrigin.startsWith('http')) {
				expect(authConfig.publicOrigin).toMatch(/^https:/);
			}
		}
	});

	it('should have reasonable timeout and limit configurations', () => {
		const appConfig = configManager.getAppConfig();

		// Session timeout should be reasonable (not too short or too long)
		expect(appConfig.sessionTimeoutMs).toBeGreaterThan(60000); // At least 1 minute
		expect(appConfig.sessionTimeoutMs).toBeLessThan(86400000); // Less than 24 hours

		// File upload limit should be reasonable
		expect(appConfig.fileUploadLimitMb).toBeGreaterThan(0);
		expect(appConfig.fileUploadLimitMb).toBeLessThan(1000); // Less than 1GB
	});
});

describe('Docker Deployment Validation', () => {
	it('should have valid port configuration for containers', () => {
		const appConfig = configManager.getAppConfig();

		// Port should be in valid range for containers
		expect(appConfig.port).toBeGreaterThan(1024);
		expect(appConfig.port).toBeLessThanOrEqual(65535);
	});

	it('should have appropriate resource limits for production', () => {
		const environment = configManager.getEnvironment();
		const appConfig = configManager.getAppConfig();

		if (environment === 'production') {
			// Production should have reasonable session limits
			expect(appConfig.maxConcurrentSessions).toBeGreaterThanOrEqual(50);
			expect(appConfig.maxConcurrentSessions).toBeLessThanOrEqual(1000);
		}
	});

	it('should have health check configuration enabled', () => {
		const appConfig = configManager.getAppConfig();

		// Health checks should be enabled for deployment
		expect(appConfig.enableHealthChecks).toBe(true);
		expect(appConfig.enableMetrics).toBe(true);
	});
});

describe('Environment Variable Validation', () => {
	it('should validate required environment variables for production', () => {
		const environment = configManager.getEnvironment();

		if (environment === 'production') {
			const config = configManager.getConfig();

			// Critical production variables
			expect(config.auth.secret).toBeTruthy();
			expect(config.database.url).toBeTruthy();

			// At least one sandbox provider should be configured
			const hasE2B = configManager.isE2BEnabled();
			const hasDaytona = configManager.isDaytonaEnabled();
			expect(hasE2B || hasDaytona).toBe(true);

			// R2 should be configured for production
			expect(configManager.isR2Enabled()).toBe(true);
		}
	});

	it('should have secure defaults for sensitive configurations', () => {
		const environment = configManager.getEnvironment();
		const appConfig = configManager.getAppConfig();

		if (environment === 'production') {
			// Log level should not be debug in production
			expect(appConfig.logLevel).not.toBe('debug');

			// Should have reasonable session timeout
			expect(appConfig.sessionTimeoutMs).toBeGreaterThan(300000); // At least 5 minutes
		}
	});
});

describe('Service Dependencies', () => {
	it('should validate service dependency configuration', () => {
		const availableProviders = configManager.getAvailableProviders();
		const r2Enabled = configManager.isR2Enabled();

		// If any sandbox provider is enabled, R2 should also be enabled for file persistence
		if (availableProviders.length > 0) {
			expect(r2Enabled).toBe(true);
		}
	});

	it('should have consistent provider configuration', () => {
		const e2bEnabled = configManager.isE2BEnabled();
		const daytonaEnabled = configManager.isDaytonaEnabled();

		if (daytonaEnabled) {
			const daytonaConfig = configManager.getDaytonaConfig();
			expect(daytonaConfig.apiKey).toBeTruthy();
			expect(daytonaConfig.baseUrl).toBeTruthy();
		}
	});
});

describe('Monitoring and Observability', () => {
	it('should have monitoring endpoints configured', () => {
		const appConfig = configManager.getAppConfig();

		// Metrics should be enabled for monitoring
		expect(appConfig.enableMetrics).toBe(true);
		expect(appConfig.enableHealthChecks).toBe(true);
	});

	it('should have appropriate logging configuration', () => {
		const appConfig = configManager.getAppConfig();
		const validLogLevels = ['debug', 'info', 'warn', 'error'];

		expect(validLogLevels).toContain(appConfig.logLevel);
	});
});
