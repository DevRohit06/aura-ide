import { DatabaseService } from '$lib/services/database.service';
import { logger } from '$lib/utils/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Store initialization status in memory (could be Redis in production)
const initStatus = new Map<
	string,
	{
		progress: number;
		message: string;
		complete: boolean;
		error?: string;
		steps: Array<{
			name: string;
			status: 'pending' | 'loading' | 'complete' | 'error';
			message?: string;
		}>;
	}
>();

export const GET: RequestHandler = async ({ params, locals }) => {
	const { id } = params;

	// Check authentication
	if (!locals.session?.user?.id) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		// Get project to verify ownership
		const project = await DatabaseService.findProjectById(id);

		if (!project) {
			return json({ error: 'Project not found' }, { status: 404 });
		}

		if (project.ownerId !== locals.session.user.id) {
			return json({ error: 'Access denied' }, { status: 403 });
		}

		// Get or create status
		let status = initStatus.get(id);

		if (!status) {
			// Initialize default status
			status = {
				progress: 0,
				message: 'Starting initialization...',
				complete: false,
				steps: [
					{ name: 'Loading project', status: 'loading' },
					{ name: 'Starting sandbox', status: 'pending' },
					{ name: 'Loading files', status: 'pending' },
					{ name: 'Indexing workspace', status: 'pending' }
				]
			};
			initStatus.set(id, status);
		}

		// Check actual project status
		if (project.status === 'ready') {
			status.complete = true;
			status.progress = 100;
			status.message = 'Project ready!';
			status.steps = status.steps.map((s) => ({ ...s, status: 'complete' as const }));
		} else if (project.status === 'error') {
			status.error = 'Project initialization failed';
			status.progress = 0;
			status.steps[0].status = 'error';
		} else if (project.status === 'initializing') {
			// Update progress based on what we know
			status.progress = 25;
			status.message = 'Initializing project...';
			status.steps[0].status = 'complete';
			status.steps[1].status = 'loading';
		}

		return json(status);
	} catch (error) {
		logger.error('Failed to get init status:', error);
		return json({ error: 'Failed to get status' }, { status: 500 });
	}
};
