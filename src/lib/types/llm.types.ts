// LLM and AI service types for Aura IDE
export type SystemPromptContext =
	| 'code-assistant'
	| 'general-chat'
	| 'code-review'
	| 'documentation'
	| 'debugging';

export interface SystemPromptTemplate {
	id: string;
	name: string;
	content: string;
	variables: string[];
	context: SystemPromptContext;
	description?: string;
	version?: string;
	createdAt?: Date;
	updatedAt?: Date;
}

export interface SystemPromptOptions {
	context?: SystemPromptContext;
	promptId?: string;
	variables?: ContextVariables;
	override?: boolean; // Whether to override existing system message
}

export interface Message {
	role: 'system' | 'user' | 'assistant';
	content: string;
	timestamp?: Date;
	metadata?: Record<string, unknown>;
}

export interface LLMRequest {
	messages: Message[];
	model?: string;
	temperature?: number;
	maxTokens?: number;
	systemPrompt?: SystemPromptOptions;
	sessionId?: string;
	userId?: string;
	projectId?: string;
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
	systemPromptUsed?: string;
	metadata?: {
		systemPromptId?: string;
		context?: SystemPromptContext;
		variables?: ContextVariables;
	};
}

export interface StreamChunk {
	content: string;
	done?: boolean;
	metadata?: {
		chunkIndex?: number;
		totalChunks?: number;
	};
}

export interface LLMError {
	code: string;
	message: string;
	provider?: string;
	model?: string;
	requestId?: string;
	timestamp: Date;
	context?: {
		systemPromptId?: string;
		userId?: string;
		sessionId?: string;
	};
}

export interface LLMServiceConfig {
	defaultModel?: string;
	defaultTemperature?: number;
	maxTokens?: number;
	enableSystemPrompts?: boolean;
	defaultSystemPromptContext?: SystemPromptContext;
	retryConfig?: {
		maxRetries: number;
		backoffMultiplier: number;
		initialDelay: number;
	};
}

export interface PromptTemplate {
	id: string;
	name: string;
	content: string;
	variables: string[];
	category?: string;
	tags?: string[];
	isSystem?: boolean;
}

export interface ContextVariables {
	// User context
	userName?: string;
	userId?: string;

	// Project context
	projectName?: string;
	projectId?: string;
	language?: string;
	framework?: string;

	// File context
	fileName?: string;
	filePath?: string;
	selectedCode?: string;
	cursorPosition?: {
		line: number;
		column: number;
	};

	// Environment context
	environment?: 'development' | 'staging' | 'production';
	branchName?: string;

	// Error context (for debugging)
	errorMessage?: string;
	stackTrace?: string;

	// Documentation context
	docType?: 'api' | 'readme' | 'guide' | 'reference';
	audience?: 'developer' | 'user' | 'admin';

	// Custom variables
	[key: string]: unknown;
}

export interface LLMProvider {
	name: string;
	displayName: string;
	models: LLMModel[];
	supportedFeatures: {
		streaming: boolean;
		functionCalling: boolean;
		systemPrompts: boolean;
		maxTokens: number;
	};
	rateLimits?: {
		requestsPerMinute: number;
		tokensPerMinute: number;
	};
}

export interface LLMModel {
	id: string;
	name: string;
	provider: string;
	contextLength: number;
	inputCost?: number; // per 1M tokens
	outputCost?: number; // per 1M tokens
	capabilities: {
		text: boolean;
		vision?: boolean;
		functionCalling?: boolean;
		codeExecution?: boolean;
	};
}

