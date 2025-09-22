/**
 * Template Service
 * Service for managing project templates with StackBlitz integration and local caching
 */

import {
	stackblitzTemplates,
	templateCategories,
	templateConfig
} from '$lib/config/template.config.js';
import { ProjectTemplateModel } from '$lib/models/ProjectTemplate.js';
import type {
	ProjectTemplate as ProjectTemplateType,
	TemplateDependency
} from '$lib/types/sandbox.js';
import { logger } from '$lib/utils/logger.js';

export interface StackBlitzTemplate {
	id: string;
	title: string;
	description: string;
	tags: string[];
	dependencies: Record<string, string>;
	devDependencies?: Record<string, string>;
	files: Record<string, string>;
}

export interface StackBlitzListResponse {
	templates: StackBlitzTemplate[];
	total: number;
	page: number;
}

export interface TemplateSearchOptions {
	category?: string;
	tags?: string[];
	search?: string;
	limit?: number;
	offset?: number;
	sortBy?: 'popularity' | 'name' | 'created_at' | 'updated_at';
	sortOrder?: 'asc' | 'desc';
}

export interface TemplateCache {
	template: ProjectTemplateType;
	cachedAt: Date;
	expiresAt: Date;
}

/**
 * Template Service Class
 */
export class TemplateService {
	private cache = new Map<string, TemplateCache>();
	private syncInProgress = false;
	private lastSync: Date | null = null;

