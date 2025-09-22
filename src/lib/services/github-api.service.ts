/**
 * GitHub API Service
 * Service for interacting with GitHub API for template management
 */

import { templateConfig } from '$lib/config/template.config.js';
import { logger } from '$lib/utils/logger.js';
import { Octokit } from '@octokit/rest';

export interface GitHubRepository {
	id: number;
	name: string;
	full_name: string;
	description: string | null;
	html_url: string;
	clone_url: string;
	default_branch: string;
	topics: string[];
	language: string | null;
	stargazers_count: number;
	forks_count: number;
	created_at: string;
	updated_at: string;
}

export interface GitHubContent {
	name: string;
	path: string;
	sha: string;
	size: number;
	url: string;
	html_url: string;
	git_url: string;
	download_url: string | null;
	type: 'file' | 'dir';
	content?: string;
	encoding?: string;
}

export interface GitHubTree {
	sha: string;
	url: string;
	tree: GitHubTreeItem[];
	truncated: boolean;
}

export interface GitHubTreeItem {
	path: string;
	mode: string;
	type: 'tree' | 'blob';
	sha: string;
	size?: number;
	url: string;
}

export interface RateLimitInfo {
	limit: number;
	remaining: number;
	reset: number;
	used: number;
}

/**
 * GitHub API Service Class
 */
export class GitHubApiService {
	private octokit: Octokit;
	private baseUrl = 'https://api.github.com';
	private rateLimitInfo: RateLimitInfo | null = null;

	constructor() {
		this.octokit = new Octokit({
			auth: templateConfig.github.token,
			userAgent: 'Aura-IDE/1.0.0'
		});
	}

	/**
	 * Get repository information
	 */
	async getRepository(owner: string, repo: string): Promise<GitHubRepository | null> {
		try {
			const { data } = await this.octokit.rest.repos.get({
				owner,
				repo
			});

			return {
				id: data.id,
				name: data.name,
				full_name: data.full_name,
				description: data.description,
				html_url: data.html_url,
				clone_url: data.clone_url,
				default_branch: data.default_branch,
				topics: data.topics || [],
				language: data.language,
				stargazers_count: data.stargazers_count,
				forks_count: data.forks_count,
				created_at: data.created_at,
				updated_at: data.updated_at
			};
		} catch (error: any) {
			if (error.status === 404) {
				return null;
			}
			logger.error(`Failed to get repository ${owner}/${repo}:`, error);
			throw error;
		}
	}

	/**
	 * Get repository contents
	 */
	async getRepositoryContents(owner: string, repo: string, path = ''): Promise<GitHubContent[]> {
		try {
			const { data } = await this.octokit.rest.repos.getContent({
				owner,
				repo,
				path
			});

			// Handle both single file and directory contents
			const contents = Array.isArray(data) ? data : [data];

			return contents.map((item) => ({
				name: item.name,
				path: item.path,
				sha: item.sha,
				size: item.size || 0,
				url: item.url,
				html_url: item.html_url || '',
				git_url: item.git_url || '',
				download_url: item.download_url || '',
				type: item.type as 'file' | 'dir',
				content: 'content' in item ? item.content : undefined,
				encoding: 'encoding' in item ? item.encoding : undefined
			}));
		} catch (error: any) {
			if (error.status === 404) {
				return [];
			}
			logger.error(`Failed to get repository contents for ${owner}/${repo}/${path}:`, error);
			throw error;
		}
	}

