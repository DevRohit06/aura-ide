#!/usr/bin/env ts-node
import { getIndexingQueueService } from '$lib/services/indexing-queue.service';

(async () => {
	console.log('Starting indexing worker (in-process)');
	try {
		const svc = getIndexingQueueService();
		await svc.startWorker();
		console.log('Worker started. Listening for jobs...');
	} catch (err) {
		console.error('Failed to start worker:', err);
		process.exit(1);
	}
})();
