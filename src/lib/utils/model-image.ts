/**
 * Get model image URL from interacly.com
 * Maps model names to their corresponding avatar images
 */

const MODEL_IMAGE_BASE_URL = 'https://interacly.com/images/ai-models';

/**
 * Model name to image filename mapping
 */
const MODEL_IMAGE_MAP: Record<string, string> = {
	// OpenAI models
	'gpt-4': 'openai.webp',
	'gpt-4o': 'openai.webp',
	'gpt-4o-mini': 'openai.webp',
	'gpt-3.5-turbo': 'openai.webp',
	o1: 'openai.webp',
	'o1-mini': 'openai.webp',
	'o3-mini': 'openai.webp',

	// Anthropic models
	claude: 'claude.webp',
	'claude-3': 'claude.webp',
	'claude-3.5': 'claude.webp',
	'claude-opus': 'claude.webp',
	'claude-sonnet': 'claude.webp',
	'claude-haiku': 'claude.webp',

	// Google models
	gemini: 'gemini.webp',
	palm: 'google.webp',
	bard: 'google.webp',

	// Meta models
	llama: 'llama.webp',

	// Mistral models
	mistral: 'mistral.webp',
	mixtral: 'mistral.webp',

	// Cohere models
	command: 'cohere.webp',

	// Groq
	groq: 'groq.webp',

	// DeepSeek
	deepseek: 'deepseek.webp',

	// Perplexity
	perplexity: 'perplexity.webp',

	// Default fallback
	default: 'openai.webp'
};

/**
 * Get the image URL for a model based on its name
 * @param modelName - The full model name or ID (e.g., "gpt-4o-mini", "claude-opus-4")
 * @returns The full URL to the model's avatar image
 */
export function getModelImageUrl(modelName?: string | null): string {
	if (!modelName) {
		return `${MODEL_IMAGE_BASE_URL}/${MODEL_IMAGE_MAP.default}`;
	}

	// Normalize the model name to lowercase for matching
	const normalizedName = modelName.toLowerCase();

	// Check for direct matches or partial matches
	for (const [key, imageName] of Object.entries(MODEL_IMAGE_MAP)) {
		if (normalizedName.includes(key)) {
			return `${MODEL_IMAGE_BASE_URL}/${imageName}`;
		}
	}

	// Fallback to default image
	return `${MODEL_IMAGE_BASE_URL}/${MODEL_IMAGE_MAP.default}`;
}

/**
 * Get initials from model name for fallback display
 * @param modelName - The model name
 * @returns Two-letter initials (e.g., "GPT", "CL", "GM")
 */
export function getModelInitials(modelName?: string | null): string {
	if (!modelName) return 'AI';

	// Extract meaningful parts from model name
	const parts = modelName
		.replace(/[-_]/g, ' ')
		.split(' ')
		.filter((part) => part.length > 0);

	if (parts.length === 0) return 'AI';
	if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();

	// Take first letter of first two parts
	return (parts[0][0] + parts[1][0]).toUpperCase();
}
