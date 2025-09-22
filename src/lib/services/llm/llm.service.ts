// services/llm/llm.service.ts
import { env } from '$env/dynamic/private';
import type { HeliconeConfig } from '@/config/helicone.config';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatGroq } from '@langchain/groq';
import { ChatOpenAI } from '@langchain/openai';
import { HeliconeConfigManager } from '../../config/helicone.config';
import { systemPromptConfig } from '../../config/system-prompts.config.js';
import type {
	ContextVariables,
	LLMRequest,
	LLMResponse,
	LLMServiceConfig,
	Message,
	StreamChunk,
	SystemPromptOptions
} from '../../types/llm.types.js';

export interface LegacyLLMRequest {
	messages: Array<{
		role: 'system' | 'user' | 'assistant';
		content: string;
	}>;
	model?: string;
	temperature?: number;
	maxTokens?: number;
}

export interface LegacyLLMResponse {
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
	private config: LLMServiceConfig;

	constructor(config: Partial<LLMServiceConfig> = {}) {
		this.heliconeConfig = HeliconeConfigManager.getInstance().getConfig();
		this.config = {
			defaultModel: 'gpt-4',
			defaultTemperature: 0,
			maxTokens: 4096,
			enableSystemPrompts: true,
			defaultSystemPromptContext: 'code-assistant',
			retryConfig: {
				maxRetries: 3,
				backoffMultiplier: 2,
				initialDelay: 1000
			},
			...config
		};

		// Validate required environment variables
		if (!env.OPENAI_API_KEY) {
			throw new Error('OPENAI_API_KEY environment variable is required');
		}
		if (!env.ANTHROPIC_API_KEY) {
			throw new Error('ANTHROPIC_API_KEY environment variable is required');
		}
		if (!env.GOOGLE_API_KEY) {
			console.warn('GOOGLE_API_KEY not found. Gemini models will not be available.');
		}
		if (!env.GROQ_API_KEY) {
			console.warn('GROQ_API_KEY not found. Groq models will not be available.');
		}
		if (!env.OPENROUTER_API_KEY) {
			console.warn('OPENROUTER_API_KEY not found. OpenRouter models will not be available.');
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

		// Google Gemini with Helicone
		const geminiConfig = env.GOOGLE_API_KEY
			? {
					apiKey: env.GOOGLE_API_KEY,
					temperature: 0,
					clientOptions: {
						baseURL: 'https://generativelanguage.helicone.ai',
						defaultHeaders: {
							'Helicone-Auth': `Bearer ${this.heliconeConfig.apiKey}`,
							'Helicone-Cache-Enabled': this.heliconeConfig.caching.enabled.toString(),
							...this.buildCustomHeaders()
						}
					}
				}
			: null;

		// Groq with Helicone
		const groqConfig = env.GROQ_API_KEY
			? {
					apiKey: env.GROQ_API_KEY,
					temperature: 0,
					configuration: {
						baseURL: 'https://groq.helicone.ai',
						defaultHeaders: {
							'Helicone-Auth': `Bearer ${this.heliconeConfig.apiKey}`,
							'Helicone-Cache-Enabled': this.heliconeConfig.caching.enabled.toString(),
							...this.buildCustomHeaders()
						}
					}
				}
			: null;

		// OpenRouter with Helicone
		const openrouterConfig = env.OPENROUTER_API_KEY
			? {
					apiKey: env.OPENROUTER_API_KEY,
					temperature: 0,
					configuration: {
						baseURL: 'https://openrouter.helicone.ai/api/v1',
						defaultHeaders: {
							'Helicone-Auth': `Bearer ${this.heliconeConfig.apiKey}`,
							'Helicone-Cache-Enabled': this.heliconeConfig.caching.enabled.toString(),
							'HTTP-Referer': 'https://aura-ide.com',
							'X-Title': 'Aura IDE',
							...this.buildCustomHeaders()
						}
					}
				}
			: null;

		this.providers.set('openai', openaiConfig);
		this.providers.set('anthropic', anthropicConfig);

		if (geminiConfig) {
			this.providers.set('gemini', geminiConfig);
		}

		if (groqConfig) {
			this.providers.set('groq', groqConfig);
		}

		if (openrouterConfig) {
			this.providers.set('openrouter', openrouterConfig);
		}
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
			// Process system prompts and prepare messages
			const processedMessages = await this.processMessages(request);
			const headers = this.buildRequestHeaders(sessionId, promptId);
			const provider = this.selectProvider(request.model);
			const llm = this.createLLMInstance(provider, request, headers);

			// Convert our Message format to LangChain format
			const langchainMessages = this.convertToLangchainMessages(processedMessages);

			const response = await llm.invoke(langchainMessages);
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
				model: request.model || this.config.defaultModel || 'default',
				cached: this.isCachedResponse(response),
				latency,
				systemPromptUsed: request.systemPrompt?.promptId,
				metadata: {
					systemPromptId: request.systemPrompt?.promptId,
					context: request.systemPrompt?.context,
					variables: request.systemPrompt?.variables
				}
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
	): AsyncGenerator<StreamChunk> {
		const headers = this.buildRequestHeaders(sessionId, promptId);
		const provider = this.selectProvider(request.model);
		const llm = this.createLLMInstance(provider, request, headers);

		try {
			// Process system prompts and prepare messages
			const processedMessages = await this.processMessages(request);
			const langchainMessages = this.convertToLangchainMessages(processedMessages);

			const stream = await llm.stream(langchainMessages);

			let chunkIndex = 0;
			for await (const chunk of stream) {
				if (chunk.content) {
					const content =
						typeof chunk.content === 'string' ? chunk.content : JSON.stringify(chunk.content);
					yield {
						content,
						metadata: {
							chunkIndex: chunkIndex++
						}
					};
				}
			}

			yield { content: '', done: true };
		} catch (error) {
			this.handleError(error, request);
			throw error;
		}
	}

	/**
	 * Process messages and inject system prompts
	 */
	private async processMessages(request: LLMRequest): Promise<Message[]> {
		const messages = [...request.messages];

		// If system prompts are enabled and configured
		if (this.config.enableSystemPrompts && request.systemPrompt) {
			const systemMessage = await this.generateSystemMessage(request.systemPrompt);

			if (systemMessage) {
				// Check if there's already a system message
				const hasSystemMessage = messages.some((msg) => msg.role === 'system');

				if (hasSystemMessage && request.systemPrompt.override) {
					// Replace existing system message
					const systemIndex = messages.findIndex((msg) => msg.role === 'system');
					messages[systemIndex] = systemMessage;
				} else if (!hasSystemMessage) {
					// Add system message at the beginning
					messages.unshift(systemMessage);
				}
			}
		}

		return messages;
	}

	/**
	 * Generate system message from prompt configuration
	 */
	private async generateSystemMessage(options: SystemPromptOptions): Promise<Message | null> {
		try {
			let promptContent: string;

			if (options.promptId) {
				// Use specific prompt by ID
				promptContent = systemPromptConfig.renderPrompt(options.promptId, options.variables || {});
			} else if (options.context) {
				// Use prompt by context
				const prompt = systemPromptConfig.getPromptByContext(options.context);
				if (!prompt) {
					throw new Error(`No system prompt found for context: ${options.context}`);
				}
				promptContent = systemPromptConfig.renderPrompt(prompt.id, options.variables || {});
			} else {
				// Use default context
				const prompt = systemPromptConfig.getPromptByContext(
					this.config.defaultSystemPromptContext!
				);
				if (!prompt) {
					return null;
				}
				promptContent = systemPromptConfig.renderPrompt(prompt.id, options.variables || {});
			}

			return {
				role: 'system',
				content: promptContent,
				timestamp: new Date()
			};
		} catch (error) {
			console.error('Error generating system message:', error);
			return null;
		}
	}

	/**
	 * Convert our Message format to LangChain message format
	 */
	private convertToLangchainMessages(messages: Message[]): any[] {
		return messages.map((msg) => ({
			type: msg.role === 'assistant' ? 'ai' : msg.role,
			content: msg.content
		}));
	}

	/**
	 * Extract context variables from request for system prompts
	 */
	extractContextVariables(request: LLMRequest): ContextVariables {
		const variables: ContextVariables = {};

		// Extract from request metadata
		if (request.userId) variables.userId = request.userId;
		if (request.projectId) variables.projectId = request.projectId;
		if (request.sessionId) variables.sessionId = request.sessionId;

		// Add any additional variables passed in system prompt options
		if (request.systemPrompt?.variables) {
			Object.assign(variables, request.systemPrompt.variables);
		}

		return variables;
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
		if (!model) return 'anthropic';

		// OpenAI models
		if (
			model.includes('gpt') ||
			model.includes('openai') ||
			model.startsWith('o1') ||
			model === 'gpt-4.1'
		)
			return 'openai';

		// Anthropic models
		if (model.includes('claude') || model.includes('anthropic')) return 'anthropic';

		// Google Gemini models
		if (model.includes('gemini') || model.includes('google')) return 'gemini';

		// Groq models
		if (
			model.includes('llama') ||
			model.includes('mixtral') ||
			model.includes('gemma') ||
			model.includes('groq') ||
			model.includes('whisper')
		)
			return 'groq';

		// OpenRouter models (prefix-based detection)
		if (model.includes('/') || model.includes('qwen') || model.includes('perplexity'))
			return 'openrouter';

		return 'anthropic'; // default fallback
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
			temperature: request.temperature ?? config.temperature ?? this.config.defaultTemperature,
			modelName: request.model || this.config.defaultModel,
			maxTokens: request.maxTokens || this.config.maxTokens,
			configuration: {
				...config.configuration,
				defaultHeaders: {
					...config.configuration?.defaultHeaders,
					...headers
				}
			},
			clientOptions: {
				...config.clientOptions,
				defaultHeaders: {
					...config.clientOptions?.defaultHeaders,
					...headers
				}
			}
		};

		switch (provider) {
			case 'openai':
				return new ChatOpenAI(enhancedConfig);
			case 'anthropic':
				return new ChatAnthropic(enhancedConfig);
			case 'gemini':
				return new ChatGoogleGenerativeAI({
					...enhancedConfig,
					model: request.model || 'gemini-1.5-flash'
				});
			case 'groq':
				return new ChatGroq(enhancedConfig);
			case 'openrouter':
				return new ChatOpenAI({
					...enhancedConfig,
					modelName: request.model || 'meta-llama/llama-3.2-3b-instruct:free'
				});
			default:
				throw new Error(`Unsupported provider: ${provider}`);
		}
	}

