/**
 * AI Chat Integration with File Tools
 * Allows AI to edit files during chat conversations
 */

import { toolManager } from '$lib/services/tool-manager.service.js';

/**
 * Get tools formatted for OpenAI/Anthropic chat completions
 */
export function getToolsForChatCompletion(): any[] {
	const tools = toolManager.getToolDefinitionsForModel();

	// Format for OpenAI function calling
	return tools.map((tool) => ({
		type: 'function',
		function: {
			name: tool.function.name,
			description: tool.function.description,
			parameters: tool.function.parameters
		}
	}));
}

/**
 * Execute tool calls from AI chat response
 */
export async function executeToolCallsFromChat(
	toolCalls: Array<{
		id?: string;
		function: {
			name: string;
			arguments: string;
		};
	}>,
	context: {
		projectId?: string;
		sandboxId?: string;
		userId: string;
	}
): Promise<Array<{ tool_call_id: string; content: string }>> {
	const results = [];

	for (const toolCall of toolCalls) {
		try {
			// Parse arguments
			const args = JSON.parse(toolCall.function.arguments);

			// Execute tool
			const result = await toolManager.executeToolCall(
				{
					name: toolCall.function.name,
					parameters: args
				},
				context
			);

			results.push({
				tool_call_id: toolCall.id || 'unknown',
				content: result.success ? JSON.stringify(result.data) : `Error: ${result.error}`
			});
		} catch (error) {
			results.push({
				tool_call_id: toolCall.id || 'unknown',
				content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
			});
		}
	}

	return results;
}

/**
 * System prompt that instructs AI on tool usage
 */
export const toolSystemPrompt = `You are an AI assistant with access to file editing tools. You can:

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

Call tools with proper JSON parameters. Wait for tool results before proceeding.`;

/**
 * Helper to create a system message with tool instructions
 */
export function createToolSystemMessage(additionalPrompt?: string): string {
	return additionalPrompt ? `${additionalPrompt}\n\n${toolSystemPrompt}` : toolSystemPrompt;
}

/**
 * Create a system prompt that includes available tools
 */
export function createSystemPromptWithTools(basePrompt: string = ''): string {
	const tools = toolManager.getTools();

	const toolDescriptions = tools
		.map((tool) => {
			const requiredParams = tool.parameters.required || [];
			const params = Object.entries(tool.parameters.properties || {})
				.map(([name, def]: [string, any]) => {
					const required = requiredParams.includes(name) ? ' (required)' : ' (optional)';
					return `  - ${name}: ${def.type}${required} - ${def.description}`;
				})
				.join('\n');

			return `## ${tool.name}
${tool.description}

Parameters:
${params}`;
		})
		.join('\n\n');

	return `${basePrompt}

## Available Tools

You have access to the following tools for editing files in the project:

${toolDescriptions}

## Tool Usage Guidelines

1. **File Paths**: Always use relative paths from the project root (e.g., "src/components/MyComponent.tsx")
2. **Content**: Provide complete file content when creating or updating files
3. **Reasoning**: Include a brief reason for each file operation to help with debugging
4. **Error Handling**: If a tool call fails, acknowledge it and try an alternative approach
5. **Context**: Use the provided projectId for all file operations

When you need to edit files, use the appropriate tool and explain what you're doing to the user.`;
}

/**
 * Format tool call results for display in chat
 */
export function formatToolCallForChat(toolName: string, parameters: any, result: any): string {
	const operation = parameters.operation || 'execute';
	const filePath = parameters.filePath || parameters.path || 'unknown';

	if (result.success) {
		switch (toolName) {
			case 'edit_file':
				return `✅ Successfully ${operation}d file: \`${filePath}\``;
			case 'read_file':
				return `📖 Read file: \`${filePath}\`${result.data?.content ? `\n\`\`\`\n${result.data.content.substring(0, 200)}${result.data.content.length > 200 ? '...' : ''}\n\`\`\`` : ''}`;
			case 'list_files':
				const files = result.data?.files || [];
				return `📁 Listed ${files.length} items in: \`${filePath || 'root'}\``;
			default:
				return `✅ ${toolName} completed successfully`;
		}
	} else {
		return `❌ Failed to ${operation} file \`${filePath}\`: ${result.error || result.message}`;
	}
}

/**
 * Simplified interface for chat integrations
 */
export const chatToolIntegration = {
	/**
	 * Get tools for AI model
	 */
	getTools: getToolsForChatCompletion,

	/**
	 * Execute tools from AI response
	 */
	executeTools: executeToolCallsFromChat,

	/**
	 * Create system prompt
	 */
	getSystemPrompt: createSystemPromptWithTools,

	/**
	 * Format results for chat
	 */
	formatResult: formatToolCallForChat
};
