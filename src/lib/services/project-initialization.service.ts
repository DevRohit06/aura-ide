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
	sandboxProvider: 'daytona' | 'e2b'; // Required: choose sandbox provider
	customRepo?: {
		owner: string;
		repo: string;
		branch?: string;
		path?: string;
	};
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
	sandboxResult?: {
		provider: 'daytona' | 'e2b';
		sandboxId: string;
		url?: string;
		status: string;
		storage?: {
			key: string;
			url: string;
			size: number;
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
		currentFile?: {
			name: string;
			size: number;
			index: number;
		};
		recentFiles?: Array<{
			name: string;
			size: number;
			status: 'downloading' | 'uploaded' | 'complete';
		}>;
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
				options.customRepo
					? `🎯 Using custom repository: ${options.customRepo.owner}/${options.customRepo.repo}`
					: `📦 Using predefined template: ${options.templateId} for framework: ${options.framework}`
			);
			logger.info(`🔍 DEBUG: customRepo =`, JSON.stringify(options.customRepo, null, 2));
			logger.info(`🔍 DEBUG: templateId = ${options.templateId}, framework = ${options.framework}`);

			const files = await Promise.race([
				this.downloadTemplateFiles(
					projectId,
					options.templateId,
					options.framework,
					options.customRepo
				),
				new Promise<never>((_, reject) =>
					setTimeout(() => reject(new Error('Template download timeout')), 30000)
				)
			]);
			logger.info(
				`Downloaded ${files.length} files from ${options.customRepo ? 'custom repository' : 'template'}`
			);

			// Step 4: Create sandbox based on provider
			let sandboxResult;
			if (options.sandboxProvider === 'daytona') {
				this.updateProjectStatus(projectId, {
					phase: 'creating-sandboxes',
					progress: 80,
					message: 'Creating Daytona workspace and cloning project...'
				});

				logger.info(`Creating Daytona workspace for project ${projectId}`);
				sandboxResult = await Promise.race([
					this.createDaytonaSandbox(projectId, options, files),
					new Promise<never>((_, reject) =>
						setTimeout(() => reject(new Error('Daytona sandbox creation timeout')), 60000)
					)
				]);
				logger.info(`Daytona workspace created:`, sandboxResult);
			} else if (options.sandboxProvider === 'e2b') {
				// Step 4a: Upload to R2 storage (for E2B flow)
				logger.info(`Uploading ${files.length} files to R2 storage for E2B`);
				const storageResult = await Promise.race([
					this.uploadToR2Storage(projectId, files),
					new Promise<never>((_, reject) =>
						setTimeout(() => reject(new Error('R2 upload timeout')), 30000)
					)
				]);
				logger.info(`Upload completed: ${storageResult.key}`);

				// Step 4b: Create E2B sandbox
				this.updateProjectStatus(projectId, {
					phase: 'creating-sandboxes',
					progress: 80,
					message: 'Creating E2B sandbox environment...'
				});

				logger.info(`Creating E2B sandbox for project ${projectId}`);
				sandboxResult = await Promise.race([
					this.createE2BSandbox(projectId, options, files),
					new Promise<never>((_, reject) =>
						setTimeout(() => reject(new Error('E2B sandbox creation timeout')), 60000)
					)
				]);
				logger.info(`E2B sandbox created:`, sandboxResult);
			}

			// Step 5: Update project with final details
			logger.info(`Finalizing project ${projectId}`);
			const updatedProject = await this.finalizeProject(project, {
				files,
				sandboxResult
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
				sandboxResult
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
			sandboxProvider: options.sandboxProvider,
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
	 * Supports both predefined templates and custom GitHub repositories
	 */
	private async downloadTemplateFiles(
		projectId: string,
		templateId: string,
		framework: string,
		customRepo?: {
			owner: string;
			repo: string;
			branch?: string;
			path?: string;
		}
	): Promise<ProjectFile[]> {
		try {
			let owner: string;
			let repo: string;
			let branch: string | undefined;
			let path: string | undefined;

			// Use custom repository if provided
			if (customRepo) {
				owner = customRepo.owner;
				repo = customRepo.repo;
				branch = customRepo.branch;
				path = customRepo.path;
				logger.info(
					`🔷 CUSTOM REPO MODE: Downloading from GitHub: ${owner}/${repo}${branch ? `@${branch}` : ''}${path ? ` (path: ${path})` : ''}`
				);
			} else {
				// Get the GitHub template configuration
				const { getGitHubTemplate } = await import('$lib/config/template.config.js');
				const templateConfig = getGitHubTemplate(templateId);

				if (!templateConfig) {
					throw new Error(`Template not found: ${templateId}`);
				}

				owner = templateConfig.owner;
				repo = templateConfig.repo;
				path = templateConfig.path;
				logger.info(`Downloading template from GitHub: ${owner}/${repo}`);
			}

			// Download the template files from GitHub
			const files = await this.githubService.downloadRepositoryFiles(
				owner,
				repo,
				branch, // Use custom branch or default
				path // Use path filter if specified
			);

			if (!files || Object.keys(files).length === 0) {
				throw new Error(
					customRepo
						? `No files found in repository: ${owner}/${repo}`
						: `No files found in template: ${templateId}`
				);
			}

			// Convert files object to ProjectFile array format
			const projectFiles: ProjectFile[] = Object.entries(files).map(
				([filePath, content], index) => ({
					path: filePath,
					content,
					size: content?.length || 0,
					sha: ''
				})
			);

			// Track file downloads - update status with recent files
			const recentFiles = projectFiles.slice(-5).map((f) => ({
				name: f.path.split('/').pop() || f.path,
				size: f.size,
				status: 'complete' as const
			}));

			this.updateProjectStatus(projectId, {
				phase: 'downloading',
				progress: 40,
				message: `Downloaded ${projectFiles.length} files from template`,
				details: {
					filesDownloaded: projectFiles.length,
					totalFiles: projectFiles.length,
					recentFiles
				}
			});

			logger.info(
				`Successfully downloaded ${projectFiles.length} files from ${customRepo ? 'custom repository' : 'template'}`
			);
			return projectFiles;
		} catch (error) {
			logger.error(
				`Failed to download ${customRepo ? 'custom repository' : `template ${templateId}`}:`,
				error
			);
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

			// Track recent files being uploaded for UI display
			const recentFiles = files.slice(-5).map((f) => ({
				name: f.path.split('/').pop() || f.path,
				size: f.size,
				status: 'downloading' as const
			}));

			this.updateProjectStatus(projectId, {
				phase: 'uploading',
				progress: 55,
				message: `Uploading ${files.length} files to R2 storage...`,
				details: {
					totalFiles: files.length,
					uploadProgress: 50,
					recentFiles
				}
			});

			const result = await this.r2Service.uploadProject(projectId, fileMap);

			// Update to complete
			const completeFiles = files.slice(-5).map((f) => ({
				name: f.path.split('/').pop() || f.path,
				size: f.size,
				status: 'uploaded' as const
			}));

			this.updateProjectStatus(projectId, {
				phase: 'uploading',
				progress: 70,
				message: 'Files uploaded to cloud storage',
				details: {
					totalFiles: files.length,
					uploadProgress: 100,
					recentFiles: completeFiles
				}
			});

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
	 * Create Daytona sandbox and clone project directly into it
	 */
	private async createDaytonaSandbox(
		projectId: string,
		options: ProjectInitializationOptions,
		files: ProjectFile[]
	): Promise<{
		provider: 'daytona';
		sandboxId: string;
		url: string;
		status: string;
	}> {
		try {
			const { DaytonaService } = await import('./sandbox/daytona.service.js');
			const daytonaService = DaytonaService.getInstance();

			// Create Daytona workspace
			const daytonaSandbox = await daytonaService.createSandbox({
				projectId,
				options: {
					type: options.framework,
					memory: options.sandboxOptions?.daytonaConfig?.memory || '4GB',
					cpu: options.sandboxOptions?.daytonaConfig?.cpu || '2vcpu',
					keepAlive: options.sandboxOptions?.daytonaConfig?.keepAlive || true
				}
			});

			// Clone project directly into Daytona workspace
			await daytonaService.cloneProjectIntoSandbox(daytonaSandbox.id, options.templateId, files);

			return {
				provider: 'daytona',
				sandboxId: daytonaSandbox.id,
				url: daytonaSandbox.url,
				status: daytonaSandbox.status
			};
		} catch (error) {
			logger.error(`Daytona sandbox creation failed:`, error);
			throw error;
		}
	}

	/**
	 * Create E2B sandbox using R2 + E2B flow
	 */
	private async createE2BSandbox(
		projectId: string,
		options: ProjectInitializationOptions,
		files: ProjectFile[]
	): Promise<{
		provider: 'e2b';
		sandboxId: string;
		url: string;
		status: string;
		storage: {
			key: string;
			url: string;
			size: number;
		};
	}> {
		try {
			// Upload to R2 first
			const storageResult = await this.uploadToR2Storage(projectId, files);

			const { E2BService } = await import('./sandbox/e2b.service.js');
			const e2bService = new E2BService();

			const e2bSandbox = await e2bService.createSandbox({
				projectId,
				options: {
					template: options.sandboxOptions?.e2bConfig?.template || 'base',
					timeout: options.sandboxOptions?.e2bConfig?.timeout || 600,
					metadata: {
						type: options.framework,
						name: options.name
					}
				}
			});

			// Upload files to E2B
			await e2bService.uploadFiles(e2bSandbox.id, files);

			return {
				provider: 'e2b',
				sandboxId: e2bSandbox.id,
				url: e2bSandbox.url,
				status: e2bSandbox.status,
				storage: storageResult
			};
		} catch (error) {
			logger.error(`E2B sandbox creation failed:`, error);
			throw error;
		}
	}

	/**
	 * Finalize project with all initialization results
	 */
	private async finalizeProject(
		project: Project,
		results: {
			files: ProjectFile[];
			sandboxResult?: {
				provider: 'daytona' | 'e2b';
				sandboxId: string;
				url?: string;
				status: string;
				storage?: {
					key: string;
					url: string;
					size: number;
				};
			};
		}
	): Promise<Project> {
		const updatedProject: Project = {
			...project,
			status: 'ready',
			sandboxId: results.sandboxResult?.sandboxId,
			updatedAt: new Date(),
			metadata: {
				...project.metadata,
				fileCount: results.files.length,
				totalSize: results.files.reduce((sum, file) => sum + file.size, 0),
				sandboxResult: results.sandboxResult,
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

		// Also update the project status in the database for real-time polling
		DatabaseService.updateProject(projectId, {
			status: status.phase === 'ready' ? 'ready' : 'initializing',
			updatedAt: new Date(),
			metadata: {
				initializationStatus: status
			}
		}).catch((error) => {
			logger.error(`Failed to update project status in database:`, error);
		});
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
