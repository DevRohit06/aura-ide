import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	// If user is not authenticated, redirect to login
	if (locals.session?.user) {
		throw redirect(302, '/dashboard');
	}
};
