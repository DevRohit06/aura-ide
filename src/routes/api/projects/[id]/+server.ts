import { DatabaseService } from '$lib/services/database.service.js';
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

		return json({ project });
	} catch (err) {
		console.error('Error fetching project:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		return json({ error: 'Failed to fetch project' }, { status: 500 });
	}
};

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

		const updateData = await request.json();

		// Get existing project to check ownership
		const existingProject = await DatabaseService.findProjectById(projectId);

		if (!existingProject) {
			throw error(404, 'Project not found');
		}

		// Check if user owns the project
		if (existingProject.ownerId !== locals.user.id) {
			throw error(403, 'Access denied');
		}

		// Update project
		const updatedProject = await DatabaseService.updateProject(projectId, {
			...updateData,
			modifiedAt: new Date()
		});

		return json({ project: updatedProject });
	} catch (err) {
		console.error('Error updating project:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		return json({ error: 'Failed to update project' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	try {
		// Check authentication
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const projectId = params.id;
		if (!projectId) {
			throw error(400, 'Project ID is required');
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

		// Delete project
		await DatabaseService.deleteProject(projectId);

		return json({ success: true });
	} catch (err) {
		console.error('Error deleting project:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		return json({ error: 'Failed to delete project' }, { status: 500 });
	}
};
