/**
 * Sandbox Snapshots API Routes
 * REST API endpoints for creating and managing sandbox snapshots
 */

import { SandboxManager } from '$lib/services/sandbox/sandbox-manager';
import { SandboxSessionService } from '$lib/services/session/sandbox-session.service';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

interface CreateSnapshotRequest {
	name?: string;
	description?: string;
	includeRuntime?: boolean;
	tags?: string[];
}

interface RestoreSnapshotRequest {
	snapshotId: string;
	preserveNetwork?: boolean;
	startAfterRestore?: boolean;
}

/**
 * POST /api/sandbox/[id]/snapshots
 * Create a new snapshot of the sandbox
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

		const body = (await request.json()) as CreateSnapshotRequest;
		const { name, description, includeRuntime = false, tags = [] } = body;

		// Get provider for this sandbox
		const provider = await sandboxManager['getProviderForSandbox'](
			session.sandboxId,
			session.provider
		);

		// Check if provider supports snapshots
		if (!provider.capabilities.supportsSnapshots) {
			return json(
				{
					error: 'Snapshots not supported by this provider'
				},
				{ status: 400 }
			);
		}

		// Create snapshot
		const snapshot = await provider.createSnapshot(session.sandboxId, name, {
			description,
			includeRuntime
		});

		// Update session activity
		sessionService.updateLastActivity(session.id);

		return json({
			success: true,
			snapshot: {
				...snapshot,
				tags,
				createdBy: user.id
			},
			message: 'Snapshot created successfully'
		});
	} catch (error) {
		console.error('Failed to create snapshot:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to create snapshot'
			},
			{ status: 500 }
		);
	}
};

/**
 * GET /api/sandbox/[id]/snapshots
 * List all snapshots for the sandbox
 */
export const GET: RequestHandler = async ({ params, locals, url }) => {
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

		// Get provider for this sandbox
		const provider = await sandboxManager['getProviderForSandbox'](
			session.sandboxId,
			session.provider
		);

		// Check if provider supports snapshots
		if (!provider.capabilities.supportsSnapshots) {
			return json(
				{
					error: 'Snapshots not supported by this provider'
				},
				{ status: 400 }
			);
		}

		// Get pagination parameters
		const page = parseInt(url.searchParams.get('page') || '1');
		const limit = parseInt(url.searchParams.get('limit') || '20');
		const sortBy = url.searchParams.get('sortBy') || 'created';
		const sortOrder = url.searchParams.get('sortOrder') || 'desc';

		// List snapshots - since listSnapshots doesn't exist in provider interface,
		// we'll return a placeholder response
		const snapshots: Array<{
			id: string;
			name: string;
			created: Date;
			size: number;
		}> = [
			// In a real implementation, this would come from a snapshots database/storage
		];

		return json({
			sandboxId,
			snapshots,
			pagination: {
				page,
				limit,
				total: snapshots.length
			},
			message: 'Snapshot listing would be implemented via database queries'
		});
	} catch (error) {
		console.error('Failed to list snapshots:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to list snapshots'
			},
			{ status: 500 }
		);
	}
};

/**
 * PUT /api/sandbox/[id]/snapshots/restore
 * Restore sandbox from a snapshot
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

		const sessionService = SandboxSessionService.getInstance();
		const sandboxManager = SandboxManager.getInstance();

		// Get session by sandbox ID
		const session = await sessionService.getSession(sandboxId);
		if (!session || session.userId !== user.id) {
			return json({ error: 'Sandbox not found' }, { status: 404 });
		}

		const body = (await request.json()) as RestoreSnapshotRequest;
		const { snapshotId, preserveNetwork = true, startAfterRestore = false } = body;

		if (!snapshotId) {
			return json({ error: 'Snapshot ID is required' }, { status: 400 });
		}

		// Get provider for this sandbox
		const provider = await sandboxManager['getProviderForSandbox'](
			session.sandboxId,
			session.provider
		);

		// Check if provider supports snapshots
		if (!provider.capabilities.supportsSnapshots) {
			return json(
				{
					error: 'Snapshots not supported by this provider'
				},
				{ status: 400 }
			);
		}

		// Restore from snapshot
		const restoredSandbox = await provider.restoreSnapshot(session.sandboxId, snapshotId, {
			restartAfter: startAfterRestore
		});

		// Update session status if needed
		if (startAfterRestore) {
			await sessionService.updateSession(session.id, {
				status: 'running'
			});
		}

		// Update session activity
		sessionService.updateLastActivity(session.id);

		return json({
			success: true,
			sandbox: restoredSandbox,
			snapshotId,
			message: 'Sandbox restored from snapshot successfully'
		});
	} catch (error) {
		console.error('Failed to restore snapshot:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to restore snapshot'
			},
			{ status: 500 }
		);
	}
};
