/**
 * LLM Tool Agent Service
 * Integrates tool calling with LLM chat completions
 * Supports OpenAI, Anthropic, and other providers with function calling
 */

import { LLMService } from '$lib/services/llm/llm.service.js';
import { toolManager } from '$lib/services/tool-manager.service.js';
import type { LLMRequest, LLMResponse } from '$lib/types/llm.types.js';
import type { ToolCall, ToolCallResult } from '$lib/types/tools.js';

export interface LLMToolAgentConfig {
	model: string;
	provider: 'openai' | 'anthropic' | 'groq' | 'openrouter' | 'gemini';
	temperature?: number;
	maxTokens?: number;
	maxToolIterations?: number;
	systemPrompt?: string;
}

export interface ChatMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
	toolCalls?: Array<{
		id: string;
		type: 'function';
		function: {
			name: string;
			arguments: string;
		};
	}>;
	toolCallId?: string; // For tool result messages
}

export interface LLMToolAgentResponse {
	content: string;
	toolCalls: ToolCall[];
	messages: ChatMessage[];
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
}

export class LLMToolAgentService {
	private llmService: LLMService;
	private config: LLMToolAgentConfig;

	constructor(config: LLMToolAgentConfig) {
		this.config = {
			maxToolIterations: 5,
			temperature: 0.1,
			maxTokens: 4096,
			...config
		};

		this.llmService = new LLMService({
			defaultModel: this.config.model,
			defaultTemperature: this.config.temperature,
			maxTokens: this.config.maxTokens
		});
	}

	/**
	 * Process a chat message with tool calling capabilities
	 */
	async processMessage(
		messages: ChatMessage[],
		context: {
			projectId?: string;
			sandboxId?: string;
			userId: string;
		}
	): Promise<LLMToolAgentResponse> {
		const allMessages: ChatMessage[] = [...messages];
		const allToolCalls: ToolCall[] = [];
		let iterationCount = 0;
		let lastResponse: LLMResponse | undefined;

		// Add system prompt if provided
		if (this.config.systemPrompt) {
			allMessages.unshift({
				role: 'system',
				content: this.config.systemPrompt
			});
		}

		while (iterationCount < this.config.maxToolIterations!) {
			// Convert to LLM format and call
			const llmRequest = this.convertToLLMRequest(allMessages);
			const response = await this.llmService.invoke(llmRequest);
			lastResponse = response;

			// Parse response for tool calls
			const { content, toolCalls } = this.parseToolCalls(response);

			// Add assistant message
			const assistantMessage: ChatMessage = {
				role: 'assistant',
				content
			};

			if (toolCalls.length > 0) {
				assistantMessage.toolCalls = toolCalls.map((tc) => ({
					id: tc.id || `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
					type: 'function' as const,
					function: {
						name: tc.name,
						arguments: JSON.stringify(tc.parameters)
					}
				}));
			}

			allMessages.push(assistantMessage);

			// If no tool calls, we're done
			if (toolCalls.length === 0) {
				break;
			}

			// Execute tool calls
			const toolResults = await this.executeToolCalls(toolCalls, context);
			allToolCalls.push(...toolCalls);

			// Add tool result messages
			for (let i = 0; i < toolResults.length; i++) {
				const result = toolResults[i];
				const toolCallId = assistantMessage.toolCalls?.[i]?.id || `result_${i}`;

				allMessages.push({
					role: 'user',
					content: `Tool "${toolCalls[i].name}" result: ${result.success ? result.data : `Error: ${result.error}`}`,
					toolCallId
				});
			}

			iterationCount++;
		}

		// Get final assistant message
		const finalMessage = allMessages.filter((m) => m.role === 'assistant').pop();

		return {
			content: finalMessage?.content || 'No response generated',
			toolCalls: allToolCalls,
			messages: allMessages,
			usage: lastResponse?.usage
		};
	}

	/**
	 * Convert chat messages to LLM request format
	 */
	private convertToLLMRequest(messages: ChatMessage[]): LLMRequest {
		return {
			messages: messages.map((msg) => ({
				role: msg.role,
				content: msg.content
			})),
			model: this.config.model,
			temperature: this.config.temperature,
			maxTokens: this.config.maxTokens
		};
	}

	/**
	 * Parse LLM response for tool calls
	 */
	private parseToolCalls(response: LLMResponse): { content: string; toolCalls: ToolCall[] } {
		const content = response.content;
		const toolCalls: ToolCall[] = [];

		// Try to extract tool calls from response
		// This is provider-specific and may need adjustment
		try {
			// Look for function calls in the response
			const functionCallRegex =
				/\{\s*"name":\s*"([^"]+)",\s*"arguments":\s*({[^}]+}|\[[^\]]+\]|"[^"]*")\s*\}/g;
			let match;

			while ((match = functionCallRegex.exec(content)) !== null) {
				try {
					const name = match[1];
					const args = JSON.parse(match[2]);

					toolCalls.push({
						id: `extracted_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
						name,
						parameters: args,
						timestamp: new Date(),
						status: 'pending'
					});
				} catch (parseError) {
					console.warn('Failed to parse tool call arguments:', parseError);
				}
			}
		} catch (error) {
			console.warn('Failed to parse tool calls from response:', error);
		}

		return { content, toolCalls };
	}