	/**
	 * Get file content with proper encoding handling
	 */
	async getFileContent(
		owner: string,
		repo: string,
		path: string,
		ref?: string
	): Promise<string | null> {
		try {
			// Check if this is a text file based on extension
			const isTextFile = this.isTextFile(path);

			if (!isTextFile) {
				// Skip binary files for template downloads
				logger.debug(`Skipping binary file: ${path}`);
				return null;
			}

			// First try to fetch directly from raw GitHub URL (more reliable)
			const branch = ref || 'main';
			const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;

			try {
				const response = await fetch(rawUrl);

				if (response.ok) {
					const text = await response.text();

					// Validate that we got proper text content (not binary garbage)
					if (this.isValidTextContent(text)) {
						return text;
					} else {
						logger.warn(`Content from raw URL appears to be binary for ${path}`);
					}
				}
			} catch (rawError) {
				logger.debug(`Raw fetch failed for ${path}, trying API:`, rawError);
			}

			// Fallback to GitHub API
			const { data } = await this.octokit.rest.repos.getContent({
				owner,
				repo,
				path,
				ref: branch
			});

			// Handle single file content
			if ('content' in data && data.type === 'file') {
				// Decode base64 content
				try {
					const buffer = Buffer.from(data.content, 'base64');
					const text = buffer.toString('utf-8');

					// Validate content
					if (this.isValidTextContent(text)) {
						return text;
					} else {
						logger.warn(`Decoded content appears to be binary for ${path}`);
						return null;
					}
				} catch (decodeError) {
					logger.warn(`Failed to decode file content for ${path}:`, decodeError);
					return null;
				}
			}

			return null;
		} catch (error: any) {
			if (error.status === 404) {
				return null;
			}
			logger.error(`Failed to get file content for ${owner}/${repo}/${path}:`, error);
			throw error;
		}
	}

	/**
	 * Validate that content is actually text and not binary garbage
	 */
	private isValidTextContent(content: string): boolean {
		// Check for null bytes (common in binary files)
		if (content.includes('\0')) {
			return false;
		}

		// Check for excessive non-printable characters
		const nonPrintableCount = (content.match(/[\x00-\x08\x0E-\x1F\x7F-\xFF]/g) || []).length;
		const nonPrintableRatio = nonPrintableCount / content.length;

		// If more than 10% of characters are non-printable, likely binary
		return nonPrintableRatio < 0.1;
	}

	/**
	 * Check if a file is a text file based on its extension
	 */
	private isTextFile(filePath: string): boolean {
		const extension = filePath.split('.').pop()?.toLowerCase() || '';
		const textExtensions = [
			// Web files
			'html',
			'htm',
			'css',
			'scss',
			'sass',
			'less',
			'js',
			'jsx',
			'ts',
			'tsx',
			'mjs',
			'cjs',
			'vue',
			'svelte',

			// Configuration files
			'json',
			'jsonc',
			'json5',
			'yml',
			'yaml',
			'toml',
			'ini',
			'conf',
			'config',
			'env',
			'example',

			// Documentation
			'md',
			'mdx',
			'markdown',
			'txt',
			'rst',

			// Code files
			'py',
			'java',
			'c',
			'cpp',
			'h',
			'hpp',
			'cs',
			'php',
			'rb',
			'go',
			'rs',
			'swift',
			'kt',

			// Build/Package files
			'xml',
			'gradle',
			'properties',
			'lock',
			'sum',

			// Git files
			'gitignore',
			'gitattributes',

			// Editor files
			'editorconfig',
			'prettierrc',
			'eslintrc',
			'nvmrc',
			'npmrc',
			'yarnrc'
		];

		// Files without extensions are often text (like Dockerfile, LICENSE, etc.)
		if (!extension) {
			const textFilenames = [
				'dockerfile',
				'license',
				'readme',
				'changelog',
				'makefile',
				'procfile',
				'rakefile',
				'gemfile',
				'requirements'
			];
			const filename = filePath.split('/').pop()?.toLowerCase() || '';
			return textFilenames.some((name) => filename === name || filename.startsWith(name));
		}

		return textExtensions.includes(extension);
	}

