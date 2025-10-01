import { DatabaseService } from '$lib/services/database.service';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { id } = params;

	// Check authentication
	if (!locals.session?.user?.id) {
		throw redirect(302, `/auth/login?redirect=/editor/${id}`);
	}

	// Get project
	const project = await DatabaseService.findProjectById(id);
	
	if (!project) {
		throw redirect(302, '/dashboard');
	}

	// Check ownership
	if (project.ownerId !== locals.session.user.id) {
		throw redirect(302, '/dashboard');
	}

	// If already ready, redirect to editor
	if (project.status === 'ready') {
		throw redirect(302, `/editor/${id}?from=loading`);
	}

	return {
		projectId: id,
		projectName: project.name
	};
};
