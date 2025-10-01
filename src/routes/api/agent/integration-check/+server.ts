import { sandboxManager } from '$lib/services/sandbox/sandbox-manager';
import { vectorDbService } from '$lib/services/vector-db.service';
import { logger } from '$lib/utils/logger.js';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
	try {
		// Test vector DB connectivity
		const vectorOk = await vectorDbService.testConnection();

		// Ensure sandbox manager initializes and return available providers and their health
		await sandboxManager.initialize();
		const providers = await sandboxManager.getAvailableProviders();
		const providerHealth = await sandboxManager.healthCheckProviders();

		return json({ success: true, vectorOk, providers, providerHealth });
	} catch (err: any) {
		logger.error('Integration check failed', err?.message ?? err);
		return json({ success: false, error: err?.message ?? String(err) }, { status: 500 });
	}
};
