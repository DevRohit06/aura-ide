import { R2StorageService } from '$lib/services/r2-storage.service.js';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';

/**
 * API endpoint to fetch project files from R2 storage
 */
export const GET: RequestHandler = async ({ params, url }) => {
	try {
		const { id: projectId } = params;
		const version = url.searchParams.get('version') || undefined;

		if (!projectId) {
			return error(400, { message: 'Project ID is required' });
		}

		const r2Service = new R2StorageService();
		const projectFiles = await r2Service.downloadProject(projectId, version);

		if (!projectFiles) {
			return error(404, { message: 'Project files not found' });
		}

		// Convert Buffer objects to text content and create proper file structure
		const files = Object.entries(projectFiles).map(([path, buffer]) => {
			// Try to detect if it's a text file based on extension
			const extension = path.split('.').pop()?.toLowerCase() || '';
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

			return {
				id: path.replace(/[^a-zA-Z0-9]/g, '_'),
				name: path.split('/').pop() || path,
				path: path,
				content: isTextFile ? buffer.toString('utf-8') : buffer.toString('base64'),
				parentId: path.includes('/')
					? path.substring(0, path.lastIndexOf('/')).replace(/[^a-zA-Z0-9]/g, '_')
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
					lineCount: isTextFile ? buffer.toString('utf-8').split('\n').length : 0,
					characterCount: isTextFile ? buffer.toString('utf-8').length : buffer.length,
					wordCount: isTextFile ? buffer.toString('utf-8').split(/\s+/).length : 0,
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
		files.forEach((file) => {
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
			children: files
				.filter(
					(f) =>
						f.path.startsWith(dirPath + '/') &&
						f.path.substring(dirPath.length + 1).indexOf('/') === -1
				)
				.map((f) => f.id),
			isExpanded: false,
			isRoot: !dirPath.includes('/')
		}));

		return json({
			success: true,
			data: {
				files: [...directoryEntries, ...files],
				totalFiles: files.length,
				totalDirectories: directoryEntries.length
			}
		});
	} catch (err) {
		console.error('Failed to fetch project files:', err);
		return error(500, {
			message: 'Failed to fetch project files',
			details: err instanceof Error ? err.message : 'Unknown error'
		});
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