	/**
	 * Search templates with various filters
	 */
	async searchTemplates(options: TemplateSearchOptions = {}): Promise<{
		templates: ProjectTemplateType[];
		total: number;
		page: number;
		totalPages: number;
	}> {
		try {
			const {
				category,
				tags = [],
				search,
				limit = 20,
				offset = 0,
				sortBy = 'popularity',
				sortOrder = 'desc'
			} = options;

			// Build search filters
			const filters: any = { is_active: true };

			if (category) {
				filters.category = category;
			}

			if (tags.length > 0) {
				filters.tags = { $in: tags };
			}

			if (search) {
				filters.$or = [
					{ name: { $regex: search, $options: 'i' } },
					{ description: { $regex: search, $options: 'i' } },
					{ tags: { $regex: search, $options: 'i' } }
				];
			}

			// Execute search
			const result = await ProjectTemplateModel.list({
				category,
				search,
				is_active: true,
				limit,
				offset,
				sort_by: sortBy === 'popularity' ? 'popularity_score' : (sortBy as any),
				sort_order: sortOrder
			});

			const page = Math.floor(offset / limit) + 1;
			const totalPages = Math.ceil(result.total / limit);

			return {
				templates: result.templates,
				total: result.total,
				page,
				totalPages
			};
		} catch (error) {
			logger.error('Failed to search templates:', error);
			throw new Error(
				`Template search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	/**
	 * Get template by ID with caching
	 */
	async getTemplate(templateId: string): Promise<ProjectTemplateType | null> {
		try {
			// Check cache first
			const cached = this.cache.get(templateId);
			if (cached && cached.expiresAt > new Date()) {
				return cached.template;
			}

			// Fetch from database
			const template = await ProjectTemplateModel.findById(templateId);
			if (template) {
				this.cacheTemplate(template);
			}

			return template;
		} catch (error) {
			logger.error(`Failed to get template ${templateId}:`, error);
			throw new Error(
				`Failed to fetch template: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	/**
	 * Get popular templates by category
	 */
	async getPopularTemplates(category?: string, limit = 10): Promise<ProjectTemplateType[]> {
		try {
			const filters: any = { is_active: true };
			if (category) {
				filters.category = category;
			}

			const result = await ProjectTemplateModel.list({
				category,
				is_active: true,
				limit,
				sort_by: 'popularity_score',
				sort_order: 'desc'
			});

			return result.templates;
		} catch (error) {
			logger.error('Failed to get popular templates:', error);
			return [];
		}
	}

	/**
	 * Get templates by framework
	 */
	async getTemplatesByFramework(framework: string): Promise<ProjectTemplateType[]> {
		try {
			// Map framework to category if needed
			let category = framework;
			for (const [cat, frameworks] of Object.entries(templateCategories)) {
				if ((frameworks as readonly string[]).includes(framework)) {
					category = cat;
					break;
				}
			}

			return this.searchTemplates({
				category,
				tags: [framework],
				limit: 50
			}).then((result) => result.templates);
		} catch (error) {
			logger.error(`Failed to get templates for framework ${framework}:`, error);
			return [];
		}
	}

	/**
	 * Sync templates from StackBlitz
	 */
	async syncFromStackBlitz(): Promise<{
		synced: number;
		updated: number;
		errors: string[];
	}> {
		if (this.syncInProgress) {
			throw new Error('Template sync already in progress');
		}

		this.syncInProgress = true;
		const errors: string[] = [];
		let synced = 0;
		let updated = 0;

		try {
			logger.info('Starting StackBlitz template sync...');

			// Fetch templates for each framework
			const frameworks = Object.keys(stackblitzTemplates);
			const batchSize = templateConfig.stackblitz.maxConcurrentDownloads;

			for (let i = 0; i < frameworks.length; i += batchSize) {
				const batch = frameworks.slice(i, i + batchSize);
				const promises = batch.map((framework) => this.syncFrameworkTemplates(framework));

				const results = await Promise.allSettled(promises);

				results.forEach((result, index) => {
					if (result.status === 'fulfilled') {
						synced += result.value.synced;
						updated += result.value.updated;
					} else {
						errors.push(`Failed to sync ${batch[index]}: ${result.reason}`);
					}
				});
			}

			this.lastSync = new Date();
			logger.info(
				`Template sync completed: ${synced} synced, ${updated} updated, ${errors.length} errors`
			);

			return { synced, updated, errors };
		} catch (error) {
			logger.error('Template sync failed:', error);
			throw error;
		} finally {
			this.syncInProgress = false;
		}
	}

	/**
	 * Sync templates for a specific framework
	 */
	private async syncFrameworkTemplates(framework: string): Promise<{
		synced: number;
		updated: number;
	}> {
		try {
			const stackblitzId = stackblitzTemplates[framework as keyof typeof stackblitzTemplates];
			if (!stackblitzId) {
				throw new Error(`No StackBlitz mapping for framework: ${framework}`);
			}

			// Fetch template data from StackBlitz API
			const templateData = await this.fetchStackBlitzTemplate(stackblitzId);
			if (!templateData) {
				throw new Error(`Failed to fetch template data for ${framework}`);
			}

			// Check if template exists in database
			const existingTemplate = await ProjectTemplateModel.findByStackBlitzPath(stackblitzId);

			if (existingTemplate) {
				// Update existing template
				await this.updateTemplate(existingTemplate._id.toString(), templateData);
				return { synced: 0, updated: 1 };
			} else {
				// Create new template
				await this.createTemplate(templateData, framework);
				return { synced: 1, updated: 0 };
			}
		} catch (error) {
			logger.error(`Failed to sync framework ${framework}:`, error);
			throw error;
		}
	}

	/**
	 * Fetch template data from StackBlitz API
	 */
	private async fetchStackBlitzTemplate(stackblitzId: string): Promise<StackBlitzTemplate | null> {
		try {
			const url = `${templateConfig.stackblitz.apiBaseUrl}/projects/${stackblitzId}`;
			const response = await fetch(url, {
				headers: {
					Accept: 'application/json',
					'User-Agent': 'Aura-IDE-Template-Sync'
				}
			});

			if (!response.ok) {
				if (response.status === 404) {
					logger.warn(`StackBlitz template not found: ${stackblitzId}`);
					return null;
				}
				throw new Error(`StackBlitz API error: ${response.status}`);
			}

			const data = await response.json();
			return this.transformStackBlitzData(data);
		} catch (error) {
			logger.error(`Failed to fetch StackBlitz template ${stackblitzId}:`, error);
			return null;
		}
	}

	/**
	 * Transform StackBlitz API response to our template format
	 */
	private transformStackBlitzData(data: any): StackBlitzTemplate {
		return {
			id: data.id || '',
			title: data.title || '',
			description: data.description || '',
			tags: data.tags || [],
			dependencies: data.dependencies || {},
			devDependencies: data.devDependencies || {},
			files: data.files || {}
		};
	}

	/**
	 * Create new template from StackBlitz data
	 */
	private async createTemplate(templateData: StackBlitzTemplate, framework: string): Promise<void> {
		try {
			const dependencies = this.extractDependencies(templateData);
			const category = this.categorizeTemplate(framework);

			await ProjectTemplateModel.create({
				name: templateData.title,
				type: framework,
				description: templateData.description,
				stackblitz_path: templateData.id,
				category,
				tags: [framework, ...templateData.tags],
				is_active: true,
				file_count: Object.keys(templateData.files).length,
				dependencies,
				popularity_score: 0
			});

			logger.debug(`Created template: ${templateData.title} (${framework})`);
		} catch (error) {
			logger.error(`Failed to create template for ${framework}:`, error);
			throw error;
		}
	}

	/**
	 * Update existing template with new data
	 */
	private async updateTemplate(
		templateId: string,
		templateData: StackBlitzTemplate
	): Promise<void> {
		try {
			const dependencies = this.extractDependencies(templateData);

			await ProjectTemplateModel.update(templateId, {
				description: templateData.description,
				tags: templateData.tags,
				file_count: Object.keys(templateData.files).length,
				dependencies
			});

			// Remove from cache to force refresh
			this.cache.delete(templateId);

			logger.debug(`Updated template: ${templateData.title}`);
		} catch (error) {
			logger.error(`Failed to update template ${templateId}:`, error);
			throw error;
		}
	}

	/**
	 * Extract dependencies from StackBlitz template data
	 */
	private extractDependencies(templateData: StackBlitzTemplate): TemplateDependency[] {
		const dependencies: TemplateDependency[] = [];

		// Add runtime dependencies
		Object.entries(templateData.dependencies || {}).forEach(([name, version]) => {
			dependencies.push({
				dependency_name: name,
				dependency_version: version,
				dependency_type: 'runtime',
				is_optional: false
			} as TemplateDependency);
		});

		// Add dev dependencies
		Object.entries(templateData.devDependencies || {}).forEach(([name, version]) => {
			dependencies.push({
				dependency_name: name,
				dependency_version: version,
				dependency_type: 'dev',
				is_optional: true
			} as TemplateDependency);
		});

		return dependencies;
	}

	/**
	 * Categorize template based on framework
	 */
	private categorizeTemplate(framework: string): string {
		for (const [category, frameworks] of Object.entries(templateCategories)) {
			if ((frameworks as readonly string[]).includes(framework)) {
				return category;
			}
		}
		return 'other';
	}

	/**
	 * Cache template for faster access
	 */
	private cacheTemplate(template: ProjectTemplateType): void {
		if (!templateConfig.cache.enabled) return;

		const now = new Date();
		const expiresAt = new Date(now.getTime() + templateConfig.cache.ttlHours * 60 * 60 * 1000);

		this.cache.set(template._id.toString(), {
			template,
			cachedAt: now,
			expiresAt
		});

		// Clean up expired cache entries
		this.cleanupCache();
	}

	/**
	 * Clean up expired cache entries
	 */
	private cleanupCache(): void {
		const now = new Date();
		const maxSize = templateConfig.cache.maxSize;

		// Remove expired entries
		for (const [key, cached] of this.cache.entries()) {
			if (cached.expiresAt <= now) {
				this.cache.delete(key);
			}
		}

		// Remove oldest entries if cache is too large
		if (this.cache.size > maxSize) {
			const entries = Array.from(this.cache.entries()).sort(
				([, a], [, b]) => a.cachedAt.getTime() - b.cachedAt.getTime()
			);

			const toRemove = entries.slice(0, this.cache.size - maxSize);
			toRemove.forEach(([key]) => this.cache.delete(key));
		}
	}

	/**
	 * Clear template cache
	 */
	clearCache(): void {
		this.cache.clear();
		logger.info('Template cache cleared');
	}

	/**
	 * Get cache statistics
	 */
	getCacheStats(): {
		size: number;
		maxSize: number;
		hitRate: number;
		oldestEntry: Date | null;
	} {
		const entries = Array.from(this.cache.values());
		const oldestEntry =
			entries.length > 0
				? entries.reduce(
						(oldest, entry) => (entry.cachedAt < oldest ? entry.cachedAt : oldest),
						entries[0].cachedAt
					)
				: null;

		return {
			size: this.cache.size,
			maxSize: templateConfig.cache.maxSize,
			hitRate: 0, // TODO: Implement hit rate tracking
			oldestEntry
		};
	}

	/**
	 * Check if sync is needed
	 */
	needsSync(): boolean {
		if (!this.lastSync) return true;

		const syncInterval = templateConfig.cache.ttlHours * 60 * 60 * 1000; // Convert to milliseconds
		const timeSinceLastSync = Date.now() - this.lastSync.getTime();

		return timeSinceLastSync > syncInterval;
	}

	/**
	 * Get sync status
	 */
	getSyncStatus(): {
		inProgress: boolean;
		lastSync: Date | null;
		needsSync: boolean;
	} {
		return {
			inProgress: this.syncInProgress,
			lastSync: this.lastSync,
			needsSync: this.needsSync()
		};
	}
}

/**
 * Singleton template service instance
 */
export const templateService = new TemplateService();
