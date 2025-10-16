import { auth } from '$lib/auth';
import { mcpManager } from '$lib/services/mcp/mcp-manager.service';
import { json, type RequestEvent } from '@sveltejs/kit';

/**
 * GET - List all MCP server configurations
 */
export async function GET({ request }: RequestEvent) {
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

		const configs = mcpManager.getAllConfigs();
		const stats = mcpManager.getStats();

		return json({
			success: true,
			data: {
				servers: configs,
				stats
			}
		});
	} catch (error) {
		console.error('Failed to get MCP servers:', error);
		return json(
			{
				success: false,
				message: 'Failed to get MCP servers',
				error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
			},
			{ status: 500 }
		);
	}
}

/**
 * POST - Add or update a server configuration
 */
export async function POST({ request }: RequestEvent) {
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
		const { name, config } = body;

		if (!name || !config) {
			return json(
				{
					success: false,
					message: 'Server name and config are required',
					error: 'INVALID_REQUEST'
				},
				{ status: 400 }
			);
		}

		mcpManager.addServerConfig(name, config);

		return json({
			success: true,
			message: 'Server configuration saved'
		});
	} catch (error) {
		console.error('Failed to add MCP server:', error);
		return json(
			{
				success: false,
				message: 'Failed to add MCP server',
				error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
			},
			{ status: 500 }
		);
	}
}

/**
 * PUT - Enable/disable a server
 */
export async function PUT({ request }: RequestEvent) {
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
		const { name, action } = body;

		if (!name || !action) {
			return json(
				{
					success: false,
					message: 'Server name and action are required',
					error: 'INVALID_REQUEST'
				},
				{ status: 400 }
			);
		}

		if (action === 'enable') {
			await mcpManager.enableServer(name);
		} else if (action === 'disable') {
			await mcpManager.disableServer(name);
		} else {
			return json(
				{
					success: false,
					message: 'Invalid action. Use "enable" or "disable"',
					error: 'INVALID_REQUEST'
				},
				{ status: 400 }
			);
		}

		return json({
			success: true,
			message: `Server ${action}d successfully`
		});
	} catch (error) {
		console.error('Failed to update MCP server:', error);
		return json(
			{
				success: false,
				message: 'Failed to update MCP server',
				error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
			},
			{ status: 500 }
		);
	}
}
