/**
 * File Watcher API Routes
 * REST API endpoints for file system monitoring and real-time updates
 */

import { SandboxManager } from '$lib/services/sandbox/sandbox-manager';
import { SandboxSessionService } from '$lib/services/session/sandbox-session.service';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

interface WatchRequest {
	paths: string[];
	recursive?: boolean;
	events?: Array<'create' | 'update' | 'delete' | 'rename'>;
	debounceMs?: number;
}

interface WatcherInfo {
	id: string;
	paths: string[];
	recursive: boolean;
	events: string[];
	created: Date;
	lastEvent?: Date;
	eventCount: number;
}

/**
 * POST /api/sandbox/[id]/watch
 * Start watching file system changes in the sandbox
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

		const body = (await request.json()) as WatchRequest;
		const {
			paths,
			recursive = false,
			events = ['create', 'update', 'delete', 'rename'],
			debounceMs = 100
		} = body;

		if (!paths || !Array.isArray(paths) || paths.length === 0) {
			return json({ error: 'Paths array is required' }, { status: 400 });
		}

		// Get provider for this sandbox
		const provider = await sandboxManager['getProviderForSandbox'](
			session.sandboxId,
			session.provider
		);

		// Create watcher ID
		const watcherId = `watcher_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		// In a real implementation, this would set up file system watching
		// For now, we'll return connection info for WebSocket upgrade
		const watcherInfo: WatcherInfo = {
			id: watcherId,
			paths,
			recursive,
			events,
			created: new Date(),
			eventCount: 0
		};

		// Update session activity
		sessionService.updateLastActivity(session.id);

		return json({
			success: true,
			watcher: watcherInfo,
			websocketUrl: `/api/sandbox/${sandboxId}/watch/${watcherId}/ws`,
			message: 'File watcher created. Connect to WebSocket URL for real-time file system events.',
			configuration: {
				debounceMs,
				maxEvents: 1000,
				bufferSize: 100
			}
		});
	} catch (error) {
		console.error('Failed to create file watcher:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to create file watcher'
			},
			{ status: 500 }
		);
	}
};

/**
 * GET /api/sandbox/[id]/watch
 * List active file watchers for the sandbox
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

		// In a real implementation, this would fetch active file watchers
		// For now, return mock data structure
		const watchers: WatcherInfo[] = [
			// This would be populated from actual watcher storage
		];

		return json({
			sandboxId,
			watchers,
			count: watchers.length,
			totalEvents: watchers.reduce((sum, w) => sum + w.eventCount, 0)
		});
	} catch (error) {
		console.error('Failed to list file watchers:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to list file watchers'
			},
			{ status: 500 }
		);
	}
};
