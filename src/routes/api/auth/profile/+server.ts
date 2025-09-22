import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		// Get user from session (set by hooks.server.ts)
		if (!locals.user || !locals.session) {
			return json(
				{
					success: false,
					error: 'Unauthorized',
					message: 'No active session'
				},
				{ status: 401 }
			);
		}

		return json({
			success: true,
			user: locals.user
		});
	} catch (error) {
		console.error('Profile fetch error:', error);
		return json(
			{
				success: false,
				error: 'Internal Server Error',
				message: 'Failed to fetch profile'
			},
			{ status: 500 }
		);
	}
};

// For now, disable profile updates until we implement them with Better Auth
export const PUT: RequestHandler = async () => {
	return json(
		{
			success: false,
			error: 'Not Implemented',
			message: 'Profile updates not yet implemented with Better Auth'
		},
		{ status: 501 }
	);
};
