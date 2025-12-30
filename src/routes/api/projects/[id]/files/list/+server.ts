import { DatabaseService } from '$lib/services/database.service.js';
import { listFiles as listFilesService } from '$lib/services/files-list.service';
import { logger } from '$lib/utils/logger.js';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';

/**
 * API endpoint to list project files from Daytona sandbox
 */
export const GET: RequestHandler = async ({ params, url, locals }) => {
	try {
		const { id: projectId } = params;
		const path = url.searchParams.get('path') || '';
		const includeContent = url.searchParams.get('includeContent') === 'true';

		// Check if user is authenticated
		if (!locals.session?.user?.id) {
			return error(401, { message: 'Authentication required' });
		}

		if (!projectId) {
			return error(400, { message: 'Project ID is required' });
		}

		// Fetch project data to get sandbox info
		const project = await DatabaseService.findProjectById(projectId);

		if (!project) {
			return error(404, { message: 'Project not found' });
		}

		// Check if user owns the project
		if (project.ownerId !== locals.session.user.id) {
			return error(403, { message: 'Access denied' });
		}

		let projectFiles: any[] = [];

		if (project.sandboxProvider === 'daytona' && project.sandboxId) {
			try {
				logger.info(
					`📁 Loading files for Daytona project ${projectId} with sandbox ${project.sandboxId}`
				);

				const filesResult = await listFilesService({
					projectId: project.id,
					sandboxId: project.sandboxId,
					path
				});
				projectFiles = Array.isArray(filesResult?.files) ? filesResult.files : [];
				logger.info(`✅ Loaded ${projectFiles.length} files from Daytona sandbox`);
			} catch (err) {
				logger.error(`Failed to load files from Daytona for project ${projectId}:`, err);
				return error(
					500,
					`Failed to load files from sandbox: ${err instanceof Error ? err.message : 'Unknown error'}`
				);
			}
		} else {
			logger.warn(`No sandbox provider configured for project ${projectId}`);
			return error(400, { message: 'No sandbox provider configured for this project' });
		}

		return json({
			success: true,
			data: {
				files: projectFiles,
				totalFiles: projectFiles.filter((f) => f.type === 'file').length,
				totalDirectories: projectFiles.filter((f) => f.type === 'directory').length,
				projectId,
				sandboxProvider: project.sandboxProvider,
				path
			}
		});
	} catch (err) {
		logger.error('Failed to list project files:', err);
		return error(
			500,
			`Failed to list project files: ${err instanceof Error ? err.message : 'Unknown error'}`
		);
	}
};
