import { env } from '$env/dynamic/private';
import { HeliconeConfigManager } from '$lib/config/helicone.config';
import modelsData from '$lib/data/models.json';
import { ChatAnthropic } from '@langchain/anthropic';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatGroq } from '@langchain/groq';
import { ChatOpenAI } from '@langchain/openai';
import { logger } from 'better-auth';

export interface ModelConfig {
	provider: 'openai' | 'anthropic' | 'groq' | 'openrouter';
	model: string;
	temperature?: number;
	maxTokens?: number;
}

// Selected providers we will expose in the UI / API
const SUPPORTED_PROVIDERS = new Set(['openai', 'anthropic', 'groq', 'openrouter']);

// Build a small preset map from models.json for supported providers
export const MODEL_PRESETS: Record<string, { provider: string; model: string; cost?: number }> = {};
(function buildPresets() {
	try {
		const all = (modelsData as any).data?.models || [];
		for (const m of all) {
			// If any of the endpoints belong to our supported providers, expose a preset keyed by id
			const endpoints = m.endpoints || [];
			const providerEndpoint = endpoints.find((e: any) => SUPPORTED_PROVIDERS.has(e?.provider));
			if (providerEndpoint) {
				const desc = m.description || '';
				const match = desc.match(/API model name: ([^\s]+)/);
				let apiModelName = match ? match[1] : m.id; // fallback to id if no match

				// For Groq and other providers, use the providerModelId from the endpoint config
				const providerModelId =
					providerEndpoint.endpoint?.modelConfig?.providerModelId ||
					providerEndpoint.providerModelId;

				// if (providerEndpoint.provider === 'groq' && providerModelId) {
				// Groq model names can be long and complex, so use the providerModelId directly
				apiModelName = providerModelId;
				// }

				MODEL_PRESETS[m.id] = {
					provider: providerEndpoint.provider || m.author || 'openai',
					model: apiModelName,
					cost: (providerEndpoint.pricing && providerEndpoint.pricing.prompt) || undefined
				};
			}
		}
	} catch (err) {
		// noop - if parsing fails, MODEL_PRESETS stays empty and we provide a few sensible defaults below
	}

	// Fallback small set if no presets built
	if (Object.keys(MODEL_PRESETS).length === 0) {
		MODEL_PRESETS['gpt-4o'] = { provider: 'openai', model: 'gpt-4o', cost: 0.005 };
		MODEL_PRESETS['gpt-4o-mini'] = { provider: 'openai', model: 'gpt-4o-mini', cost: 0.00015 };
		MODEL_PRESETS['claude-opus-4-1'] = {
			provider: 'anthropic',
			model: 'claude-opus-4-1',
			cost: 0.015
		};
	}
})();

export class ModelManager {
	private models: Map<string, BaseChatModel> = new Map();
	private helicone = HeliconeConfigManager.getInstance().getConfig();
	private providerModelIdToId: Map<string, string> = new Map();
	private apiModelNameToId: Map<string, string> = new Map();

	constructor() {
		// Build reverse mapping from providerModelId to model id
		try {
			const all = (modelsData as any).data?.models || [];
			for (const m of all) {
				const endpoints = m.endpoints || [];
				for (const endpoint of endpoints) {
					// Map from endpoint's providerModelId
					if (endpoint?.endpoint?.modelConfig?.providerModelId) {
						this.providerModelIdToId.set(endpoint.endpoint.modelConfig.providerModelId, m.id);
					}
					// Also map from top-level providerModelId
					if (endpoint?.providerModelId) {
						this.providerModelIdToId.set(endpoint.providerModelId, m.id);
					}
				}
				// Also build mapping from API model name to id
				const desc = m.description || '';
				const match = desc.match(/API model name: ([^\s]+)/);
				if (match) {
					this.apiModelNameToId.set(match[1], m.id);
				}
			}
		} catch (err) {
			// noop - reverse mapping won't work but that's ok
		}
	}

	getModel(config: ModelConfig): BaseChatModel {
		const provider = config.provider || 'openai';
		const modelName = config.model;
		const cacheKey = `${provider}:${modelName}:${config.temperature ?? 0}`;
		if (this.models.has(cacheKey)) return this.models.get(cacheKey)!;
		logger.info('[ModelManager] Creating model for config:', config);
		const model = this.createModel(config);
		this.models.set(cacheKey, model);
		return model;
	}

	getModelPreset(presetName: string): ModelConfig | null {
		// First check if it's a direct model id
		let modelId = presetName;

		// If not found, check if it's a providerModelId or API model name that maps to a model id
		if (!MODEL_PRESETS[presetName]) {
			const mappedId =
				this.providerModelIdToId.get(presetName) || this.apiModelNameToId.get(presetName);
			if (mappedId) {
				modelId = mappedId;
			}
		}

		const p = MODEL_PRESETS[modelId];
		if (!p) return null;
		return { provider: p.provider as any, model: p.model };
	}

	listModels() {
		return Object.entries(MODEL_PRESETS).map(([name, cfg]) => ({ name, ...cfg }));
	}

	private createModel(config: ModelConfig): BaseChatModel {
		const provider = config.provider;
		const model = config.model;
		const temperature = config.temperature ?? 0.7;

		const heliconeBase = this.helicone.baseUrl || 'https://oai.helicone.ai/v1';
		const commonOptions: any = {
			temperature
		};

		const headers: Record<string, string> = {
			'Helicone-Auth': `Bearer ${this.helicone.apiKey}`,
			'Helicone-Property-Environment': process.env.NODE_ENV || 'development',
			'Helicone-Property-Provider': provider
		};

		switch (provider) {
			case 'openai':
				return new ChatOpenAI({
					model: model,
					openAIApiKey: env.OPENAI_API_KEY || undefined,
					configuration: {
						baseURL: heliconeBase,
						defaultHeaders: headers
					},
					...commonOptions
				});

			case 'anthropic':
				return new ChatAnthropic({
					model: model,
					anthropicApiKey: env.ANTHROPIC_API_KEY || undefined,
					clientOptions: {
						baseURL: 'https://anthropic.helicone.ai',
						defaultHeaders: headers
					},
					...commonOptions
				});

			case 'groq':
				return new ChatGroq({
					// Groq exposes an OpenAI-compatible API; route through Helicone gateway
					model: model,
					apiKey: env.GROQ_API_KEY || undefined,
					configuration: {
						baseURL: 'https://groq.helicone.ai/openai/v1',
						defaultHeaders: headers
					},
					...commonOptions
				});

			case 'openrouter':
				return new ChatOpenAI({
					// OpenRouter also supports OpenAI-like semantics
					model: model,
					apiKey: env.OPENROUTER_API_KEY || undefined,
					configuration: {
						baseURL: 'https://openrouter.helicone.ai/api/v1',
						defaultHeaders: {
							...headers,
							'HTTP-Referer': env.APP_ORIGIN || 'https://aura.local'
						}
					},
					...commonOptions
				});

			default:
				throw new Error(`Unsupported provider: ${provider}`);
		}
	}
}

export const modelManager = new ModelManager();
