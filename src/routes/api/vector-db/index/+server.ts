import { env } from '$env/dynamic/private';
import { auth } from '$lib/auth';
import { getIndexingQueueService } from '$lib/services/indexing-queue.service';
import { redisRateLimiter } from '$lib/services/rate-limiter.service';
import { vectorDbService } from '$lib/services/vector-db.service';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

// Rate limit settings
const MAX_DOCS_PER_REQUEST = Number(env.VECTOR_INDEX_MAX_BATCH || 500);
const CHUNK_SIZE = Number(env.VECTOR_INDEX_CHUNK_SIZE || 50);
const CHUNK_PAUSE_MS = Number(env.VECTOR_INDEX_CHUNK_PAUSE_MS || 200);
const RATE_LIMIT_WINDOW_MS = Number(env.VECTOR_INDEX_RATE_WINDOW_MS || 60_000); // 1 min
const MAX_DOCS_PER_WINDOW = Number(env.VECTOR_INDEX_RATE_LIMIT || 1000); // per user per window
const ENQUEUE_THRESHOLD = Number(env.VECTOR_INDEX_ENQUEUE_THRESHOLD || 100); // docs above this threshold will be enqueued by default

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		// Require authenticated session
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return json({ success: false, message: 'Unauthorized' }, { status: 401 });
		}

		const userId = session.user.id;

		const body = await request.json();

		// Accept either an array body or an object with a `documents` array (useful when specifying async:true)
		let docs = Array.isArray(body)
			? body
			: Array.isArray(body?.documents)
				? body.documents
				: [body];

		// Basic per-request limits
		if (docs.length === 0) {
			return json({ success: false, message: 'No documents provided' }, { status: 400 });
		}

		if (docs.length > MAX_DOCS_PER_REQUEST) {
			return json(
				{
					success: false,
					message: `Too many documents in request. Max allowed per request: ${MAX_DOCS_PER_REQUEST}`
				},
				{ status: 400 }
			);
		}

		// Per-user rate limit enforcement using Redis
		const rateResult = await redisRateLimiter.allow(
			String(userId),
			docs.length,
			RATE_LIMIT_WINDOW_MS,
			MAX_DOCS_PER_WINDOW
		);
		if (!rateResult.allowed) {
			const retryAfter = Math.ceil(
				Number(rateResult.retryAfterSeconds || Math.ceil(RATE_LIMIT_WINDOW_MS / 1000))
			);
			return json(
				{ success: false, message: `Rate limit exceeded. Try again in ${retryAfter}s` },
				{ status: 429, headers: { 'Retry-After': String(retryAfter) } }
			);
		}

		// Prepare documents first so we can optionally enqueue entire set
		const preparedDocs: any[] = [];
		for (const doc of docs) {
			if (!doc.id || !doc.content || !doc.filePath || !doc.projectId) {
				// skip invalid docs; record minimally for transparency
				preparedDocs.push(null);
				continue;
			}

			preparedDocs.push({
				id: String(doc.id),
				filePath: String(doc.filePath),
				content: String(doc.content),
				language: doc.language || 'unknown',
				projectId: String(doc.projectId),
				lastModified: doc.lastModified ? new Date(doc.lastModified) : new Date(),
				metadata: doc.metadata || { type: 'code' }
			});
		}

		const forceAsync =
			body?.async === true || preparedDocs.filter(Boolean).length >= ENQUEUE_THRESHOLD;

		// If request indicates async or exceeds threshold, enqueue job
		if (forceAsync) {
			const svc = getIndexingQueueService();
			const toEnqueue = preparedDocs.filter(Boolean);
			if (toEnqueue.length === 0) {
				return json({ success: false, message: 'No valid documents to enqueue' }, { status: 400 });
			}

			try {
				const jobId = await svc.enqueueIndexDocuments(toEnqueue, userId);
				return json({ success: true, enqueued: true, jobId }, { status: 202 });
			} catch (err) {
				console.error('Failed to enqueue index job:', err);
				return json(
					{ success: false, message: err instanceof Error ? err.message : String(err) },
					{ status: 500 }
				);
			}
		}

		await vectorDbService.initialize();

		const results: Array<{ id: string; filePath?: string; status: string; error?: string }> = [];

		// Process in chunks to reduce load and avoid long synchronous loops
		for (let i = 0; i < preparedDocs.length; i += CHUNK_SIZE) {
			const chunk = preparedDocs.slice(i, i + CHUNK_SIZE);

			// Validate and prepare documents for indexing
			const prepared = [] as any[];
			for (const doc of chunk) {
				if (!doc) {
					results.push({ id: 'unknown', status: 'error', error: 'Missing required fields' });
					continue;
				}

				prepared.push(doc);
			}

			// Index prepared chunk sequentially to keep attribution simple
			try {
				for (const d of prepared) {
					try {
						await vectorDbService.indexCodebaseDocument(d);
						results.push({ id: d.id, filePath: d.filePath, status: 'indexed' });
					} catch (err) {
						results.push({
							id: d.id,
							filePath: d.filePath,
							status: 'error',
							error: err instanceof Error ? err.message : String(err)
						});
					}
				}
			} catch (err) {
				console.error('Chunk indexing failed:', err);
				for (const d of prepared) {
					results.push({
						id: d.id,
						filePath: d.filePath,
						status: 'error',
						error: 'Chunk indexing failed'
					});
				}
			}

			// Pause between chunks to give downstream services breathing room
			if (i + CHUNK_SIZE < preparedDocs.length) {
				await sleep(CHUNK_PAUSE_MS);
			}
		}

		return json({
			success: true,
			results,
			indexedCount: results.filter((r) => r.status === 'indexed').length
		});
	} catch (error) {
		console.error('Vector DB indexing error:', error);
		return json(
			{ success: false, message: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
