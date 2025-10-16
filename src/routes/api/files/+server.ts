import { auth } from '$lib/auth';
import { fileChangeBroadcaster } from '$lib/services/file-change-broadcaster';
import { listFiles as listFilesService } from '$lib/services/files-list.service';
import { filesService } from '$lib/services/files.service';
import { r2StorageService } from '$lib/services/r2-storage.service';
import { SandboxManager } from '$lib/services/sandbox/sandbox-manager';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export interface FileOperationRequest {
	operation: 'create' | 'read' | 'update' | 'delete' | 'rename' | 'move' | 'list';
	projectId?: string;
	sandboxId?: string;
	path: string;
	content?: string;
	newPath?: string;
	metadata?: Record<string, any>;
	// optional provider hint
	sandboxProvider?: 'daytona' | 'e2b';
}

export interface FileOperationResponse {
	success: boolean;
	message: string;
	data?: any;
	error?: string;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		console.log('🔍 Files API endpoint called');

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

		const body: FileOperationRequest = await request.json();
		console.log('📥 Request body:', {
			operation: body.operation,
			path: body.path,
			hasContent: !!body.content,
			projectId: body.projectId,
			sandboxId: body.sandboxId
		});

		const { operation, projectId, sandboxId, path, content, newPath, metadata, sandboxProvider } =
			body;

		// Validate required fields
		if (!operation) {
			console.log('❌ Validation failed - missing operation');
			return json(
				{
					success: false,
					message: 'Operation is required',
					error: 'INVALID_REQUEST'
				},
				{ status: 400 }
			);
		}

		if (!path && operation !== 'list') {
			console.log('❌ Validation failed - missing path');
			return json(
				{
					success: false,
					message: 'Path is required',
					error: 'INVALID_REQUEST'
				},
				{ status: 400 }
			);
		}

		// Set default path for list operation
		const resolvedPath = operation === 'list' ? path || '/workspace' : path;

		let result: any;

		console.log(`🔄 Processing ${operation} operation for path: ${path}`);

		switch (operation) {
			case 'create':
				result = await createFile({ projectId, sandboxId, path, content: content || '', metadata });
				// Broadcast file creation event
				if (result) {
					fileChangeBroadcaster.broadcast({
						type: 'created',
						path,
						content: content || '',
						timestamp: Date.now(),
						projectId,
						sandboxId,
						userId: session.user.id,
						metadata
					});
				}
				break;

			case 'read':
				result = await readFile({ projectId, sandboxId, path, sandboxProvider });
				break;

			case 'update':
				if (content === undefined) {
					return json(
						{
							success: false,
							message: 'Content is required for update operation',
							error: 'INVALID_REQUEST'
						},
						{ status: 400 }
					);
				}
				result = await updateFile({ projectId, sandboxId, path, content, metadata });
				// Broadcast file modification event
				if (result) {
					fileChangeBroadcaster.broadcast({
						type: 'modified',
						path,
						content,
						timestamp: Date.now(),
						projectId,
						sandboxId,
						userId: session.user.id,
						metadata
					});
				}
				break;

			case 'delete':
				result = await deleteFile({ projectId, sandboxId, path });
				// Broadcast file deletion event
				if (result) {
					fileChangeBroadcaster.broadcast({
						type: 'deleted',
						path,
						timestamp: Date.now(),
						projectId,
						sandboxId,
						userId: session.user.id
					});
				}
				break;

			case 'rename':
				if (!newPath) {
					return json(
						{
							success: false,
							message: 'New path is required for rename operation',
							error: 'INVALID_REQUEST'
						},
						{ status: 400 }
					);
				}
				result = await renameFile({ projectId, sandboxId, path, newPath });
				// Broadcast file rename event
				if (result) {
					fileChangeBroadcaster.broadcast({
						type: 'renamed',
						path,
						newPath,
						timestamp: Date.now(),
						projectId,
						sandboxId,
						userId: session.user.id
					});
				}
				break;

			case 'move':
				if (!newPath) {
					return json(
						{
							success: false,
							message: 'New path is required for move operation',
							error: 'INVALID_REQUEST'
						},
						{ status: 400 }
					);
				}
				result = await moveFile({ projectId, sandboxId, path, newPath });
				// Broadcast file move event
				if (result) {
					fileChangeBroadcaster.broadcast({
						type: 'renamed', // Move is essentially a rename
						path,
						newPath,
						timestamp: Date.now(),
						projectId,
						sandboxId,
						userId: session.user.id
					});
				}
				break;

			case 'list':
				result = await listFilesService({ projectId, sandboxId, path: resolvedPath });
				break;

			default:
				return json(
					{
						success: false,
						message: `Unknown operation: ${operation}`,
						error: 'INVALID_OPERATION'
					},
					{ status: 400 }
				);
		}

		return json({
			success: true,
			message: `File ${operation} operation completed successfully`,
			data: { ...result }
		});
	} catch (error) {
		console.error('File operation error:', error);
		return json(
			{
				success: false,
				message: 'Internal server error',
				error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
			},
			{ status: 500 }
		);
	}
};

