import { vectorDbService } from '$lib/services/vector-db.server.js';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	try {
		const stats = await vectorDbService.getCollectionStats();
		return json(stats);
	} catch (error) {
		console.error('Vector DB stats error:', error);
		return json({ error: 'Failed to get collection stats' }, { status: 500 });
	}
};
