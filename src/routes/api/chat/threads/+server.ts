import { json } from '@sveltejs/kit';
import { DatabaseService } from '$lib/services/database.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		const projectId = url.searchParams.get('projectId');
		const userId = locals?.user?.id || 'default';

		const threads = await DatabaseService.searchChatThreads({
			userId,
			projectId: projectId || undefined,
			isArchived: false,
			sortBy: 'updatedAt',
			sortOrder: 'desc',
			limit: 50
		});

		return json({ threads });
	} catch (error) {
		console.error('Failed to load chat threads:', error);
		return json({ error: 'Failed to load threads', threads: [] }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const userId = locals?.user?.id || 'default';
		const { title, projectId, settings } = await request.json();

		const newThread = {
			id: crypto.randomUUID(),
			projectId: projectId || null,
			userId,
			title: title || 'New Chat',
			isArchived: false,
			isPinned: false,
			tags: [],
			participants: [
				{
					userId,
					role: 'owner' as const,
					joinedAt: new Date(),
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
				contextWindowSize: 20,
				...settings
			},
			statistics: {
				messageCount: 0,
				participantCount: 1,
				totalTokensUsed: 0,
				totalCost: 0,
				averageResponseTime: 0
			},
			createdAt: new Date(),
			updatedAt: new Date()
		};

		await DatabaseService.createChatThread(newThread);

		return json({ thread: newThread });
	} catch (error) {
		console.error('Failed to create chat thread:', error);
		return json({ error: 'Failed to create thread' }, { status: 500 });
	}
};
