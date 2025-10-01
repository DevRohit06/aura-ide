import { getIndexingQueueService } from '$lib/services/indexing-queue.service';
import { vectorDbService } from '$lib/services/vector-db.service';
import { logger } from '$lib/utils/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		logger.info('Testing vector database connection...');

		// Test connection
		const connectionTest = await vectorDbService.testConnection();
		if (!connectionTest) {
			return json({ error: 'Vector database connection failed' }, { status: 500 });
		}

		// Get stats
		const stats = await vectorDbService.getCollectionStats();

		return json({
			success: true,
			connection: 'OK',
			stats,
			message: 'Vector database is working correctly'
		});
	} catch (error) {
		logger.error('Vector database test failed:', error);
		return json(
			{
				error: 'Vector database test failed',
				details: error instanceof Error ? error.message : String(error)
			},
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();

		// Create a test document
		const testDoc = {
			id: 'test-doc-' + Date.now(),
			filePath: '/test/example.ts',
			content: 'function helloWorld() { console.log("Hello, world!"); }',
			language: 'typescript',
			projectId: 'test-project',
			lastModified: new Date(),
			metadata: {
				type: 'code' as const,
				functions: ['helloWorld']
			}
		};

		logger.info('Testing document indexing with test document:', testDoc);
		const queueService = getIndexingQueueService();
		const jobId = await queueService.enqueueIndexDocuments([testDoc], 'test-api');

		return json({
			success: true,
			jobId,
			message: 'Test document enqueued for indexing',
			testDocument: testDoc
		});
	} catch (error) {
		logger.error('Document indexing test failed:', error);
		return json(
			{
				error: 'Document indexing test failed',
				details: error instanceof Error ? error.message : String(error)
			},
			{ status: 500 }
		);
	}
};
