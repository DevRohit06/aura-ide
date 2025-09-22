/**
 * Individual File API Routes
 * REST API endpoints for specific file operations in sandbox
 */

import { SandboxManager } from '$lib/services/sandbox/sandbox-manager';
import { SandboxSessionService } from '$lib/services/session/sandbox-session.service';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

interface UpdateFileRequest {
	content: string;
	encoding?: 'utf-8' | 'base64' | 'binary';
}

/**
 * GET /api/sandbox/[id]/files/[...path]
 * Get file content from the sandbox
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		const user = locals.user;
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const sandboxId = params.id;
		const filePath = '/' + ((params as any).path || '');

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

		// Read file
		const fileContent = await provider.readFile(session.sandboxId, filePath);

		if (!fileContent) {
			return json({ error: 'File not found' }, { status: 404 });
		}

		// Update session activity
		sessionService.updateLastActivity(session.id);

		return json({
			path: filePath,
			content: fileContent.content,
			encoding: fileContent.encoding,
			size: fileContent.size,
			modified: fileContent.modified
		});
	} catch (error) {
		console.error('Failed to read file:', error);

		// Check if it's a file not found error
		if (
			error instanceof Error &&
			(error.message.includes('not found') || error.message.includes('ENOENT'))
		) {
			return json({ error: 'File not found' }, { status: 404 });
		}

		return json({ error: 'Failed to read file' }, { status: 500 });
	}
};

/**
 * PUT /api/sandbox/[id]/files/[...path]
 * Update file content in the sandbox
 */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	try {
		const user = locals.user;
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const sandboxId = params.id;
		const filePath = '/' + ((params as any).path || '');

		if (!sandboxId) {
			return json({ error: 'Sandbox ID is required' }, { status: 400 });
		}

		const body = (await request.json()) as UpdateFileRequest;
		const { content, encoding = 'utf-8' } = body;

		if (content === undefined) {
			return json({ error: 'Content is required' }, { status: 400 });
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

		// Update file
		await provider.writeFile(session.sandboxId, filePath, content, {
			encoding,
			backup: true
		});

		// Update session activity
		sessionService.updateLastActivity(session.id);

		return json({
			path: filePath,
			message: 'File updated successfully'
		});
	} catch (error) {
		console.error('Failed to update file:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to update file'
			},
			{ status: 500 }
		);
	}
};

/**
 * DELETE /api/sandbox/[id]/files/[...path]
 * Delete a file from the sandbox
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	try {
		const user = locals.user;
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const sandboxId = params.id;
		const filePath = '/' + ((params as any).path || '');

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

		// Delete file
		await provider.deleteFile(session.sandboxId, filePath);

		// Update session activity
		sessionService.updateLastActivity(session.id);

		return json({
			path: filePath,
			message: 'File deleted successfully'
		});
	} catch (error) {
		console.error('Failed to delete file:', error);

		// Check if it's a file not found error
		if (
			error instanceof Error &&
			(error.message.includes('not found') || error.message.includes('ENOENT'))
		) {
			return json({ error: 'File not found' }, { status: 404 });
		}

		return json({ error: 'Failed to delete file' }, { status: 500 });
	}
};
