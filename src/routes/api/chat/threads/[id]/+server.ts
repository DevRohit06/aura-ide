import { DatabaseService } from '$lib/services/database.service.js';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const thread = await DatabaseService.findChatThreadById(params.id);

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

		return json({ thread });
	} catch (error) {
		console.error('Failed to get thread:', error);
		return json({ error: 'Failed to get thread' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const thread = await DatabaseService.findChatThreadById(params.id);

		if (!thread) {
			return json({ error: 'Thread not found' }, { status: 404 });
		}

		// Check if user can edit this thread
		const userId = locals.user.id;
		const canEdit =
			thread.userId === userId ||
			thread.participants.some((p) => p.userId === userId && p.permissions.canEditSettings);

		if (!canEdit) {
			return json({ error: 'Access denied' }, { status: 403 });
		}

		const updates = await request.json();
		const updatedThread = await DatabaseService.updateChatThread(params.id, {
			...updates,
			updatedAt: new Date()
		});

		return json({ thread: updatedThread });
	} catch (error) {
		console.error('Failed to update thread:', error);
		return json({ error: 'Failed to update thread' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const thread = await DatabaseService.findChatThreadById(params.id);

		if (!thread) {
			return json({ error: 'Thread not found' }, { status: 404 });
		}

		// Check if user can delete this thread
		const userId = locals.user.id;
		const canDelete =
			thread.userId === userId ||
			thread.participants.some((p) => p.userId === userId && p.permissions.canDelete);

		if (!canDelete) {
			return json({ error: 'Access denied' }, { status: 403 });
		}

		const deleted = await DatabaseService.deleteChatThread(params.id);

		if (!deleted) {
			return json({ error: 'Failed to delete thread' }, { status: 500 });
		}

		return json({ success: true });
	} catch (error) {
		console.error('Failed to delete thread:', error);
		return json({ error: 'Failed to delete thread' }, { status: 500 });
	}
};
