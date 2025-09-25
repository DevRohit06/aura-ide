import { DatabaseService } from '$lib/services/database.service.js';
import {
	LangGraphWorkflowService,
	type GraphState
} from '$lib/services/langgraph-workflow.service.js';
import { LLMService } from '$lib/services/llm/llm.service.js';
import { toolManager } from '$lib/services/tool-manager.service.js';
import { webSocketService } from '$lib/services/websocket.service.js';
import type { ChatMessage } from '$lib/types/chat.js';
import type { ToolCallResult } from '$lib/types/tools.js';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Enhanced type definitions for better type safety
interface WorkflowMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

interface ToolCall {
	id: string;
	function: {
		name: string;
		arguments: string;
	};
}

interface ToolResult {
	tool_call_id: string;
	content: string;
}

interface ChatCompletionRequest {
	threadId: string;
	content: string;
	model?: string;
	fileContext?: {
		fileName?: string;
		filePath?: string;
		language?: string;
	};
	contextVariables?: {
		selectedCode?: string;
		framework?: string;
	};
	enableTools?: boolean;
	projectId?: string;
}

interface ExecutionContext {
	projectId: string;
	userId: string;
	sessionId: string;
}

/**
 * Enhanced workflow-based chat completion service
 */
class WorkflowChatCompletionService {
	private workflowService: LangGraphWorkflowService;
	private llmService: LLMService;

	constructor() {
		this.workflowService = new LangGraphWorkflowService();
		this.llmService = new LLMService();
	}

	/**
	 * Process chat completion using workflow agent
	 */
	async processChatCompletion(
		requestData: ChatCompletionRequest,
		userId: string,
		threadId: string,
		projectId?: string
	) {
		try {
			// Get available tools
			const availableTools = toolManager.getTools();

			// Combine all tools
			const allTools = [...availableTools];

			// Build enhanced context
			const context: ExecutionContext = {
				projectId: projectId || 'default',
				userId,
				sessionId: threadId
			};

			// Get recent messages for context
			const recentMessages = await DatabaseService.findChatMessagesByThreadId(threadId, 10, 0);
			const conversationHistory = recentMessages.map((msg) => ({
				role: msg.role as 'system' | 'user' | 'assistant',
				content: msg.content
			}));

			// Build enhanced user message with context
			const enhancedContent = this.buildEnhancedContent(
				requestData.content,
				requestData.fileContext,
				requestData.contextVariables
			);

			// Add the new user message
			const messages: WorkflowMessage[] = [
				...conversationHistory,
				{
					role: 'user',
					content: enhancedContent
				}
			];

			// Create workflow input
			const workflowInput: GraphState = LangGraphWorkflowService.createWorkflowInput(
				messages.map((msg) => ({
					role: msg.role,
					content: msg.content
				})),
				context,
				allTools
			);

			// Execute workflow
			const workflowResult = await this.workflowService.executeWorkflow(workflowInput);

			// Process workflow result
			return this.processWorkflowResult(workflowResult, context, requestData);
		} catch (error) {
			console.error('Workflow chat completion error:', error);
			throw error;
		}
	}

	/**
	 * Build enhanced content with context
	 */
	private buildEnhancedContent(
		content: string,
		fileContext?: ChatCompletionRequest['fileContext'],
		contextVariables?: ChatCompletionRequest['contextVariables']
	): string {
		if (!fileContext || !contextVariables) {
			return content;
		}

		const fileInfo: string[] = [];
		if (fileContext.fileName) fileInfo.push(`File: ${fileContext.fileName}`);
		if (fileContext.filePath) fileInfo.push(`Path: ${fileContext.filePath}`);
		if (fileContext.language) fileInfo.push(`Language: ${fileContext.language}`);

		let contextInfo = '';

		if (fileInfo.length > 0) {
			contextInfo += `\n\n**Current File Context:**\n${fileInfo.join('\n')}`;
		}

		if (contextVariables.selectedCode) {
			const language = fileContext.language || 'text';
			contextInfo += `\n\n**Current File Content:**\n\`\`\`${language}\n${contextVariables.selectedCode}\n\`\`\``;
		}

		if (contextVariables.framework) {
			contextInfo += `\n\n**Project Framework:** ${contextVariables.framework}`;
		}

		return content + contextInfo;
	}

