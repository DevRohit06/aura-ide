import { DatabaseService } from '$lib/services/database.service.js';
import { MarkdownService } from '$lib/services/markdown.service.js';
import type { ChatMessage } from '$lib/types/chat';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const thread = await DatabaseService.findChatThreadById(params.threadId);

		if (!thread) {
			return json({ error: 'Thread not found' }, { status: 404 });
		}

		// Check if user can write to this thread
		const userId = locals.user.id;
		const canWrite =
			thread.userId === userId ||
			thread.participants.some((p) => p.userId === userId && p.permissions.canWrite) ||
			(thread.settings.isPublic && thread.settings.allowGuestMessages);

		if (!canWrite) {
			return json({ error: 'Access denied' }, { status: 403 });
		}

		const { content, role = 'user', fileContext, metadata } = await request.json();

		if (!content) {
			return json({ error: 'Content is required' }, { status: 400 });
		}

		const { content: plainContent, contentMarkdown } = MarkdownService.enhanceMessageContent(
			content,
			role
		);
		const now = new Date();

		const message: ChatMessage = {
			id: crypto.randomUUID(),
			threadId: params.threadId,
			projectId: thread.projectId, // Add project context
			userId, // Add user context
			content: plainContent,
			contentMarkdown,
			role,
			timestamp: now,
			fileContext,
			metadata: {
				...metadata,
				userId
			},
			reactions: [],
			editHistory: [],
			createdAt: now,
			updatedAt: now
		};

		const createdMessage = await DatabaseService.createChatMessage(message);

		return json({ message: createdMessage });
	} catch (error) {
		console.error('Failed to create message:', error);
		return json({ error: 'Failed to create message' }, { status: 500 });
	}
};

export const GET: RequestHandler = async ({ params, url, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const thread = await DatabaseService.findChatThreadById(params.threadId);

		if (!thread) {
			return json({ error: 'Thread not found' }, { status: 404 });
		}

		// Check if user has access to this thread
		const userId = locals.user.id;
		const hasAccess =
			thread.userId === userId ||
			thread.participants.some((p) => p.userId === userId) ||
			thread.settings.isPublic;

		if (!hasAccess) {
			return json({ error: 'Access denied' }, { status: 403 });
		}

		const limit = parseInt(url.searchParams.get('limit') || '50');
		const offset = parseInt(url.searchParams.get('offset') || '0');

		const messages = await DatabaseService.findChatMessagesByThreadId(
			params.threadId,
			limit,
			offset
		);

		return json({ messages });
	} catch (error) {
		console.error('Failed to get messages:', error);
		return json({ error: 'Failed to get messages' }, { status: 500 });
	}
};
