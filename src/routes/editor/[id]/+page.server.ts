import { DatabaseService } from '$lib/services/database.service.js';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, cookies, locals }) => {
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
			ownerId: project.ownerId,
			configuration: project.configuration,
			metadata: project.metadata,
			createdAt: project.createdAt?.toISOString(),
			updatedAt: project.updatedAt?.toISOString()
		};

		// Check if project is ready
		if (project.status === 'error') {
			throw error(500, 'Project initialization failed');
		}

		// Get project setup status if still initializing
		let setupStatus = null;
		if (project.status === 'initializing') {
			try {
				// Try to get project status from the status API
				const response = await fetch(
					`${process.env.ORIGIN || 'http://localhost:5173'}/api/projects/${id}/status`,
					{
						headers: {
							cookie: `session=${cookies.get('session') || ''}`
						}
					}
				);

				if (response.ok) {
					const statusData = await response.json();
					setupStatus = statusData.data;
				}
			} catch (error) {
				console.warn('Failed to fetch project setup status:', error);
			}
		}

		return {
			project: serializableProject,
			setupStatus,
			layout,
			verticalLayout,
			user: locals.session.user
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
