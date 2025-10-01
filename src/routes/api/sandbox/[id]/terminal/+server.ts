/**
 * Terminal WebSocket API Routes
 * WebSocket endpoints for real-time terminal access to sandbox
 */

import { SandboxManager } from '$lib/services/sandbox/sandbox-manager';
import { SandboxSessionService } from '$lib/services/session/sandbox-session.service';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

interface TerminalSessionRequest {
	shell?: string;
	workingDir?: string;
	environment?: Record<string, string>;
	dimensions?: {
		cols: number;
		rows: number;
	};
}

interface TerminalInputRequest {
	data: string;
	type?: 'input' | 'resize' | 'signal';
	dimensions?: {
		cols: number;
		rows: number;
	};
	signal?: string;
}

/**
 * POST /api/sandbox/[id]/terminal
 * Create a new terminal session in the sandbox
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

		const sessionService = SandboxSessionService.getInstance();
		const sandboxManager = SandboxManager.getInstance();

		// Get session by sandbox ID
		const session = await sessionService.getSession(sandboxId);
		if (!session || session.userId !== user.id) {
			return json({ error: 'Sandbox not found' }, { status: 404 });
		}

		// Check if sandbox is running
		if (session.status !== 'running' && session.status !== 'active') {
			return json(
				{
					error: 'Sandbox is not running',
					status: session.status
				},
				{ status: 400 }
			);
		}

		const body = (await request.json()) as TerminalSessionRequest;
		const { shell = '/bin/bash', workingDir = '/', environment, dimensions } = body;

		// Get provider for this sandbox
		const provider = await sandboxManager['getProviderForSandbox'](
			session.sandboxId,
			session.provider
		);

		// Check if provider supports terminal
		if (!provider.capabilities.supportsTerminal) {
			return json(
				{
					error: 'Terminal not supported by this provider'
				},
				{ status: 400 }
			);
		}

		// Create terminal session ID
		const terminalSessionId = `terminal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		// For now, we'll return connection info for WebSocket upgrade
		// Prefer provider-backed terminal sessions when available
		let connectionInfo: {
			terminalSessionId: string;
			providerSessionId?: string;
			wsUrl?: string;
			ssh?: { host: string; port?: number; user?: string; instructions?: string };
			publicUrl?: string;
			shell?: string;
			workingDir?: string;
			websocketUrl?: string;
			dimensions?: { cols: number; rows: number };
		} | null = null;

		try {
			if (provider && typeof provider.connectTerminal === 'function') {
				const providerConnection = await provider.connectTerminal(session.sandboxId, {
					shell,
					workingDir,
					rows: dimensions?.rows,
					cols: dimensions?.cols
				});

				connectionInfo = {
					terminalSessionId,
					providerSessionId: providerConnection?.sessionId,
					wsUrl: providerConnection?.wsUrl,
					ssh: providerConnection?.sshConnection,
					publicUrl: providerConnection?.publicUrl,
					shell,
					workingDir
				};
			} else {
				connectionInfo = {
					terminalSessionId,
					websocketUrl: `/api/sandbox/${sandboxId}/terminal/${terminalSessionId}/ws`,
					shell,
					workingDir,
					dimensions: dimensions || { cols: 80, rows: 24 }
				};
			}
		} catch (err) {
			// If provider connect fails, fall back to local session info
			console.warn('Provider connectTerminal failed, falling back to local session:', err);
			connectionInfo = {
				terminalSessionId,
				websocketUrl: `/api/sandbox/${sandboxId}/terminal/${terminalSessionId}/ws`,
				shell,
				workingDir,
				dimensions: dimensions || { cols: 80, rows: 24 }
			};
		}

		// Update session activity
		sessionService.updateLastActivity(session.id);

		return json({
			success: true,
			terminal: connectionInfo,
			message:
				'Terminal session created. Connect to the returned connection info for real-time access.'
		});
	} catch (error) {
		console.error('Failed to create terminal session:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to create terminal session'
			},
			{ status: 500 }
		);
	}
};

/**
 * GET /api/sandbox/[id]/terminal
 * List active terminal sessions for the sandbox
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

		// Get session by sandbox ID
		const session = await sessionService.getSession(sandboxId);
		if (!session || session.userId !== user.id) {
			return json({ error: 'Sandbox not found' }, { status: 404 });
		}

		// In a real implementation, this would fetch active terminal sessions
		// For now, return mock data structure
		const terminalSessions: Array<{
			id: string;
			shell: string;
			workingDir: string;
			created: Date;
			lastActivity: Date;
		}> = [
			// This would be populated from actual terminal session storage
		];

		return json({
			sandboxId,
			terminals: terminalSessions,
			count: terminalSessions.length
		});
	} catch (error) {
		console.error('Failed to list terminal sessions:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to list terminal sessions'
			},
			{ status: 500 }
		);
	}
};
