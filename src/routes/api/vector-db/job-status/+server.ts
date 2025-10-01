import { getIndexingQueueService } from '$lib/services/indexing-queue.service';
import { logger } from '$lib/utils/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const jobId = url.searchParams.get('jobId');

		if (!jobId) {
			return json({ error: 'jobId parameter is required' }, { status: 400 });
		}

		logger.info(`Checking status for job: ${jobId}`);
		const queueService = getIndexingQueueService();
		const status = await queueService.getJobStatus(jobId);

		if (!status) {
			return json({ error: 'Job not found' }, { status: 404 });
		}

		return json({
			success: true,
			jobId,
			status
		});
	} catch (error) {
		logger.error('Failed to get job status:', error);
		return json(
			{
				error: 'Failed to get job status',
				details: error instanceof Error ? error.message : String(error)
			},
			{ status: 500 }
		);
	}
};
