import { DatabaseService } from '$lib/services/database.service.js';
import { LLMService } from '$lib/services/llm/llm.service.js';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Check authentication
		if (!locals.session?.user?.id) {
			throw error(401, 'Unauthorized');
		}

		const {
			threadId,
			content,
			model = 'gpt-4',
			provider = 'openai',
			fileContext,
			contextVariables
		} = await request.json();

		if (!threadId || !content) {
			throw error(400, 'Missing threadId or content');
		}

		// Verify user has access to this thread
		const thread = await DatabaseService.findChatThreadById(threadId);
		if (!thread || thread.userId !== locals.session.user.id) {
			throw error(403, 'Access denied');
		}

		// Get recent messages from thread for context
		const recentMessages = await DatabaseService.findChatMessagesByThreadId(threadId, 10, 0);

		// Build conversation context
		const messages = recentMessages.map((msg) => ({
			role: msg.role as 'system' | 'user' | 'assistant',
			content: msg.content
		}));

		// Build enhanced user message with file context
		let enhancedContent = content;
		if (fileContext && contextVariables) {
			const fileInfo = [];
			if (fileContext.fileName) fileInfo.push(`File: ${fileContext.fileName}`);
			if (fileContext.filePath) fileInfo.push(`Path: ${fileContext.filePath}`);
			if (fileContext.language) fileInfo.push(`Language: ${fileContext.language}`);

			let contextInfo = '';
			if (fileInfo.length > 0) {
				contextInfo += `\n\n**Current File Context:**\n${fileInfo.join('\n')}`;
			}

			if (contextVariables.selectedCode) {
				contextInfo += `\n\n**Current File Content:**\n\`\`\`${fileContext.language || 'text'}\n${contextVariables.selectedCode}\n\`\`\``;
			}

			if (contextVariables.framework) {
				contextInfo += `\n\n**Project Framework:** ${contextVariables.framework}`;
			}

			enhancedContent = content + contextInfo;
		}

		// Add the new user message with context
		messages.push({
			role: 'user',
			content: enhancedContent
		});

		// Get AI response using LLM service
		const llmService = new LLMService();
		const aiResponse = await llmService.invoke({
			messages: messages.map((msg) => ({
				role: msg.role,
				content: msg.content
			})),
			model,
			temperature: 0.7,
			maxTokens: 2000
		});

		// Return the response
		return json({
			content: aiResponse.content,
			usage: aiResponse.usage
		});
	} catch (err) {
		console.error('Chat completion error:', err);

		if (err instanceof Response) {
			throw err;
		}

		throw error(500, 'Failed to process chat completion');
	}
};
