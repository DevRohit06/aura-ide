/**
 * Daytona Sandbox Service
 * Adapted from the demo - provides Daytona workspace creation and management
 */

import { env } from '$env/dynamic/private';
import { logger } from '$lib/utils/logger.js';
import type { ProjectFile } from '../project-initialization.service.js';

export interface DaytonaSandboxConfig {
	projectId: string;
	options: {
		type: string;
		memory?: string;
		cpu?: string;
		keepAlive?: boolean;
		autoSleep?: boolean;
	};
}

export interface DaytonaSandbox {
	id: string;
	projectId: string;
	provider: 'daytona';
	status: 'running' | 'stopped' | 'error';
	url: string;
	real: boolean;
	daytonaSandbox?: any; // Store the actual SDK sandbox instance
	features: {
		subSecondStartup: boolean;
		lspSupport: boolean;
		gitIntegration: boolean;
		terminalAccess: boolean;
		vscodeAccess: boolean;
		jetbrainsAccess: boolean;
		keepAlive: boolean;
	};
	resources: {
		memory: string;
		cpu: string;
	};
	createdAt: string;
}

export class DaytonaService {
	private provider: 'daytona' = 'daytona';
	private isConfigured: boolean;
	private activeSandboxes = new Map<string, DaytonaSandbox>();
	private daytona: any = null;
	private initialized = false;
	private initPromise: Promise<void> | null = null;

	constructor() {
		this.isConfigured = !!env.DAYTONA_API_KEY;

		if (!this.isConfigured) {
			throw new Error(
				'Daytona API key not configured. Please set DAYTONA_API_KEY environment variable.'
			);
		}
	}

	private async initializeDaytonaSDK(): Promise<void> {
		if (this.initialized) return;

		if (this.initPromise) {
			return this.initPromise;
		}

		this.initPromise = (async () => {
			try {
				// Import Daytona SDK
				const { Daytona } = await import('@daytonaio/sdk');
				this.daytona = new Daytona({
					apiKey: env.DAYTONA_API_KEY
				});
				this.initialized = true;
				logger.info('✅ Daytona SDK initialized successfully');
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				logger.error(`❌ Failed to initialize Daytona SDK: ${errorMessage}`);
				throw new Error(
					`Failed to initialize Daytona SDK: ${errorMessage}. Make sure @daytonaio/sdk is installed.`
				);
			}
		})();

		return this.initPromise;
	}

	private async ensureInitialized(): Promise<void> {
		if (!this.initialized) {
			await this.initializeDaytonaSDK();
		}
	}

	async createSandbox(config: DaytonaSandboxConfig): Promise<DaytonaSandbox> {
		const { projectId, options } = config;

		await this.ensureInitialized();

		if (!this.daytona) {
			throw new Error('Daytona SDK not initialized. Please check configuration.');
		}

		try {
			logger.info(`🚀 Creating Daytona sandbox for project: ${projectId}`);

			// Create Daytona sandbox with timeout
			const sandbox = await Promise.race([
				this.daytona.create({
					language: this.mapProjectTypeToLanguage(options.type),
					metadata: {
						projectId,
						projectType: options.type,
						keepAlive: options.keepAlive || true
					}
				}),
				new Promise<never>((_, reject) =>
					setTimeout(
						() => reject(new Error('Daytona sandbox creation timeout after 45 seconds')),
						45000
					)
				)
			]);

			// Debug: Log the sandbox object structure
			logger.info('Daytona sandbox instance structure:', {
				sandboxId: sandbox.sandboxId || sandbox.id,
				properties: Object.keys(sandbox),
				methods: Object.getOwnPropertyNames(sandbox),
				hasFs: !!sandbox.fs,
				fsProperties: sandbox.fs ? Object.keys(sandbox.fs) : 'N/A',
				hasFiles: !!sandbox.files,
				filesProperties: sandbox.files ? Object.keys(sandbox.files) : 'N/A',
				hasWorkspace: !!sandbox.workspace,
				workspaceProperties: sandbox.workspace ? Object.keys(sandbox.workspace) : 'N/A'
			});

			const sandboxData: DaytonaSandbox = {
				id: sandbox.sandboxId || sandbox.id,
				projectId,
				provider: this.provider,
				status: 'running',
				url: `https://app.daytona.io/sandbox/${sandbox.sandboxId || sandbox.id}`,
				real: true,
				daytonaSandbox: sandbox, // Store the actual SDK sandbox instance
				features: {
					subSecondStartup: true,
					lspSupport: true,
					gitIntegration: true,
					terminalAccess: true,
					vscodeAccess: true,
					jetbrainsAccess: true,
					keepAlive: true
				},
				resources: {
					memory: options.memory || '4GB',
					cpu: options.cpu || '2vcpu'
				},
				createdAt: new Date().toISOString()
			};

			this.activeSandboxes.set(sandboxData.id, sandboxData);
			logger.info(`✅ Daytona sandbox created: ${sandboxData.id}`);

			return sandboxData;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			logger.error(`❌ Daytona sandbox creation failed: ${errorMessage}`);
			throw new Error(`Failed to create Daytona sandbox: ${errorMessage}`);
		}
	}

