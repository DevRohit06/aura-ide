/**
 * Individual Sandbox API Routes
 * REST API endpoints for specific sandbox operations
 */

import { SandboxManager } from '$lib/services/sandbox/sandbox-manager';
import { SandboxSessionService } from '$lib/services/session/sandbox-session.service';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

interface UpdateSandboxRequest {
	environment?: Record<string, string>;
	metadata?: Record<string, any>;
	resources?: {
		cpu?: number;
		memory?: number;
		storage?: number;
	};
}

/**
 * GET /api/sandbox/[id]
 * Get details of a specific sandbox
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		const user = locals.user;
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const sandboxId = params.id;
		if (!sandboxId) {
			return json({ error: 'Sandbox ID is required' }, { status: 400 });
		}

		const sessionService = SandboxSessionService.getInstance();
		const sandboxManager = SandboxManager.getInstance();

		// Get session by sandbox ID
		const session = await sessionService.getSession(sandboxId);
		if (!session || session.userId !== user.id) {
			return json({ error: 'Sandbox not found' }, { status: 404 });
		}

		// Get sandbox details
		const sandbox = await sandboxManager.getSandbox(session.sandboxId, session.provider);
		if (!sandbox) {
			return json({ error: 'Sandbox not accessible' }, { status: 404 });
		}

		// Get metrics
		const metrics = await sessionService.getSessionMetrics(session.id);

		return json({
			session,
			sandbox,
			metrics
		});
	} catch (error) {
		console.error('Failed to get sandbox:', error);
		return json({ error: 'Failed to get sandbox details' }, { status: 500 });
	}
};

/**
 * PUT /api/sandbox/[id]
 * Update a sandbox configuration
 */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	try {
		const user = locals.user;
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const sandboxId = params.id;
		if (!sandboxId) {
			return json({ error: 'Sandbox ID is required' }, { status: 400 });
		}

		const body = (await request.json()) as UpdateSandboxRequest;
		const { environment, metadata, resources } = body;

		const sessionService = SandboxSessionService.getInstance();
		const sandboxManager = SandboxManager.getInstance();

		// Get session by sandbox ID
		const session = await sessionService.getSession(sandboxId);
		if (!session || session.userId !== user.id) {
			return json({ error: 'Sandbox not found' }, { status: 404 });
		}

		// Update sandbox
		const updatedSandbox = await sandboxManager.updateSandbox(
			session.sandboxId,
			{
				environment,
				metadata,
				resources
			},
			session.provider
		);

		// Update session metadata
		if (metadata) {
			await sessionService.updateSession(session.id, {
				metadata: {
					...session.metadata,
					...metadata
				}
			});
		}

		return json({
			sandbox: updatedSandbox,
			message: 'Sandbox updated successfully'
		});
	} catch (error) {
		console.error('Failed to update sandbox:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to update sandbox'
			},
			{ status: 500 }
		);
	}
};

/**
 * DELETE /api/sandbox/[id]
 * Delete a sandbox
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	try {
		const user = locals.user;
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const sandboxId = params.id;
		if (!sandboxId) {
			return json({ error: 'Sandbox ID is required' }, { status: 400 });
		}

		const sessionService = SandboxSessionService.getInstance();

		// Get session by sandbox ID
		const session = await sessionService.getSession(sandboxId);
		if (!session || session.userId !== user.id) {
			return json({ error: 'Sandbox not found' }, { status: 404 });
		}

		// Terminate session (which deletes the sandbox)
		const deleted = await sessionService.terminateSession(session.id, {
			reason: 'user_deleted',
			preserveFiles: false
		});

		if (!deleted) {
			return json({ error: 'Failed to delete sandbox' }, { status: 500 });
		}

		return json({
			message: 'Sandbox deleted successfully'
		});
	} catch (error) {
		console.error('Failed to delete sandbox:', error);
		return json({ error: 'Failed to delete sandbox' }, { status: 500 });
	}
};
