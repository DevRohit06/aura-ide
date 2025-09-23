import { DatabaseService } from '$lib/services/database.service.js';
import { json } from '@sveltejs/kit';

export const GET = async ({
	params,
	url,
	locals
}: {
	params: { projectId: string };
	url: URL;
	locals: any;
}) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { projectId } = params;
		const userId = locals.user.id;

		// Get query parameters
		const limit = parseInt(url.searchParams.get('limit') || '50');
		const offset = parseInt(url.searchParams.get('offset') || '0');
		const threadId = url.searchParams.get('threadId');
		const role = url.searchParams.get('role') as 'user' | 'assistant' | 'system' | null;

		// Build search query
		const searchQuery = {
			projectId,
			userId,
			limit,
			offset,
			sortBy: 'timestamp' as const,
			sortOrder: 'desc' as const,
			...(threadId && { threadId }),
			...(role && { role })
		};

		const messages = await DatabaseService.searchChatMessages(searchQuery);

		// Return serializable format
		const serializableMessages = messages.map((message) => ({
			id: message.id,
			threadId: message.threadId,
			projectId: message.projectId,
			content: message.content,
			contentMarkdown: message.contentMarkdown,
			role: message.role,
			timestamp: message.timestamp?.toISOString(),
			parentMessageId: message.parentMessageId,
			metadata: message.metadata,
			fileContext: message.fileContext
		}));

		return json({
			messages: serializableMessages,
			pagination: {
				limit,
				offset,
				hasMore: messages.length === limit
			}
		});
	} catch (error) {
		console.error('Failed to fetch project messages:', error);
		return json({ error: 'Failed to fetch messages' }, { status: 500 });
	}
};
