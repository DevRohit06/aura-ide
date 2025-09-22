/**
 * Configuration Validation Tests
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { SandboxExecutionConfig } from '../types.js';
import { ConfigValidator } from '../validation.js';

describe('ConfigValidator', () => {
	let validator: ConfigValidator;
	let validConfig: SandboxExecutionConfig;

	beforeEach(() => {
		validator = new ConfigValidator();
		validConfig = {
			e2b: {
				enabled: true,
				apiKey: 'e2b_test_key_123',
				timeout: 300000,
				defaultTemplate: 'base',
				sandboxTemplate: 'code-interpreter:latest',
				autoPause: true,
				maxSandboxes: 10,
				retryAttempts: 3
			},
			daytona: {
				enabled: true,
				apiKey: 'daytona_test_key',
				baseUrl: 'https://api.daytona.io',
				timeout: 30000,
				retryAttempts: 3,
				workspaceTemplate: 'universal',
				defaultLanguage: 'typescript',
				enableGitIntegration: true,
				enablePortForwarding: true,
				workspaceDefaults: {
					cpu: '2',
					memory: '4Gi',
					storage: '10Gi'
				}
			},
			r2: {
				accessKeyId: 'test_access_key',
				secretAccessKey: 'test_secret_key',
				accountId: 'test_account_id',
				defaultBucket: 'test-bucket',
				region: 'auto',
				maxFileSize: 104857600,
				multipartThreshold: 10485760,
				mountPath: '/mnt/r2',
				endpoint: 'https://test.r2.cloudflarestorage.com'
			},
			database: {
				url: 'mongodb://localhost:27017/test',
				maxPoolSize: 10,
				minPoolSize: 2,
				maxIdleTimeMs: 30000,
				serverSelectionTimeoutMs: 5000,
				socketTimeoutMs: 45000,
				connectTimeoutMs: 10000
			},
			auth: {
				secret: 'super_secret_key_that_is_long_enough_for_security',
				origin: 'http://localhost:5173',
				publicOrigin: 'http://localhost:5173',
				google: {
					clientId: 'google_client_id',
					clientSecret: 'google_client_secret'
				},
				github: {
					clientId: 'github_client_id',
					clientSecret: 'github_client_secret'
				}
			},
			helicone: {
				apiKey: 'helicone_test_key',
				enableCaching: true,
				openaiBaseUrl: 'https://oai.helicone.ai/v1',
				anthropicBaseUrl: 'https://anthropic.helicone.ai',
				defaultModel: 'gpt-4o',
				defaultTemperature: 0
			},
			app: {
				environment: 'development',
				port: 5173,
				logLevel: 'info',
				enableMetrics: true,
				enableHealthChecks: true,
				maxConcurrentSessions: 50,
				sessionTimeoutMs: 1800000,
				fileUploadLimitMb: 100
			}
		};
	});

	describe('E2B Configuration Validation', () => {
		it('should validate valid E2B configuration', () => {
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should require API key when E2B is enabled', () => {
			validConfig.e2b.apiKey = '';
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.field === 'e2b.apiKey')).toBe(true);
		});

		it('should validate timeout constraints', () => {
			validConfig.e2b.timeout = 500;
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.field === 'e2b.timeout')).toBe(true);
		});

		it('should validate retry attempts range', () => {
			validConfig.e2b.retryAttempts = 15;
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.field === 'e2b.retryAttempts')).toBe(true);
		});

		it('should validate max sandboxes range', () => {
			validConfig.e2b.maxSandboxes = 150;
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.field === 'e2b.maxSandboxes')).toBe(true);
		});

		it('should warn about API key format', () => {
			validConfig.e2b.apiKey = 'invalid_key_format';
			const result = validator.validate(validConfig);
			expect(result.warnings.some((w) => w.field === 'e2b.apiKey')).toBe(true);
		});

		it('should allow disabled E2B with warnings', () => {
			validConfig.e2b.enabled = false;
			validConfig.e2b.apiKey = '';
			const result = validator.validate(validConfig);
			expect(result.warnings.some((w) => w.field === 'e2b.enabled')).toBe(true);
		});
	});

	describe('Daytona Configuration Validation', () => {
		it('should validate valid Daytona configuration', () => {
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(true);
		});

		it('should require API key when enabled', () => {
			validConfig.daytona.apiKey = '';
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.field === 'daytona.apiKey')).toBe(true);
		});

		it('should validate base URL format', () => {
			validConfig.daytona.baseUrl = 'invalid-url';
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.field === 'daytona.baseUrl')).toBe(true);
		});

		it('should validate workspace defaults CPU format', () => {
			validConfig.daytona.workspaceDefaults.cpu = 'invalid';
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.field === 'daytona.workspaceDefaults.cpu')).toBe(true);
		});

		it('should validate workspace defaults memory format', () => {
			validConfig.daytona.workspaceDefaults.memory = '4GB';
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.field === 'daytona.workspaceDefaults.memory')).toBe(true);
		});

		it('should validate workspace defaults storage format', () => {
			validConfig.daytona.workspaceDefaults.storage = '10GB';
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.field === 'daytona.workspaceDefaults.storage')).toBe(true);
		});
	});

	describe('R2 Configuration Validation', () => {
		it('should validate valid R2 configuration', () => {
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(true);
		});

		it('should require access credentials', () => {
			validConfig.r2.accessKeyId = '';
			validConfig.r2.secretAccessKey = '';
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.field === 'r2.accessKeyId')).toBe(true);
			expect(result.errors.some((e) => e.field === 'r2.secretAccessKey')).toBe(true);
		});

		it('should validate file size limits', () => {
			validConfig.r2.maxFileSize = 500;
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.field === 'r2.maxFileSize')).toBe(true);
		});

		it('should validate multipart threshold', () => {
			validConfig.r2.multipartThreshold = validConfig.r2.maxFileSize + 1000;
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.field === 'r2.multipartThreshold')).toBe(true);
		});

		it('should validate bucket name format', () => {
			validConfig.r2.defaultBucket = 'Invalid_Bucket_Name';
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.field === 'r2.defaultBucket')).toBe(true);
		});

		it('should validate endpoint URL', () => {
			validConfig.r2.endpoint = 'not-a-url';
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.field === 'r2.endpoint')).toBe(true);
		});
	});

	describe('Database Configuration Validation', () => {
		it('should validate valid database configuration', () => {
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(true);
		});

		it('should require database URL', () => {
			validConfig.database.url = '';
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.field === 'database.url')).toBe(true);
		});

		it('should validate pool size constraints', () => {
			validConfig.database.maxPoolSize = 0;
			validConfig.database.minPoolSize = 5;
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.field === 'database.maxPoolSize')).toBe(true);
			expect(result.errors.some((e) => e.field === 'database.minPoolSize')).toBe(true);
		});

		it('should validate MongoDB URL format', () => {
			validConfig.database.url = 'invalid://url';
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.field === 'database.url')).toBe(true);
		});
	});

	describe('Auth Configuration Validation', () => {
		it('should validate valid auth configuration', () => {
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(true);
		});

		it('should require auth secret', () => {
			validConfig.auth.secret = '';
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.field === 'auth.secret')).toBe(true);
		});

		it('should validate secret length', () => {
			validConfig.auth.secret = 'short';
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.field === 'auth.secret')).toBe(true);
		});

		it('should validate origin URLs', () => {
			validConfig.auth.origin = 'not-a-url';
			validConfig.auth.publicOrigin = 'also-not-a-url';
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.field === 'auth.origin')).toBe(true);
			expect(result.errors.some((e) => e.field === 'auth.publicOrigin')).toBe(true);
		});

		it('should warn about missing OAuth secrets', () => {
			validConfig.auth.google.clientSecret = '';
			validConfig.auth.github.clientSecret = '';
			const result = validator.validate(validConfig);
			expect(result.warnings.some((w) => w.field === 'auth.google.clientSecret')).toBe(true);
			expect(result.warnings.some((w) => w.field === 'auth.github.clientSecret')).toBe(true);
		});
	});

	describe('Helicone Configuration Validation', () => {
		it('should validate valid Helicone configuration', () => {
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(true);
		});

		it('should warn about missing API key', () => {
			validConfig.helicone.apiKey = '';
			const result = validator.validate(validConfig);
			expect(result.warnings.some((w) => w.field === 'helicone.apiKey')).toBe(true);
		});

		it('should validate base URLs', () => {
			validConfig.helicone.openaiBaseUrl = 'invalid-url';
			validConfig.helicone.anthropicBaseUrl = 'also-invalid';
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.field === 'helicone.openaiBaseUrl')).toBe(true);
			expect(result.errors.some((e) => e.field === 'helicone.anthropicBaseUrl')).toBe(true);
		});

		it('should validate temperature range', () => {
			validConfig.helicone.defaultTemperature = 3.0;
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.field === 'helicone.defaultTemperature')).toBe(true);
		});
	});

	describe('App Configuration Validation', () => {
		it('should validate valid app configuration', () => {
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(true);
		});

		it('should validate port range', () => {
			validConfig.app.port = 70000;
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.field === 'app.port')).toBe(true);
		});

		it('should validate session limits', () => {
			validConfig.app.maxConcurrentSessions = 2000;
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.field === 'app.maxConcurrentSessions')).toBe(true);
		});

		it('should validate session timeout', () => {
			validConfig.app.sessionTimeoutMs = 30000;
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.field === 'app.sessionTimeoutMs')).toBe(true);
		});

		it('should validate file upload limit', () => {
			validConfig.app.fileUploadLimitMb = 2000;
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.field === 'app.fileUploadLimitMb')).toBe(true);
		});

		it('should validate environment values', () => {
			validConfig.app.environment = 'invalid' as any;
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.field === 'app.environment')).toBe(true);
		});

		it('should validate log level values', () => {
			validConfig.app.logLevel = 'invalid' as any;
			const result = validator.validate(validConfig);
			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.field === 'app.logLevel')).toBe(true);
		});
	});
});
