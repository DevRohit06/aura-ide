import { filesService } from '$lib/services/files.service';
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

	// For Daytona sandboxes, list from sandbox
	if (sandboxId) {
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
