import { auth } from '$lib/auth';
import { mcpManager } from '$lib/services/mcp/mcp-manager.service';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

/**
 * GET - List all available MCP resources
 */
export const GET: RequestHandler = async ({ request, url }) => {
	try {
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session?.user) {
			return json(
				{
					success: false,
					message: 'Authentication required',
					error: 'UNAUTHORIZED'
				},
				{ status: 401 }
			);
		}

		const resources = mcpManager.getAllResources();

		return json({
			success: true,
			data: {
				resources,
				count: resources.length
			}
		});
	} catch (error) {
		console.error('Failed to get MCP resources:', error);
		return json(
			{
				success: false,
				message: 'Failed to get MCP resources',
				error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
			},
			{ status: 500 }
		);
	}
};

/**
 * POST - Read an MCP resource
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session?.user) {
			return json(
				{
					success: false,
					message: 'Authentication required',
					error: 'UNAUTHORIZED'
				},
				{ status: 401 }
			);
		}

		const body = await request.json();
		const { server, uri } = body;

		if (!server || !uri) {
			return json(
				{
					success: false,
					message: 'Server and resource URI are required',
					error: 'INVALID_REQUEST'
				},
				{ status: 400 }
			);
		}

		if (!mcpManager.isServerConnected(server)) {
			return json(
				{
					success: false,
					message: `Server ${server} is not connected`,
					error: 'SERVER_NOT_CONNECTED'
				},
				{ status: 400 }
			);
		}

		const result = await mcpManager.readResource(server, uri);

		return json({
			success: true,
			data: result
		});
	} catch (error) {
		console.error('Failed to read MCP resource:', error);
		return json(
			{
				success: false,
				message: 'Failed to read MCP resource',
				error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
			},
			{ status: 500 }
		);
	}
};
