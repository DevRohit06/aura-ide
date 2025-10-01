import { json } from '@sveltejs/kit';
import { DatabaseService } from '$lib/services/database.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { threadId } = params;

		const thread = await DatabaseService.findChatThreadById(threadId);

		if (!thread) {
			return json({ error: 'Thread not found' }, { status: 404 });
		}

		return json({ thread });
	} catch (error) {
		console.error('Failed to load chat thread:', error);
		return json({ error: 'Failed to load thread' }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const { threadId } = params;
		const updates = await request.json();

		const updatedThread = await DatabaseService.updateChatThread(threadId, updates);

		if (!updatedThread) {
			return json({ error: 'Thread not found' }, { status: 404 });
		}

		return json({ thread: updatedThread });
	} catch (error) {
		console.error('Failed to update chat thread:', error);
		return json({ error: 'Failed to update thread' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const { threadId } = params;

		const deleted = await DatabaseService.deleteChatThread(threadId);

		if (!deleted) {
			return json({ error: 'Thread not found' }, { status: 404 });
		}

		return json({ success: true });
	} catch (error) {
		console.error('Failed to delete chat thread:', error);
		return json({ error: 'Failed to delete thread' }, { status: 500 });
	}
};
