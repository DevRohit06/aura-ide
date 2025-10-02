import { browser } from '$app/environment';

export class FileLazyLoader {
	private static instance: FileLazyLoader;
	private cache = new Map<string, Promise<any>>();
	private loadingState = new Map<string, boolean>();

	static getInstance(): FileLazyLoader {
		if (!FileLazyLoader.instance) {
			FileLazyLoader.instance = new FileLazyLoader();
		}
		return FileLazyLoader.instance;
	}

	/**
	 * Load file content with caching and deduplication
	 */
	async loadFileContent(projectId: string, filePath: string): Promise<string | null> {
		if (!browser) return null;

		const cacheKey = `${projectId}:${filePath}`;

		// Return cached promise if exists
		if (this.cache.has(cacheKey)) {
			return this.cache.get(cacheKey);
		}

		// Create new load promise
		const loadPromise = this.fetchFileContent(projectId, filePath);
		this.cache.set(cacheKey, loadPromise);

		try {
			const result = await loadPromise;
			return result;
		} catch (error) {
			// Remove from cache on error so it can be retried
			this.cache.delete(cacheKey);
			throw error;
		}
	}

	/**
	 * Load files with content in batches
	 */
	async loadFilesWithContent(
		projectId: string,
		options: { fastMode?: boolean } = {}
	): Promise<any[]> {
		if (!browser) return [];

		const cacheKey = `files:${projectId}:${options.fastMode ? 'fast' : 'full'}`;

		if (this.cache.has(cacheKey)) {
			return this.cache.get(cacheKey);
		}

		const loadPromise = this.fetchFilesWithContent(projectId, options);
		this.cache.set(cacheKey, loadPromise);

		try {
			const result = await loadPromise;
			return result;
		} catch (error) {
			this.cache.delete(cacheKey);
			throw error;
		}
	}

	private async fetchFileContent(projectId: string, filePath: string): Promise<string | null> {
		try {
			const response = await fetch(
				`/api/projects/${projectId}/files/${encodeURIComponent(filePath)}`
			);

			if (!response.ok) {
				throw new Error(`Failed to load file: ${response.status}`);
			}

			const data = await response.json();
			return data.content || null;
		} catch (error) {
			console.error(`Failed to load file content for ${filePath}:`, error);
			throw error;
		}
	}

	private async fetchFilesWithContent(
		projectId: string,
		options: { fastMode?: boolean } = {}
	): Promise<any[]> {
		try {
			const params = new URLSearchParams();
			params.set('content', 'true');
			if (options.fastMode) {
				params.set('fast', 'true');
			}

			const response = await fetch(`/api/projects/${projectId}/files-lazy?${params}`);

			if (!response.ok) {
				throw new Error(`Failed to load files: ${response.status}`);
			}

			const data = await response.json();
			return data.files || [];
		} catch (error) {
			console.error('Failed to load files with content:', error);
			throw error;
		}
	}

	/**
	 * Check if file content is currently loading
	 */
	isLoading(projectId: string, filePath: string): boolean {
		const cacheKey = `${projectId}:${filePath}`;
		return this.loadingState.get(cacheKey) || false;
	}

	/**
	 * Clear cache for a specific project
	 */
	clearProjectCache(projectId: string): void {
		for (const [key] of this.cache) {
			if (key.startsWith(`${projectId}:`)) {
				this.cache.delete(key);
			}
		}
	}

	/**
	 * Clear all cache
	 */
	clearCache(): void {
		this.cache.clear();
		this.loadingState.clear();
	}
}

// Export singleton instance
export const fileLazyLoader = FileLazyLoader.getInstance();