	/**
	 * Process workflow result and format response
	 */
	private async processWorkflowResult(
		workflowResult: GraphState,
		context: ExecutionContext,
		requestData: ChatCompletionRequest
	) {
		const { finalResponse, toolResults } = workflowResult;

		// Store the conversation in database
		await this.storeConversation(workflowResult, context);

		// Send WebSocket notifications for tool results
		if (toolResults && toolResults.length > 0) {
			await this.sendToolNotifications(toolResults, context);
		}

		const startTime = Date.now(); // Define startTime here

		return {
			content: finalResponse || 'No response generated',
			usage: {
				prompt_tokens: 0, // Would need to calculate actual usage
				completion_tokens: 0,
				total_tokens: 0
			},
			toolsUsed: (toolResults && toolResults.length > 0) || false,
			toolResults: toolResults || [],
			workflowSteps: workflowResult.currentStep,
			metadata: {
				model: workflowResult.analysis || 'unknown',
				provider: 'workflow-agent',
				tokens: 0, // Would need to calculate actual usage
				latency: Date.now() - startTime,
				temperature: 0.7,
				contextFiles: requestData.fileContext ? [requestData.fileContext.filePath || ''] : [],
				systemPromptId: 'workflow-agent'
			}
		};
	}

	/**
	 * Store conversation in database
	 */
	private async storeConversation(workflowResult: GraphState, context: ExecutionContext) {
		try {
			const now = new Date();

			// Store user message (get the last user message from the conversation)
			const userMessage = workflowResult.messages
				.filter((msg) => typeof msg === 'object' && 'role' in msg && msg.role === 'user')
				.pop() as { role: string; content: string } | undefined;

			if (userMessage) {
				const chatMessage: ChatMessage = {
					id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
					threadId: context.sessionId,
					projectId: context.projectId,
					userId: context.userId,
					content: userMessage.content,
					contentMarkdown: userMessage.content, // For now, just use content as markdown
					role: 'user',
					timestamp: now,
					createdAt: now,
					updatedAt: now
				};
				await DatabaseService.createChatMessage(chatMessage);
			}

			// Store assistant response
			if (workflowResult.finalResponse) {
				const chatMessage: ChatMessage = {
					id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
					threadId: context.sessionId,
					projectId: context.projectId,
					userId: context.userId,
					content: workflowResult.finalResponse,
					contentMarkdown: workflowResult.finalResponse, // For now, just use content as markdown
					role: 'assistant',
					timestamp: now,
					createdAt: now,
					updatedAt: now
				};
				await DatabaseService.createChatMessage(chatMessage);
			}
		} catch (error) {
			console.error('Failed to store conversation:', error);
		}
	}

	/**
	 * Send WebSocket notifications for tool results
	 */
	private async sendToolNotifications(toolResults: ToolCallResult[], context: ExecutionContext) {
		for (const result of toolResults) {
			try {
				if (result.success && result.message.includes('file')) {
					await webSocketService.send({
						type: 'file_created',
						data: {
							sandboxId: context.projectId,
							path: result.message,
							content: result.data,
							isDirectory: false
						}
					});
				}
			} catch (error) {
				console.warn('Failed to send tool notification:', error);
			}
		}
	}
}

// Create singleton instance
const workflowChatService = new WorkflowChatCompletionService();

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Validate authentication
		if (!locals.session?.user?.id) {
			throw error(401, 'Unauthorized');
		}

		// Parse and validate request data
		const requestData = await request.json();

		if (!requestData || typeof requestData !== 'object') {
			throw error(400, 'Invalid request data');
		}

		const {
			threadId,
			content,
			model = 'gemini-1.5-flash',
			fileContext,
			contextVariables,
			enableTools = true,
			projectId
		} = requestData as ChatCompletionRequest;

		if (!threadId || typeof threadId !== 'string') {
			throw error(400, 'Missing or invalid threadId');
		}

		if (!content || typeof content !== 'string') {
			throw error(400, 'Missing or invalid content');
		}

		// Verify user has access to this thread
		const thread = await DatabaseService.findChatThreadById(threadId);
		if (!thread || thread.userId !== locals.session.user.id) {
			throw error(403, 'Access denied');
		}

		// Process chat completion using workflow agent
		const result = await workflowChatService.processChatCompletion(
			{
				threadId,
				content,
				model,
				fileContext,
				contextVariables,
				enableTools,
				projectId
			},
			locals.session.user.id,
			threadId,
			projectId
		);

		return json(result);
	} catch (err) {
		console.error('Chat completion error:', err);

		// Re-throw SvelteKit errors
		if (err instanceof Response) {
			throw err;
		}

		// Handle other errors
		const errorMessage = err instanceof Error ? err.message : 'Failed to process chat completion';
		throw error(500, errorMessage);
	}
};
