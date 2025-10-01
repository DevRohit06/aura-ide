import { env } from '$env/dynamic/private';
import { TavilySearch } from '@langchain/tavily';
import { json } from '@sveltejs/kit';

export const POST = async ({ request }: { request: Request }) => {
	try {
		if (!env.TAVILY_API_KEY) {
			return json({ success: false, message: 'TAVILY_API_KEY is not configured' }, { status: 500 });
		}

		const body = await request.json();
		const query = String((body as any).query || '');
		const maxResults = Number((body as any).maxResults || 3);

		if (!query) return json({ success: false, message: 'query is required' }, { status: 400 });

		const tavily = new TavilySearch({ tavilyApiKey: env.TAVILY_API_KEY, maxResults });

		let results: any;
		if (typeof (tavily as any).run === 'function') {
			results = await (tavily as any).run(query);
		} else if (typeof (tavily as any).search === 'function') {
			results = await (tavily as any).search(query);
		} else {
			results = await (tavily as any)(query);
		}

		return json({ success: true, data: results });
	} catch (err) {
		console.error('Web search error:', err);
		return json(
			{ success: false, message: err instanceof Error ? err.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
