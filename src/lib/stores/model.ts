import { browser } from '$app/environment';
import { LLM_PROVIDERS } from '@/types/llm.types';
import { writable } from 'svelte/store';

// Default to Claude 3.5 Sonnet if available, otherwise first available model
const defaultModel =
	LLM_PROVIDERS.anthropic?.models[0]?.id ||
	Object.values(LLM_PROVIDERS)[0]?.models[0]?.id ||
	'claude-3-5-sonnet-20241022';

// Initialize with default model, will be updated from localStorage if available
let initialModel = defaultModel;

// Only access localStorage in browser
if (browser) {
	try {
		const savedModel = localStorage.getItem('aura-selected-model');
		if (savedModel) {
			initialModel = savedModel;
		}
	} catch (e) {
		console.warn('Failed to load saved model from localStorage:', e);
	}
}

export const selectedModelStore = writable(initialModel);

export const modelActions = {
	setModel: (modelId: string) => {
		selectedModelStore.set(modelId);

		// Save to localStorage only in browser
		if (browser) {
			try {
				localStorage.setItem('aura-selected-model', modelId);
			} catch (e) {
				console.warn('Failed to save model to localStorage:', e);
			}
		}
	},

	loadPersistedModel: () => {
		if (browser) {
			try {
				const savedModel = localStorage.getItem('aura-selected-model');
				if (savedModel) {
					selectedModelStore.set(savedModel);
					return savedModel;
				}
			} catch (e) {
				console.warn('Failed to load saved model from localStorage:', e);
			}
		}
		return defaultModel;
	}
};
