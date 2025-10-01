import { runAgentTest } from '$lib/agent/graph';
import { AIMessage } from '@langchain/core/messages';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const message = String((body as any).message || 'Test message');

	const mockModel = {
		async invoke(messages: any[]) {
			const last = messages[messages.length - 1];
			return new AIMessage(
				`MOCK RESPONSE: ${typeof last.content === 'string' ? last.content : JSON.stringify(last)}`
			);
		}
	};

	const result = (await runAgentTest({ message, mockModel })) as any;
	return new Response(
		JSON.stringify({
			success: true,
			response: result?.response?.content ?? String(result?.response ?? null)
		}),
		{ status: 200 }
	);
};
