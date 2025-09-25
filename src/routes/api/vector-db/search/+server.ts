import { vectorDbService } from '$lib/services/vector-db.server.js';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { query, projectId, maxTokens } = await request.json();

		if (!query || !projectId) {
			return json({ error: 'Query and projectId are required' }, { status: 400 });
		}

		const result = await vectorDbService.getCodebaseContext(query, projectId, maxTokens);
		return json(result);
	} catch (error) {
		console.error('Vector DB search error:', error);
		return json({ error: 'Failed to search vector database' }, { status: 500 });
	}
};