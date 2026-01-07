/**
 * Project Initialization Service
 * Handles complete project lifecycle:
 * 1. GitHub template cloning
 * 2. Sandbox creation (Daytona)
 * 3. Status tracking
 */

import type { Project } from '$lib/types/index.js';
import { logger } from '$lib/utils/logger.js';
import { nanoid } from 'nanoid';
import { DatabaseService } from './database.service.js';
import { GitHubApiService } from './github-api.service.js';

export interface ProjectInitializationOptions {
	name: string;
	templateId: string;
	framework: string;
	userId: string;
	description?: string;
	initialPrompt?: string; // What the user wants to build - passed to the agent
	sandboxProvider: 'daytona';
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
		daytonaConfig?: {
			memory?: string;
			cpu?: string;
			keepAlive?: boolean;
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
		provider: 'daytona';
		sandboxId: string;
		url?: string;
		status: string;
	};
}

export interface ProjectStatus {
	phase: 'initializing' | 'downloading' | 'creating-sandboxes' | 'ready' | 'error';
	progress: number; // 0-100
	message: string;
	details?: {
		filesDownloaded?: number;
		totalFiles?: number;
		sandboxStatus?: Record<string, string>;
	};
	error?: string;
}

/**
 * Project Initialization Service Class
 */
export class ProjectInitializationService {
	private githubService: GitHubApiService;
	private projectStatuses = new Map<string, ProjectStatus>();

	constructor() {
		this.githubService = new GitHubApiService();
	}

	/**
	 * Initialize a complete project with cloning and sandbox creation
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

			const files = await Promise.race([
				this.downloadTemplateFiles(options.templateId, options.framework, options.customRepo),
				new Promise<never>((_, reject) =>
					setTimeout(() => reject(new Error('Template download timeout')), 30000)
				)
			]);
			
			this.updateProjectStatus(projectId, {
				phase: 'downloading',
				progress: 40,
				message: `Downloaded ${files.length} files from template`,
				details: {
					filesDownloaded: files.length,
					totalFiles: files.length
				}
			});

			// Step 3: Create Daytona sandbox
			this.updateProjectStatus(projectId, {
				phase: 'creating-sandboxes',
				progress: 60,
				message: 'Creating Daytona workspace and cloning project...'
			});

			logger.info(`Creating Daytona workspace for project ${projectId}`);
			let sandboxResult;
			
			try {
				sandboxResult = await Promise.race([
					this.createDaytonaSandbox(projectId, options, files),
					new Promise<never>((_, reject) =>
						setTimeout(() => reject(new Error('Daytona sandbox creation timeout')), 60000)
					)
				]);
				logger.info(`Daytona workspace created:`, sandboxResult);
			} catch (err) {
				logger.error('Failed to create Daytona sandbox:', err);
				throw err;
			}

			// Step 4: Finalize project
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

			// If project created but initialization failed, mark as error
			try {
				await DatabaseService.updateProject(projectId, {
					status: 'error',
					updatedAt: new Date()
				});
			} catch (dbError) {
				logger.error('Failed to update project status to error:', dbError);
			}

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
	 * Update project initialization status
	 */
	private updateProjectStatus(projectId: string, status: ProjectStatus): void {
		this.projectStatuses.set(projectId, status);
		// In a real app, you might want to broadcast this via SSE or WebSocket
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
				initializationStarted: new Date().toISOString(),
				initialPrompt: options.initialPrompt?.trim()
			}
		};

		await DatabaseService.createProject(project);
		return project;
	}

	/**
	 * Download template files from GitHub
	 */
	private async downloadTemplateFiles(
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
			}

			// Download the template files from GitHub
			const files = await this.githubService.downloadRepositoryFiles(
				owner,
				repo,
				branch,
				path
			);

			if (!files || Object.keys(files).length === 0) {
				throw new Error(
					customRepo
						? `No files found in repository: ${owner}/${repo}`
						: `No files found in template: ${templateId}`
				);
			}

			// Convert files object to ProjectFile array format
			let projectFiles: ProjectFile[] = Object.entries(files).map(([path, content]) => ({
				path,
				content,
				size: content?.length || 0,
				sha: ''
			}));

			// Patch framework configuration files
			projectFiles = this.patchFrameworkConfigs(projectFiles, framework);

			return projectFiles;
		} catch (error) {
			logger.error('Failed to download template files:', error);
			throw error;
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
	 * Finalize project initialization
	 */
	private async finalizeProject(
		project: Project,
		result: {
			files: ProjectFile[];
			sandboxResult?: any;
		}
	): Promise<Project> {
		const updates: Partial<Project> = {
			status: 'ready',
			updatedAt: new Date(),
			metadata: {
				...project.metadata,
				initializationCompleted: new Date().toISOString(),
				fileCount: result.files.length,
				sandboxes: result.sandboxResult ? {
					[result.sandboxResult.provider]: {
						id: result.sandboxResult.sandboxId,
						url: result.sandboxResult.url,
						status: result.sandboxResult.status,
						createdAt: new Date().toISOString()
					}
				} : undefined
			}
		};

		if (result.sandboxResult) {
			updates.sandboxProvider = result.sandboxResult.provider;
			updates.sandboxId = result.sandboxResult.sandboxId;
		}

		return await DatabaseService.updateProject(project.id, updates) as Project;
	}

	/**
	 * Patch framework configuration files to ensure dev servers work with proxy
	 */
	private patchFrameworkConfigs(files: ProjectFile[], framework: string): ProjectFile[] {
		const patchedFiles = [...files];

		// Simple helper to replace or add content
		const ensureConfig = (content: string, search: RegExp | string, replace: string, append: string) => {
			if (content.match(search) || content.includes(search as string)) {
				return content.replace(search, replace);
			}
			// basic append logic (not robust but sufficient for simple configs)
			const lastBrace = content.lastIndexOf('}');
			if (lastBrace > -1) {
				return content.slice(0, lastBrace) + append + content.slice(lastBrace);
			}
			return content;
		};

		if (framework === 'astro' || framework?.includes('astro')) {
			const configIndex = patchedFiles.findIndex(f => f.path.includes('astro.config'));
			if (configIndex !== -1) {
				let content = patchedFiles[configIndex].content;
				// Ensure 0.0.0.0 host
				if (!content.includes('0.0.0.0')) {
					content = ensureConfig(
						content, 
						/server:\s*\{/, 
						`server: {\n\t\thost: '0.0.0.0',`, 
						`,\n\tserver: {\n\t\thost: '0.0.0.0',\n\t\tport: 4321\n\t}`
					);
					patchedFiles[configIndex].content = content;
				}
			}
		} else if (['react', 'vue', 'svelte', 'vite'].some(f => framework.includes(f))) {
			const configIndex = patchedFiles.findIndex(f => f.path.includes('vite.config'));
			if (configIndex !== -1) {
				let content = patchedFiles[configIndex].content;
				if (!content.includes('0.0.0.0')) {
					content = ensureConfig(
						content,
						/server:\s*\{/,
						`server: {\n\t\thost: '0.0.0.0',`,
						`,\n\tserver: {\n\t\thost: '0.0.0.0'\n\t}`
					);
					patchedFiles[configIndex].content = content;
				}
			}
		}

		return patchedFiles;
	}
}

export const projectInitializationService = new ProjectInitializationService();
