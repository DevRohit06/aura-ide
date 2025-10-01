import modelsData from '$lib/data/models.json';

export interface ProviderDescriptor {
	displayName: string;
	description?: string;
}

// Build a lightweight lookup of provider slug -> displayName from the models.json filters.
const providersList: Array<{ name: string; displayName: string }> =
	(modelsData as any)?.data?.filters?.providers || [];

export const LLM_PROVIDERS: Record<string, ProviderDescriptor> = providersList.reduce(
	(acc, p) => {
		acc[p.name] = { displayName: p.displayName };
		return acc;
	},
	{} as Record<string, ProviderDescriptor>
);

// Add some sensible defaults if the catalog is missing any entries used in the UI
const FALLBACKS: Record<string, ProviderDescriptor> = {
	openai: { displayName: 'OpenAI' },
	anthropic: { displayName: 'Anthropic' },
	'google-ai-studio': { displayName: 'Google AI Studio' },
	groq: { displayName: 'Groq' },
	openrouter: { displayName: 'OpenRouter' },
	xai: { displayName: 'xAI' }
};

export function getProviderDescriptor(slug: string) {
	return LLM_PROVIDERS[slug] || FALLBACKS[slug] || { displayName: slug };
}

export default LLM_PROVIDERS;
