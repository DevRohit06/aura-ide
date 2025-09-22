import { DatabaseService } from '$lib/services/database.service.js';
import { DaytonaService } from '$lib/services/sandbox/daytona.service.js';
import { E2BService } from '$lib/services/sandbox/e2b.service.js';
import { error, json, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	try {
		// Check authentication
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const projectId = params.id;
		if (!projectId) {
			throw error(400, 'Project ID is required');
		}

		const { provider, config } = await request.json();

		// Validate provider
		const validProviders = ['daytona', 'e2b'];
		if (!validProviders.includes(provider)) {
			return json({ error: 'Invalid sandbox provider' }, { status: 400 });
		}

		// Get project
		const project = await DatabaseService.findProjectById(projectId);
		if (!project) {
			throw error(404, 'Project not found');
		}

		// Check if user owns the project
		if (project.ownerId !== locals.user.id) {
			throw error(403, 'Access denied');
		}

		// Create sandbox based on provider
		let sandboxResult;
		try {
			if (provider === 'daytona') {
				const daytonaService = new DaytonaService();
				sandboxResult = await daytonaService.createSandbox({
					projectId: project.id,
					framework: project.framework,
					gitUrl: `https://github.com/stackblitz/starter-${project.framework}`,
					...config
				});
			} else if (provider === 'e2b') {
				const e2bService = new E2BService();
				sandboxResult = await e2bService.createSandbox({
					projectId: project.id,
					framework: project.framework,
					template: project.framework,
					...config
				});
			}

			if (!sandboxResult) {
				throw new Error('Failed to create sandbox');
			}

			// Update project metadata with sandbox info
			const metadata = project.metadata ? { ...project.metadata } : {};
			if (!metadata.sandboxes) {
				metadata.sandboxes = {};
			}
			metadata.sandboxes[provider] = {
				id: sandboxResult.id,
				url: sandboxResult.url,
				status: sandboxResult.status || 'active',
				createdAt: new Date().toISOString(),
				provider
			};

			await DatabaseService.updateProject(projectId, {
				metadata,
				updatedAt: new Date()
			});

			return json({
				success: true,
				sandbox: {
					provider,
					id: sandboxResult.id,
					url: sandboxResult.url,
					status: sandboxResult.status || 'active'
				}
			});
		} catch (sandboxError) {
			console.error(`Error creating ${provider} sandbox:`, sandboxError);
			return json(
				{
					error: `Failed to create ${provider} sandbox`,
					details: sandboxError instanceof Error ? sandboxError.message : 'Unknown error'
				},
				{ status: 500 }
			);
		}
	} catch (err) {
		console.error('Error creating sandbox:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		return json(
			{
				error: 'Failed to create sandbox',
				details: err instanceof Error ? err.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

export const DELETE: RequestHandler = async ({ params, request, locals }) => {
	try {
		// Check authentication
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const projectId = params.id;
		if (!projectId) {
			throw error(400, 'Project ID is required');
		}

		const { provider, sandboxId } = await request.json();

		// Validate provider
		const validProviders = ['daytona', 'e2b'];
		if (!validProviders.includes(provider)) {
			return json({ error: 'Invalid sandbox provider' }, { status: 400 });
		}

		// Get project
		const project = await DatabaseService.findProjectById(projectId);
		if (!project) {
			throw error(404, 'Project not found');
		}

		// Check if user owns the project
		if (project.ownerId !== locals.user.id) {
			throw error(403, 'Access denied');
		}

		// Delete sandbox based on provider
		try {
			if (provider === 'daytona') {
				const daytonaService = new DaytonaService();
				await daytonaService.deleteSandbox(sandboxId);
			} else if (provider === 'e2b') {
				const e2bService = new E2BService();
				await e2bService.deleteSandbox(sandboxId);
			}

			// Remove sandbox info from project metadata
			const metadata = project.metadata ? { ...project.metadata } : {};
			if (metadata.sandboxes && metadata.sandboxes[provider]) {
				delete metadata.sandboxes[provider];
			}

			await DatabaseService.updateProject(projectId, {
				metadata,
				updatedAt: new Date()
			});

			return json({
				success: true,
				message: `${provider} sandbox deleted successfully`
			});
		} catch (sandboxError) {
			console.error(`Error deleting ${provider} sandbox:`, sandboxError);
			return json(
				{
					error: `Failed to delete ${provider} sandbox`,
					details: sandboxError instanceof Error ? sandboxError.message : 'Unknown error'
				},
				{ status: 500 }
			);
		}
	} catch (err) {
		console.error('Error deleting sandbox:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		return json(
			{
				error: 'Failed to delete sandbox',
				details: err instanceof Error ? err.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
