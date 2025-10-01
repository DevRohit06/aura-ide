import { auth } from '$lib/auth';
import { getIndexingQueueService } from '$lib/services/indexing-queue.service';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) return json({ success: false, message: 'Unauthorized' }, { status: 401 });

		const body = await request.json();
		const docs = Array.isArray(body) ? body : [body];
		if (docs.length === 0)
			return json({ success: false, message: 'No documents provided' }, { status: 400 });

		const svc = getIndexingQueueService();
		const jobId = await svc.enqueueIndexDocuments(docs, session.user.id);
		return json({ success: true, jobId });
	} catch (err) {
		console.error('Failed to enqueue index job:', err);
		return json(
			{ success: false, message: err instanceof Error ? err.message : String(err) },
			{ status: 500 }
		);
	}
};

export const GET: RequestHandler = async ({ url, request }) => {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) return json({ success: false, message: 'Unauthorized' }, { status: 401 });

		const jobId = url.searchParams.get('jobId');
		if (!jobId) return json({ success: false, message: 'Missing jobId' }, { status: 400 });

		const svc = getIndexingQueueService();
		const status = await svc.getJobStatus(jobId);
		if (!status) return json({ success: false, message: 'Job not found' }, { status: 404 });
		return json({ success: true, status });
	} catch (err) {
		console.error('Failed to fetch job status:', err);
		return json(
			{ success: false, message: err instanceof Error ? err.message : String(err) },
			{ status: 500 }
		);
	}
};
