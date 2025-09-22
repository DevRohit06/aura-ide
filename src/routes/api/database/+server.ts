import { getSandboxDatabaseStats, initializeSandboxDatabase } from '$lib/database/init';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const stats = await getSandboxDatabaseStats();
		return json({ success: true, stats });
	} catch (error) {
		console.error('Failed to get database stats:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { action } = await request.json();

		if (action === 'initialize') {
			await initializeSandboxDatabase();
			return json({ success: true, message: 'Database initialized successfully' });
		}

		return json({ success: false, error: 'Invalid action' }, { status: 400 });
	} catch (error) {
		console.error('Failed to initialize database:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
