import { DatabaseService } from '$lib/services/database.service.js';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
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

		const markdown = await DatabaseService.exportThreadToMarkdown(params.threadId);

		return new Response(markdown, {
			headers: {
				'Content-Type': 'text/markdown',
				'Content-Disposition': `attachment; filename="${thread.title.replace(/[^a-zA-Z0-9]/g, '_')}.md"`
			}
		});
	} catch (error) {
		console.error('Failed to export thread:', error);
		return json({ error: 'Failed to export thread' }, { status: 500 });
	}
};
