import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';

/**
 * API endpoint to fetch project files from Daytona sandbox
 * R2 storage has been removed - files are managed directly via Daytona
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		const { id: projectId } = params;

		if (!projectId) {
			return error(400, { message: 'Project ID is required' });
		}

		// Check authentication
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Get project to find sandbox ID
		const { DatabaseService } = await import('$lib/services/database.service.js');
		const project = await DatabaseService.findProjectById(projectId);

		if (!project) {
			return error(404, { message: 'Project not found' });
		}

		// Check if user owns the project
		if (project.ownerId !== locals.user.id) {
			return error(403, { message: 'Access denied' });
		}

		if (!project.sandboxId) {
			return json({
				success: true,
				data: {
					files: [],
					totalFiles: 0,
					totalDirectories: 0,
					message: 'No sandbox associated with this project'
				}
			});
		}

		// Get files from Daytona sandbox
		try {
			const { DaytonaService } = await import('$lib/services/sandbox/daytona.service.js');
			const daytonaService = DaytonaService.getInstance();
			
			const files = await daytonaService.listFiles(project.sandboxId, '/home/daytona');
			
			return json({
				success: true,
				data: {
					files: files || [],
					totalFiles: Array.isArray(files) ? files.filter((f: any) => f.type === 'file').length : 0,
					totalDirectories: Array.isArray(files) ? files.filter((f: any) => f.type === 'directory').length : 0
				}
			});
		} catch (sandboxError) {
			console.error('Failed to fetch files from sandbox:', sandboxError);
			return json({
				success: false,
				data: {
					files: [],
					totalFiles: 0,
					totalDirectories: 0
				},
				error: sandboxError instanceof Error ? sandboxError.message : 'Failed to fetch files from sandbox'
			});
		}
	} catch (err) {
		console.error('Failed to fetch project files:', err);
		return error(500, {
			message: 'Failed to fetch project files',
			details: err instanceof Error ? err.message : 'Unknown error'
		});
	}
};