	async loadProjectFiles(
		sandboxId: string,
		storageKey: string,
		files: ProjectFile[]
	): Promise<{
		filesLoaded: number;
		loadTime: string;
		mock: boolean;
	}> {
		await this.ensureInitialized();

		const sandbox = this.activeSandboxes.get(sandboxId);
		if (!sandbox) {
			throw new Error(`Sandbox not found: ${sandboxId}`);
		}

		if (!sandbox.daytonaSandbox) {
			throw new Error(`Daytona sandbox instance not found for ${sandboxId}`);
		}

		try {
			logger.info(`📁 Loading ${files.length} files to Daytona sandbox: ${sandboxId}`);

			const startTime = Date.now();
			let uploadedCount = 0;
			const errors: string[] = [];

			// Upload files to Daytona sandbox using the correct SDK method
			for (const file of files) {
				try {
					// Try different methods to upload files
					if (sandbox.daytonaSandbox.fs && sandbox.daytonaSandbox.fs.uploadFile) {
						await sandbox.daytonaSandbox.fs.uploadFile(Buffer.from(file.content), file.path);
						uploadedCount++;
						logger.debug(`✅ Uploaded: ${file.path}`);
					} else if (sandbox.daytonaSandbox.writeFile) {
						await sandbox.daytonaSandbox.writeFile(file.path, file.content);
						uploadedCount++;
						logger.debug(`✅ Uploaded: ${file.path}`);
					} else if (sandbox.daytonaSandbox.files && sandbox.daytonaSandbox.files.write) {
						await sandbox.daytonaSandbox.files.write(file.path, file.content);
						uploadedCount++;
						logger.debug(`✅ Uploaded: ${file.path}`);
					} else {
						logger.warn(`File upload not supported by current Daytona SDK version`);
						logger.error(`Available methods on sandbox:`, {
							hasFs: !!sandbox.daytonaSandbox.fs,
							fsProps: sandbox.daytonaSandbox.fs ? Object.keys(sandbox.daytonaSandbox.fs) : [],
							hasFiles: !!sandbox.daytonaSandbox.files,
							filesProps: sandbox.daytonaSandbox.files
								? Object.keys(sandbox.daytonaSandbox.files)
								: [],
							hasWriteFile: !!sandbox.daytonaSandbox.writeFile,
							allMethods: Object.getOwnPropertyNames(sandbox.daytonaSandbox),
							allProps: Object.keys(sandbox.daytonaSandbox)
						});
						break;
					}
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : 'Unknown error';
					logger.warn(`Failed to upload ${file.path}: ${errorMessage}`);
					errors.push(`${file.path}: ${errorMessage}`);
				}
			}

			const loadTime = `${Date.now() - startTime}ms`;
			logger.info(
				`✅ Uploaded ${uploadedCount}/${files.length} files to Daytona sandbox in ${loadTime}`
			);

			if (errors.length > 0) {
				logger.warn(`File upload errors: ${errors.join(', ')}`);
			}

			return {
				filesLoaded: uploadedCount,
				loadTime,
				mock: false
			};
		} catch (error) {
			logger.error(`Failed to load files to Daytona sandbox:`, error);
			throw error;
		}
	}

