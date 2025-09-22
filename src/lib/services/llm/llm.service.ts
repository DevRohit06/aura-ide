// services/llm/llm.service.ts
import { env } from '$env/dynamic/private';
import type { HeliconeConfig } from '@/config/helicone.config';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { HeliconeConfigManager } from '../../config/helicone.config';

export interface LLMRequest {
	messages: Array<{
		role: 'system' | 'user' | 'assistant';
		content: string;
	}>;
	model?: string;
	temperature?: number;
	maxTokens?: number;
}

export interface LLMResponse {
	content: string;
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
		cost?: number;
	};
	provider: string;
	model: string;
	cached?: boolean;
	latency: number;
}

export class LLMService {
	private heliconeConfig: HeliconeConfig;
	private providers: Map<string, any> = new Map();

	constructor() {
		this.heliconeConfig = HeliconeConfigManager.getInstance().getConfig();

		// Validate required environment variables
		if (!env.OPENAI_API_KEY) {
			throw new Error('OPENAI_API_KEY environment variable is required');
		}
		if (!env.ANTHROPIC_API_KEY) {
			throw new Error('ANTHROPIC_API_KEY environment variable is required');
		}

		this.initializeProviders();
	}

	private initializeProviders(): void {
		// OpenAI with Helicone
		const openaiConfig = {
			apiKey: env.OPENAI_API_KEY,
			temperature: 0,
			configuration: {
				baseURL: this.heliconeConfig.baseUrl,
				defaultHeaders: {
					'Helicone-Auth': `Bearer ${this.heliconeConfig.apiKey}`,
					'Helicone-Cache-Enabled': this.heliconeConfig.caching.enabled.toString(),
					'Cache-Control': `max-age=${this.heliconeConfig.caching.ttl}`,
					'Helicone-Cache-Bucket-Max-Size': this.heliconeConfig.caching.bucketMaxSize.toString(),
					...this.buildCustomHeaders()
				}
			}
		};

		// Anthropic with Helicone
		const anthropicConfig = {
			apiKey: env.ANTHROPIC_API_KEY,
			temperature: 0,
			clientOptions: {
				baseURL: 'https://anthropic.helicone.ai',
				defaultHeaders: {
					'Helicone-Auth': `Bearer ${this.heliconeConfig.apiKey}`,
					'Helicone-Cache-Enabled': this.heliconeConfig.caching.enabled.toString(),
					...this.buildCustomHeaders()
				}
			}
		};

		this.providers.set('openai', openaiConfig);
		this.providers.set('anthropic', anthropicConfig);
	}

	private buildCustomHeaders(): Record<string, string> {
		const headers: Record<string, string> = {};

		// Add custom properties for observability
		Object.entries(this.heliconeConfig.observability.customProperties).forEach(([key, value]) => {
			headers[`Helicone-Property-${key}`] = value;
		});

		return headers;
	}

	async invoke(request: LLMRequest, sessionId?: string, promptId?: string): Promise<LLMResponse> {
		const startTime = Date.now();

		try {
			const headers = this.buildRequestHeaders(sessionId, promptId);
			const provider = this.selectProvider(request.model);
			const llm = this.createLLMInstance(provider, request, headers);

			const response = await llm.invoke(request.messages);
			const latency = Date.now() - startTime;

			return {
				content:
					typeof response.content === 'string'
						? response.content
						: JSON.stringify(response.content),
				usage: response.usage_metadata
					? {
							promptTokens: response.usage_metadata.input_tokens || 0,
							completionTokens: response.usage_metadata.output_tokens || 0,
							totalTokens:
								(response.usage_metadata.input_tokens || 0) +
								(response.usage_metadata.output_tokens || 0)
						}
					: undefined,
				provider: provider,
				model: request.model || 'default',
				cached: this.isCachedResponse(response),
				latency
			};
		} catch (error) {
			this.handleError(error, request);
			throw error;
		}
	}

	async *stream(
		request: LLMRequest,
		sessionId?: string,
		promptId?: string
	): AsyncGenerator<{ content: string; done?: boolean }> {
		const headers = this.buildRequestHeaders(sessionId, promptId);
		const provider = this.selectProvider(request.model);
		const llm = this.createLLMInstance(provider, request, headers);

		try {
			const stream = await llm.stream(request.messages);

			for await (const chunk of stream) {
				if (chunk.content) {
					const content =
						typeof chunk.content === 'string' ? chunk.content : JSON.stringify(chunk.content);
					yield { content };
				}
			}

			yield { content: '', done: true };
		} catch (error) {
			this.handleError(error, request);
			throw error;
		}
	}

	private buildRequestHeaders(sessionId?: string, promptId?: string): Record<string, string> {
		const headers: Record<string, string> = {};

		if (sessionId) {
			headers['Helicone-Session-Id'] = sessionId;
		}

		if (promptId) {
			headers['Helicone-Prompt-Id'] = promptId;
		}

		// Add timestamp for request tracking
		headers['Helicone-Request-Timestamp'] = new Date().toISOString();

		return headers;
	}

	private selectProvider(model?: string): string {
		if (!model) return 'openai';

		if (model.includes('gpt') || model.includes('openai')) return 'openai';
		if (model.includes('claude') || model.includes('anthropic')) return 'anthropic';

		return 'openai'; // default fallback
	}

	private createLLMInstance(
		provider: string,
		request: LLMRequest,
		headers: Record<string, string>
	) {
		const config = this.providers.get(provider);

		if (!config) {
			throw new Error(`Provider ${provider} not configured`);
		}

		// Merge request-specific headers with default config
		const enhancedConfig = {
			...config,
			temperature: request.temperature ?? config.temperature,
			modelName: request.model,
			maxTokens: request.maxTokens,
			configuration: {
				...config.configuration,
				defaultHeaders: {
					...config.configuration?.defaultHeaders,
					...headers
				}
			}
		};

		switch (provider) {
			case 'openai':
				return new ChatOpenAI(enhancedConfig);
			case 'anthropic':
				return new ChatAnthropic(enhancedConfig);
			default:
				throw new Error(`Unsupported provider: ${provider}`);
		}
	}

	/**
	 * Create a configured LLM instance for agent use
	 */
	createLLMInstanceForAgent(model: string, temperature?: number): ChatOpenAI | ChatAnthropic {
		const provider = this.selectProvider(model);
		const request: LLMRequest = {
			messages: [],
			model,
			temperature
		};
		const headers = this.buildRequestHeaders();

		return this.createLLMInstance(provider, request, headers);
	}

	private isCachedResponse(response: any): boolean {
		// Check if response was served from cache
		return response.response_metadata?.httpResponse?.headers?.['helicone-cache'] === 'HIT';
	}
	private handleError(error: any, request: LLMRequest): void {
		// Log error with context for debugging
		console.error('LLM Request Error:', {
			error: error.message,
			model: request.model,
			provider: this.selectProvider(request.model),
			timestamp: new Date().toISOString()
		});

		// Could integrate with error tracking service here
	}
}
