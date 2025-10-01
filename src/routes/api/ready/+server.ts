import { ExecutionQueue } from '$lib/services/execution/execution-queue.service';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	try {
		// readiness: queue operational
		const queue = ExecutionQueue.getInstance();
		const stats = queue.getStats();
		// If we reached here, we consider service ready
		return json({ ready: true, queue: stats });
	} catch (err: any) {
		return json({ ready: false, message: err?.message || 'not ready' }, { status: 503 });
	}
};
