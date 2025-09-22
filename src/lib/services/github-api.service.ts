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
	 * Get file content
	 */
	async getFileContent(
		owner: string,
		repo: string,
		path: string,
		ref?: string
	): Promise<string | null> {
		try {
			const { data } = await this.octokit.rest.repos.getContent({
				owner,
				repo,
				path,
				ref
			});

			// Handle single file content
			if ('content' in data && data.type === 'file') {
				return Buffer.from(data.content, 'base64').toString('utf-8');
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
