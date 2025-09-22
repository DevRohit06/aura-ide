/**
 * Configuration Manager Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigurationManager } from '../manager.js';

// Mock the environment module
vi.mock('$env/dynamic/private', () => ({
	env: {
		NODE_ENV: 'test',
		E2B_API_KEY: 'e2b_test_key',
		E2B_ENABLED: 'true',
		DAYTONA_API_KEY: 'daytona_test_key',
		DAYTONA_ENABLED: 'true',
		R2_ACCESS_KEY_ID: 'test_access_key',
		R2_SECRET_ACCESS_KEY: 'test_secret_key',
		R2_ACCOUNT_ID: 'test_account',
		DATABASE_URL: 'mongodb://localhost:27017/test',
		BETTER_AUTH_SECRET: 'super_secret_key_that_is_long_enough_for_security',
		ORIGIN: 'http://localhost:5173',
		HELICONE_API_KEY: 'helicone_test_key'
	}
}));

describe('ConfigurationManager', () => {
	let manager: ConfigurationManager;

	beforeEach(() => {
		// Reset singleton instance
		(ConfigurationManager as any).instance = null;
		manager = ConfigurationManager.getInstance();
	});

	describe('Singleton Pattern', () => {
		it('should return the same instance', () => {
			const manager1 = ConfigurationManager.getInstance();
			const manager2 = ConfigurationManager.getInstance();
			expect(manager1).toBe(manager2);
		});
	});

	describe('Initialization', () => {
		it('should initialize configuration successfully', async () => {
			const result = await manager.initialize();
			expect(result.isValid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should throw error when accessing config before initialization', () => {
			expect(() => manager.getConfig()).toThrow('Configuration not initialized');
		});

		it('should throw error when accessing validation before initialization', () => {
			expect(() => manager.getValidationResult()).toThrow('Configuration not validated');
		});
	});

	describe('Configuration Access', () => {
		beforeEach(async () => {
			await manager.initialize();
		});

		it('should provide access to full configuration', () => {
			const config = manager.getConfig();
			expect(config).toHaveProperty('e2b');
			expect(config).toHaveProperty('daytona');
			expect(config).toHaveProperty('r2');
			expect(config).toHaveProperty('database');
			expect(config).toHaveProperty('auth');
			expect(config).toHaveProperty('helicone');
			expect(config).toHaveProperty('app');
		});

		it('should provide access to individual service configs', () => {
			expect(manager.getDaytonaConfig()).toHaveProperty('baseUrl');
			expect(manager.getR2Config()).toHaveProperty('accessKeyId');
			expect(manager.getDatabaseConfig()).toHaveProperty('url');
			expect(manager.getAuthConfig()).toHaveProperty('secret');
			expect(manager.getHeliconeConfig()).toHaveProperty('apiKey');
			expect(manager.getAppConfig()).toHaveProperty('environment');
		});

		it('should provide environment information', () => {
			expect(manager.getEnvironment()).toBe('test');
		});
	});

	describe('Service Enablement Checks', () => {
		beforeEach(async () => {
			await manager.initialize();
		});

		it('should check E2B enablement', () => {
			expect(manager.isE2BEnabled()).toBe(true);
		});

		it('should check Daytona enablement', () => {
			expect(manager.isDaytonaEnabled()).toBe(true);
		});

		it('should check R2 enablement', () => {
			expect(manager.isR2Enabled()).toBe(true);
		});

		it('should check Helicone enablement', () => {
			expect(manager.isHeliconeEnabled()).toBe(true);
		});
	});

	describe('Provider Management', () => {
		beforeEach(async () => {
			await manager.initialize();
		});

		it('should list available providers', () => {
			const providers = manager.getAvailableProviders();
			expect(providers).toContain('e2b');
			expect(providers).toContain('daytona');
		});

		it('should determine preferred provider for test environment', () => {
			const preferred = manager.getPreferredProvider();
			expect(['e2b', 'daytona']).toContain(preferred);
		});
	});

	describe('Configuration Summary', () => {
		beforeEach(async () => {
			await manager.initialize();
		});

		it('should provide configuration summary', () => {
			const summary = manager.getConfigSummary();

			expect(summary).toHaveProperty('environment', 'test');
			expect(summary).toHaveProperty('isValid', true);
			expect(summary).toHaveProperty('providers');
			expect(summary.providers).toHaveProperty('e2b', true);
			expect(summary.providers).toHaveProperty('daytona', true);
			expect(summary.providers).toHaveProperty('r2', true);
			expect(summary.providers).toHaveProperty('helicone', true);
			expect(summary).toHaveProperty('preferredProvider');
			expect(summary).toHaveProperty('errors', 0);
			expect(summary).toHaveProperty('warnings');
		});
	});

	describe('Configuration Reload', () => {
		beforeEach(async () => {
			await manager.initialize();
		});

		it('should reload configuration', async () => {
			const initialConfig = manager.getConfig();
			const reloadResult = await manager.reload();

			expect(reloadResult.isValid).toBe(true);
			expect(manager.getConfig()).toEqual(initialConfig);
		});
	});

	describe('Validation Status', () => {
		beforeEach(async () => {
			await manager.initialize();
		});

		it('should report validation status', () => {
			expect(manager.isValid()).toBe(true);

			const validationResult = manager.getValidationResult();
			expect(validationResult.isValid).toBe(true);
			expect(validationResult.errors).toHaveLength(0);
		});
	});
});

describe('ConfigurationManager with Invalid Configuration', () => {
	beforeEach(() => {
		// Mock invalid environment
		vi.doMock('$env/dynamic/private', () => ({
			env: {
				NODE_ENV: 'test',
				// Missing required fields
				DATABASE_URL: '',
				BETTER_AUTH_SECRET: 'short', // Too short
				E2B_MAX_SANDBOXES: '200', // Too high
				R2_MAX_FILE_SIZE: '500' // Too small
			}
		}));

		// Reset singleton
		(ConfigurationManager as any).instance = null;
	});

	it('should handle validation errors gracefully', async () => {
		const manager = ConfigurationManager.getInstance();
		const result = await manager.initialize();

		expect(result.isValid).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
		expect(manager.isValid()).toBe(false);
	});

	it('should provide empty provider list when none are available', async () => {
		const manager = ConfigurationManager.getInstance();
		await manager.initialize();

		const providers = manager.getAvailableProviders();
		expect(providers).toHaveLength(0);

		const preferred = manager.getPreferredProvider();
		expect(preferred).toBeNull();
	});
});
