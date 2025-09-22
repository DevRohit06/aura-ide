/**
 * Sandbox Action API Routes
 * REST API endpoints for sandbox actions (start, stop, restart)
 */

import { SandboxManager } from '$lib/services/sandbox/sandbox-manager';
import { SandboxSessionService } from '$lib/services/session/sandbox-session.service';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

interface ActionRequest {
	action: 'start' | 'stop' | 'restart';
	force?: boolean;
	reason?: string;
}

/**
 * POST /api/sandbox/[id]/action
 * Perform actions on a sandbox (start, stop, restart)
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	try {
		const user = locals.user;
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const sandboxId = params.id;
		if (!sandboxId) {
			return json({ error: 'Sandbox ID is required' }, { status: 400 });
		}

		const body = (await request.json()) as ActionRequest;
		const { action, force = false, reason } = body;

		if (!action || !['start', 'stop', 'restart'].includes(action)) {
			return json({ error: 'Invalid action. Must be start, stop, or restart' }, { status: 400 });
		}

		const sessionService = SandboxSessionService.getInstance();
		const sandboxManager = SandboxManager.getInstance();

		// Get session by sandbox ID
		const session = await sessionService.getSession(sandboxId);
		if (!session || session.userId !== user.id) {
			return json({ error: 'Sandbox not found' }, { status: 404 });
		}

		let result;
		let message: string;

		switch (action) {
			case 'start':
				result = await sandboxManager.startSandbox(session.sandboxId, session.provider);
				message = 'Sandbox started successfully';

				// Update session status
				await sessionService.updateSession(session.id, { status: 'running' });
				break;

			case 'stop':
				result = await sandboxManager.stopSandbox(session.sandboxId, session.provider);
				message = 'Sandbox stopped successfully';

				// Update session status
				await sessionService.updateSession(session.id, { status: 'stopped' });
				break;

			case 'restart':
				result = await sandboxManager.restartSandbox(session.sandboxId, session.provider);
				message = 'Sandbox restarted successfully';

				// Update session activity
				sessionService.updateLastActivity(session.id);
				break;
		}

		return json({
			action,
			sandbox: result,
			message
		});
	} catch (error) {
		console.error('Failed to perform sandbox action:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to perform action'
			},
			{ status: 500 }
		);
	}
};
