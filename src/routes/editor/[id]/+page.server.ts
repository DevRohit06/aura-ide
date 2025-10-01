import { DatabaseService } from '$lib/services/database.service.js';
import { listFiles as listFilesService } from '$lib/services/files-list.service';
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
				layout,
				verticalLayout,
				user: locals.session!.user,
				recentMessages: [],
				projectFiles: [],
				isInitializing: true
			};
		}

		// Load all data in parallel after we have the project
		const [sandboxStatus, setupStatus, projectFiles] = await Promise.all([
			// Sandbox status check
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
				: Promise.resolve(null),

			// Setup status fetch (not needed since we handle initializing above)
			Promise.resolve(null),

			// Project files fetch
			(async () => {
				let projectFiles: any[] = [];
				try {
					if (project.sandboxProvider === 'daytona' && project.sandboxId) {
						// Instead of calling the DaytonaService directly, use the unified files API
						// This ensures the same batching/snippet behavior for Daytona as other providers.
						try {
							// Request async snippet loading to keep page load fast; the page can await the promises
							const filesResult = await listFilesService(
								{ projectId: project.id, sandboxId: project.sandboxId, path: '' },
								{ includeSnippets: 'sync', batchSize: 50 }
							);
							projectFiles = Array.isArray(filesResult?.files) ? filesResult.files : [];

							logger.info(
								'Project files from Daytona (via service, async snippets):',
								projectFiles.length
							);
						} catch (error) {
							logger.error(
								`Failed to load files via listFilesService for Daytona for project ${id}:`,
								error
							);
							projectFiles = [];
						}
					} else if (project.sandboxProvider === 'e2b' && project.id) {
						// For E2B projects, fetch files from R2 via internal API
						const response = await fetch(
							`${process.env.ORIGIN || 'http://localhost:5173'}/api/projects/${project.id}/files`,
							{
								headers: {
									cookie: `session=${cookies.get('session') || ''}`
								}
							}
						);
						if (response.ok) {
							const files = await response.json();
							projectFiles = Array.isArray(files) ? files : [];
							logger.info(`Loaded ${projectFiles.length} files from R2 storage for project ${id}`);
						} else {
							logger.warn(`Failed to fetch files from R2 API: ${response.status}`);
							projectFiles = [];
						}
					} else {
						logger.warn(`No sandbox provider configured for project ${id}, no files loaded`);
					}
				} catch (error) {
					logger.error(`Failed to load project files for project ${id}:`, error);
					// Don't fail the entire page load if file loading fails
					projectFiles = [];
				}
				return projectFiles;
			})()
		]);

		return {
			project: serializableProject,
			setupStatus,
			layout,
			verticalLayout,
			user: locals.session!.user,
			projectFiles,
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