	/**
	 * Create a configured LLM instance for agent use
	 */
	createLLMInstanceForAgent(
		model: string,
		temperature?: number
	): ChatOpenAI | ChatAnthropic | ChatGoogleGenerativeAI | ChatGroq {
		const provider = this.selectProvider(model);
		const request: LLMRequest = {
			messages: [],
			model,
			temperature
		};
		const headers = this.buildRequestHeaders();

		return this.createLLMInstance(provider, request, headers);
	}

	/**
	 * Create a request with system prompt for code assistance
	 */
	createCodeAssistantRequest(
		userMessage: string,
		contextVariables: ContextVariables = {},
		options: Partial<LLMRequest> = {}
	): LLMRequest {
		return {
			messages: [
				{
					role: 'user',
					content: userMessage,
					timestamp: new Date()
				}
			],
			systemPrompt: {
				context: 'code-assistant',
				variables: contextVariables
			},
			model: this.config.defaultModel,
			temperature: this.config.defaultTemperature,
			...options
		};
	}

	/**
	 * Create a request with system prompt for code review
	 */
	createCodeReviewRequest(
		code: string,
		contextVariables: ContextVariables = {},
		options: Partial<LLMRequest> = {}
	): LLMRequest {
		return {
			messages: [
				{
					role: 'user',
					content: `Please review the following code:\n\n\`\`\`${contextVariables.language || ''}\n${code}\n\`\`\``,
					timestamp: new Date()
				}
			],
			systemPrompt: {
				context: 'code-review',
				variables: contextVariables
			},
			model: this.config.defaultModel,
			temperature: this.config.defaultTemperature,
			...options
		};
	}