	/**
	 * Execute tool calls and update UI state
	 */
	private async executeToolCalls(
		toolCalls: ToolCall[],
		context: {
			projectId?: string;
			sandboxId?: string;
			userId: string;
		}
	): Promise<ToolCallResult[]> {
		const results: ToolCallResult[] = [];

		for (const toolCall of toolCalls) {
			try {
				const result = await toolManager.executeToolCall(toolCall, context);
				results.push(result);
			} catch (error) {
				const errorResult: ToolCallResult = {
					success: false,
					message: 'Tool execution failed',
					error: error instanceof Error ? error.message : 'Unknown error',
					data: null
				};
				results.push(errorResult);
			}
		}

		return results;
	}

	/**
	 * Get available tools formatted for the current model
	 */
	private getToolsForModel(): any[] {
		const tools = toolManager.getToolDefinitionsForModel();

		// Format for OpenAI/compatible APIs
		return tools.map((tool) => ({
			type: 'function',
			function: {
				name: tool.function.name,
				description: tool.function.description,
				parameters: {
					type: 'object',
					properties: tool.function.parameters?.properties || {},
					required: tool.function.parameters?.required || []
				}
			}
		}));
	}

	/**
	 * Create a system prompt that includes tool usage instructions
	 */
	static createToolSystemPrompt(basePrompt?: string): string {
		const toolInstructions = `
You are an AI assistant with access to file editing tools. You can:

1. **read_file** - Read file contents from R2 storage
2. **write_file** - Create or update files in R2 storage  
3. **delete_file** - Remove files from R2 storage
4. **list_files** - List files in a directory

When editing files:
- Always read the file first to understand its current state
- Make precise, targeted changes
- Explain what you're doing and why
- Handle errors gracefully

Use tools when the user asks you to:
- View, edit, create, or delete files
- Make code changes
- Update project files
- Manage file structure

Call tools with proper JSON parameters. Wait for tool results before proceeding.
`;

		return basePrompt ? `${basePrompt}\n\n${toolInstructions}` : toolInstructions;
	}

	/**
	 * Create a pre-configured agent for code assistance
	 */
	static createCodeAssistant(userId: string, model = 'gpt-4'): LLMToolAgentService {
		return new LLMToolAgentService({
			model,
			provider: model.includes('claude') ? 'anthropic' : 'openai',
			temperature: 0.1,
			maxTokens: 4096,
			maxToolIterations: 3,
			systemPrompt: this.createToolSystemPrompt(`
You are an expert software engineer and coding assistant. You help users with:

- Code review and optimization
- Bug fixing and debugging  
- Feature implementation
- Code refactoring
- Best practices and architecture advice

Always write clean, maintainable, well-documented code following modern best practices.
			`)
		});
	}

	/**
	 * Create a pre-configured agent for file management
	 */
	static createFileManager(userId: string, model = 'gpt-4'): LLMToolAgentService {
		return new LLMToolAgentService({
			model,
			provider: model.includes('claude') ? 'anthropic' : 'openai',
			temperature: 0.1,
			maxTokens: 2048,
			maxToolIterations: 5,
			systemPrompt: this.createToolSystemPrompt(`
You are a file management assistant. You help users organize, edit, and manage their project files.

Be efficient and precise when working with files. Always confirm operations before executing destructive actions.
			`)
		});
	}
}

// Export convenience functions
export const llmToolAgent = {
	/**
	 * Quick chat with tool calling
	 */
	async chat(
		message: string,
		context: {
			projectId?: string;
			sandboxId?: string;
			userId: string;
		},
		config?: Partial<LLMToolAgentConfig>
	): Promise<LLMToolAgentResponse> {
		const agent = new LLMToolAgentService({
			model: 'gpt-4',
			provider: 'openai',
			...config
		});

		return agent.processMessage([{ role: 'user', content: message }], context);
	},

	/**
	 * Continue a conversation with tool calling
	 */
	async continue(
		messages: ChatMessage[],
		context: {
			projectId?: string;
			sandboxId?: string;
			userId: string;
		},
		config?: Partial<LLMToolAgentConfig>
	): Promise<LLMToolAgentResponse> {
		const agent = new LLMToolAgentService({
			model: 'gpt-4',
			provider: 'openai',
			...config
		});

		return agent.processMessage(messages, context);
	}
};
