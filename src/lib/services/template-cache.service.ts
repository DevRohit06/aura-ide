/**
 * Template Cache Service
 * Service for caching template data and files with compression and TTL management
 */

import { templateConfig } from '$lib/config/template.config.js';
import type { ProjectTemplate as ProjectTemplateType } from '$lib/types/sandbox.js';
import { logger } from '$lib/utils/logger.js';

export interface CachedTemplate {
	template: ProjectTemplateType;
	files?: Record<string, string>;
	metadata: {
		cachedAt: Date;
		expiresAt: Date;
		lastAccessed: Date;
		accessCount: number;
		compressedSize?: number;
		originalSize?: number;
	};
}

export interface CacheStats {
	totalItems: number;
	totalSize: number;
	hitRate: number;
	oldestEntry: Date | null;
	newestEntry: Date | null;
	compressionRatio: number;
}

/**
 * Template Cache Service Class
 */
export class TemplateCacheService {
	private cache = new Map<string, CachedTemplate>();
	private hitCount = 0;
	private missCount = 0;
	private cleanupInterval: NodeJS.Timeout | null = null;

	constructor() {
		this.startCleanupTimer();
	}

	/**
	 * Get template from cache
	 */
	get(templateId: string): ProjectTemplateType | null {
		if (!templateConfig.cache.enabled) {
			return null;
		}

		const cached = this.cache.get(templateId);
		if (!cached) {
			this.missCount++;
			return null;
		}

		// Check if expired
		if (cached.metadata.expiresAt <= new Date()) {
			this.cache.delete(templateId);
			this.missCount++;
			return null;
		}

		// Update access metadata
		cached.metadata.lastAccessed = new Date();
		cached.metadata.accessCount++;
		this.hitCount++;

		return cached.template;
	}

	/**
	 * Store template in cache
	 */
	set(templateId: string, template: ProjectTemplateType, files?: Record<string, string>): void {
		if (!templateConfig.cache.enabled) {
			return;
		}

		const now = new Date();
		const expiresAt = new Date(now.getTime() + templateConfig.cache.ttlHours * 60 * 60 * 1000);

		let compressedSize: number | undefined;
		let originalSize: number | undefined;

		// Calculate sizes if files are provided
		if (files) {
			const filesJson = JSON.stringify(files);
			originalSize = Buffer.byteLength(filesJson, 'utf8');

			if (templateConfig.cache.compressionEnabled) {
				// Simulate compression (in a real implementation, you'd use actual compression)
				compressedSize = Math.floor(originalSize * 0.7); // Assume 30% compression
			}
		}

		const cachedTemplate: CachedTemplate = {
			template,
			files,
			metadata: {
				cachedAt: now,
				expiresAt,
				lastAccessed: now,
				accessCount: 0,
				compressedSize,
				originalSize
			}
		};

		this.cache.set(templateId, cachedTemplate);

		// Enforce cache size limits
		this.enforceSizeLimit();

		logger.debug(`Cached template: ${template.name} (${templateId})`);
	}

	/**
	 * Get template files from cache
	 */
	getFiles(templateId: string): Record<string, string> | null {
		if (!templateConfig.cache.enabled) {
			return null;
		}

		const cached = this.cache.get(templateId);
		if (!cached || cached.metadata.expiresAt <= new Date()) {
			return null;
		}

		// Update access metadata
		cached.metadata.lastAccessed = new Date();
		cached.metadata.accessCount++;

		return cached.files || null;
	}

	/**
	 * Store template files in cache
	 */
	setFiles(templateId: string, files: Record<string, string>): void {
		if (!templateConfig.cache.enabled) {
			return;
		}

		const cached = this.cache.get(templateId);
		if (!cached) {
			return;
		}

		const filesJson = JSON.stringify(files);
		const originalSize = Buffer.byteLength(filesJson, 'utf8');
		let compressedSize: number | undefined;

		if (templateConfig.cache.compressionEnabled) {
			// Simulate compression
			compressedSize = Math.floor(originalSize * 0.7);
		}

		cached.files = files;
		cached.metadata.originalSize = originalSize;
		cached.metadata.compressedSize = compressedSize;

		logger.debug(`Cached files for template: ${templateId}`);
	}

	/**
	 * Check if template exists in cache
	 */
	has(templateId: string): boolean {
		if (!templateConfig.cache.enabled) {
			return false;
		}

		const cached = this.cache.get(templateId);
		if (!cached) {
			return false;
		}

		// Check if expired
		if (cached.metadata.expiresAt <= new Date()) {
			this.cache.delete(templateId);
			return false;
		}

		return true;
	}

	/**
	 * Remove template from cache
	 */
	delete(templateId: string): boolean {
		return this.cache.delete(templateId);
	}

