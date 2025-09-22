import { building } from '$app/environment';
import { auth } from '$lib/auth.js';
import { svelteKitHandler } from 'better-auth/svelte-kit';

export async function handle({ event, resolve }) {
	// Fetch current session from Better Auth
	const session = await auth.api.getSession({
		headers: event.request.headers
	});

	// Make session and user available on server
	if (session) {
		event.locals.session = session;
		event.locals.user = {
			id: session.user.id,
			email: session.user.email,
			username: session.user.name || session.user.email
		};
	}

	return svelteKitHandler({ event, resolve, auth, building });
}
