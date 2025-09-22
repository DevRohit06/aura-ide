/**
 * Configuration Manager
 * Central configuration management with validation and caching
 */

import { EnvironmentConfigManager } from './environment.js';
import type { ConfigValidationResult, SandboxExecutionConfig } from './types.js';
import { ConfigValidator } from './validation.js';

export class ConfigurationManager {
	private static instance: ConfigurationManager;
	private config: SandboxExecutionConfig | null = null;
	private validationResult: ConfigValidationResult | null = null;
	private environmentManager: EnvironmentConfigManager;
	private validator: ConfigValidator;

	private constructor() {
		this.environmentManager = new EnvironmentConfigManager();
		this.validator = new ConfigValidator();
	}

	static getInstance(): ConfigurationManager {
		if (!ConfigurationManager.instance) {
			ConfigurationManager.instance = new ConfigurationManager();
		}
		return ConfigurationManager.instance;
	}

	/**
	 * Load and validate configuration
	 */
	async initialize(): Promise<ConfigValidationResult> {
		try {
			// Load configuration from environment
			this.config = this.environmentManager.loadConfiguration();

			// Validate configuration
			this.validationResult = this.validator.validate(this.config);

			// Log validation results
			this.logValidationResults();

			return this.validationResult;
		} catch (error) {
			const errorResult: ConfigValidationResult = {
				isValid: false,
				errors: [
					{
						field: 'configuration',
						message: `Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
					}
				],
				warnings: []
			};

			this.validationResult = errorResult;
			return errorResult;
		}
	}

	/**
	 * Get the current configuration
	 */
	getConfig(): SandboxExecutionConfig {
		if (!this.config) {
			throw new Error('Configuration not initialized. Call initialize() first.');
		}
		return this.config;
	}

	/**
	 * Get validation results
	 */
	getValidationResult(): ConfigValidationResult {
		if (!this.validationResult) {
			throw new Error('Configuration not validated. Call initialize() first.');
		}
		return this.validationResult;
	}

	/**
	 * Check if configuration is valid
	 */
	isValid(): boolean {
		return this.validationResult?.isValid ?? false;
	}

	/**
	 * Get configuration for a specific service
	 */

	getDaytonaConfig() {
		return this.getConfig().daytona;
	}

	getR2Config() {
		return this.getConfig().r2;
	}

	getDatabaseConfig() {
		return this.getConfig().database;
	}

	getAuthConfig() {
		return this.getConfig().auth;
	}

	getHeliconeConfig() {
		return this.getConfig().helicone;
	}

	getAppConfig() {
		return this.getConfig().app;
	}

	/**
	 * Get current environment
	 */
	getEnvironment() {
		return this.environmentManager.getEnvironment();
	}

	/**
	 * Check if a service is enabled and properly configured
	 */

	isDaytonaEnabled(): boolean {
		const config = this.getDaytonaConfig();
		return config.enabled && !!config.apiKey;
	}

	isR2Enabled(): boolean {
		const config = this.getR2Config();
		return !!config.accessKeyId && !!config.secretAccessKey;
	}

	isHeliconeEnabled(): boolean {
		const config = this.getHeliconeConfig();
		return !!config.apiKey;
	}

	/**
	 * Get available sandbox providers
	 */
	getAvailableProviders(): string[] {
		const providers: string[] = [];

		if (this.isE2BEnabled()) {
			providers.push('e2b');
		}

		if (this.isDaytonaEnabled()) {
			providers.push('daytona');
		}

		return providers;
	}

	/**
	 * Get preferred sandbox provider
	 */
	getPreferredProvider(): string | null {
		const providers = this.getAvailableProviders();

		if (providers.length === 0) {
			return null;
		}

		// Prefer E2B in production, Daytona in development
		const environment = this.getEnvironment();

		if (environment === 'production' && providers.includes('e2b')) {
			return 'e2b';
		}

		if (environment === 'development' && providers.includes('daytona')) {
			return 'daytona';
		}

		// Return first available provider
		return providers[0];
	}

	/**
	 * Reload configuration
	 */
	async reload(): Promise<ConfigValidationResult> {
		this.config = null;
		this.validationResult = null;
		return this.initialize();
	}

	/**
	 * Get configuration summary for debugging
	 */
	getConfigSummary(): Record<string, any> {
		if (!this.config) {
			return { status: 'not_initialized' };
		}

		return {
			environment: this.getEnvironment(),
			isValid: this.isValid(),
			providers: {
				e2b: this.isE2BEnabled(),
				daytona: this.isDaytonaEnabled(),
				r2: this.isR2Enabled(),
				helicone: this.isHeliconeEnabled()
			},
			preferredProvider: this.getPreferredProvider(),
			errors: this.validationResult?.errors.length || 0,
			warnings: this.validationResult?.warnings.length || 0
		};
	}

	private logValidationResults(): void {
		if (!this.validationResult) return;

		const { isValid, errors, warnings } = this.validationResult;
		const environment = this.getEnvironment();

		console.log(`[Config] Environment: ${environment}`);
		console.log(`[Config] Validation: ${isValid ? 'PASSED' : 'FAILED'}`);

		if (warnings.length > 0) {
			console.warn(`[Config] ${warnings.length} warning(s):`);
			warnings.forEach((warning) => {
				console.warn(`  - ${warning.field}: ${warning.message}`);
			});
		}

		if (errors.length > 0) {
			console.error(`[Config] ${errors.length} error(s):`);
			errors.forEach((error) => {
				console.error(`  - ${error.field}: ${error.message}`);
			});
		}

		// Log provider availability
		const providers = this.getAvailableProviders();
		if (providers.length > 0) {
			console.log(`[Config] Available providers: ${providers.join(', ')}`);
			console.log(`[Config] Preferred provider: ${this.getPreferredProvider()}`);
		} else {
			console.warn('[Config] No sandbox providers available');
		}
	}
}

// Export singleton instance
export const configManager = ConfigurationManager.getInstance();
