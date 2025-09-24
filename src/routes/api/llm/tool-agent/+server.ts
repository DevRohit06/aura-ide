/**
 * LLM Tool Agent API Endpoint
 * Handles chat requests with tool calling capabilities
 */

import { LLMToolAgentService } from '$lib/services/llm-tool-agent.service.js';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Get user from session
		const user = locals.user;
		if (!user) {
			throw error(401, 'Authentication required');
		}

		const body = await request.json();
		const {
			messages,
			model = 'gpt-4',
			provider = 'openai',
			temperature = 0.1,
			maxTokens = 4096,
			maxToolIterations = 3,
			systemPrompt,
			projectId,
			sandboxId
		} = body;

		// Validate required fields
		if (!messages || !Array.isArray(messages)) {
			throw error(400, 'Messages array is required');
		}

		// Create LLM tool agent
		const agent = new LLMToolAgentService({
			model,
			provider,
			temperature,
			maxTokens,
			maxToolIterations,
			systemPrompt
		});

		// Process the conversation with tool calling
		const response = await agent.processMessage(messages, {
			projectId,
			sandboxId,
			userId: user.id
		});

		return json({
			success: true,
			...response
		});
	} catch (err) {
		console.error('LLM Tool Agent API Error:', err);

		const status = err && typeof err === 'object' && 'status' in err ? (err as any).status : 500;

		return json(
			{
				success: false,
				error: err instanceof Error ? err.message : 'Unknown error',
				content: 'Sorry, I encountered an error processing your request.'
			},
			{ status }
		);
	}
};