	async getSandboxStatus(sandboxId: string): Promise<DaytonaSandbox | null> {
		return this.activeSandboxes.get(sandboxId) || null;
	}

	async executeCommand(
		sandboxId: string,
		command: string
	): Promise<{
		success: boolean;
		output: string;
		exitCode: number;
		executionTime: string;
	}> {
		await this.ensureInitialized();

		const sandbox = this.activeSandboxes.get(sandboxId);
		if (!sandbox) {
			throw new Error(`Sandbox not found: ${sandboxId}`);
		}

		if (!sandbox.daytonaSandbox) {
			throw new Error(`Daytona sandbox instance not found for ${sandboxId}`);
		}

		try {
			logger.info(`Executing command in Daytona sandbox ${sandboxId}: ${command}`);

			const startTime = Date.now();
			let result;

			// Try different methods based on what's available in the SDK
			if (sandbox.daytonaSandbox.process) {
				if (sandbox.daytonaSandbox.process.exec) {
					// Method 1: Direct exec
					result = await sandbox.daytonaSandbox.process.exec(command, {
						cwd: '/workspace',
						timeout: 30000
					});
				} else if (sandbox.daytonaSandbox.process.execute) {
					// Method 2: Execute method
					result = await sandbox.daytonaSandbox.process.execute(command, {
						workDir: '/workspace',
						timeout: 30000
					});
				} else if (sandbox.daytonaSandbox.process.run) {
					// Method 3: Run method
					result = await sandbox.daytonaSandbox.process.run(command, {
						workingDirectory: '/workspace',
						timeout: 30000
					});
				} else {
					throw new Error('Process execution not available in current SDK version');
				}
			} else {
				throw new Error('Process execution not available in current SDK version');
			}

			const executionTime = `${Date.now() - startTime}ms`;
			logger.info(`✅ Command executed successfully in ${executionTime}: ${command}`);

			return {
				success: (result.exitCode || result.exit_code) === 0,
				output: result.stdout || result.output || result.result || 'Command completed',
				exitCode: result.exitCode || result.exit_code || 0,
				executionTime
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			logger.error(`❌ Command execution failed in Daytona: ${errorMessage}`);
			throw new Error(`Failed to execute command: ${errorMessage}`);
		}
	}

	private mapProjectTypeToLanguage(projectType: string): string {
		const languageMap: Record<string, string> = {
			javascript: 'javascript',
			typescript: 'typescript',
			react: 'javascript',
			vue: 'javascript',
			svelte: 'javascript',
			sveltekit: 'javascript',
			nextjs: 'typescript',
			nuxt: 'javascript',
			python: 'python',
			go: 'go',
			rust: 'rust',
			java: 'java'
		};

		return languageMap[projectType] || 'javascript';
	}

	getStats(): {
		total: number;
		keepAlive: number;
	} {
		const sandboxes = Array.from(this.activeSandboxes.values());
		return {
			total: sandboxes.length,
			keepAlive: sandboxes.filter((s) => s.features.keepAlive).length
		};
	}

	/**
	 * Delete a Daytona workspace
	 */
	async deleteSandbox(workspaceId: string): Promise<void> {
		await this.ensureInitialized();

		try {
			if (!this.daytona) {
				throw new Error('Daytona SDK not initialized');
			}

			await this.daytona.deleteWorkspace({
				workspaceId
			});

			this.activeSandboxes.delete(workspaceId);
			logger.info(`Daytona workspace ${workspaceId} deleted successfully`);
		} catch (error) {
			logger.error('Failed to delete Daytona workspace:', error);
			throw new Error(
				`Failed to delete Daytona workspace: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	/**
	 * Get workspace status
	 */
	async getWorkspaceStatus(workspaceId: string): Promise<DaytonaSandbox['status']> {
		await this.ensureInitialized();

		try {
			if (!this.daytona) {
				throw new Error('Daytona SDK not initialized');
			}

			const workspace = await this.daytona.getWorkspace({ workspaceId });
			return workspace.status as DaytonaSandbox['status'];
		} catch (error) {
			logger.error('Failed to get Daytona workspace status:', error);
			return 'error';
		}
	}
}
