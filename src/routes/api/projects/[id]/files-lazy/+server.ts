import { listFiles } from '$lib/services/files-list.service';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url, locals }) => {
	const { id: projectId } = params;

	// Check authentication
	if (!locals.session?.user?.id) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const includeContent = url.searchParams.get('content') === 'true';
		const fastMode = url.searchParams.get('fast') === 'true';

		const filesResult = await listFiles(
			{ projectId, path: '' },
			{
				includeSnippets: includeContent ? 'sync' : false,
				fastMode,
				batchSize: fastMode ? 5 : 20,
				maxReadSize: fastMode ? 256 * 1024 : 1024 * 1024
			}
		);

		return json({
			files: filesResult.files || [],
			success: true
		});
	} catch (error) {
		console.error('Failed to load files:', error);
		return json(
			{
				error: 'Failed to load files',
				message: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
