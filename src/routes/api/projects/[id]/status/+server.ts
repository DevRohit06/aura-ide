import { DatabaseService } from '$lib/services/database.service.js';
import { R2StorageService } from '$lib/services/r2-storage.service.js';
import { error, json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		// Check authentication
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const projectId = params.id;
		if (!projectId) {
			throw error(400, 'Project ID is required');
		}

		// Get project by ID
		const project = await DatabaseService.findProjectById(projectId);

		if (!project) {
			throw error(404, 'Project not found');
		}

		// Check if user owns the project
		if (project.ownerId !== locals.user.id) {
			throw error(403, 'Access denied');
		}

		// Get enhanced status information
		const status = {
			project: {
				id: project.id,
				name: project.name,
				status: project.status,
				framework: project.framework,
				e2bSessionId: project.e2bSessionId,
				sandboxProvider: project.sandboxProvider,
				sandboxId: project.sandboxId,
				createdAt: project.createdAt,
				updatedAt: project.updatedAt
			},
			initialization: {
				status: project.status,
				progress: getInitializationProgress(project.status),
				lastActivity: project.updatedAt,
				...(project.metadata?.initializationStatus || {})
			},
			storage: {
				hasFiles: false,
				fileCount: 0,
				lastSync: null as string | null
			},
			sandboxes: {
				daytona: null as any,
				e2b: null as any
			}
		};

		// Check R2 storage for files if project is initialized
		if (project.status === 'ready') {
			try {
				const r2Service = new R2StorageService();
				const projectKey = `projects/${project.ownerId}/${project.id}/`;

				// List files in R2 to check if project files exist
				const result = await r2Service.listFiles({ prefix: projectKey });
				const objects = result.objects || [];
				status.storage.hasFiles = objects.length > 0;
				status.storage.fileCount = objects.length;

				// Get last modified from most recent file
				if (objects.length > 0) {
					const sortedFiles = objects.sort(
						(a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
					);
					status.storage.lastSync = sortedFiles[0].lastModified.toISOString();
				}
			} catch (error) {
				console.warn('Failed to check R2 storage status:', error);
			}
		}

		// Check sandbox status from project metadata
		if (project.metadata?.sandboxes) {
			const sandboxes = project.metadata.sandboxes as any;

			if (sandboxes.daytona) {
				status.sandboxes.daytona = {
					id: sandboxes.daytona.id,
					url: sandboxes.daytona.url,
					status: sandboxes.daytona.status || 'unknown',
					createdAt: sandboxes.daytona.createdAt
				};
			}

			if (sandboxes.e2b) {
				status.sandboxes.e2b = {
					id: sandboxes.e2b.id,
					url: sandboxes.e2b.url,
					status: sandboxes.e2b.status || 'unknown',
					createdAt: sandboxes.e2b.createdAt
				};
			}
		}

		// Also include E2B session ID for backward compatibility
		if (project.e2bSessionId) {
			if (!status.sandboxes.e2b) {
				status.sandboxes.e2b = {};
			}
			status.sandboxes.e2b.sessionId = project.e2bSessionId;
		}

		// Return enhanced project status
		return json({
			success: true,
			data: status
		});
	} catch (err) {
		console.error('Error fetching project status:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		return json(
			{
				success: false,
				error: 'Failed to fetch project status'
			},
			{ status: 500 }
		);
	}
};

function getInitializationProgress(status: string): number {
	switch (status) {
		case 'initializing':
			return 10;
		case 'downloading':
			return 30;
		case 'uploading':
			return 60;
		case 'creating-sandboxes':
			return 80;
		case 'ready':
		case 'completed':
		case 'active':
			return 100;
		case 'error':
			return 0;
		default:
			return 0;
	}
}

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	try {
		// Check authentication
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const projectId = params.id;
		if (!projectId) {
			throw error(400, 'Project ID is required');
		}

		const { status: newStatus } = await request.json();

		// Validate status
		const validStatuses = ['initializing', 'ready', 'error'];
		if (!validStatuses.includes(newStatus)) {
			throw error(400, 'Invalid status value');
		}

		// Get existing project to check ownership
		const existingProject = await DatabaseService.findProjectById(projectId);

		if (!existingProject) {
			throw error(404, 'Project not found');
		}

		// Check if user owns the project
		if (existingProject.ownerId !== locals.user.id) {
			throw error(403, 'Access denied');
		}

		// Update project status
		const updatedProject = await DatabaseService.updateProject(projectId, {
			status: newStatus,
			updatedAt: new Date()
		});

		if (!updatedProject) {
			throw error(500, 'Failed to update project status');
		}

		return json({
			success: true,
			data: {
				status: updatedProject.status,
				id: updatedProject.id,
				name: updatedProject.name,
				framework: updatedProject.framework,
				e2bSessionId: updatedProject.e2bSessionId,
				createdAt: updatedProject.createdAt,
				updatedAt: updatedProject.updatedAt
			}
		});
	} catch (err) {
		console.error('Error updating project status:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		return json(
			{
				success: false,
				error: 'Failed to update project status'
			},
			{ status: 500 }
		);
	}
};
