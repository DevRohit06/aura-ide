/**
 * Project Initialization Service
 * Based on the demo sandbox integration flow - handles complete project lifecycle:
 * 1. GitHub template cloning
 * 2. R2 storage upload
 * 3. Sandbox creation (Daytona/E2B)
 * 4. File synchronization
 * 5. Status tracking
 */

import type { Project } from '$lib/types/index.js';
import { logger } from '$lib/utils/logger.js';
import { nanoid } from 'nanoid';
import { DatabaseService } from './database.service.js';
import { GitHubApiService } from './github-api.service.js';
import { R2StorageService } from './r2-storage.service.js';

export interface ProjectInitializationOptions {
	name: string;
	templateId: string;
	framework: string;
	userId: string;
	description?: string;
	configuration?: {
		typescript?: boolean;
		eslint?: boolean;
		prettier?: boolean;
		tailwindcss?: boolean;
		packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun';
		additionalDependencies?: string[];
	};
	sandboxOptions?: {
		createDaytona?: boolean;
		createE2B?: boolean;
		daytonaConfig?: {
			memory?: string;
			cpu?: string;
			keepAlive?: boolean;
		};
		e2bConfig?: {
			template?: string;
			timeout?: number;
		};
	};
}

export interface ProjectFile {
	path: string;
	content: string;
	size: number;
	sha?: string;
}

export interface ProjectInitializationResult {
	project: Project;
	files: ProjectFile[];
	storage: {
		key: string;
		url: string;
		size: number;
	};
	sandboxes?: {
		daytona?: {
			id: string;
			url: string;
			status: string;
		};
		e2b?: {
			id: string;
			url: string;
			status: string;
		};
	};
}

export interface ProjectStatus {
	phase: 'initializing' | 'downloading' | 'uploading' | 'creating-sandboxes' | 'ready' | 'error';
	progress: number; // 0-100
	message: string;
	details?: {
		filesDownloaded?: number;
		totalFiles?: number;
		uploadProgress?: number;
		sandboxStatus?: Record<string, string>;
	};
	error?: string;
}

/**
 * Project Initialization Service Class
 */
export class ProjectInitializationService {
	private r2Service: R2StorageService;
	private githubService: GitHubApiService;
	private projectStatuses = new Map<string, ProjectStatus>();

	constructor() {
		this.r2Service = new R2StorageService();
		this.githubService = new GitHubApiService();
	}

	/**
	 * Initialize a complete project with cloning, storage, and sandbox creation
	 */
	async initializeProject(
		options: ProjectInitializationOptions
	): Promise<ProjectInitializationResult> {
		const projectId = nanoid();

		try {
			logger.info(`Starting project initialization for ${projectId}`, options);

			// Update status: Initializing
			this.updateProjectStatus(projectId, {
				phase: 'initializing',
				progress: 0,
				message: 'Starting project initialization...'
			});

			// Step 1: Create project record
			logger.info(`Creating project record for ${projectId}`);
			const project = await this.createProjectRecord(projectId, options);
			logger.info(`Project record created: ${project.id}`);

			// Step 2: Download template files from GitHub
			this.updateProjectStatus(projectId, {
				phase: 'downloading',
				progress: 10,
				message: 'Downloading template files from GitHub...'
			});

			logger.info(
				`Downloading template: ${options.templateId} for framework: ${options.framework}`
			);
			const files = await Promise.race([
				this.downloadTemplateFiles(options.templateId, options.framework),
				new Promise<never>((_, reject) =>
					setTimeout(() => reject(new Error('Template download timeout')), 30000)
				)
			]);
			logger.info(`Downloaded ${files.length} files from template`);

			this.updateProjectStatus(projectId, {
				phase: 'downloading',
				progress: 40,
				message: `Downloaded ${files.length} files from template`,
				details: {
					filesDownloaded: files.length,
					totalFiles: files.length
				}
			});

			// Step 3: Upload to R2 storage
			this.updateProjectStatus(projectId, {
				phase: 'uploading',
				progress: 50,
				message: 'Uploading project files to cloud storage...'
			});

			logger.info(`Uploading ${files.length} files to R2 storage`);
			const storageResult = await Promise.race([
				this.uploadToR2Storage(projectId, files),
				new Promise<never>((_, reject) =>
					setTimeout(() => reject(new Error('R2 upload timeout')), 30000)
				)
			]);
			logger.info(`Upload completed: ${storageResult.key}`);

			this.updateProjectStatus(projectId, {
				phase: 'uploading',
				progress: 70,
				message: 'Files uploaded to cloud storage',
				details: {
					uploadProgress: 100
				}
			});

			// Step 4: Create sandboxes if requested
			let sandboxes;
			if (options.sandboxOptions?.createDaytona || options.sandboxOptions?.createE2B) {
				this.updateProjectStatus(projectId, {
					phase: 'creating-sandboxes',
					progress: 80,
					message: 'Creating sandbox environments...'
				});

				logger.info(`Creating sandboxes for project ${projectId}`);
				sandboxes = await Promise.race([
					this.createSandboxes(projectId, options, files),
					new Promise<never>((_, reject) =>
						setTimeout(() => reject(new Error('Sandbox creation timeout')), 60000)
					)
				]);
				logger.info(`Sandboxes created:`, sandboxes);
			}

			// Step 5: Update project with final details
			logger.info(`Finalizing project ${projectId}`);
			const updatedProject = await this.finalizeProject(project, {
				files,
				storage: storageResult,
				sandboxes
			});

			this.updateProjectStatus(projectId, {
				phase: 'ready',
				progress: 100,
				message: 'Project initialized successfully!'
			});

			logger.info(`Project ${projectId} initialized successfully`);

			return {
				project: updatedProject,
				files,
				storage: storageResult,
				sandboxes
			};
		} catch (error) {
			logger.error(`Project initialization failed for ${projectId}:`, error);

			this.updateProjectStatus(projectId, {
				phase: 'error',
				progress: 0,
				message: 'Project initialization failed',
				error: error instanceof Error ? error.message : 'Unknown error'
			});

			throw error;
		}
	}