// File operation implementations
async function createFile({
	projectId,
	sandboxId,
	path,
	content,
	metadata
}: {
	projectId?: string;
	sandboxId?: string;
	path: string;
	content: string;
	metadata?: Record<string, any>;
}) {
	const results: any = {};

	// Create in database
	try {
		const file = await filesService.createFile({
			name: getFileNameFromPath(path),
			path,
			content,
			type: 'file',
			parentId: null,
			metadata: {
				...metadata,
				createdAt: new Date().toISOString(),
				size: content.length
			}
		});
		results.database = file;
	} catch (error) {
		console.warn('Failed to create file in database:', error);
		results.database = { error: error instanceof Error ? error.message : 'Unknown error' };
	}

	// Save to R2 if project ID provided
	if (projectId) {
		try {
			await r2StorageService.uploadFile(`projects/${projectId}/${path}`, content, {
				contentType: getContentType(path),
				metadata: {
					...metadata,
					createdAt: new Date().toISOString(),
					size: content.length.toString()
				}
			});
			results.r2 = { success: true };
		} catch (error) {
			console.warn('Failed to create file in R2:', error);
			results.r2 = { error: error instanceof Error ? error.message : 'Unknown error' };
		}
	}

	// Create in sandbox if sandbox ID provided
	if (sandboxId) {
		try {
			const sandboxManager = SandboxManager.getInstance();
			await sandboxManager.writeFile(sandboxId, path, content, { encoding: 'utf-8' });
			// Read back to verify
			try {
				const verification = await sandboxManager.readFile(sandboxId, path, { encoding: 'utf-8' });
				if (verification) {
					results.sandbox = {
						success: true,
						verification: {
							sandboxRead: true,
							size: verification.size,
							contentSnippet: verification.content?.slice(0, 2000)
						}
					};
				} else {
					results.sandbox = {
						success: true,
						verification: { sandboxRead: false, error: 'File not found in sandbox after write' }
					};
				}
			} catch (verErr) {
				console.warn('Failed to verify file in sandbox after write:', verErr);
				results.sandbox = {
					success: true,
					verification: {
						sandboxRead: false,
						error: verErr instanceof Error ? verErr.message : String(verErr)
					}
				};
			}
		} catch (error) {
			console.warn('Failed to create file in sandbox:', error);
			results.sandbox = { error: error instanceof Error ? error.message : 'Unknown error' };
		}
	}

	return results;
}

async function readFile({
	projectId,
	sandboxId,
	path,
	sandboxProvider
}: {
	projectId?: string;
	sandboxId?: string;
	path: string;
	sandboxProvider?: 'daytona' | 'e2b';
}) {
	// Try reading from sandbox first (most up-to-date), then R2, then database
	if (sandboxId && sandboxProvider === 'daytona') {
		try {
			const sandboxManager = SandboxManager.getInstance();
			const content = await sandboxManager.readFile(sandboxId, path, {
				encoding: 'utf-8',
				provider: 'daytona'
			});
			return { ...content, source: 'sandbox' };
		} catch (error) {
			console.warn('Failed to read from sandbox:', error);
		}
	}

	if (projectId && (!sandboxProvider || sandboxProvider === 'e2b')) {
		try {
			const fileData = await r2StorageService.downloadFile(`projects/${projectId}/${path}`);
			if (fileData) {
				const cont = typeof fileData === 'string' ? fileData : fileData.toString('utf-8');
				return { content: cont, source: 'r2' };
			}
		} catch (error) {
			console.warn('Failed to read from R2:', error);
		}
	}

	// Fallback to database
	// try {
	// 	const file = await filesService.getFileByPath(path);
	// 	return { content: file?.content || '', source: 'database', file };
	// } catch (error) {
	// 	throw new Error(`File not found: ${path}`);
	// }

	// If we reach here, file was not found in any source
	throw new Error(`File not found: ${path}`);
}

