/**
 * Sandbox Provider Factory
 * Creates and manages sandbox provider instances (Daytona only)
 */

import type { SandboxProvider } from '$lib/types/sandbox.js';
import { sandboxConfig } from '../../config/sandbox.config.js';
import { DaytonaProvider } from './daytona-provider.js';
import type { ISandboxProvider, ISandboxProviderFactory } from './sandbox-provider.interface.js';

/**
 * Provider Factory Implementation
 */
export class SandboxProviderFactory implements ISandboxProviderFactory {
	private static instance: SandboxProviderFactory | null = null;
	private providers = new Map<SandboxProvider, ISandboxProvider>();

	private constructor() {}

	static getInstance(): SandboxProviderFactory {
		if (!this.instance) {
			this.instance = new SandboxProviderFactory();
		}
		return this.instance;
	}

	createProvider(type: SandboxProvider, config?: any): ISandboxProvider {
		// Check if provider already exists
		if (this.providers.has(type)) {
			return this.providers.get(type)!;
		}

		let provider: ISandboxProvider;

		switch (type) {
			case 'daytona':
				provider = new DaytonaProvider(config || sandboxConfig.daytona);
				break;

			default:
				throw new Error(`Unsupported provider type: ${type}`);
		}

		// Store provider instance
		this.providers.set(type, provider);
		return provider;
	}

	getProvider(type: SandboxProvider): ISandboxProvider | null {
		return this.providers.get(type) || null;
	}

	getAvailableProviders(): SandboxProvider[] {
		const available: SandboxProvider[] = [];

		// Check Daytona
		if (sandboxConfig.daytona.apiKey) {
			available.push('daytona');
		}

		return available;
	}

	validateConfig(type: SandboxProvider, config: any): boolean {
		switch (type) {
			case 'daytona':
				return !!(config.apiKey && config.apiUrl);

			default:
				return false;
		}
	}

	async initializeProvider(type: SandboxProvider): Promise<ISandboxProvider> {
		const provider = this.createProvider(type);
		await provider.initialize();
		return provider;
	}

	async initializeAllProviders(): Promise<void> {
		const available = this.getAvailableProviders();
		const initPromises = available.map((type) => this.initializeProvider(type));

		await Promise.allSettled(initPromises);
	}

	async healthCheckProvider(type: SandboxProvider): Promise<{
		healthy: boolean;
		latency: number;
		error?: string;
	}> {
		try {
			const provider = this.getProvider(type);
			if (!provider) {
				return {
					healthy: false,
					latency: 0,
					error: 'Provider not available'
				};
			}

			return await provider.healthCheck();
		} catch (error: any) {
			return {
				healthy: false,
				latency: 0,
				error: error.message || String(error)
			};
		}
	}

	async healthCheckAllProviders(): Promise<
		Record<
			SandboxProvider,
			{
				healthy: boolean;
				latency: number;
				error?: string;
			}
		>
	> {
		const available = this.getAvailableProviders();
		const results: Record<string, any> = {};

		await Promise.all(
			available.map(async (type) => {
				results[type] = await this.healthCheckProvider(type);
			})
		);

		return results as Record<
			SandboxProvider,
			{
				healthy: boolean;
				latency: number;
				error?: string;
			}
		>;
	}

	async cleanupAllProviders(): Promise<void> {
		const cleanupPromises = Array.from(this.providers.values()).map((provider) =>
			provider.cleanup()
		);

		await Promise.allSettled(cleanupPromises);
		this.providers.clear();
	}

	getProviderCapabilities(type: SandboxProvider): ISandboxProvider['capabilities'] | null {
		const provider = this.getProvider(type);
		return provider?.capabilities || null;
	}

	async getProviderInfo(type: SandboxProvider): Promise<any> {
		const provider = this.getProvider(type);
		if (!provider) {
			throw new Error(`Provider ${type} not available`);
		}

		return await provider.getProviderInfo();
	}
}