	/**
	 * Get project initialization status
	 */
	getProjectStatus(projectId: string): ProjectStatus | null {
		return this.projectStatuses.get(projectId) || null;
	}

	/**
	 * Create initial project record in database
	 */
	private async createProjectRecord(
		projectId: string,
		options: ProjectInitializationOptions
	): Promise<Project> {
		const project: Project = {
			id: projectId,
			name: options.name.trim(),
			description: options.description?.trim() || '',
			ownerId: options.userId,
			framework: options.framework as any,
			status: 'initializing',
			configuration: {
				typescript: options.configuration?.typescript ?? false,
				eslint: options.configuration?.eslint ?? true,
				prettier: options.configuration?.prettier ?? true,
				tailwindcss: options.configuration?.tailwindcss ?? false,
				packageManager: options.configuration?.packageManager ?? 'npm',
				additionalDependencies: options.configuration?.additionalDependencies ?? []
			},
			createdAt: new Date(),
			updatedAt: new Date(),
			metadata: {
				templateId: options.templateId,
				initializationStarted: new Date().toISOString()
			}
		};

		await DatabaseService.createProject(project);
		return project;
	}

	/**
	 * Download template files from GitHub using GitHub API service
	 */
	private async downloadTemplateFiles(
		templateId: string,
		framework: string
	): Promise<ProjectFile[]> {
		try {
			// Get the GitHub template configuration
			const { getGitHubTemplate } = await import('$lib/config/template.config.js');
			const templateConfig = getGitHubTemplate(templateId);

			if (!templateConfig) {
				throw new Error(`Template not found: ${templateId}`);
			}

			logger.info(
				`Downloading template from GitHub: ${templateConfig.owner}/${templateConfig.repo}`
			);

			// Download the template files from GitHub
			const files = await this.githubService.downloadRepositoryFiles(
				templateConfig.owner,
				templateConfig.repo,
				undefined, // Use default branch
				templateConfig.path || undefined // Use path filter if specified
			);

			if (!files || Object.keys(files).length === 0) {
				throw new Error(`No files found in template: ${templateId}`);
			}

			// Convert files object to ProjectFile array format
			const projectFiles: ProjectFile[] = Object.entries(files).map(([path, content]) => ({
				path,
				content,
				size: content?.length || 0,
				sha: ''
			}));

			logger.info(
				`Successfully downloaded ${projectFiles.length} files from template ${templateId}`
			);
			return projectFiles;
		} catch (error) {
			logger.error(`Failed to download template ${templateId}:`, error);
			throw new Error(
				`Template download failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	/**
	 * Upload project files to R2 storage
	 */
	private async uploadToR2Storage(
		projectId: string,
		files: ProjectFile[]
	): Promise<{
		key: string;
		url: string;
		size: number;
	}> {
		try {
			// Convert ProjectFile[] to Record<string, string> format required by R2Service
			const fileMap: Record<string, string> = {};
			for (const file of files) {
				fileMap[file.path] = file.content;
			}

			const result = await this.r2Service.uploadProject(projectId, fileMap);

			return {
				key: result.storage_key,
				url: `https://storage.aura-ide.com/${result.storage_key}`,
				size: result.total_size_bytes
			};
		} catch (error) {
			logger.error(`R2 upload failed for project ${projectId}:`, error);
			throw new Error(
				`Storage upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	/**
	 * Create sandbox environments (Daytona/E2B)
	 */
	private async createSandboxes(
		projectId: string,
		options: ProjectInitializationOptions,
		files: ProjectFile[]
	): Promise<{
		daytona?: { id: string; url: string; status: string };
		e2b?: { id: string; url: string; status: string };
	}> {
		const sandboxes: any = {};

		try {
			// Create Daytona sandbox if requested
			if (options.sandboxOptions?.createDaytona) {
				try {
					const { DaytonaService } = await import('./sandbox/daytona.service.js');
					const daytonaService = new DaytonaService();

					const daytonaSandbox = await daytonaService.createSandbox({
						projectId,
						options: {
							type: options.framework,
							memory: options.sandboxOptions.daytonaConfig?.memory || '4GB',
							cpu: options.sandboxOptions.daytonaConfig?.cpu || '2vcpu',
							keepAlive: options.sandboxOptions.daytonaConfig?.keepAlive || true
						}
					});

					// Upload files to Daytona
					await daytonaService.loadProjectFiles(daytonaSandbox.id, `projects/${projectId}`, files);

					sandboxes.daytona = {
						id: daytonaSandbox.id,
						url: daytonaSandbox.url,
						status: daytonaSandbox.status
					};

					logger.info(`Daytona sandbox created: ${daytonaSandbox.id}`);
				} catch (error) {
					logger.error(`Daytona sandbox creation failed:`, error);
					// Continue with other sandboxes
				}
			}

			// Create E2B sandbox if requested
			if (options.sandboxOptions?.createE2B) {
				try {
					const { E2BService } = await import('./sandbox/e2b.service.js');
					const e2bService = new E2BService();

					const e2bSandbox = await e2bService.createSandbox({
						projectId,
						options: {
							template: options.sandboxOptions.e2bConfig?.template || 'base',
							timeout: options.sandboxOptions.e2bConfig?.timeout || 600,
							metadata: {
								type: options.framework,
								name: options.name
							}
						}
					});

					// Upload files to E2B
					await e2bService.uploadFiles(e2bSandbox.id, files);

					sandboxes.e2b = {
						id: e2bSandbox.id,
						url: e2bSandbox.url,
						status: e2bSandbox.status
					};

					logger.info(`E2B sandbox created: ${e2bSandbox.id}`);
				} catch (error) {
					logger.error(`E2B sandbox creation failed:`, error);
					// Continue anyway
				}
			}

			return sandboxes;
		} catch (error) {
			logger.error(`Sandbox creation failed for project ${projectId}:`, error);
			// Return what we have, even if partial
			return sandboxes;
		}
	}

	/**
	 * Finalize project with all initialization results
	 */
	private async finalizeProject(
		project: Project,
		results: {
			files: ProjectFile[];
			storage: { key: string; url: string; size: number };
			sandboxes?: any;
		}
	): Promise<Project> {
		const updatedProject: Project = {
			...project,
			status: 'ready',
			updatedAt: new Date(),
			metadata: {
				...project.metadata,
				fileCount: results.files.length,
				totalSize: results.files.reduce((sum, file) => sum + file.size, 0),
				storageKey: results.storage.key,
				storageUrl: results.storage.url,
				storageSize: results.storage.size,
				sandboxes: results.sandboxes,
				initializationCompleted: new Date().toISOString()
			}
		};

		await DatabaseService.updateProject(project.id, updatedProject);
		return updatedProject;
	}

	/**
	 * Update project status
	 */
	private updateProjectStatus(projectId: string, status: ProjectStatus): void {
		this.projectStatuses.set(projectId, status);
		logger.info(
			`Project ${projectId} status: ${status.phase} (${status.progress}%) - ${status.message}`
		);
	}

	/**
	 * Cleanup project status after completion or error
	 */
	cleanupProjectStatus(projectId: string): void {
		this.projectStatuses.delete(projectId);
	}

	/**
	 * Get all active project statuses
	 */
	getAllProjectStatuses(): Map<string, ProjectStatus> {
		return new Map(this.projectStatuses);
	}
}

// Export singleton instance
export const projectInitializationService = new ProjectInitializationService();
