import { auth } from '$lib/auth';
import { vectorDbService } from '$lib/services/vector-db.service';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		// Require authenticated session
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return json({ success: false, message: 'Unauthorized' }, { status: 401 });
		}

		const body = await request.json();
		const {
			query,
			projectId,
			mode = 'context',
			limit = 10,
			threshold = 0.6,
			maxTokens = 2000,
			fileType,
			language
		} = body || {};

		if (!query || !projectId) {
			return json({ success: false, message: 'query and projectId are required' }, { status: 400 });
		}

		// Ensure vector DB initialized
		await vectorDbService.initialize();

		if (mode === 'search') {
			// similarity search returning matching documents + scores
			const results = await vectorDbService.searchSimilarCode(query, projectId, {
				limit,
				threshold,
				fileType,
				language
			});

			return json({ success: true, results });
		} else {
			// default: return rich context (summary + relevant files)
			const context = await vectorDbService.getCodebaseContext(query, projectId, maxTokens);
			return json({ success: true, context });
		}
	} catch (error) {
		console.error('Vector DB search error:', error);
		return json(
			{ success: false, message: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};

export const GET: RequestHandler = async ({ request }) => {
	try {
		// Require authenticated session
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return json({ success: false, message: 'Unauthorized' }, { status: 401 });
		}

		await vectorDbService.initialize();
		const stats = await vectorDbService.getCollectionStats();
		return json({ success: true, stats });
	} catch (error) {
		console.error('Vector DB stats error:', error);
		return json(
			{ success: false, message: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
