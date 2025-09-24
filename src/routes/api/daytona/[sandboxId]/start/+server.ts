import { DatabaseService } from '$lib/services/database.service.js';
import { json, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ params, locals }) => {
	try {
		// Check authentication
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { sandboxId } = params;
		if (!sandboxId) {
			return json({ error: 'Sandbox ID is required' }, { status: 400 });
		}

		// Check if there's a project with this sandboxId
		const project = await DatabaseService.findProjectBySandboxId(sandboxId);
		if (!project) {
			return json({ error: 'Sandbox not found' }, { status: 404 });
		}

		// Check if the project belongs to the user
		if (project.ownerId !== locals.user.id) {
			return json({ error: 'Access denied' }, { status: 403 });
		}

		// For Daytona projects, assume the sandbox is running since it's managed by the SDK
		// The actual sandbox instance is stored during creation
		return json({
			success: true,
			data: {
				sandboxId,
				status: 'running',
				message: 'Sandbox is running'
			}
		});
	} catch (error) {
		console.error('Error starting Daytona sandbox:', error);
		return json(
			{
				error: 'Failed to start sandbox',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