	/**
	 * Process template structure to handle common template subdirectory patterns
	 */
	private processTemplateStructure(files: Record<string, string>): Record<string, string> {
		const processedFiles: Record<string, string> = {};

		// Check if there's a template subdirectory structure
		const hasTemplateDir = Object.keys(files).some((path) => path.startsWith('template/'));
		const hasRootPackageJson = files['package.json'] !== undefined;

		if (hasTemplateDir && hasRootPackageJson) {
			// This is a template with subdirectory structure
			logger.info('Detected template subdirectory structure, extracting files...');

			// Keep important root-level files
			const rootFilesToKeep = [
				'package.json',
				'README.md',
				'readme.md',
				'LICENSE',
				'license',
				'LICENSE.md',
				'.gitignore',
				'.npmrc',
				'.yarnrc',
				'.nvmrc',
				'tsconfig.json',
				'jsconfig.json',
				'vite.config.js',
				'vite.config.ts',
				'next.config.js',
				'next.config.ts',
				'nuxt.config.js',
				'nuxt.config.ts',
				'svelte.config.js',
				'astro.config.js',
				'astro.config.ts'
			];

			// Add root-level files that should be kept
			for (const [path, content] of Object.entries(files)) {
				if (!path.includes('/') && rootFilesToKeep.includes(path)) {
					processedFiles[path] = content;
				}
			}

			// Extract files from template subdirectory and promote to root
			for (const [path, content] of Object.entries(files)) {
				if (path.startsWith('template/')) {
					const newPath = path.substring('template/'.length);
					if (newPath) {
						// Don't add empty paths
						processedFiles[newPath] = content;
					}
				}
			}
		} else if (hasTemplateDir && !hasRootPackageJson) {
			// Only template directory exists, extract everything from it
			logger.info('Extracting all files from template subdirectory...');

			for (const [path, content] of Object.entries(files)) {
				if (path.startsWith('template/')) {
					const newPath = path.substring('template/'.length);
					if (newPath) {
						processedFiles[newPath] = content;
					}
				} else {
					// Keep non-template files as they are
					processedFiles[path] = content;
				}
			}
		} else {
			// No template subdirectory, use files as they are
			return files;
		}

		// Check for other common subdirectory patterns
		const commonTemplateDirs = ['app-template', 'starter', 'scaffold', 'boilerplate'];
		for (const templateDirName of commonTemplateDirs) {
			const templateDirPrefix = templateDirName + '/';
			const hasThisTemplateDir = Object.keys(processedFiles).some((path) =>
				path.startsWith(templateDirPrefix)
			);

			if (hasThisTemplateDir) {
				logger.info(`Detected ${templateDirName} subdirectory, extracting files...`);

				const tempFiles: Record<string, string> = {};
				for (const [path, content] of Object.entries(processedFiles)) {
					if (path.startsWith(templateDirPrefix)) {
						const newPath = path.substring(templateDirPrefix.length);
						if (newPath) {
							tempFiles[newPath] = content;
						}
					} else {
						tempFiles[path] = content;
					}
				}
				return tempFiles;
			}
		}

		return processedFiles;
	}

	/**
	 * Get repository tree (recursive)
	 */
	async getTree(
		owner: string,
		repo: string,
		sha: string,
		recursive = true
	): Promise<GitHubTree | null> {
		try {
			const { data } = await this.octokit.rest.git.getTree({
				owner,
				repo,
				tree_sha: sha,
				recursive: recursive ? 'true' : undefined
			});

			return {
				sha: data.sha,
				url: data.url || '',
				tree: data.tree.map((item) => ({
					path: item.path!,
					mode: item.mode!,
					type: item.type as 'blob' | 'tree',
					sha: item.sha!,
					size: item.size,
					url: item.url!
				})),
				truncated: data.truncated
			};
		} catch (error) {
			logger.error(`Failed to get tree for ${owner}/${repo}/${sha}:`, error);
			return null;
		}
	}

	/**
	 * Search repositories
	 */
	async searchRepositories(
		query: string,
		options: {
			sort?: 'stars' | 'forks' | 'updated';
			order?: 'asc' | 'desc';
			perPage?: number;
			page?: number;
		} = {}
	): Promise<{ repositories: GitHubRepository[]; total: number }> {
		try {
			const { data } = await this.octokit.rest.search.repos({
				q: query,
				sort: options.sort,
				order: options.order,
				per_page: options.perPage || 30,
				page: options.page || 1
			});

			return {
				repositories: data.items.map((item) => ({
					id: item.id,
					name: item.name,
					full_name: item.full_name,
					description: item.description,
					html_url: item.html_url,
					clone_url: item.clone_url,
					default_branch: item.default_branch,
					topics: item.topics || [],
					language: item.language,
					stargazers_count: item.stargazers_count,
					forks_count: item.forks_count,
					created_at: item.created_at,
					updated_at: item.updated_at
				})),
				total: data.total_count
			};
		} catch (error) {
			logger.error(`Failed to search repositories with query "${query}":`, error);
			throw error;
		}
	}