	/**
	 * Create a request with system prompt for debugging assistance
	 */
	createDebuggingRequest(
		errorDescription: string,
		contextVariables: ContextVariables = {},
		options: Partial<LLMRequest> = {}
	): LLMRequest {
		return {
			messages: [
				{
					role: 'user',
					content: errorDescription,
					timestamp: new Date()
				}
			],
			systemPrompt: {
				context: 'debugging',
				variables: {
					errorMessage: errorDescription,
					...contextVariables
				}
			},
			model: this.config.defaultModel,
			temperature: this.config.defaultTemperature,
			...options
		};
	}

	/**
	 * Create a request with system prompt for documentation
	 */
	createDocumentationRequest(
		content: string,
		docType: 'api' | 'readme' | 'guide' | 'reference',
		contextVariables: ContextVariables = {},
		options: Partial<LLMRequest> = {}
	): LLMRequest {
		return {
			messages: [
				{
					role: 'user',
					content: content,
					timestamp: new Date()
				}
			],
			systemPrompt: {
				context: 'documentation',
				variables: {
					docType,
					...contextVariables
				}
			},
			model: this.config.defaultModel,
			temperature: this.config.defaultTemperature,
			...options
		};
	}

	/**
	 * Get service configuration
	 */
	getConfig(): LLMServiceConfig {
		return { ...this.config };
	}

	/**
	 * Update service configuration
	 */
	updateConfig(newConfig: Partial<LLMServiceConfig>): void {
		this.config = { ...this.config, ...newConfig };
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
