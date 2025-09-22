import type { ServerLoad } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';

export const load: ServerLoad = async ({ locals }) => {
	// If user is not authenticated, redirect to login
	if (!locals.session?.user) {
		throw redirect(302, '/auth/login');
	}

	// Return user data to be accessible in the component
	return {
		user: locals.session.user
	};
};
