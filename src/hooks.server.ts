import { building } from '$app/environment';
import { auth } from '$lib/auth.js';
import { initializeMCP } from '$lib/services/mcp/mcp-init.service';
import { svelteKitHandler } from 'better-auth/svelte-kit';

// Initialize MCP on server startup (only once)
let mcpInitPromise: Promise<void> | null = null;
if (!building && !mcpInitPromise) {
	mcpInitPromise = initializeMCP().catch(console.error);
}

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
			username: session.user.name || session.user.email,
			image: session.user.image || null
		};
	}

	return svelteKitHandler({ event, resolve, auth, building });
}
