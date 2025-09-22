// config/helicone.config.ts
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
	}

	static getInstance(): HeliconeConfigManager {
		if (!HeliconeConfigManager.instance) {
			HeliconeConfigManager.instance = new HeliconeConfigManager();
		}
		return HeliconeConfigManager.instance;
	}

	private loadConfig(): HeliconeConfig {
		return {
			apiKey: process.env.HELICONE_API_KEY!,
			baseUrl: process.env.HELICONE_BASE_URL || 'https://oai.helicone.ai/v1',
			caching: {
				enabled: process.env.HELICONE_CACHE_ENABLED === 'true',
				ttl: parseInt(process.env.HELICONE_CACHE_TTL || '3600'),
				bucketMaxSize: parseInt(process.env.HELICONE_CACHE_BUCKET_SIZE || '3')
			},
			routing: {
				strategy: (process.env.HELICONE_ROUTING_STRATEGY as any) || 'latency',
				fallbackProviders: (process.env.HELICONE_FALLBACK_PROVIDERS || '').split(',')
			},
			rateLimit: {
				requestsPerMinute: parseInt(process.env.HELICONE_RATE_LIMIT_RPM || '1000'),
				tokensPerMinute: parseInt(process.env.HELICONE_RATE_LIMIT_TPM || ''),
				costPerMinute: parseFloat(process.env.HELICONE_RATE_LIMIT_COST || '')
			},
			observability: {
				sessionTracking: process.env.HELICONE_SESSION_TRACKING === 'true',
				customProperties: JSON.parse(process.env.HELICONE_CUSTOM_PROPERTIES || '{}')
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