	/**
	 * Clear all cache entries
	 */
	clear(): void {
		this.cache.clear();
		this.hitCount = 0;
		this.missCount = 0;
		logger.info('Template cache cleared');
	}

	/**
	 * Get cache statistics
	 */
	getStats(): CacheStats {
		const entries = Array.from(this.cache.values());
		const totalRequests = this.hitCount + this.missCount;
		const hitRate = totalRequests > 0 ? this.hitCount / totalRequests : 0;

		const sizes = entries
			.filter((entry) => entry.metadata.originalSize)
			.map((entry) => ({
				original: entry.metadata.originalSize!,
				compressed: entry.metadata.compressedSize || entry.metadata.originalSize!
			}));

		const totalOriginalSize = sizes.reduce((sum, size) => sum + size.original, 0);
		const totalCompressedSize = sizes.reduce((sum, size) => sum + size.compressed, 0);
		const compressionRatio = totalOriginalSize > 0 ? totalCompressedSize / totalOriginalSize : 1;

		const timestamps = entries.map((entry) => entry.metadata.cachedAt);
		const oldestEntry =
			timestamps.length > 0 ? new Date(Math.min(...timestamps.map((t) => t.getTime()))) : null;
		const newestEntry =
			timestamps.length > 0 ? new Date(Math.max(...timestamps.map((t) => t.getTime()))) : null;

		return {
			totalItems: this.cache.size,
			totalSize: totalCompressedSize,
			hitRate,
			oldestEntry,
			newestEntry,
			compressionRatio
		};
	}

	/**
	 * Get cache entries by access frequency
	 */
	getMostAccessed(
		limit = 10
	): Array<{ templateId: string; template: ProjectTemplateType; accessCount: number }> {
		return Array.from(this.cache.entries())
			.map(([templateId, cached]) => ({
				templateId,
				template: cached.template,
				accessCount: cached.metadata.accessCount
			}))
			.sort((a, b) => b.accessCount - a.accessCount)
			.slice(0, limit);
	}

	/**
	 * Get cache entries by recency
	 */
	getMostRecent(
		limit = 10
	): Array<{ templateId: string; template: ProjectTemplateType; lastAccessed: Date }> {
		return Array.from(this.cache.entries())
			.map(([templateId, cached]) => ({
				templateId,
				template: cached.template,
				lastAccessed: cached.metadata.lastAccessed
			}))
			.sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime())
			.slice(0, limit);
	}

	/**
	 * Warm up cache with popular templates
	 */
	async warmUp(templates: ProjectTemplateType[]): Promise<void> {
		if (!templateConfig.cache.enabled) {
			return;
		}

		logger.info(`Warming up cache with ${templates.length} templates...`);

		for (const template of templates) {
			this.set(template._id.toString(), template);
		}

		logger.info('Cache warm-up completed');
	}

	/**
	 * Preload template files for popular templates
	 */
	async preloadFiles(
		templateFiles: Array<{ templateId: string; files: Record<string, string> }>
	): Promise<void> {
		if (!templateConfig.cache.enabled) {
			return;
		}

		logger.info(`Preloading files for ${templateFiles.length} templates...`);

		for (const { templateId, files } of templateFiles) {
			this.setFiles(templateId, files);
		}

		logger.info('File preloading completed');
	}

	/**
	 * Enforce cache size limit
	 */
	private enforceSizeLimit(): void {
		const maxSize = templateConfig.cache.maxSize;

		if (this.cache.size <= maxSize) {
			return;
		}

		// Remove least recently used entries
		const entries = Array.from(this.cache.entries()).sort(
			([, a], [, b]) => a.metadata.lastAccessed.getTime() - b.metadata.lastAccessed.getTime()
		);

		const toRemove = entries.slice(0, this.cache.size - maxSize);

		for (const [templateId] of toRemove) {
			this.cache.delete(templateId);
		}

		logger.debug(`Removed ${toRemove.length} entries to enforce cache size limit`);
	}

	/**
	 * Clean up expired entries
	 */
	private cleanupExpired(): void {
		const now = new Date();
		let removedCount = 0;

		for (const [templateId, cached] of this.cache.entries()) {
			if (cached.metadata.expiresAt <= now) {
				this.cache.delete(templateId);
				removedCount++;
			}
		}

		if (removedCount > 0) {
			logger.debug(`Cleaned up ${removedCount} expired cache entries`);
		}
	}

	/**
	 * Start periodic cleanup timer
	 */
	private startCleanupTimer(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
		}

		// Run cleanup every hour
		this.cleanupInterval = setInterval(
			() => {
				this.cleanupExpired();
			},
			60 * 60 * 1000
		);
	}

	/**
	 * Stop cleanup timer
	 */
	destroy(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = null;
		}
		this.clear();
	}
}

/**
 * Singleton template cache service instance
 */
export const templateCacheService = new TemplateCacheService();