async function updateFile({
	projectId,
	sandboxId,
	path,
	content,
	metadata
}: {
	projectId?: string;
	sandboxId?: string;
	path: string;
	content: string;
	metadata?: Record<string, any>;
}) {
	const results: any = {};
	const now = new Date();

	// Update in database
	try {
		// Capture previous content for history/diff
		let previousContent: string | null = null;
		try {
			const existing = await filesService.getFileByPath(path);
			if (existing && existing.type === 'file') {
				previousContent = (existing as any).content || null;
				// create history entry
				await filesService.createFileHistory(existing as any);
			}
		} catch (err) {
			console.warn('Failed to capture previous file content for history:', err);
		}

		const file = await filesService.updateFileByPath(path, {
			content,
			modifiedAt: now,
			metadata: {
				...metadata,
				modifiedAt: now.toISOString(),
				size: content.length
			}
		});
		results.database = { ...file, previousContent };
	} catch (error) {
		console.warn('Failed to update file in database:', error);
		results.database = { error: error instanceof Error ? error.message : 'Unknown error' };
	}

	// Update in R2 if project ID provided
	if (projectId) {
		try {
			await r2StorageService.uploadFile(`projects/${projectId}/${path}`, content, {
				contentType: getContentType(path),
				metadata: {
					...metadata,
					modifiedAt: now.toISOString(),
					size: content.length.toString()
				}
			});
			results.r2 = { success: true };
		} catch (error) {
			console.warn('Failed to update file in R2:', error);
			results.r2 = { error: error instanceof Error ? error.message : 'Unknown error' };
		}
	}

	// Update in sandbox if sandbox ID provided
	if (sandboxId) {
		try {
			const sandboxManager = SandboxManager.getInstance();
			await sandboxManager.writeFile(sandboxId, path, content, { encoding: 'utf-8' });
			// Read back to verify
			try {
				const verification = await sandboxManager.readFile(sandboxId, path, { encoding: 'utf-8' });
				if (verification) {
					results.sandbox = {
						success: true,
						verification: {
							sandboxRead: true,
							size: verification.size,
							contentSnippet: verification.content?.slice(0, 2000)
						}
					};
				} else {
					results.sandbox = {
						success: true,
						verification: { sandboxRead: false, error: 'File not found in sandbox after write' }
					};
				}
			} catch (verErr) {
				console.warn('Failed to verify file in sandbox after write:', verErr);
				results.sandbox = {
					success: true,
					verification: {
						sandboxRead: false,
						error: verErr instanceof Error ? verErr.message : String(verErr)
					}
				};
			}
		} catch (error) {
			console.warn('Failed to update file in sandbox:', error);
			results.sandbox = { error: error instanceof Error ? error.message : 'Unknown error' };
		}
	}

	return results;
}

async function deleteFile({
	projectId,
	sandboxId,
	path
}: {
	projectId?: string;
	sandboxId?: string;
	path: string;
}) {
	const results: any = {};

	// Delete from database
	try {
		await filesService.deleteFileByPath(path);
		results.database = { success: true };
	} catch (error) {
		console.warn('Failed to delete file from database:', error);
		results.database = { error: error instanceof Error ? error.message : 'Unknown error' };
	}

	// Delete from R2 if project ID provided
	if (projectId) {
		try {
			await r2StorageService.deleteFile(`projects/${projectId}/${path}`);
			results.r2 = { success: true };
		} catch (error) {
			console.warn('Failed to delete file from R2:', error);
			results.r2 = { error: error instanceof Error ? error.message : 'Unknown error' };
		}
	}

	// Delete from sandbox if sandbox ID provided
	if (sandboxId) {
		try {
			const sandboxManager = SandboxManager.getInstance();
			await sandboxManager.deleteFile(sandboxId, path);
			results.sandbox = { success: true };
		} catch (error) {
			console.warn('Failed to delete file from sandbox:', error);
			results.sandbox = { error: error instanceof Error ? error.message : 'Unknown error' };
		}
	}

	return results;
}

async function renameFile({
	projectId,
	sandboxId,
	path,
	newPath
}: {
	projectId?: string;
	sandboxId?: string;
	path: string;
	newPath: string;
}) {
	// Read the file content first
	const fileData = await readFile({ projectId, sandboxId, path });
	const fileContent =
		typeof fileData.content === 'string'
			? fileData.content
			: fileData.content
				? String(fileData.content)
				: '';

	// Create the file with new path
	const createResult = await createFile({
		projectId,
		sandboxId,
		path: newPath,
		content: fileContent
	});

	// Delete the old file
	const deleteResult = await deleteFile({ projectId, sandboxId, path });

	return {
		create: createResult,
		delete: deleteResult
	};
}

async function moveFile({
	projectId,
	sandboxId,
	path,
	newPath
}: {
	projectId?: string;
	sandboxId?: string;
	path: string;
	newPath: string;
}) {
	// Same as rename for now, but could be optimized for different directories
	return await renameFile({ projectId, sandboxId, path, newPath });
}

// Utility functions
function getFileNameFromPath(path: string): string {
	return path.split('/').pop() || path;
}

function getContentType(path: string): string {
	const extension = path.split('.').pop()?.toLowerCase();
	const mimeTypes: Record<string, string> = {
		js: 'application/javascript',
		ts: 'application/typescript',
		jsx: 'application/javascript',
		tsx: 'application/typescript',
		json: 'application/json',
		html: 'text/html',
		css: 'text/css',
		scss: 'text/scss',
		sass: 'text/sass',
		md: 'text/markdown',
		txt: 'text/plain',
		py: 'text/x-python',
		java: 'text/x-java-source',
		c: 'text/x-c',
		cpp: 'text/x-c++',
		php: 'text/x-php',
		rb: 'text/x-ruby',
		go: 'text/x-go',
		rs: 'text/x-rust',
		xml: 'application/xml',
		svg: 'image/svg+xml'
	};
	return mimeTypes[extension || ''] || 'text/plain';
}
