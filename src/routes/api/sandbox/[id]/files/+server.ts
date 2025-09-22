/**
 * Sandbox Files API Routes
 * REST API endpoints for sandbox file operations
 */

import { SandboxManager } from '$lib/services/sandbox/sandbox-manager';
import { SandboxSessionService } from '$lib/services/session/sandbox-session.service';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

interface CreateFileRequest {
	path: string;
	content: string;
	encoding?: 'utf-8' | 'base64' | 'binary';
}

interface UpdateFileRequest {
	content: string;
	encoding?: 'utf-8' | 'base64' | 'binary';
}

interface CopyFileRequest {
	sourcePath: string;
	destinationPath: string;
}

interface MoveFileRequest {
	sourcePath: string;
	destinationPath: string;
}

/**
 * GET /api/sandbox/[id]/files
 * List files in the sandbox
 */
export const GET: RequestHandler = async ({ params, url, locals }) => {
	try {
		const user = locals.user;
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const sandboxId = params.id;
		if (!sandboxId) {
			return json({ error: 'Sandbox ID is required' }, { status: 400 });
		}

		const path = url.searchParams.get('path') || '/';
		const recursive = url.searchParams.get('recursive') === 'true';

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

		// List files
		const files = await provider.listFiles(session.sandboxId, path, { recursive });

		return json({
			path,
			files,
			count: files.length
		});
	} catch (error) {
		console.error('Failed to list files:', error);
		return json({ error: 'Failed to list files' }, { status: 500 });
	}
};

/**
 * POST /api/sandbox/[id]/files
 * Create a new file in the sandbox
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

		const body = (await request.json()) as CreateFileRequest;
		const { path, content, encoding = 'utf-8' } = body;

		if (!path || content === undefined) {
			return json({ error: 'Path and content are required' }, { status: 400 });
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

		// Create file
		await provider.writeFile(session.sandboxId, path, content, {
			encoding,
			createDirs: true
		});

		// Update session activity
		sessionService.updateLastActivity(session.id);

		return json(
			{
				path,
				message: 'File created successfully'
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('Failed to create file:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to create file'
			},
			{ status: 500 }
		);
	}
};
