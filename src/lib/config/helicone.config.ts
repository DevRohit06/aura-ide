// config/helicone.config.ts

import { env } from '$env/dynamic/private';

export interface HeliconeConfig {
	apiKey: string;
	baseUrl: string;
	caching: {
		enabled: boolean;
		ttl: number;
		bucketMaxSize: number;
	};
	routing: {
		strategy: 'latency' | 'cost' | 'weighted';
		fallbackProviders: string[];
	};
	rateLimit: {
		requestsPerMinute: number;
		tokensPerMinute?: number;
		costPerMinute?: number;
	};
	observability: {
		sessionTracking: boolean;
		customProperties: Record<string, string>;
	};
}

export class HeliconeConfigManager {
	private static instance: HeliconeConfigManager;
	private config: HeliconeConfig;

	private constructor() {
		this.config = this.loadConfig();
		// Ensure Helicone API key is present - Langraph currently requires Helicone for all provider traffic
		if (!this.config.apiKey) {
			throw new Error(
				'HELICONE_API_KEY environment variable is required. Langraph only supports providers via Helicone.'
			);
		}
	}

	static getInstance(): HeliconeConfigManager {
		if (!HeliconeConfigManager.instance) {
			HeliconeConfigManager.instance = new HeliconeConfigManager();
		}
		return HeliconeConfigManager.instance;
	}

	private loadConfig(): HeliconeConfig {
		const apiKey = env.HELICONE_API_KEY || '';
		return {
			apiKey,
			baseUrl: env.HELICONE_BASE_URL || 'https://oai.helicone.ai/v1',
			caching: {
				enabled: env.HELICONE_CACHE_ENABLED === 'true',
				ttl: parseInt(env.HELICONE_CACHE_TTL || '3600'),
				bucketMaxSize: parseInt(env.HELICONE_CACHE_BUCKET_SIZE || '3')
			},
			routing: {
				strategy: (env.HELICONE_ROUTING_STRATEGY as any) || 'latency',
				fallbackProviders: (env.HELICONE_FALLBACK_PROVIDERS || '').split(',')
			},
			rateLimit: {
				requestsPerMinute: parseInt(env.HELICONE_RATE_LIMIT_RPM || '1000'),
				tokensPerMinute: parseInt(env.HELICONE_RATE_LIMIT_TPM || ''),
				costPerMinute: parseFloat(env.HELICONE_RATE_LIMIT_COST || '')
			},
			observability: {
				sessionTracking: env.HELICONE_SESSION_TRACKING === 'true',
				customProperties: JSON.parse(env.HELICONE_CUSTOM_PROPERTIES || '{}')
			}
		};
	}

	getConfig(): HeliconeConfig {
		return this.config;
	}

	updateConfig(updates: Partial<HeliconeConfig>): void {
		this.config = { ...this.config, ...updates };
	}
}
