/**
 * Bulk File Operations API Routes
 * REST API endpoints for batch file operations in sandbox
 */

import { SandboxManager } from '$lib/services/sandbox/sandbox-manager';
import { SandboxSessionService } from '$lib/services/session/sandbox-session.service';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

interface CopyMoveRequest {
	operations: Array<{
		source: string;
		destination: string;
	}>;
}

interface BatchUploadRequest {
	files: Array<{
		path: string;
		content: string;
		encoding?: 'utf-8' | 'base64' | 'binary';
	}>;
}

interface BatchDeleteRequest {
	paths: string[];
}

/**
 * POST /api/sandbox/[id]/files/bulk/copy
 * Copy multiple files within the sandbox
 */
export const POST: RequestHandler = async ({ params, request, locals, url }) => {
	try {
		const user = locals.user;
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const sandboxId = params.id;
		if (!sandboxId) {
			return json({ error: 'Sandbox ID is required' }, { status: 400 });
		}

		const operation = url.searchParams.get('operation');

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

		switch (operation) {
			case 'copy':
			case 'move': {
				const body = (await request.json()) as CopyMoveRequest;
				const { operations } = body;

				if (!operations || !Array.isArray(operations)) {
					return json({ error: 'Operations array is required' }, { status: 400 });
				}

				const results = await Promise.allSettled(
					operations.map(async (op) => {
						if (operation === 'copy') {
							// Read source file and write to destination
							const sourceFile = await provider.readFile(session.sandboxId, op.source);
							if (!sourceFile) {
								throw new Error(`Source file not found: ${op.source}`);
							}
							await provider.writeFile(session.sandboxId, op.destination, sourceFile.content, {
								encoding: sourceFile.encoding,
								createDirs: true
							});
						} else {
							// Read source file, write to destination, then delete source
							const sourceFile = await provider.readFile(session.sandboxId, op.source);
							if (!sourceFile) {
								throw new Error(`Source file not found: ${op.source}`);
							}
							await provider.writeFile(session.sandboxId, op.destination, sourceFile.content, {
								encoding: sourceFile.encoding,
								createDirs: true
							});
							await provider.deleteFile(session.sandboxId, op.source);
						}
						return { source: op.source, destination: op.destination, success: true };
					})
				);

				const successful = results
					.filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
					.map((result) => result.value);

				const failed = results
					.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
					.map((result, index) => ({
						operation: operations[index],
						error: result.reason.message
					}));

				// Update session activity
				sessionService.updateLastActivity(session.id);

				return json({
					operation,
					successful: successful.length,
					failed: failed.length,
					results: successful,
					errors: failed
				});
			}

			case 'upload': {
				const body = (await request.json()) as BatchUploadRequest;
				const { files } = body;

				if (!files || !Array.isArray(files)) {
					return json({ error: 'Files array is required' }, { status: 400 });
				}

				const results = await Promise.allSettled(
					files.map(async (file) => {
						await provider.writeFile(session.sandboxId, file.path, file.content, {
							encoding: file.encoding || 'utf-8'
						});
						return { path: file.path, success: true };
					})
				);

				const successful = results
					.filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
					.map((result) => result.value);

				const failed = results
					.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
					.map((result, index) => ({
						file: files[index],
						error: result.reason.message
					}));

				// Update session activity
				sessionService.updateLastActivity(session.id);

				return json({
					operation: 'upload',
					successful: successful.length,
					failed: failed.length,
					results: successful,
					errors: failed
				});
			}

			case 'delete': {
				const body = (await request.json()) as BatchDeleteRequest;
				const { paths } = body;

				if (!paths || !Array.isArray(paths)) {
					return json({ error: 'Paths array is required' }, { status: 400 });
				}

				const results = await Promise.allSettled(
					paths.map(async (path) => {
						await provider.deleteFile(session.sandboxId, path);
						return { path, success: true };
					})
				);

				const successful = results
					.filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
					.map((result) => result.value);

				const failed = results
					.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
					.map((result, index) => ({
						path: paths[index],
						error: result.reason.message
					}));

				// Update session activity
				sessionService.updateLastActivity(session.id);

				return json({
					operation: 'delete',
					successful: successful.length,
					failed: failed.length,
					results: successful,
					errors: failed
				});
			}

			default: {
				return json(
					{
						error: 'Invalid operation. Supported operations: copy, move, upload, delete'
					},
					{ status: 400 }
				);
			}
		}
	} catch (error) {
		console.error(`Failed to perform bulk file operation:`, error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to perform bulk operation'
			},
			{ status: 500 }
		);
	}
};
