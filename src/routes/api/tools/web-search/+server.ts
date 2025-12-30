import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import { tavily } from '@tavily/core';

export const POST = async ({ request }: { request: Request }) => {
	try {
		if (!env.TAVILY_API_KEY) {
			return json({ success: false, message: 'TAVILY_API_KEY is not configured' }, { status: 500 });
		}

		const body = await request.json();
		const query = String((body as any).query || '');
		const maxResults = Number((body as any).maxResults || 3);

		if (!query) return json({ success: false, message: 'query is required' }, { status: 400 });

		const tvly = tavily({ apiKey: env.TAVILY_API_KEY });
		const results = await tvly.search(query, {
			maxResults,
			includeAnswer: true
		});

		return json({ success: true, data: results.results });
	} catch (err) {
		console.error('Web search error:', err);
		return json(
			{ success: false, message: err instanceof Error ? err.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
