import { browser } from '$app/environment';
import modelCatalog from '$lib/data/models.json';
import { writable } from 'svelte/store';

// Only allow these providers in the UI and persisted selection for now
const ALLOWED_PROVIDERS = new Set(['openrouter', 'anthropic', 'openai', 'groq']);

// Default model: prefer the first entry from the bundled static catalog
let defaultModel = 'gpt-4o';
try {
	const catalogModels = (modelCatalog as any)?.data?.models;
	if (Array.isArray(catalogModels) && catalogModels.length > 0) {
		// Prefer an endpoint-level providerModelId from an allowed provider
		let found: string | null = null;
		for (const entry of catalogModels) {
			if (!entry.endpoints) continue;
			for (const ep of entry.endpoints) {
				const providerKey = ep.providerSlug || ep.provider || ep.endpoint?.provider || '';
				if (!ALLOWED_PROVIDERS.has(providerKey)) continue;
				const pmid =
					ep.endpoint?.modelConfig?.providerModelId || ep.endpoint?.providerModelId || null;
				if (pmid) {
					found = pmid;
					break;
				}
			}
			if (found) break;
		}

		if (found) defaultModel = found;
		else defaultModel = catalogModels[0].id || defaultModel;
	}
} catch (e) {
	console.warn('Failed to read static model catalog for default model:', e);
}

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
		// Accept either a providerModelId or a top-level catalog id. Resolve to
		// an endpoint-level providerModelId for allowed providers and persist
		// that value so the UI and server are consistent.
		const catalog = (modelCatalog as any)?.data?.models || [];

		// Helper: find a providerModelId by searching endpoints and top-level ids
		function resolveToProviderModelId(id: string): string | null {
			// Direct match against endpoint providerModelIds
			for (const m of catalog) {
				for (const ep of m.endpoints || []) {
					const providerKey = ep.providerSlug || ep.provider || ep.endpoint?.provider || '';
					if (!ALLOWED_PROVIDERS.has(providerKey)) continue;
					const pmid = ep.endpoint?.modelConfig?.providerModelId || ep.endpoint?.providerModelId;
					if (!pmid) continue;
					if (pmid === id) return pmid;
				}
			}

			// Fallback: if the provided id is a top-level catalog id, pick the
			// first allowed endpoint's providerModelId for that model.
			const foundEntry = catalog.find((m: any) => m.id === id || m.name === id);
			if (foundEntry) {
				for (const ep of foundEntry.endpoints || []) {
					const providerKey = ep.providerSlug || ep.provider || ep.endpoint?.provider || '';
					if (!ALLOWED_PROVIDERS.has(providerKey)) continue;
					const pmid = ep.endpoint?.modelConfig?.providerModelId || ep.endpoint?.providerModelId;
					if (pmid) return pmid;
				}
			}

			return null;
		}

		const resolved = resolveToProviderModelId(modelId);
		if (!resolved) {
			console.warn(`Attempted to select unknown or unsupported model ${modelId}, ignoring`);
			return;
		}

		selectedModelStore.set(resolved);

		// Save to localStorage only in browser
		if (browser) {
			try {
				localStorage.setItem('aura-selected-model', resolved);
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
					// Validate and resolve saved value to a providerModelId when
					// possible. This handles older saved top-level ids gracefully.
					const catalog = (modelCatalog as any)?.data?.models || [];
					function resolveSavedToProviderModelId(saved: string): string | null {
						for (const m of catalog) {
							for (const ep of m.endpoints || []) {
								const providerKey = ep.providerSlug || ep.provider || ep.endpoint?.provider || '';
								if (!ALLOWED_PROVIDERS.has(providerKey)) continue;
								const pmid =
									ep.endpoint?.modelConfig?.providerModelId || ep.endpoint?.providerModelId;
								if (!pmid) continue;
								if (pmid === saved) return pmid;
							}
							if (m.id === saved || m.name === saved) {
								// return first allowed endpoint for this model
								for (const ep of m.endpoints || []) {
									const providerKey = ep.providerSlug || ep.provider || ep.endpoint?.provider || '';
									if (!ALLOWED_PROVIDERS.has(providerKey)) continue;
									const pmid =
										ep.endpoint?.modelConfig?.providerModelId || ep.endpoint?.providerModelId;
									if (pmid) return pmid;
								}
							}
						}
						return null;
					}

					const resolved = resolveSavedToProviderModelId(savedModel as string);
					if (resolved) {
						selectedModelStore.set(resolved);
						return resolved;
					}
				}
			} catch (e) {
				console.warn('Failed to load persisted model from localStorage:', e);
			}
		}
		return defaultModel;
	}
};
