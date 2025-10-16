import { DatabaseService } from '$lib/services/database.service';
import { ProjectInitializationService } from '$lib/services/project-initialization.service';
import { logger } from '$lib/utils/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Store initialization status in memory (could be Redis in production)
const initStatus = new Map<
	string,
	{
		phase: string;
		progress: number;
		message: string;
		complete: boolean;
		error?: string;
		details?: any;
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

		// Try to get status from service first
		const initService = new ProjectInitializationService();
		let serviceStatus = initService.getProjectStatus(id);

		// If we have service status, use it
		if (serviceStatus) {
			const steps = mapPhaseToSteps(serviceStatus.phase, serviceStatus.progress);
			return json({
				phase: serviceStatus.phase,
				progress: serviceStatus.progress,
				message: serviceStatus.message,
				complete: project.status === 'ready',
				error: serviceStatus.error,
				details: serviceStatus.details,
				steps
			});
		}

		// Fall back to project status-based inference
		let status = initStatus.get(id);

		if (!status) {
			// Initialize default status
			status = {
				phase: 'initializing',
				progress: 0,
				message: 'Starting initialization...',
				complete: false,
				steps: [
					{ name: 'Downloading files', status: 'loading' },
					{ name: 'Uploading to storage', status: 'pending' },
					{ name: 'Creating sandbox', status: 'pending' },
					{ name: 'Finalizing project', status: 'pending' }
				]
			};
			initStatus.set(id, status);
		}

		// Check actual project status
		if (project.status === 'ready') {
			status.complete = true;
			status.progress = 100;
			status.message = 'Project ready!';
			status.phase = 'ready';
			status.steps = status.steps.map((s) => ({ ...s, status: 'complete' as const }));
		} else if (project.status === 'error') {
			status.error = 'Project initialization failed';
			status.progress = 0;
			status.phase = 'error';
			status.steps[0].status = 'error';
		} else if (project.status === 'initializing') {
			// Update progress based on what we know
			status.progress = 25;
			status.message = 'Initializing project...';
			status.phase = 'initializing';
			status.steps[0].status = 'complete';
			status.steps[1].status = 'loading';
		}

		return json(status);
	} catch (error) {
		logger.error('Failed to get init status:', error);
		return json({ error: 'Failed to get status' }, { status: 500 });
	}
};

function mapPhaseToSteps(
	phase: string,
	progress: number
): Array<{ name: string; status: 'pending' | 'loading' | 'complete' | 'error'; message?: string }> {
	const steps: Array<{ name: string; status: 'pending' | 'loading' | 'complete' | 'error' }> = [
		{ name: 'Downloading files', status: 'pending' },
		{ name: 'Uploading to storage', status: 'pending' },
		{ name: 'Creating sandbox', status: 'pending' },
		{ name: 'Finalizing project', status: 'pending' }
	];

	if (phase === 'downloading') {
		steps[0].status = 'loading';
	} else if (phase === 'uploading') {
		steps[0].status = 'complete';
		steps[1].status = 'loading';
	} else if (phase === 'creating-sandboxes') {
		steps[0].status = 'complete';
		steps[1].status = 'complete';
		steps[2].status = 'loading';
	} else if (phase === 'ready') {
		steps.forEach((s) => (s.status = 'complete'));
	} else if (phase === 'error') {
		steps[0].status = 'error';
	}

	return steps;
}
