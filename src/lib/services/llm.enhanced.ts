// Enhanced LLM service with system prompts - Main integration
export { SystemPromptConfig, systemPromptConfig } from '../config/system-prompts.config.js';
export { PromptTemplateManager, promptTemplateManager } from '../utils/prompt-template.manager.js';
export { LLMService } from './llm/llm.service.js';

// Re-export types
export type {
	ContextVariables,
	LLMRequest,
	LLMResponse,
	LLMServiceConfig,
	Message,
	StreamChunk,
	SystemPromptContext,
	SystemPromptOptions,
	SystemPromptTemplate
} from '../types/llm.types.js';

/**
 * Factory function to create a configured LLM service
 */
export function createLLMService(
	config?: Partial<import('../types/llm.types.js').LLMServiceConfig>
) {
	return new (await import('./llm/llm.service.js')).LLMService(config);
}

/**
 * Create a pre-configured LLM service for code assistance
 */
export async function createCodeAssistantService() {
	const { LLMService } = await import('./llm/llm.service.js');
	return new LLMService({
		enableSystemPrompts: true,
		defaultSystemPromptContext: 'code-assistant',
		defaultModel: 'gpt-4',
		defaultTemperature: 0.1
	});
}

/**
 * Create a pre-configured LLM service for general chat
 */
export async function createChatService() {
	const { LLMService } = await import('./llm/llm.service.js');
	return new LLMService({
		enableSystemPrompts: true,
		defaultSystemPromptContext: 'general-chat',
		defaultModel: 'gpt-4',
		defaultTemperature: 0.3
	});
}

/**
 * Utility function to create a quick code assistance request
 */
export async function createQuickCodeRequest(
	userMessage: string,
	context: {
		projectName?: string;
		fileName?: string;
		language?: string;
		selectedCode?: string;
	} = {}
) {
	const service = await createCodeAssistantService();
	return service.createCodeAssistantRequest(userMessage, context);
}

/**
 * Utility function to create a debugging request
 */
export async function createQuickDebugRequest(
	errorMessage: string,
	context: {
		fileName?: string;
		language?: string;
		stackTrace?: string;
	} = {}
) {
	const service = await createCodeAssistantService();
	return service.createDebuggingRequest(errorMessage, context);
}
