/**
 * Daytona Sandbox Service
 * Adapted from the demo - provides Daytona workspace creation and management
 */

import { env } from '$env/dynamic/private';
import type { Directory, File, FileSystemItem } from '$lib/types/files';
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
	private static instance: DaytonaService | null = null;
	private static instanceId: string = Math.random().toString(36).substr(2, 9);
	private provider: 'daytona' = 'daytona';
	private isConfigured: boolean;
	private activeSandboxes = new Map<string, DaytonaSandbox>();
	private daytona: any = null;
	private initialized = false;
	private initPromise: Promise<void> | null = null;

	constructor() {
		this.isConfigured = !!env.DAYTONA_API_KEY;
		logger.info(
			`🏗️ DaytonaService constructor called, instance ID: ${DaytonaService.instanceId}, configured: ${this.isConfigured}`
		);

		if (!this.isConfigured) {
			throw new Error(
				'Daytona API key not configured. Please set DAYTONA_API_KEY environment variable.'
			);
		}
	}

	static getInstance(): DaytonaService {
		if (!this.instance) {
			logger.info(`🆕 Creating new DaytonaService instance, ID: ${this.instanceId}`);
			this.instance = new DaytonaService();
		} else {
			logger.info(`♻️ Reusing existing DaytonaService instance, ID: ${this.instanceId}`);
		}
		return this.instance;
	}

	private async initializeDaytonaSDK(): Promise<void> {
		if (this.initialized) return;

		if (this.initPromise) {
			return this.initPromise;
		}

		this.initPromise = (async () => {
			try {
				logger.info(`🔄 Initializing Daytona SDK for instance ${DaytonaService.instanceId}`);
				// Import Daytona SDK
				const { Daytona } = await import('@daytonaio/sdk');
				this.daytona = new Daytona({
					apiKey: env.DAYTONA_API_KEY
				});
				this.initialized = true;
				logger.info(
					`✅ Daytona SDK initialized successfully for instance ${DaytonaService.instanceId}`
				);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				logger.error(
					`❌ Failed to initialize Daytona SDK for instance ${DaytonaService.instanceId}: ${errorMessage}`
				);
				throw new Error(
					`Failed to initialize Daytona SDK: ${errorMessage}. Make sure @daytonaio/sdk is installed.`
				);
			}
		})();

		return this.initPromise;
	}

	private async ensureInitialized(): Promise<void> {
		if (!this.initialized) {
			logger.info(`🔄 Initializing DaytonaService instance ${DaytonaService.instanceId}`);
			await this.initializeDaytonaSDK();
			logger.info(`✅ DaytonaService instance ${DaytonaService.instanceId} initialized`);
		} else {
			logger.info(`♻️ DaytonaService instance ${DaytonaService.instanceId} already initialized`);
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
			logger.info(`✅ Daytona sandbox created and stored: ${sandboxData.id}`);
			logger.info(`📊 Active sandboxes after creation:`, Array.from(this.activeSandboxes.keys()));

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

	/**
	 * Retrieve an existing sandbox from Daytona API if it's not in memory
	 */
	async retrieveExistingSandbox(sandboxId: string): Promise<DaytonaSandbox | undefined> {
		try {
			await this.ensureInitialized();

			logger.info(`🔍 Retrieving existing sandbox ${sandboxId} using Daytona SDK`);

			// Try to get the sandbox directly using the SDK
			const daytonaSandbox = await this.daytona.get(sandboxId);

			if (!daytonaSandbox) {
				logger.warn(`Sandbox ${sandboxId} not found via Daytona SDK get()`);
				return undefined;
			}

			// Create a proper sandbox object with the SDK instance
			const sandboxData: DaytonaSandbox = {
				id: sandboxId,
				projectId: 'unknown', // We don't know the project ID from the SDK
				provider: this.provider,
				status: 'running', // Assume it's running if we can get it
				url: `https://app.daytona.io/sandbox/${sandboxId}`,
				real: true,
				daytonaSandbox: daytonaSandbox, // Store the actual SDK instance
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
					memory: '4GB',
					cpu: '2vcpu'
				},
				createdAt: new Date().toISOString()
			};

			logger.info(`✅ Retrieved existing Daytona sandbox ${sandboxId} with SDK instance`);
			return sandboxData;
		} catch (error) {
			logger.error(`Failed to retrieve existing sandbox ${sandboxId} via SDK:`, error);
			return undefined;
		}
	}

	async listSandboxes(): Promise<DaytonaSandbox[]> {
		try {
			await this.ensureInitialized();

			logger.info(`📋 Listing all Daytona sandboxes using SDK`);

			// Get all sandboxes from Daytona
			const daytonaSandboxes = await this.daytona.list();

			const sandboxes: DaytonaSandbox[] = daytonaSandboxes.map((daytonaSandbox: any) => ({
				id: daytonaSandbox.id,
				projectId: daytonaSandbox.projectId || 'unknown',
				provider: this.provider,
				status: 'running', // Assume running if listed
				url: `https://app.daytona.io/sandbox/${daytonaSandbox.id}`,
				real: true,
				daytonaSandbox: daytonaSandbox, // Store the SDK instance
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
					memory: '4GB',
					cpu: '2vcpu'
				},
				createdAt: daytonaSandbox.createdAt || new Date().toISOString()
			}));

			logger.info(`✅ Listed ${sandboxes.length} Daytona sandboxes`);
			return sandboxes;
		} catch (error) {
			logger.error(`Failed to list Daytona sandboxes:`, error);
			throw new Error(
				`Failed to list sandboxes: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	async ensureSandboxRunning(sandbox: DaytonaSandbox): Promise<void> {
		try {
			// Check if the sandbox has a status method or property
			if (sandbox.daytonaSandbox && typeof sandbox.daytonaSandbox.status === 'function') {
				const status = await sandbox.daytonaSandbox.status();
				if (status !== 'running' && status !== 'ready') {
					logger.info(`Sandbox ${sandbox.id} is ${status}, attempting to start...`);
					if (typeof sandbox.daytonaSandbox.start === 'function') {
						await sandbox.daytonaSandbox.start();
						logger.info(`✅ Started sandbox ${sandbox.id}`);
					} else {
						logger.warn(`Sandbox ${sandbox.id} has status ${status} but no start method available`);
					}
				}
			} else if (sandbox.daytonaSandbox && sandbox.daytonaSandbox.state) {
				// Check state property if available
				const state = sandbox.daytonaSandbox.state;
				if (state !== 'running' && state !== 'ready') {
					logger.info(`Sandbox ${sandbox.id} state is ${state}, attempting to start...`);
					if (typeof sandbox.daytonaSandbox.start === 'function') {
						await sandbox.daytonaSandbox.start();
						logger.info(`✅ Started sandbox ${sandbox.id}`);
					} else {
						logger.warn(`Sandbox ${sandbox.id} has state ${state} but no start method available`);
					}
				}
			} else {
				// If we can't check status, try a simple command to see if sandbox is responsive
				logger.info(`Cannot check sandbox ${sandbox.id} status, testing with simple command...`);
				try {
					await this.executeSimpleCommand(sandbox.daytonaSandbox, 'echo "test"');
					logger.info(`Sandbox ${sandbox.id} appears to be running`);
				} catch (error) {
					logger.warn(`Sandbox ${sandbox.id} test command failed, may not be running:`, error);
					// Try to start if available
					if (typeof sandbox.daytonaSandbox.start === 'function') {
						await sandbox.daytonaSandbox.start();
						logger.info(`✅ Started sandbox ${sandbox.id} after test failure`);
					}
				}
			}
		} catch (error) {
			logger.error(`Failed to ensure sandbox ${sandbox.id} is running:`, error);
			throw error;
		}
	}

	private async executeSimpleCommand(daytonaSandbox: any, command: string): Promise<any> {
		// Try different execution methods
		if (daytonaSandbox.process?.exec) {
			return await daytonaSandbox.process.exec(command, {
				cwd: '/workspace',
				timeout: 5000
			});
		} else if (daytonaSandbox.process?.executeCommand) {
			return await daytonaSandbox.process.executeCommand(command, '/workspace', undefined, 5000);
		} else {
			throw new Error('No suitable execution method found');
		}
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

		logger.info(`🔍 Looking for sandbox ${sandboxId} in active sandboxes`);
		logger.info(`📊 Current active sandboxes:`, Array.from(this.activeSandboxes.keys()));

		let sandbox = this.activeSandboxes.get(sandboxId);

		// If not in active sandboxes, try to retrieve it from Daytona API
		if (!sandbox) {
			logger.info(`🔄 Sandbox ${sandboxId} not in memory, trying to retrieve from Daytona SDK`);
			try {
				sandbox = await this.retrieveExistingSandbox(sandboxId);
				if (!sandbox) {
					throw new Error(`Sandbox ${sandboxId} not found in Daytona and could not be retrieved`);
				}
				this.activeSandboxes.set(sandboxId, sandbox);
				logger.info(`✅ Retrieved and cached existing sandbox ${sandboxId}`);
			} catch (error) {
				logger.warn(`Failed to retrieve existing sandbox ${sandboxId}:`, error);
			}
		}

		if (!sandbox) {
			logger.error(`❌ Sandbox ${sandboxId} not found in active sandboxes or Daytona API`);
			throw new Error(`Sandbox not found: ${sandboxId}`);
		}

		if (!sandbox.daytonaSandbox) {
			// For existing sandboxes without SDK instances, use API calls
			logger.info(
				`🔄 Using API-based execution for sandbox ${sandboxId} (no SDK instance available)`
			);
			return await this.executeCommandViaAPI(sandboxId, command);
		}

		// Check if sandbox is running and start it if needed
		try {
			await this.ensureSandboxRunning(sandbox);
		} catch (error) {
			logger.warn(`Failed to ensure sandbox ${sandboxId} is running:`, error);
			// Continue with execution attempt - some commands might still work
		}

		try {
			logger.info(`Executing command in Daytona sandbox ${sandboxId}: ${command}`);

			const startTime = Date.now();
			let result;

			// Try different methods based on what's available in the SDK
			if (sandbox.daytonaSandbox.process) {
				if (sandbox.daytonaSandbox.process.exec) {
					// Method 1: Direct exec (correct API according to docs)
					result = await sandbox.daytonaSandbox.process.exec(command, {
						cwd: '/workspace',
						timeout: 30000
					});
				} else if (sandbox.daytonaSandbox.process.executeCommand) {
					// Method 2: executeCommand method (TypeScript SDK)
					result = await sandbox.daytonaSandbox.process.executeCommand(
						command,
						'/workspace',
						undefined,
						30000
					);
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

	/**
	 * Execute command via Daytona API for existing sandboxes without SDK instances
	 */
	private async executeCommandViaAPI(
		sandboxId: string,
		command: string
	): Promise<{
		success: boolean;
		output: string;
		exitCode: number;
		executionTime: string;
	}> {
		try {
			logger.info(`🌐 Executing command via API in Daytona sandbox ${sandboxId}: ${command}`);

			const startTime = Date.now();

			// Use Daytona API to execute command
			// Based on the Daytona API documentation, we need to make a POST request to execute commands
			const apiUrl = `https://api.daytona.io/v1/workspaces/${sandboxId}/exec`;

			const response = await fetch(apiUrl, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${env.DAYTONA_API_KEY}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					command,
					cwd: '/workspace',
					timeout: 30000
				})
			});

			if (!response.ok) {
				throw new Error(`API request failed: ${response.status} ${response.statusText}`);
			}

			const result = await response.json();
			const executionTime = `${Date.now() - startTime}ms`;

			logger.info(`✅ Command executed via API successfully in ${executionTime}: ${command}`);

			return {
				success: (result.exitCode || result.exit_code || 0) === 0,
				output: result.stdout || result.output || result.result || 'Command completed',
				exitCode: result.exitCode || result.exit_code || 0,
				executionTime
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			logger.error(`❌ API command execution failed in Daytona: ${errorMessage}`);
			throw new Error(`Failed to execute command via API: ${errorMessage}`);
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

	/**
	 * Clone project directly into Daytona sandbox using git
	 */
	async cloneProjectIntoSandbox(
		sandboxId: string,
		templateId: string,
		files: ProjectFile[]
	): Promise<void> {
		await this.ensureInitialized();

		const sandbox = this.activeSandboxes.get(sandboxId);
		if (!sandbox) {
			throw new Error(`Sandbox not found: ${sandboxId}`);
		}

		try {
			logger.info(`Cloning project into Daytona sandbox: ${sandboxId}`);

			// First, upload all files to the sandbox
			await this.loadProjectFiles(sandboxId, `projects/${sandbox.projectId}`, files);

			// Initialize git repository if needed
			try {
				await this.executeCommand(sandboxId, 'git init');
				await this.executeCommand(sandboxId, 'git add .');
				await this.executeCommand(sandboxId, 'git commit -m "Initial commit"');
				logger.info(`Git repository initialized in Daytona sandbox: ${sandboxId}`);
			} catch (error) {
				logger.warn(`Git initialization failed, continuing without git: ${error}`);
			}
		} catch (error) {
			logger.error(`Failed to clone project into Daytona sandbox:`, error);
			throw error;
		}
	}

	async listFiles(sandboxId: string, path = '/workspace'): Promise<any[]> {
		await this.ensureInitialized();

		logger.info(`🔍 Looking for sandbox ${sandboxId} in active sandboxes`);
		logger.info(`📊 Current active sandboxes:`, Array.from(this.activeSandboxes.keys()));

		let sandbox = this.activeSandboxes.get(sandboxId);

		// If not in active sandboxes, try to retrieve it from Daytona API
		if (!sandbox) {
			logger.info(`🔄 Sandbox ${sandboxId} not in memory, trying to retrieve from Daytona SDK`);
			try {
				sandbox = await this.retrieveExistingSandbox(sandboxId);
				if (!sandbox) {
					throw new Error(`Sandbox ${sandboxId} not found in Daytona and could not be retrieved`);
				}
				this.activeSandboxes.set(sandboxId, sandbox);
				logger.info(`✅ Retrieved and cached existing sandbox ${sandboxId}`);
			} catch (error) {
				logger.warn(`Failed to retrieve existing sandbox ${sandboxId}:`, error);
			}
		}

		if (!sandbox) {
			logger.error(`❌ Sandbox ${sandboxId} not found in active sandboxes or Daytona API`);
			throw new Error(`Sandbox not found: ${sandboxId}`);
		}

		if (!sandbox.daytonaSandbox) {
			logger.warn(`Daytona sandbox instance not found for ${sandboxId}`);
			throw new Error(`Daytona sandbox instance not found for ${sandboxId}`);
		}

		try {
			logger.info(`Listing files in Daytona sandbox ${sandboxId} at path: ${path}`);

			// Ensure sandbox is running before file operations
			await this.ensureSandboxRunning(sandbox);

			// Build complete file tree starting from root
			const fileTree = await this.buildFileTree(
				sandbox.daytonaSandbox,
				sandboxId,
				'/home/daytona',
				null
			);

			return fileTree;
		} catch (error) {
			logger.error(`Failed to list files in Daytona sandbox:`, error);
			throw error;
		}
	}

	/**
	 * Recursively build file tree from Daytona sandbox
	 */
	private async buildFileTree(
		daytonaSandbox: any,
		sandboxId: string,
		currentPath: string,
		parentId: string | null,
		depth = 0
	): Promise<FileSystemItem[]> {
		if (depth > 10) {
			logger.warn(`Max depth reached for path: ${currentPath}`);
			return [];
		}

		try {
			const files = await daytonaSandbox.fs.listFiles(currentPath);
			const result: FileSystemItem[] = [];

			for (let index = 0; index < files.length; index++) {
				const file = files[index];
				const fileName = file.name;
				const filePath = currentPath === '/home/daytona' ? fileName : `${currentPath}/${fileName}`;
				const modifiedDate = file.modTime ? new Date(file.modTime) : new Date();
				const itemId = `daytona-${sandboxId}-${filePath.replace(/\//g, '-')}-${index}`;

				const baseItem = {
					id: itemId,
					name: fileName,
					path: filePath,
					content: '', // Content will be loaded on demand
					parentId,
					type: file.isDir ? 'directory' : 'file',
					createdAt: modifiedDate,
					modifiedAt: modifiedDate,
					size: file.size || 0,
					permissions: {
						read: true,
						write: true,
						execute: file.isDir ? false : true,
						delete: true,
						share: true,
						owner: 'daytona',
						collaborators: []
					}
				};

				if (file.isDir) {
					// Recursively get children
					const children = await this.buildFileTree(
						daytonaSandbox,
						sandboxId,
						filePath,
						itemId,
						depth + 1
					);
					const childIds = children.map((child) => child.id);

					result.push({
						...baseItem,
						type: 'directory' as const,
						children: childIds,
						isExpanded: false,
						isRoot: parentId === null
					} as Directory);

					// Add children to result
					result.push(...children);
				} else {
					// File-specific properties
					const extension = fileName.split('.').pop()?.toLowerCase() || '';
					const languageMap: Record<string, string> = {
						js: 'javascript',
						ts: 'typescript',
						jsx: 'javascript',
						tsx: 'typescript',
						json: 'json',
						html: 'html',
						css: 'css',
						scss: 'scss',
						sass: 'sass',
						md: 'markdown',
						txt: 'plaintext',
						py: 'python',
						java: 'java',
						c: 'c',
						cpp: 'cpp',
						php: 'php',
						rb: 'ruby',
						go: 'go',
						rs: 'rust',
						xml: 'xml',
						svg: 'xml'
					};

					result.push({
						...baseItem,
						type: 'file' as const,
						content: '', // Will be loaded when opened
						language: languageMap[extension] || 'plaintext',
						encoding: 'utf-8' as const,
						mimeType: `text/${languageMap[extension] || 'plain'}`,
						isDirty: false,
						isReadOnly: false,
						metadata: {
							extension,
							lineCount: 0, // Will be calculated when content is loaded
							characterCount: 0,
							wordCount: 0,
							lastCursor: null,
							bookmarks: [],
							breakpoints: [],
							folds: [],
							searchHistory: []
						},
						editorState: undefined,
						aiContext: undefined
					} as File);
				}
			}

			return result;
		} catch (error) {
			logger.error(`Failed to build file tree for path ${currentPath}:`, error);
			return [];
		}
	}

	async readFile(
		sandboxId: string,
		filePath: string,
		options?: {
			encoding?: 'utf-8' | 'base64' | 'binary';
			maxSize?: number;
		}
	): Promise<string | null> {
		await this.ensureInitialized();

		logger.info(
			`🔍 Looking for sandbox ${sandboxId} in active sandboxes for reading file: ${filePath}`
		);

		let sandbox = this.activeSandboxes.get(sandboxId);

		// If not in active sandboxes, try to retrieve it from Daytona API
		if (!sandbox) {
			logger.info(`🔄 Sandbox ${sandboxId} not in memory, trying to retrieve from Daytona SDK`);
			try {
				sandbox = await this.retrieveExistingSandbox(sandboxId);
				if (!sandbox) {
					throw new Error(`Sandbox ${sandboxId} not found in Daytona and could not be retrieved`);
				}
				this.activeSandboxes.set(sandboxId, sandbox);
				logger.info(`✅ Retrieved and cached existing sandbox ${sandboxId}`);
			} catch (error) {
				logger.warn(`Failed to retrieve existing sandbox ${sandboxId}:`, error);
			}
		}

		if (!sandbox) {
			logger.error(`❌ Sandbox ${sandboxId} not found in active sandboxes or Daytona API`);
			throw new Error(`Sandbox not found: ${sandboxId}`);
		}

		if (!sandbox.daytonaSandbox) {
			logger.warn(`Daytona sandbox instance not found for ${sandboxId}`);
			throw new Error(`Daytona sandbox instance not found for ${sandboxId}`);
		}

		try {
			logger.info(`Reading file ${filePath} from Daytona sandbox ${sandboxId}`);

			// Read file using Daytona SDK
			const content = await sandbox.daytonaSandbox.fs.downloadFile(filePath);

			// Convert bytes to string based on encoding option
			const encoding = options?.encoding || 'utf-8';
			if (encoding === 'utf-8') {
				return content.toString('utf-8');
			} else if (encoding === 'base64') {
				return content.toString('base64');
			} else {
				// For binary, return as-is (though the API expects string)
				return content.toString('utf-8');
			}
		} catch (error) {
			logger.error(`Failed to read file ${filePath} from Daytona sandbox:`, error);
			throw error;
		}
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

		// Check if we have this sandbox in our active sandboxes
		const sandbox = this.activeSandboxes.get(workspaceId);
		if (sandbox) {
			return sandbox.status;
		}

		// If not in active sandboxes, assume it's running (persistent)
		// The Daytona SDK doesn't provide a getWorkspace method
		return 'running';
	}
}
