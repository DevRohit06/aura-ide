import { filesService } from '$lib/services/files.service';
import { r2StorageService } from '$lib/services/r2-storage.service';
import { SandboxManager } from '$lib/services/sandbox/sandbox-manager';

// Exposed listing utility used by the API route and server-side page loaders.
export async function listFiles({
	projectId,
	sandboxId,
	path = '/workspace'
}: {
	projectId?: string;
	sandboxId?: string;
	path?: string;
}) {
	const results: any = {};

	// Determine provider from project
	let provider: 'daytona' | 'e2b' | undefined;
	if (sandboxId) {
		try {
			const { DatabaseService } = await import('$lib/services/database.service.js');
			const project = await DatabaseService.findProjectBySandboxId(sandboxId);
			provider = project?.sandboxProvider as 'daytona' | 'e2b' | undefined;
		} catch (error) {
			console.warn('Failed to determine provider:', error);
		}
	}

	// List files based on provider
	if (provider === 'daytona' && sandboxId) {
		// For Daytona sandboxes, list from sandbox only
		try {
			const { DaytonaService } = await import('$lib/services/sandbox/daytona.service.js');
			const daytonaService = DaytonaService.getInstance();

			const files = await daytonaService.listFiles(sandboxId, path || '/home/daytona');
			results.files = files;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			console.warn('Failed to list files from Daytona sandbox:', error);
			// If sandbox not found, assume no files (sandbox may not exist or be stopped)
			if (errorMessage.includes('Sandbox not found')) {
				results.files = [];
			} else {
				results.files = { error: errorMessage };
			}
		}
	} else if (provider === 'e2b' && projectId) {
		// For E2B sandboxes, list from R2 only
		try {
			const files = await r2StorageService.listFiles({
				prefix: `projects/${projectId}/`
			});
			results.files = files;
		} catch (error) {
			console.warn('Failed to list files from R2:', error);
			results.files = { error: error instanceof Error ? error.message : 'Unknown error' };
		}
	} else if (sandboxId) {
		// Fallback: try sandbox first, then R2
		try {
			const sandboxManager = SandboxManager.getInstance();
			const files = await sandboxManager.listFiles(sandboxId, path, { provider });
			results.files = files;
		} catch (error) {
			console.warn('Failed to list files from sandbox:', error);
			results.files = { error: error instanceof Error ? error.message : 'Unknown error' };
		}
	} else if (projectId) {
		// No sandbox, list from R2
		try {
			const files = await r2StorageService.listFiles({
				prefix: `projects/${projectId}/`
			});
			results.files = files;
		} catch (error) {
			console.warn('Failed to list files from R2:', error);
			results.files = { error: error instanceof Error ? error.message : 'Unknown error' };
		}
	} else {
		results.files = [];
	}

	// List from database (always include)
	try {
		const files = await filesService.getFilesByParentPath(path);
		results.database = files;
	} catch (error) {
		console.warn('Failed to list files from database:', error);
		results.database = { error: error instanceof Error ? error.message : 'Unknown error' };
	}

	return results;
}
