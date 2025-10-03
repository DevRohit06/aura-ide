import { DatabaseService } from '$lib/services/database.service.js';
import { listFiles as listFilesService } from '$lib/services/files-list.service';
import { logger } from '$lib/utils/logger.js';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';

/**
 * API endpoint to list project files for both Daytona and E2B projects
 */
export const GET: RequestHandler = async ({ params, url, locals }) => {
	try {
		const { id: projectId } = params;
		const path = url.searchParams.get('path') || '';
		const includeContent = url.searchParams.get('includeContent') === 'true';
		const fastMode = url.searchParams.get('fastMode') !== 'false'; // Default to true

		// Check if user is authenticated
		if (!locals.session?.user?.id) {
			return error(401, { message: 'Authentication required' });
		}

		if (!projectId) {
			return error(400, { message: 'Project ID is required' });
		}

		// Fetch project data to get sandbox info
		const project = await DatabaseService.findProjectById(projectId);

		if (!project) {
			return error(404, { message: 'Project not found' });
		}

		// Check if user owns the project
		if (project.ownerId !== locals.session.user.id) {
			return error(403, { message: 'Access denied' });
		}

		let projectFiles: any[] = [];

		if (project.sandboxProvider === 'daytona' && project.sandboxId) {
			try {
				logger.info(
					`📁 Loading files for Daytona project ${projectId} with sandbox ${project.sandboxId}`
				);

				const filesResult = await listFilesService(
					{ projectId: project.id, sandboxId: project.sandboxId, path },
					{
						includeSnippets: includeContent ? 'sync' : false,
						batchSize: 50,
						fastMode
					}
				);

				projectFiles = Array.isArray(filesResult?.files) ? filesResult.files : [];
				logger.info(`✅ Loaded ${projectFiles.length} files from Daytona sandbox`);
			} catch (err) {
				logger.error(`Failed to load files from Daytona for project ${projectId}:`, err);
				return error(
					500,
					`Failed to load files from sandbox: ${err instanceof Error ? err.message : 'Unknown error'}`
				);
			}
		} else if (project.sandboxProvider === 'e2b') {
			// For E2B projects, use R2 storage
			try {
				logger.info(`📁 Loading files for E2B project ${projectId} from R2 storage`);

				const { R2StorageService } = await import('$lib/services/r2-storage.service');
				const r2Service = new R2StorageService();
				const projectFilesMap = await r2Service.downloadProject(projectId);

				if (projectFilesMap) {
					// Convert Buffer objects to file structure similar to Daytona
					projectFiles = Object.entries(projectFilesMap).map(([filePath, buffer]) => {
						const extension = filePath.split('.').pop()?.toLowerCase() || '';
						const textExtensions = [
							'js',
							'ts',
							'jsx',
							'tsx',
							'vue',
							'svelte',
							'html',
							'css',
							'scss',
							'sass',
							'less',
							'json',
							'md',
							'txt',
							'yml',
							'yaml',
							'xml',
							'env',
							'gitignore',
							'editorconfig',
							'prettierrc',
							'eslintrc',
							'config',
							'conf',
							'ini',
							'toml',
							'lock',
							'log',
							'py',
							'java',
							'c',
							'cpp',
							'h',
							'cs',
							'php',
							'rb',
							'go',
							'rs',
							'swift',
							'kt'
						];

						const isTextFile = textExtensions.includes(extension) || !extension;
						const content = isTextFile ? buffer.toString('utf-8') : buffer.toString('base64');

						return {
							id: filePath.replace(/[^a-zA-Z0-9]/g, '_'),
							name: filePath.split('/').pop() || filePath,
							path: filePath,
							content: includeContent ? content : '',
							parentId: filePath.includes('/')
								? filePath.substring(0, filePath.lastIndexOf('/')).replace(/[^a-zA-Z0-9]/g, '_')
								: null,
							type: 'file' as const,
							createdAt: new Date(),
							modifiedAt: new Date(),
							size: buffer.length,
							permissions: {
								read: true,
								write: true,
								execute: false,
								delete: true,
								share: false,
								owner: 'user',
								collaborators: []
							},
							language: getLanguageFromExtension(extension),
							encoding: isTextFile ? ('utf-8' as const) : ('base64' as const),
							mimeType: getMimeType(extension),
							isDirty: false,
							isReadOnly: false,
							metadata: {
								extension,
								lineCount: isTextFile ? content.split('\n').length : 0,
								characterCount: isTextFile ? content.length : buffer.length,
								wordCount: isTextFile ? content.split(/\s+/).length : 0,
								lastCursor: null,
								bookmarks: [],
								breakpoints: [],
								folds: [],
								searchHistory: []
							}
						};
					});

					// Create directory entries for proper tree structure
					const directories = new Set<string>();
					projectFiles.forEach((file) => {
						const pathParts = file.path.split('/');
						for (let i = 1; i < pathParts.length; i++) {
							const dirPath = pathParts.slice(0, i).join('/');
							directories.add(dirPath);
						}
					});

					const directoryEntries = Array.from(directories).map((dirPath) => ({
						id: dirPath.replace(/[^a-zA-Z0-9]/g, '_'),
						name: dirPath.split('/').pop() || dirPath,
						path: dirPath,
						content: '',
						parentId: dirPath.includes('/')
							? dirPath.substring(0, dirPath.lastIndexOf('/')).replace(/[^a-zA-Z0-9]/g, '_')
							: null,
						type: 'directory' as const,
						createdAt: new Date(),
						modifiedAt: new Date(),
						permissions: {
							read: true,
							write: true,
							execute: true,
							delete: true,
							share: false,
							owner: 'user',
							collaborators: []
						},
						children: projectFiles
							.filter(
								(f) =>
									f.path.startsWith(dirPath + '/') &&
									f.path.substring(dirPath.length + 1).indexOf('/') === -1
							)
							.map((f) => f.id),
						isExpanded: false,
						isRoot: !dirPath.includes('/')
					}));

					projectFiles = [...directoryEntries, ...projectFiles];
				}

				logger.info(`✅ Loaded ${projectFiles.length} files from R2 storage`);
			} catch (err) {
				logger.error(`Failed to load files from R2 for project ${projectId}:`, err);
				return error(
					500,
					`Failed to load files from storage: ${err instanceof Error ? err.message : 'Unknown error'}`
				);
			}
		} else {
			logger.warn(`No sandbox provider configured for project ${projectId}`);
			return error(400, { message: 'No sandbox provider configured for this project' });
		}

		return json({
			success: true,
			data: {
				files: projectFiles,
				totalFiles: projectFiles.filter((f) => f.type === 'file').length,
				totalDirectories: projectFiles.filter((f) => f.type === 'directory').length,
				projectId,
				sandboxProvider: project.sandboxProvider,
				path
			}
		});
	} catch (err) {
		logger.error('Failed to list project files:', err);
		return error(
			500,
			`Failed to list project files: ${err instanceof Error ? err.message : 'Unknown error'}`
		);
	}
};

