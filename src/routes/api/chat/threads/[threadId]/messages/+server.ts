import { DatabaseService } from '$lib/services/database.service';
import { json } from '@sveltejs/kit';
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

export const POST: RequestHandler = async ({ params, request, locals }) => {
	try {
		const { threadId } = params;
		const userId = locals?.user?.id || 'default';
		const { content, role, projectId, metadata } = await request.json();

		const newMessage = {
			id: crypto.randomUUID(),
			threadId,
			projectId: projectId || null,
			userId,
			content: String(content),
			contentMarkdown: String(content),
			role: role || 'user',
			timestamp: new Date(),
			fileContext: metadata?.fileContext || undefined,
			metadata: metadata || {},
			createdAt: new Date(),
			updatedAt: new Date()
		};

		await DatabaseService.createChatMessage(newMessage);

		return json({ message: newMessage });
	} catch (error) {
		console.error('Failed to create chat message:', error);
		return json({ error: 'Failed to create message' }, { status: 500 });
	}
};
