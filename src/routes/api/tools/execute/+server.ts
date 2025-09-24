import { auth } from '$lib/auth';
import { toolManager } from '$lib/services/tool-manager.service';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export interface ToolExecutionRequest {
	toolName: string;
	parameters: Record<string, any>;
	context?: {
		projectId?: string;
		sandboxId?: string;
	};
}

export interface ToolExecutionResponse {
	success: boolean;
	message: string;
	data?: any;
	error?: string;
	callId?: string;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		console.log('🔧 Tool execution endpoint called');

		// Authenticate user
		const session = await auth.api.getSession({ headers: request.headers });
		console.log('🔐 Session check:', { hasSession: !!session, hasUser: !!session?.user });

		if (!session?.user) {
			console.log('❌ Authentication failed - no session or user');
			return json(
				{
					success: false,
					message: 'Authentication required',
					error: 'UNAUTHORIZED'
				},
				{ status: 401 }
			);
		}

		const body: ToolExecutionRequest = await request.json();
		console.log('📥 Tool execution request:', {
			toolName: body.toolName,
			hasParameters: !!body.parameters,
			context: body.context
		});

		const { toolName, parameters, context } = body;

		// Validate required fields
		if (!toolName || !parameters) {
			console.log('❌ Validation failed - missing toolName or parameters');
			return json(
				{
					success: false,
					message: 'Tool name and parameters are required',
					error: 'INVALID_REQUEST'
				},
				{ status: 400 }
			);
		}

		// Prepare execution context
		const executionContext = {
			userId: session.user.id,
			projectId: context?.projectId,
			sandboxId: context?.sandboxId
		};

		console.log(`🔄 Executing tool: ${toolName}`);

		// Execute tool
		const result = await toolManager.executeToolCall(
			{
				name: toolName,
				parameters
			},
			executionContext
		);

		console.log('✅ Tool execution completed:', {
			success: result.success,
			message: result.message
		});

		return json({
			success: result.success,
			message: result.message,
			data: result.data,
			error: result.error
		});
	} catch (error) {
		console.error('❌ Tool execution error:', error);
		return json(
			{
				success: false,
				message: 'Tool execution failed',
				error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
			},
			{ status: 500 }
		);
	}
};

export const GET: RequestHandler = async ({ request }) => {
	try {
		// Authenticate user
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

		// Get available tools
		const tools = toolManager.getToolDefinitionsForModel();

		return json({
			success: true,
			message: 'Tools retrieved successfully',
			data: {
				tools,
				count: tools.length
			}
		});
	} catch (error) {
		console.error('❌ Tools retrieval error:', error);
		return json(
			{
				success: false,
				message: 'Failed to retrieve tools',
				error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
			},
			{ status: 500 }
		);
	}
};
