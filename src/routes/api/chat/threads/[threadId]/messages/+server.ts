import { json } from '@sveltejs/kit';
import { DatabaseService } from '$lib/services/database.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { threadId } = params;

		const messages = await DatabaseService.findChatMessagesByThreadId(threadId, 100);

		return json({ messages });
	} catch (error) {
		console.error('Failed to load chat messages:', error);
		return json({ error: 'Failed to load messages', messages: [] }, { status: 500 });
	}
};
