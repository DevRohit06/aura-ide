/**
 * Environment Configuration Tests
 * Tests the configuration loading logic without mocking the environment
 */

import { describe, expect, it } from 'vitest';
import { EnvironmentConfigManager } from '../environment.js';

describe('EnvironmentConfigManager', () => {
	let manager: EnvironmentConfigManager;

	describe('Basic Functionality', () => {
		it('should create an instance', () => {
			manager = new EnvironmentConfigManager();
			expect(manager).toBeDefined();
		});

		it('should detect environment', () => {
			manager = new EnvironmentConfigManager();
			const env = manager.getEnvironment();
			expect(['development', 'production', 'test']).toContain(env);
		});

		it('should load configuration without errors', () => {
			manager = new EnvironmentConfigManager();
			const config = manager.loadConfiguration();

			expect(config).toHaveProperty('e2b');
			expect(config).toHaveProperty('daytona');
			expect(config).toHaveProperty('r2');
			expect(config).toHaveProperty('database');
			expect(config).toHaveProperty('auth');
			expect(config).toHaveProperty('helicone');
			expect(config).toHaveProperty('app');
		});

		it('should have valid configuration structure', () => {
			manager = new EnvironmentConfigManager();
			const config = manager.loadConfiguration();

			// E2B config structure
			expect(config.e2b).toHaveProperty('enabled');
			expect(config.e2b).toHaveProperty('apiKey');
			expect(config.e2b).toHaveProperty('timeout');
			expect(config.e2b).toHaveProperty('retryAttempts');

			// Daytona config structure
			expect(config.daytona).toHaveProperty('enabled');
			expect(config.daytona).toHaveProperty('apiKey');
			expect(config.daytona).toHaveProperty('baseUrl');
			expect(config.daytona).toHaveProperty('workspaceDefaults');

			// R2 config structure
			expect(config.r2).toHaveProperty('accessKeyId');
			expect(config.r2).toHaveProperty('secretAccessKey');
			expect(config.r2).toHaveProperty('defaultBucket');
			expect(config.r2).toHaveProperty('endpoint');

			// Database config structure
			expect(config.database).toHaveProperty('url');
			expect(config.database).toHaveProperty('maxPoolSize');

			// Auth config structure
			expect(config.auth).toHaveProperty('secret');
			expect(config.auth).toHaveProperty('origin');
			expect(config.auth).toHaveProperty('google');
			expect(config.auth).toHaveProperty('github');

			// Helicone config structure
			expect(config.helicone).toHaveProperty('apiKey');
			expect(config.helicone).toHaveProperty('enableCaching');
			expect(config.helicone).toHaveProperty('defaultModel');

			// App config structure
			expect(config.app).toHaveProperty('environment');
			expect(config.app).toHaveProperty('port');
			expect(config.app).toHaveProperty('logLevel');
		});

		it('should have valid default values', () => {
			manager = new EnvironmentConfigManager();
			const config = manager.loadConfiguration();

			// Check some default values
			expect(config.e2b.defaultTemplate).toBe('base');
			expect(config.daytona.baseUrl).toContain('daytona');
			expect(config.r2.defaultBucket).toBe('aura-projects');
			expect(config.r2.region).toBe('auto');
			expect(config.helicone.defaultModel).toMatch(/gpt/);
			expect(['development', 'production', 'test']).toContain(config.app.environment);
			expect(['debug', 'info', 'warn', 'error']).toContain(config.app.logLevel);
		});

		it('should have numeric values in correct ranges', () => {
			manager = new EnvironmentConfigManager();
			const config = manager.loadConfiguration();

			// Check numeric constraints
			expect(config.e2b.timeout).toBeGreaterThan(0);
			expect(config.e2b.retryAttempts).toBeGreaterThan(0);
			expect(config.e2b.maxSandboxes).toBeGreaterThan(0);

			expect(config.daytona.timeout).toBeGreaterThan(0);
			expect(config.daytona.retryAttempts).toBeGreaterThan(0);

			expect(config.r2.maxFileSize).toBeGreaterThan(0);
			expect(config.r2.multipartThreshold).toBeGreaterThan(0);

			expect(config.database.maxPoolSize).toBeGreaterThan(0);
			expect(config.database.minPoolSize).toBeGreaterThanOrEqual(0);

			expect(config.app.port).toBeGreaterThan(0);
			expect(config.app.port).toBeLessThanOrEqual(65535);
			expect(config.app.maxConcurrentSessions).toBeGreaterThan(0);
			expect(config.app.sessionTimeoutMs).toBeGreaterThan(0);
			expect(config.app.fileUploadLimitMb).toBeGreaterThan(0);
		});

		it('should have boolean values', () => {
			manager = new EnvironmentConfigManager();
			const config = manager.loadConfiguration();

			expect(typeof config.e2b.enabled).toBe('boolean');
			expect(typeof config.e2b.autoPause).toBe('boolean');
			expect(typeof config.daytona.enabled).toBe('boolean');
			expect(typeof config.daytona.enableGitIntegration).toBe('boolean');
			expect(typeof config.daytona.enablePortForwarding).toBe('boolean');
			expect(typeof config.helicone.enableCaching).toBe('boolean');
			expect(typeof config.app.enableMetrics).toBe('boolean');
			expect(typeof config.app.enableHealthChecks).toBe('boolean');
		});

		it('should have workspace defaults in correct format', () => {
			manager = new EnvironmentConfigManager();
			const config = manager.loadConfiguration();

			const { workspaceDefaults } = config.daytona;

			// CPU should be a number string
			expect(workspaceDefaults.cpu).toMatch(/^\d+(\.\d+)?$/);

			// Memory should be in Gi or Mi format
			expect(workspaceDefaults.memory).toMatch(/^\d+[GM]i$/);

			// Storage should be in Gi or Mi format
			expect(workspaceDefaults.storage).toMatch(/^\d+[GM]i$/);
		});
	});
});
