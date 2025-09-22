/**
 * Sandbox API Routes
 * REST API endpoints for sandbox operations
 */

import { SandboxManager } from '$lib/services/sandbox/sandbox-manager';
import { SandboxSessionService } from '$lib/services/session/sandbox-session.service';
import type { SandboxProvider } from '$lib/types/sandbox';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

interface CreateSandboxRequest {
	template?: string;
	runtime?: string;
	environment?: Record<string, string>;
	provider?: SandboxProvider;
	projectId?: string;
	metadata?: Record<string, any>;
}

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
 * GET /api/sandbox
 * List all sandboxes for the authenticated user
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		const user = locals.user;
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const sandboxManager = SandboxManager.getInstance();
		const sessionService = SandboxSessionService.getInstance();

		// Get query parameters
		const provider = url.searchParams.get('provider') as SandboxProvider | null;
		const status = url.searchParams.get('status');
		const projectId = url.searchParams.get('projectId');
		const limit = parseInt(url.searchParams.get('limit') || '20');
		const offset = parseInt(url.searchParams.get('offset') || '0');

		// Get user sessions
		const sessions = await sessionService.getUserSessions(user.id);

		// Filter sessions based on query parameters
		let filteredSessions = sessions;

		if (provider) {
			filteredSessions = filteredSessions.filter((s) => s.provider === provider);
		}

		if (status) {
			filteredSessions = filteredSessions.filter((s) => s.status === status);
		}

		if (projectId) {
			filteredSessions = filteredSessions.filter((s) => s.projectId === projectId);
		}

		// Apply pagination
		const paginatedSessions = filteredSessions.slice(offset, offset + limit);

		// Get sandbox details for each session
		const sandboxes = await Promise.allSettled(
			paginatedSessions.map(async (session) => {
				try {
					const sandbox = await sandboxManager.getSandbox(session.sandboxId, session.provider);
					return {
						...session,
						sandbox
					};
				} catch (error) {
					return {
						...session,
						sandbox: null,
						error: error instanceof Error ? error.message : 'Unknown error'
					};
				}
			})
		);

		const results = sandboxes.map((result) =>
			result.status === 'fulfilled' ? result.value : { error: result.reason }
		);

		return json({
			sandboxes: results,
			pagination: {
				total: filteredSessions.length,
				limit,
				offset,
				hasMore: offset + limit < filteredSessions.length
			}
		});
	} catch (error) {
		console.error('Failed to list sandboxes:', error);
		return json({ error: 'Failed to list sandboxes' }, { status: 500 });
	}
};

/**
 * POST /api/sandbox
 * Create a new sandbox
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const user = locals.user;
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = (await request.json()) as CreateSandboxRequest;
		const {
			template = 'blank',
			runtime = 'node',
			environment = {},
			provider,
			projectId,
			metadata = {}
		} = body;

		// Validate required fields
		if (!projectId) {
			return json({ error: 'Project ID is required' }, { status: 400 });
		}

		const sessionService = SandboxSessionService.getInstance();

		// Create new session (which creates the sandbox)
		const session = await sessionService.createSession({
			userId: user.id,
			projectId,
			templateId: template,
			provider,
			environment: runtime,
			metadata: {
				...metadata,
				createdViaAPI: true,
				environment
			}
		});

		return json(
			{
				session,
				message: 'Sandbox created successfully'
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('Failed to create sandbox:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to create sandbox'
			},
			{ status: 500 }
		);
	}
};