// Predefined providers and their models
export const LLM_PROVIDERS: Record<string, LLMProvider> = {
	openai: {
		name: 'openai',
		displayName: 'OpenAI',
		models: [
			{
				id: 'gpt-4o',
				name: 'GPT-4o',
				provider: 'openai',
				contextLength: 128000,
				inputCost: 2.5,
				outputCost: 10.0,
				capabilities: { text: true, vision: true, functionCalling: true }
			},
			{
				id: 'gpt-4o-mini',
				name: 'GPT-4o Mini',
				provider: 'openai',
				contextLength: 128000,
				inputCost: 0.15,
				outputCost: 0.6,
				capabilities: { text: true, vision: true, functionCalling: true }
			},
			{
				id: 'gpt-4o-2024-11-20',
				name: 'GPT-4o (2024-11-20)',
				provider: 'openai',
				contextLength: 128000,
				inputCost: 2.5,
				outputCost: 10.0,
				capabilities: { text: true, vision: true, functionCalling: true }
			},
			{
				id: 'gpt-4.1',
				name: 'GPT-4.1',
				provider: 'openai',
				contextLength: 200000,
				inputCost: 30.0,
				outputCost: 60.0,
				capabilities: { text: true, vision: true, functionCalling: true }
			},
			{
				id: 'o1-preview',
				name: 'o1 Preview',
				provider: 'openai',
				contextLength: 128000,
				inputCost: 15.0,
				outputCost: 60.0,
				capabilities: { text: true, functionCalling: false }
			},
			{
				id: 'o1-mini',
				name: 'o1 Mini',
				provider: 'openai',
				contextLength: 128000,
				inputCost: 3.0,
				outputCost: 12.0,
				capabilities: { text: true, functionCalling: false }
			},
			{
				id: 'o1',
				name: 'o1',
				provider: 'openai',
				contextLength: 200000,
				inputCost: 15.0,
				outputCost: 60.0,
				capabilities: { text: true, functionCalling: false }
			}
		],
		supportedFeatures: {
			streaming: true,
			functionCalling: true,
			systemPrompts: true,
			maxTokens: 200000
		}
	},
	anthropic: {
		name: 'anthropic',
		displayName: 'Anthropic',
		models: [
			{
				id: 'claude-3-5-sonnet-20241022',
				name: 'Claude 3.5 Sonnet',
				provider: 'anthropic',
				contextLength: 200000,
				inputCost: 3.0,
				outputCost: 15.0,
				capabilities: { text: true, vision: true, functionCalling: true }
			},
			{
				id: 'claude-3-5-haiku-20241022',
				name: 'Claude 3.5 Haiku',
				provider: 'anthropic',
				contextLength: 200000,
				inputCost: 0.8,
				outputCost: 4.0,
				capabilities: { text: true, vision: true, functionCalling: true }
			},
			{
				id: 'claude-3-opus-20240229',
				name: 'Claude 3 Opus',
				provider: 'anthropic',
				contextLength: 200000,
				inputCost: 15.0,
				outputCost: 75.0,
				capabilities: { text: true, vision: true, functionCalling: true }
			}
		],
		supportedFeatures: {
			streaming: true,
			functionCalling: true,
			systemPrompts: true,
			maxTokens: 200000
		}
	},
	gemini: {
		name: 'gemini',
		displayName: 'Google Gemini',
		models: [
			{
				id: 'gemini-2.5-pro',
				name: 'Gemini 2.5 Pro',
				provider: 'gemini',
				contextLength: 1048576,
				inputCost: 1.25,
				outputCost: 10.0,
				capabilities: { text: true, vision: true, functionCalling: true, codeExecution: true }
			},
			{
				id: 'gemini-1.5-pro',
				name: 'Gemini 1.5 Pro',
				provider: 'gemini',
				contextLength: 2000000,
				inputCost: 1.25,
				outputCost: 5.0,
				capabilities: { text: true, vision: true, functionCalling: true, codeExecution: true }
			},
			{
				id: 'gemini-1.5-flash',
				name: 'Gemini 1.5 Flash',
				provider: 'gemini',
				contextLength: 1000000,
				inputCost: 0.075,
				outputCost: 0.3,
				capabilities: { text: true, vision: true, functionCalling: true }
			},
			{
				id: 'gemini-1.5-flash-8b',
				name: 'Gemini 1.5 Flash 8B',
				provider: 'gemini',
				contextLength: 1000000,
				inputCost: 0.0375,
				outputCost: 0.15,
				capabilities: { text: true, functionCalling: true }
			}
		],
		supportedFeatures: {
			streaming: true,
			functionCalling: true,
			systemPrompts: true,
			maxTokens: 2000000
		}
	},
	groq: {
		name: 'groq',
		displayName: 'Groq',
		models: [
			{
				id: 'llama-3.3-70b-versatile',
				name: 'Llama 3.3 70B',
				provider: 'groq',
				contextLength: 131072,
				capabilities: { text: true, functionCalling: true }
			},
			{
				id: 'llama-3.1-405b-reasoning',
				name: 'Llama 3.1 405B',
				provider: 'groq',
				contextLength: 131072,
				capabilities: { text: true, functionCalling: true }
			},
			{
				id: 'llama-3.1-70b-versatile',
				name: 'Llama 3.1 70B',
				provider: 'groq',
				contextLength: 131072,
				capabilities: { text: true, functionCalling: true }
			},
			{
				id: 'llama-3.1-8b-instant',
				name: 'Llama 3.1 8B',
				provider: 'groq',
				contextLength: 131072,
				capabilities: { text: true, functionCalling: true }
			},
			{
				id: 'llama-3.2-90b-vision-preview',
				name: 'Llama 3.2 90B Vision',
				provider: 'groq',
				contextLength: 131072,
				capabilities: { text: true, vision: true, functionCalling: true }
			},
			{
				id: 'llama-3.2-11b-vision-preview',
				name: 'Llama 3.2 11B Vision',
				provider: 'groq',
				contextLength: 131072,
				capabilities: { text: true, vision: true, functionCalling: true }
			},
			{
				id: 'mixtral-8x7b-32768',
				name: 'Mixtral 8x7B',
				provider: 'groq',
				contextLength: 32768,
				capabilities: { text: true, functionCalling: true }
			},
			{
				id: 'gemma2-9b-it',
				name: 'Gemma 2 9B',
				provider: 'groq',
				contextLength: 8192,
				capabilities: { text: true }
			}
		],
		supportedFeatures: {
			streaming: true,
			functionCalling: true,
			systemPrompts: true,
			maxTokens: 131072
		}
	},
	openrouter: {
		name: 'openrouter',
		displayName: 'OpenRouter',
		models: [
			// Latest flagship models
			{
				id: 'google/gemini-2.5-pro',
				name: 'Gemini 2.5 Pro',
				provider: 'openrouter',
				contextLength: 1048576,
				inputCost: 1.25,
				outputCost: 10.0,
				capabilities: { text: true, vision: true, functionCalling: true }
			},
			{
				id: 'openai/o1',
				name: 'OpenAI o1',
				provider: 'openrouter',
				contextLength: 200000,
				inputCost: 15.0,
				outputCost: 60.0,
				capabilities: { text: true, functionCalling: false }
			},
			{
				id: 'openai/gpt-4o',
				name: 'GPT-4o',
				provider: 'openrouter',
				contextLength: 128000,
				inputCost: 2.5,
				outputCost: 10.0,
				capabilities: { text: true, vision: true, functionCalling: true }
			},
			{
				id: 'anthropic/claude-3.5-sonnet',
				name: 'Claude 3.5 Sonnet',
				provider: 'openrouter',
				contextLength: 200000,
				inputCost: 3.0,
				outputCost: 15.0,
				capabilities: { text: true, vision: true, functionCalling: true }
			},
			// Latest Qwen models
			{
				id: 'qwen/qwen3-235b-a22b',
				name: 'Qwen3 235B A22B',
				provider: 'openrouter',
				contextLength: 40960,
				inputCost: 0.13,
				outputCost: 0.6,
				capabilities: { text: true, functionCalling: true }
			},
			{
				id: 'qwen/qwen3-235b-a22b:free',
				name: 'Qwen3 235B A22B (Free)',
				provider: 'openrouter',
				contextLength: 131072,
				inputCost: 0,
				outputCost: 0,
				capabilities: { text: true, functionCalling: true }
			},
			{
				id: 'qwen/qwen-vl-max',
				name: 'Qwen VL Max',
				provider: 'openrouter',
				contextLength: 7500,
				inputCost: 0.8,
				outputCost: 3.2,
				capabilities: { text: true, vision: true }
			},
			// Free models
			{
				id: 'meta-llama/llama-3.2-3b-instruct:free',
				name: 'Llama 3.2 3B (Free)',
				provider: 'openrouter',
				contextLength: 131072,
				inputCost: 0,
				outputCost: 0,
				capabilities: { text: true }
			},
			{
				id: 'meta-llama/llama-3.1-8b-instruct:free',
				name: 'Llama 3.1 8B (Free)',
				provider: 'openrouter',
				contextLength: 131072,
				inputCost: 0,
				outputCost: 0,
				capabilities: { text: true }
			},
			{
				id: 'microsoft/phi-3-medium-128k-instruct:free',
				name: 'Phi-3 Medium (Free)',
				provider: 'openrouter',
				contextLength: 128000,
				inputCost: 0,
				outputCost: 0,
				capabilities: { text: true }
			},
			// Research-focused models
			{
				id: 'perplexity/sonar-deep-research',
				name: 'Perplexity Sonar Deep Research',
				provider: 'openrouter',
				contextLength: 128000,
				inputCost: 2.0,
				outputCost: 8.0,
				capabilities: { text: true, functionCalling: true }
			}
		],
		supportedFeatures: {
			streaming: true,
			functionCalling: true,
			systemPrompts: true,
			maxTokens: 1048576
		}
	}
};

export const getAllModels = (): LLMModel[] => {
	return Object.values(LLM_PROVIDERS).flatMap((provider) => provider.models);
};

export const getModelsByProvider = (providerName: string): LLMModel[] => {
	return LLM_PROVIDERS[providerName]?.models || [];
};

export const getModelById = (modelId: string): LLMModel | undefined => {
	return getAllModels().find((model) => model.id === modelId);
};

export interface LLMMetrics {
	totalRequests: number;
	totalTokens: number;
	averageLatency: number;
	errorRate: number;
	cacheHitRate: number;
	costPerRequest?: number;
	providerDistribution: Record<string, number>;
	modelDistribution: Record<string, number>;
}

// Event types for LLM service
export interface LLMServiceEvents {
	'request-start': {
		requestId: string;
		model: string;
		provider: string;
		timestamp: Date;
	};
	'request-complete': {
		requestId: string;
		response: LLMResponse;
		timestamp: Date;
	};
	'request-error': {
		requestId: string;
		error: LLMError;
		timestamp: Date;
	};
	'stream-chunk': {
		requestId: string;
		chunk: StreamChunk;
		timestamp: Date;
	};
}
