import { auth } from '$lib/auth';
import { r2StorageService } from '$lib/services/r2-storage.service';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Get project metadata and files
 * GET /api/r2-project?projectId=xxx
 */
export const GET: RequestHandler = async ({ url, request }) => {
	try {
		// Authenticate user
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session?.user) {
			return json(
				{
					success: false,
					message: 'Authentication required',
					error: 'UNAUTHORIZED'
				},
				{ status: 401 }
			);
		}

		const projectId = url.searchParams.get('projectId');

		if (!projectId) {
			return json(
				{
					success: false,
					message: 'projectId query parameter is required',
					error: 'INVALID_REQUEST'
				},
				{ status: 400 }
			);
		}

		// Get project metadata
		const metadata = await r2StorageService.getProjectMetadata(projectId);

		if (!metadata) {
			return json(
				{
					success: false,
					message: `No metadata found for project '${projectId}'`,
					error: 'PROJECT_NOT_FOUND'
				},
				{ status: 404 }
			);
		}

		// Get list of files
		const files = await r2StorageService.listProjectFiles(projectId);

		return json({
			success: true,
			message: `Project metadata retrieved successfully`,
			data: {
				projectId,
				metadata,
				files: files || [],
				fileCount: files?.length || 0,
				totalSize: metadata.totalSize || 0
			}
		});
	} catch (error) {
		console.error('R2 project metadata error:', error);

		return json(
			{
				success: false,
				message: 'Failed to retrieve project metadata',
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

/**
 * Update project metadata (for maintenance)
 * POST /api/r2-project
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Authenticate user
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session?.user) {
			return json(
				{
					success: false,
					message: 'Authentication required',
					error: 'UNAUTHORIZED'
				},
				{ status: 401 }
			);
		}

		const body = await request.json();
		const { projectId, action } = body;

		if (!projectId) {
			return json(
				{
					success: false,
					message: 'projectId is required',
					error: 'INVALID_REQUEST'
				},
				{ status: 400 }
			);
		}

		let result;

		switch (action) {
			case 'rebuild_metadata':
				// Rebuild metadata from existing files
				result = await rebuildProjectMetadata(projectId);
				break;

			case 'cleanup_old_versions':
				// Clean up old versions
				const deletedCount = await r2StorageService.cleanupOldVersions(projectId, 5);
				result = {
					success: true,
					message: `Cleaned up ${deletedCount} old versions`,
					data: { deletedVersions: deletedCount }
				};
				break;

			default:
				return json(
					{
						success: false,
						message: 'Invalid action. Supported actions: rebuild_metadata, cleanup_old_versions',
						error: 'INVALID_ACTION'
					},
					{ status: 400 }
				);
		}

		return json(result);
	} catch (error) {
		console.error('R2 project maintenance error:', error);

		return json(
			{
				success: false,
				message: 'Failed to perform project maintenance',
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

/**
 * Rebuild project metadata from existing files
 */
async function rebuildProjectMetadata(projectId: string) {
	try {
		// List all files for the project
		const listResult = await r2StorageService.listFiles({
			prefix: `projects/${projectId}/`,
			maxKeys: 1000,
			includeMetadata: true
		});

		// Filter out metadata file itself
		const fileObjects = listResult.objects.filter((obj) => !obj.key.endsWith('/_metadata.json'));

		// Build metadata
		const files = fileObjects.map((obj) => {
			const path = obj.key.replace(`projects/${projectId}/`, '');
			return {
				path,
				key: obj.key,
				size: obj.size,
				lastModified: obj.lastModified,
				version: 'latest',
				etag: obj.etag
			};
		});

		const totalSize = files.reduce((sum, f) => sum + f.size, 0);

		const metadata = {
			projectId,
			files,
			totalSize,
			fileCount: files.length,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			lastRebuild: new Date().toISOString()
		};

		// Save metadata
		await r2StorageService.uploadFile(
			`projects/${projectId}/_metadata.json`,
			JSON.stringify(metadata, null, 2),
			{
				contentType: 'application/json',
				metadata: {
					projectId,
					metadataType: 'project-files',
					fileCount: files.length.toString(),
					totalSize: totalSize.toString(),
					lastRebuild: new Date().toISOString()
				}
			}
		);

		return {
			success: true,
			message: `Rebuilt metadata for project '${projectId}': ${files.length} files, ${totalSize} bytes`,
			data: {
				projectId,
				fileCount: files.length,
				totalSize,
				files: files.map((f) => ({ path: f.path, size: f.size }))
			}
		};
	} catch (error) {
		console.error(`Failed to rebuild metadata for project ${projectId}:`, error);
		throw error;
	}
}
