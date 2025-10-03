import { DatabaseService } from '$lib/services/database.service.js';
import { logger } from '$lib/utils/logger.js';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, cookies, locals, url }) => {
	const { id } = params;

	// Check if user is authenticated
	if (!locals.session?.user?.id) {
		throw redirect(302, `/auth/login?redirect=/editor/${id}`);
	}

	try {
		// Get layout preferences from cookies
		let layout = cookies.get('PaneForge:layout');
		let verticalLayout = cookies.get('PaneForge:vertical-layout');

		if (layout) {
			layout = JSON.parse(layout);
		}
		if (verticalLayout) {
			verticalLayout = JSON.parse(verticalLayout);
		}

		// Fetch project data
		const project = await DatabaseService.findProjectById(id);

		if (!project) {
			throw error(404, 'Project not found');
		}

		// Check if user owns the project
		if (project.ownerId !== locals.session.user.id) {
			throw error(403, 'Access denied');
		}

		// Convert project to serializable format (remove MongoDB ObjectId and other non-serializable fields)
		const serializableProject = {
			id: project.id,
			name: project.name,
			description: project.description,
			framework: project.framework,
			status: project.status,
			sandboxProvider: project.sandboxProvider,
			sandboxId: project.sandboxId,
			ownerId: project.ownerId,
			configuration: project.configuration,
			metadata: project.metadata,
			createdAt: project.createdAt,
			updatedAt: project.updatedAt
		};

		// Check if project is ready
		if (project.status === 'error') {
			throw error(500, 'Project initialization failed');
		}

		// If project is initializing, return minimal data and let client handle loading
		if (project.status === 'initializing') {
			return {
				project: serializableProject,
				setupStatus: null,
				sandboxStatus: null,
				layout,
				verticalLayout,
				user: locals.session!.user,
				recentMessages: [],
				projectFiles: [],
				isInitializing: true
			};
		}

		// Load critical data first, defer file loading for better performance
		const criticalDataPromise = Promise.all([
			// Sandbox status check (critical for editor functionality)
			project.sandboxId && project.status === 'ready'
				? (async () => {
						try {
							logger.info(
								`🔄 Checking sandbox status for project ${id} with sandbox ${project.sandboxId}`
							);

							if (project.sandboxProvider === 'daytona') {
								const { DaytonaService } = await import('$lib/services/sandbox/daytona.service.js');
								const daytonaService = DaytonaService.getInstance();

								// Try to get the sandbox and ensure it's running
								const sandbox = await daytonaService.retrieveExistingSandbox(project.sandboxId!);
								if (sandbox) {
									await daytonaService.ensureSandboxRunning(sandbox);
									logger.info(`✅ Sandbox ${project.sandboxId} is running for project ${id}`);
									return {
										provider: 'daytona',
										status: 'running',
										sandboxId: project.sandboxId
									};
								} else {
									logger.warn(`⚠️ Sandbox ${project.sandboxId} not found for project ${id}`);
									return {
										provider: 'daytona',
										status: 'not_found',
										sandboxId: project.sandboxId
									};
								}
							} else if (project.sandboxProvider === 'e2b') {
								// E2B sandbox logic can be added here if needed
								return { provider: 'e2b', status: 'unknown', sandboxId: project.sandboxId };
							}
						} catch (error) {
							logger.error(`Failed to spin up sandbox for project ${id}:`, error);
							return {
								provider: project.sandboxProvider,
								status: 'error',
								sandboxId: project.sandboxId,
								error: error instanceof Error ? error.message : String(error)
							};
						}
						return null;
					})()
				: Promise.resolve(null)
		]);

		// Wait for critical data only - files will be loaded client-side
		const [sandboxStatus] = await criticalDataPromise;
		const setupStatus = null; // Not needed since we handle initializing above

		logger.info(`✅ Project ${id} data loaded, files will be loaded client-side`);

		return {
			project: serializableProject,
			setupStatus,
			sandboxStatus,
			layout,
			verticalLayout,
			user: locals.session!.user,
			projectFiles: [], // Files will be loaded client-side
			isInitializing: false
		};
	} catch (err) {
		console.error('Error loading project:', err);

		// If it's already a redirect or error, re-throw it
		if (err instanceof Response) {
			throw err;
		}

		throw error(500, 'An unexpected error occurred while loading the project.');
	}
};