function getLanguageFromExtension(extension: string): string {
	const languageMap: Record<string, string> = {
		js: 'javascript',
		jsx: 'javascript',
		ts: 'typescript',
		tsx: 'typescript',
		vue: 'vue',
		svelte: 'svelte',
		html: 'html',
		css: 'css',
		scss: 'scss',
		sass: 'sass',
		less: 'less',
		json: 'json',
		md: 'markdown',
		py: 'python',
		java: 'java',
		c: 'c',
		cpp: 'cpp',
		h: 'c',
		cs: 'csharp',
		php: 'php',
		rb: 'ruby',
		go: 'go',
		rs: 'rust',
		swift: 'swift',
		kt: 'kotlin',
		yml: 'yaml',
		yaml: 'yaml',
		xml: 'xml',
		txt: 'plaintext'
	};

	return languageMap[extension] || 'plaintext';
}

function getMimeType(extension: string): string {
	const mimeMap: Record<string, string> = {
		js: 'application/javascript',
		jsx: 'application/javascript',
		ts: 'application/typescript',
		tsx: 'application/typescript',
		vue: 'text/x-vue',
		svelte: 'text/x-svelte',
		html: 'text/html',
		css: 'text/css',
		scss: 'text/x-scss',
		sass: 'text/x-sass',
		less: 'text/x-less',
		json: 'application/json',
		md: 'text/markdown',
		txt: 'text/plain',
		py: 'text/x-python',
		java: 'text/x-java',
		xml: 'application/xml',
		yml: 'application/x-yaml',
		yaml: 'application/x-yaml'
	};

	return mimeMap[extension] || 'text/plain';
}
