import { auth } from '$lib/auth';
import { mcpManager } from '$lib/services/mcp/mcp-manager.service';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

/**
 * GET - List all available MCP tools
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

		const serverName = url.searchParams.get('server');

		let tools;
		if (serverName) {
			tools = mcpManager.getToolsForServer(serverName);
		} else {
			tools = mcpManager.getAllTools();
		}

		return json({
			success: true,
			data: {
				tools,
				count: tools.length
			}
		});
	} catch (error) {
		console.error('Failed to get MCP tools:', error);
		return json(
			{
				success: false,
				message: 'Failed to get MCP tools',
				error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
			},
			{ status: 500 }
		);
	}
};

/**
 * POST - Call an MCP tool
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
		const { server, tool, args } = body;

		if (!server || !tool) {
			return json(
				{
					success: false,
					message: 'Server and tool name are required',
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

		const result = await mcpManager.callTool(server, tool, args || {});

		return json({
			success: true,
			data: result
		});
	} catch (error) {
		console.error('Failed to call MCP tool:', error);
		return json(
			{
				success: false,
				message: 'Failed to call MCP tool',
				error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
			},
			{ status: 500 }
		);
	}
};
