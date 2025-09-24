import { auth } from '$lib/auth';
import { r2StorageService } from '$lib/services/r2-storage.service';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export interface R2TestRequest {
	projectId: string;
	fileName: string;
	content: string;
}

/**
 * Test endpoint for R2 file operations
 * POST /api/r2-test - Create a test file in R2
 */
export const POST: RequestHandler = async ({ request, locals }) => {
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

		const body: R2TestRequest = await request.json();
		const { projectId, fileName, content } = body;

		// Validate request
		if (!projectId || !fileName || content === undefined) {
			return json(
				{
					success: false,
					message: 'projectId, fileName, and content are required',
					error: 'INVALID_REQUEST'
				},
				{ status: 400 }
			);
		}

		// Create file in R2
		const r2Key = `projects/${projectId}/${fileName}`;

		console.log(`Creating test file in R2: ${r2Key}`);

		const uploadResult = await r2StorageService.uploadFile(r2Key, content, {
			contentType: getContentType(fileName),
			metadata: {
				createdAt: new Date().toISOString(),
				size: content.length.toString(),
				projectId,
				userId: session.user.id,
				testFile: 'true'
			}
		});

		console.log('R2 upload successful:', uploadResult);

		// Test reading the file back
		const downloadResult = await r2StorageService.downloadFile(r2Key);
		const downloadedContent = downloadResult ? downloadResult.toString('utf-8') : null;

		return json({
			success: true,
			message: `Test file '${fileName}' created successfully in R2`,
			data: {
				upload: {
					key: uploadResult.key,
					etag: uploadResult.etag,
					size: uploadResult.size
				},
				download: {
					contentMatches: downloadedContent === content,
					downloadedSize: downloadResult?.length || 0
				},
				r2Key,
				projectId,
				fileName
			}
		});
	} catch (error) {
		console.error('R2 test error:', error);

		return json(
			{
				success: false,
				message: 'Failed to create test file in R2',
				error: error instanceof Error ? error.message : 'Unknown error',
				details: error instanceof Error ? error.stack : undefined
			},
			{ status: 500 }
		);
	}
};

/**
 * Test endpoint for R2 file reading
 * GET /api/r2-test?projectId=xxx&fileName=xxx
 */
export const GET: RequestHandler = async ({ url, request }) => {
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

		const projectId = url.searchParams.get('projectId');
		const fileName = url.searchParams.get('fileName');

		if (!projectId || !fileName) {
			return json(
				{
					success: false,
					message: 'projectId and fileName query parameters are required',
					error: 'INVALID_REQUEST'
				},
				{ status: 400 }
			);
		}

		// Read file from R2
		const r2Key = `projects/${projectId}/${fileName}`;

		console.log(`Reading test file from R2: ${r2Key}`);

		const content = await r2StorageService.downloadFile(r2Key);

		if (!content) {
			return json(
				{
					success: false,
					message: `File '${fileName}' not found in R2`,
					error: 'FILE_NOT_FOUND'
				},
				{ status: 404 }
			);
		}

		return json({
			success: true,
			message: `Test file '${fileName}' read successfully from R2`,
			data: {
				content: content.toString('utf-8'),
				size: content.length,
				r2Key,
				projectId,
				fileName
			}
		});
	} catch (error) {
		console.error('R2 test read error:', error);

		return json(
			{
				success: false,
				message: 'Failed to read test file from R2',
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

/**
 * Helper function to determine content type based on file extension
 */
function getContentType(fileName: string): string {
	const ext = fileName.split('.').pop()?.toLowerCase();
	const mimeTypes: Record<string, string> = {
		html: 'text/html',
		css: 'text/css',
		js: 'text/javascript',
		ts: 'text/typescript',
		json: 'application/json',
		md: 'text/markdown',
		txt: 'text/plain',
		svg: 'image/svg+xml',
		png: 'image/png',
		jpg: 'image/jpeg',
		gif: 'image/gif'
	};
	return mimeTypes[ext || ''] || 'text/plain';
}