	/**
	 * Download repository as zip
	 */
	async downloadRepository(owner: string, repo: string, ref?: string): Promise<ArrayBuffer> {
		try {
			const { url } = await this.octokit.rest.repos.downloadZipballArchive({
				owner,
				repo,
				ref: ref || 'main'
			});

			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`Failed to download repository: ${response.status}`);
			}

			return await response.arrayBuffer();
		} catch (error) {
			logger.error(`Failed to download repository ${owner}/${repo}:`, error);
			throw error;
		}
	}

	/**
	 * Get package.json content
	 */
	async getPackageJson(owner: string, repo: string, ref?: string): Promise<any | null> {
		try {
			const content = await this.getFileContent(owner, repo, 'package.json', ref);
			if (!content) {
				return null;
			}

			return JSON.parse(content);
		} catch (error) {
			logger.error(`Failed to get package.json for ${owner}/${repo}:`, error);
			return null;
		}
	}

	/**
	 * Get README content
	 */
	async getReadme(owner: string, repo: string, ref?: string): Promise<string | null> {
		try {
			// Try different README file names
			const readmeFiles = ['README.md', 'readme.md', 'README.txt', 'readme.txt', 'README'];

			for (const filename of readmeFiles) {
				const content = await this.getFileContent(owner, repo, filename, ref);
				if (content) {
					return content;
				}
			}

			return null;
		} catch (error) {
			logger.error(`Failed to get README for ${owner}/${repo}:`, error);
			return null;
		}
	}

	/**
	 * Check if repository has specific files
	 */
	async hasFiles(
		owner: string,
		repo: string,
		filenames: string[],
		ref?: string
	): Promise<Record<string, boolean>> {
		const result: Record<string, boolean> = {};

		try {
			const promises = filenames.map(async (filename) => {
				const content = await this.getFileContent(owner, repo, filename, ref);
				result[filename] = content !== null;
			});

			await Promise.all(promises);
			return result;
		} catch (error) {
			logger.error(`Failed to check files for ${owner}/${repo}:`, error);
			// Return all false if there's an error
			filenames.forEach((filename) => {
				result[filename] = false;
			});
			return result;
		}
	}

	/**
	 * Get repository languages
	 */
	async getLanguages(owner: string, repo: string): Promise<Record<string, number>> {
		try {
			const { data } = await this.octokit.rest.repos.listLanguages({
				owner,
				repo
			});

			return data;
		} catch (error) {
			logger.error(`Failed to get languages for ${owner}/${repo}:`, error);
			return {};
		}
	}

	/**
	 * Get rate limit information
	 */
	async getRateLimit(): Promise<RateLimitInfo> {
		try {
			const { data } = await this.octokit.rest.rateLimit.get();

			this.rateLimitInfo = {
				limit: data.rate.limit,
				remaining: data.rate.remaining,
				reset: data.rate.reset,
				used: data.rate.used
			};

			return this.rateLimitInfo;
		} catch (error) {
			logger.error('Failed to get rate limit info:', error);
			throw error;
		}
	}

	/**
	 * Check if rate limit allows for requests
	 */
	canMakeRequest(): boolean {
		if (!this.rateLimitInfo) {
			return true; // Assume we can make requests if we don't have rate limit info
		}

		return this.rateLimitInfo.remaining > 0;
	}

	/**
	 * Download all repository files as key-value pairs
	 */
	async downloadRepositoryFiles(
		owner: string,
		repo: string,
		ref?: string,
		pathFilter?: string
	): Promise<Record<string, string>> {
		try {
			// Get repository information to get default branch
			const repoInfo = await this.getRepository(owner, repo);
			if (!repoInfo) {
				throw new Error(`Repository not found: ${owner}/${repo}`);
			}

			const branch = ref || repoInfo.default_branch;

			// Get the repository tree
			const tree = await this.getTree(owner, repo, branch, true);
			if (!tree) {
				throw new Error(`Failed to get repository tree for ${owner}/${repo}`);
			}

			const files: Record<string, string> = {};
			const downloadPromises: Promise<void>[] = [];

			// Filter files (only download blobs, not trees, and apply path filter if provided)
			const filesToDownload = tree.tree.filter((item) => {
				if (item.type !== 'blob') return false;

				// Apply path filter if provided
				if (pathFilter) {
					// Add trailing slash to pathFilter if not present for proper directory filtering
					const filterWithSlash = pathFilter.endsWith('/') ? pathFilter : pathFilter + '/';
					// Include files that start with the filter path
					if (!item.path.startsWith(filterWithSlash) && item.path !== pathFilter) {
						return false;
					}
				}

				// Only include text files for templates
				if (!this.isTextFile(item.path)) {
					return false;
				}

				// Skip common files that shouldn't be included in templates
				const excludePatterns = [
					'.git/',
					'node_modules/',
					'build/',
					'dist/',
					'coverage/',
					'.next/',
					'.nuxt/',
					'.vscode/',
					'.idea/',
					'__pycache__/',
					'.DS_Store',
					'Thumbs.db',
					'*.log',
					'.env',
					'.env.local',
					'.env.production',
					'.env.development'
				];

				return !excludePatterns.some((pattern) => {
					if (pattern.endsWith('/')) {
						return item.path.startsWith(pattern);
					}
					if (pattern.includes('*')) {
						const regex = new RegExp(pattern.replace('*', '.*'));
						return regex.test(item.path);
					}
					return item.path === pattern || item.path.endsWith('/' + pattern);
				});
			});

			// Download files in batches to avoid rate limiting
			const batchSize = 10;
			for (let i = 0; i < filesToDownload.length; i += batchSize) {
				const batch = filesToDownload.slice(i, i + batchSize);

				const batchPromises = batch.map(async (item) => {
					try {
						const content = await this.getFileContent(owner, repo, item.path, branch);
						if (content !== null) {
							// Remove path filter prefix if it was applied
							let relativePath = item.path;
							if (pathFilter && item.path.startsWith(pathFilter)) {
								// Add trailing slash to pathFilter if not present
								const filterWithSlash = pathFilter.endsWith('/') ? pathFilter : pathFilter + '/';
								if (item.path.startsWith(filterWithSlash)) {
									relativePath = item.path.substring(filterWithSlash.length);
								} else if (item.path === pathFilter) {
									// Handle case where the file is exactly the pathFilter (shouldn't happen for directories)
									relativePath = item.path.substring(pathFilter.length);
								}
							}

							// Skip empty paths
							if (relativePath) {
								files[relativePath] = content;
							}
						}
					} catch (error) {
						logger.warn(`Failed to download file ${item.path}:`, error);
					}
				});

				await Promise.all(batchPromises);

				// Small delay between batches to be nice to GitHub API
				if (i + batchSize < filesToDownload.length) {
					await new Promise((resolve) => setTimeout(resolve, 100));
				}
			}

			// Post-process files to handle template subdirectory structures
			const processedFiles = this.processTemplateStructure(files);

			logger.info(`Downloaded ${Object.keys(processedFiles).length} files from ${owner}/${repo}`);
			return processedFiles;
		} catch (error) {
			logger.error(`Failed to download repository files from ${owner}/${repo}:`, error);
			throw error;
		}
	}

	/**
	 * Get time until rate limit reset
	 */
	getRateLimitResetTime(): Date | null {
		if (!this.rateLimitInfo) {
			return null;
		}

		return new Date(this.rateLimitInfo.reset * 1000);
	}

	/**
	 * Parse repository URL to extract owner and repo
	 */
	static parseRepositoryUrl(url: string): { owner: string; repo: string } | null {
		try {
			// Handle different GitHub URL formats
			const patterns = [
				/^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)(?:\.git)?(?:\/.*)?$/,
				/^git@github\.com:([^\/]+)\/([^\/]+)(?:\.git)?$/,
				/^([^\/]+)\/([^\/]+)$/
			];

			for (const pattern of patterns) {
				const match = url.match(pattern);
				if (match) {
					return {
						owner: match[1],
						repo: match[2].replace(/\.git$/, '')
					};
				}
			}

			return null;
		} catch (error) {
			logger.error(`Failed to parse repository URL: ${url}`, error);
			return null;
		}
	}
}

/**
 * Singleton GitHub API service instance
 */
export const gitHubApiService = new GitHubApiService();
