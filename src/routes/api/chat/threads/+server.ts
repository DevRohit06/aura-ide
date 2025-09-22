import { DatabaseService } from '$lib/services/database.service.js';
import type { ChatThread } from '$lib/types/chat';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { title, description, projectId, tags = [] } = await request.json();

		if (!title) {
			return json({ error: 'Title is required' }, { status: 400 });
		}

		const now = new Date();
		const thread: ChatThread = {
			id: crypto.randomUUID(),
			projectId,
			userId: locals.user.id,
			title,
			description,
			isArchived: false,
			isPinned: false,
			tags,
			participants: [
				{
					userId: locals.user.id,
					role: 'owner',
					joinedAt: now,
					permissions: {
						canWrite: true,
						canDelete: true,
						canManageParticipants: true,
						canEditSettings: true
					}
				}
			],
			settings: {
				isPublic: false,
				allowGuestMessages: false,
				enableMarkdownRendering: true,
				contextWindowSize: 20
			},
			statistics: {
				messageCount: 0,
				participantCount: 1,
				totalTokensUsed: 0,
				totalCost: 0,
				averageResponseTime: 0
			},
			createdAt: now,
			updatedAt: now
		};

		const createdThread = await DatabaseService.createChatThread(thread);

		return json({ thread: createdThread });
	} catch (error) {
		console.error('Failed to create thread:', error);
		return json({ error: 'Failed to create thread' }, { status: 500 });
	}
};

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const query = url.searchParams.get('q');
		const projectId = url.searchParams.get('projectId');
		const tagsParam = url.searchParams.get('tags');
		const tags = tagsParam ? tagsParam.split(',') : undefined;
		const limit = parseInt(url.searchParams.get('limit') || '20');
		const isArchived = url.searchParams.get('archived') === 'true';

		const threads = await DatabaseService.searchChatThreads({
			userId: locals.user.id,
			query: query || undefined,
			projectId: projectId || undefined,
			tags,
			isArchived,
			sortBy: 'lastMessageAt',
			sortOrder: 'desc',
			limit
		});

		return json({ threads });
	} catch (error) {
		console.error('Failed to get threads:', error);
		return json({ error: 'Failed to get threads' }, { status: 500 });
	}
};
