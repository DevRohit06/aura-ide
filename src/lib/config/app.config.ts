// config/app.config.ts
export const AppConfig = {
	development: {
		helicone: {
			caching: { enabled: true, ttl: 3600 },
			rateLimit: { requestsPerMinute: 100 },
			observability: {
				sessionTracking: true,
				customProperties: {
					environment: 'development',
					version: process.env.APP_VERSION || 'dev'
				}
			}
		}
	},
	production: {
		helicone: {
			caching: { enabled: true, ttl: 7200 },
			rateLimit: { requestsPerMinute: 1000 },
			routing: {
				strategy: 'latency',
				fallbackProviders: ['openai', 'anthropic']
			},
			observability: {
				sessionTracking: true,
				customProperties: {
					environment: 'production',
					version: process.env.APP_VERSION
				}
			}
		}
	}
};
