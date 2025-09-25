import { vectorDbService } from '$lib/services/vector-db.server.js';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const document = await request.json();

		if (!document.id || !document.filePath || !document.content || !document.projectId) {
			return json({ error: 'Missing required document fields' }, { status: 400 });
		}

		// Ensure lastModified is a Date object
		if (typeof document.lastModified === 'string') {
			document.lastModified = new Date(document.lastModified);
		}

		await vectorDbService.indexCodebaseDocument(document);
		return json({ success: true, message: 'Document indexed successfully' });
	} catch (error) {
		console.error('Vector DB indexing error:', error);
		return json({ error: 'Failed to index document' }, { status: 500 });
	}
};
