import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';

/**
 * API endpoint to fetch project file tree for agent context
 * Returns a simplified tree structure suitable for system prompts
 */
export const GET: RequestHandler = async ({ params, url, locals }) => {
	try {
		const { id: projectId } = params;
		const maxDepth = parseInt(url.searchParams.get('maxDepth') || '3');
		const includeContent = url.searchParams.get('includeContent') === 'true';

		if (!projectId) {
			return error(400, { message: 'Project ID is required' });
		}

		// Check authentication
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Get project to find sandbox ID
		const { DatabaseService } = await import('$lib/services/database.service.js');
		const project = await DatabaseService.findProjectById(projectId);

		if (!project) {
			return error(404, { message: 'Project not found' });
		}

		// Check if user owns the project
		if (project.ownerId !== locals.user.id) {
			return error(403, { message: 'Access denied' });
		}

		if (!project.sandboxId) {
			return json({
				success: true,
				data: {
					tree: '',
					fileCount: 0,
					message: 'No sandbox associated with this project'
				}
			});
		}

		// Get files from Daytona sandbox
		try {
			const { DaytonaService } = await import('$lib/services/sandbox/daytona.service.js');
			const daytonaService = DaytonaService.getInstance();
			
			const files = await daytonaService.listFiles(project.sandboxId, '/home/daytona');
			
			// Build tree string for agent context
			const tree = buildTreeString(files || [], maxDepth);
			const keyFiles = identifyKeyFiles(files || []);
			
			return json({
				success: true,
				data: {
					tree,
					keyFiles,
					fileCount: Array.isArray(files) ? files.length : 0,
					projectName: project.name || projectId
				}
			});
		} catch (sandboxError) {
			console.error('Failed to fetch file tree from sandbox:', sandboxError);
			return json({
				success: false,
				data: { tree: '', keyFiles: [], fileCount: 0 },
				error: sandboxError instanceof Error ? sandboxError.message : 'Failed to fetch file tree'
			});
		}
	} catch (err) {
		console.error('Failed to fetch project file tree:', err);
		return error(500, {
			message: 'Failed to fetch project file tree',
			details: err instanceof Error ? err.message : 'Unknown error'
		});
	}
};

/**
 * Build a tree string representation for agent context
 */
function buildTreeString(files: any[], maxDepth: number, currentDepth: number = 0, prefix: string = ''): string {
	if (currentDepth >= maxDepth) return '';
	
	let result = '';
	const sortedFiles = [...files].sort((a, b) => {
		// Directories first, then alphabetically
		if (a.type === 'directory' && b.type !== 'directory') return -1;
		if (a.type !== 'directory' && b.type === 'directory') return 1;
		return (a.name || a.path || '').localeCompare(b.name || b.path || '');
	});

	for (let i = 0; i < sortedFiles.length; i++) {
		const file = sortedFiles[i];
		const isLast = i === sortedFiles.length - 1;
		const name = file.name || file.path?.split('/').pop() || 'unknown';
		
		// Skip hidden files and common ignore patterns
		if (name.startsWith('.') || name === 'node_modules' || name === '__pycache__') {
			continue;
		}

		const connector = isLast ? '└── ' : '├── ';
		const icon = file.type === 'directory' ? '📁' : '📄';
		result += `${prefix}${connector}${icon} ${name}\n`;

		if (file.type === 'directory' && file.children && currentDepth < maxDepth - 1) {
			const newPrefix = prefix + (isLast ? '    ' : '│   ');
			result += buildTreeString(file.children, maxDepth, currentDepth + 1, newPrefix);
		}
	}

	return result;
}

/**
 * Identify key configuration and entry files
 */
function identifyKeyFiles(files: any[]): string[] {
	const keyPatterns = [
		'package.json',
		'tsconfig.json',
		'svelte.config.js',
		'vite.config.ts',
		'README.md',
		'.env.example',
		'Dockerfile',
		'docker-compose.yml'
	];

	const found: string[] = [];
	
	function searchFiles(fileList: any[], path: string = '') {
		for (const file of fileList) {
			const name = file.name || file.path?.split('/').pop() || '';
			const fullPath = path ? `${path}/${name}` : name;
			
			if (keyPatterns.includes(name)) {
				found.push(fullPath);
			}
			
			if (file.type === 'directory' && file.children) {
				searchFiles(file.children, fullPath);
			}
		}
	}

	searchFiles(files);
	return found;
}
