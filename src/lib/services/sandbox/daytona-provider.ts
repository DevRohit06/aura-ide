/**
 * Daytona Sandbox Provider Implementation
 * Provides integration with Daytona workspace management platform using the official SDK
 */

import type { SandboxProvider, SandboxStatus } from '$lib/types/sandbox.js';
import { Daytona, Sandbox as DaytonaSandbox } from '@daytonaio/sdk';
import { daytonaConfig } from '../../config/sandbox.config.js';
import type {
	ExecutionResult,
	FileSystemEntry,
	ISandboxProvider,
	SandboxCreateOptions,
	SandboxEnvironment,
	SandboxFile,
	SandboxMetrics,
	SandboxProviderEvents,
	SandboxUpdateOptions
} from './sandbox-provider.interface.js';

/**
 * Daytona Provider Implementation using the official SDK
 */
export class DaytonaProvider implements ISandboxProvider {
	readonly name: SandboxProvider = 'daytona';
	readonly capabilities = {
		supportsFileSystem: true,
		supportsTerminal: true,
		supportsPortForwarding: true,
		supportsSnapshots: false, // Daytona doesn't support snapshots directly
		supportsResourceScaling: true,
		maxConcurrentSessions: daytonaConfig.limits.maxConcurrentWorkspaces,
		supportedRuntimes: [
			'node',
			'python',
			'go',
			'rust',
			'java',
			'dotnet',
			'php',
			'ruby',
			'universal'
		]
	};

	private daytona: Daytona;
	private initialized = false;
	private eventListeners: Map<keyof SandboxProviderEvents, Function[]> = new Map();

	constructor(config: typeof daytonaConfig) {
		this.daytona = new Daytona({
			apiKey: config.apiKey,
			apiUrl: config.apiUrl,
			target: config.region
		});
	}

	async initialize(): Promise<void> {
		if (this.initialized) return;

		try {
			// Test the connection by trying to list sandboxes
			await this.daytona.list();
			this.initialized = true;
		} catch (error) {
			throw new Error(`Failed to initialize Daytona provider: ${error}`);
		}
	}

	async createSandbox(config: SandboxCreateOptions): Promise<SandboxEnvironment> {
		await this.ensureInitialized();

		try {
			const sandbox = await this.daytona.create({
				language: config.runtime || 'universal'
			});

			const environment = this.mapSandboxToEnvironment(sandbox);
			this.emit('sandbox:created', environment);
			return environment;
		} catch (error) {
			throw new Error(`Failed to create Daytona workspace: ${error}`);
		}
	}

	async getSandbox(sandboxId: string): Promise<SandboxEnvironment | null> {
		await this.ensureInitialized();

		try {
			// The SDK doesn't have a direct get method, so we list and find
			const sandboxes = await this.daytona.list();
			const sandbox = sandboxes.find((s) => s.id === sandboxId);
			return sandbox ? this.mapSandboxToEnvironment(sandbox) : null;
		} catch (error: any) {
			if (error.status === 404) return null;
			throw new Error(`Failed to get Daytona workspace: ${error}`);
		}
	}

	async listSandboxes(filters?: {
		userId?: string;
		projectId?: string;
		status?: SandboxStatus;
		template?: string;
	}): Promise<SandboxEnvironment[]> {
		await this.ensureInitialized();

		try {
			const sandboxes = await this.daytona.list();
			return sandboxes.map((sandbox) => this.mapSandboxToEnvironment(sandbox));
		} catch (error) {
			throw new Error(`Failed to list Daytona workspaces: ${error}`);
		}
	}

	async deleteSandbox(sandboxId: string): Promise<boolean> {
		await this.ensureInitialized();

		try {
			// Get the sandbox instance first
			const sandboxes = await this.daytona.list();
			const sandbox = sandboxes.find((s) => s.id === sandboxId);
			if (!sandbox) return false;

			await this.daytona.delete(sandbox);
			this.emit('sandbox:deleted', sandboxId);
			return true;
		} catch (error: any) {
			this.emit(
				'sandbox:error',
				sandboxId,
				error instanceof Error ? error : new Error(String(error))
			);
			throw new Error(`Failed to delete Daytona workspace: ${error}`);
		}
	}

	async readFile(
		sandboxId: string,
		filePath: string,
		options?: {
			encoding?: 'utf-8' | 'base64' | 'binary';
			maxSize?: number;
		}
	): Promise<SandboxFile | null> {
		await this.ensureInitialized();

		try {
			const sandbox = await this.getSandbox(sandboxId);
			if (!sandbox) return null;

			// Get the Daytona sandbox instance
			const sandboxes = await this.daytona.list();
			const daytonaSandbox = sandboxes.find((s) => s.id === sandboxId);
			if (!daytonaSandbox) return null;

			// Use the SDK's filesystem API
			const buffer = await daytonaSandbox.fs.downloadFile(filePath);
			const content = buffer.toString(options?.encoding === 'binary' ? 'binary' : 'utf-8');

			return {
				path: filePath,
				content,
				encoding: options?.encoding || 'utf-8',
				size: buffer.length
			};
		} catch (error: any) {
			if (error.status === 404) return null;
			throw new Error(`Failed to read file from Daytona workspace: ${error}`);
		}
	}

	async writeFile(
		sandboxId: string,
		filePath: string,
		content: string | Buffer,
		options?: {
			encoding?: 'utf-8' | 'base64' | 'binary';
			createDirs?: boolean;
			backup?: boolean;
		}
	): Promise<boolean> {
		await this.ensureInitialized();

		try {
			// Get the Daytona sandbox instance
			const sandboxes = await this.daytona.list();
			const daytonaSandbox = sandboxes.find((s) => s.id === sandboxId);
			if (!daytonaSandbox) return false;

			const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');
			await daytonaSandbox.fs.uploadFile(buffer, filePath);

			this.emit('file:changed', sandboxId, filePath, 'modified');
			return true;
		} catch (error) {
			throw new Error(`Failed to write file to Daytona workspace: ${error}`);
		}
	}

	async listFiles(
		sandboxId: string,
		path = '/workspace',
		options?: {
			recursive?: boolean;
			includeHidden?: boolean;
			maxDepth?: number;
		}
	): Promise<FileSystemEntry[]> {
		await this.ensureInitialized();

		try {
			// Get the Daytona sandbox instance
			const sandboxes = await this.daytona.list();
			const daytonaSandbox = sandboxes.find((s) => s.id === sandboxId);
			if (!daytonaSandbox) return [];

			const files = await daytonaSandbox.fs.listFiles(path);
			return files.map((file) => ({
				path: file.name, // FileInfo has 'name', not 'path'
				type: file.isDir ? 'directory' : 'file', // FileInfo has 'isDir', not 'type'
				size: file.size,
				modified: file.modTime ? new Date(file.modTime) : undefined,
				permissions: file.permissions
			}));
		} catch (error) {
			throw new Error(`Failed to list files in Daytona workspace: ${error}`);
		}
	}

	async executeCommand(
		sandboxId: string,
		command: string,
		options?: {
			workingDir?: string;
			timeout?: number;
			environment?: Record<string, string>;
		}
	): Promise<ExecutionResult> {
		await this.ensureInitialized();

		try {
			// Get the Daytona sandbox instance
			const sandboxes = await this.daytona.list();
			const daytonaSandbox = sandboxes.find((s) => s.id === sandboxId);
			if (!daytonaSandbox) {
				return {
					success: false,
					output: '',
					error: 'Sandbox not found',
					exitCode: 1,
					duration: 0,
					timestamp: new Date()
				};
			}

			const result = await daytonaSandbox.process.executeCommand(command, options?.workingDir);

			return {
				success: result.exitCode === 0,
				output: result.result || '',
				error: undefined, // ExecuteResponse doesn't have stderr
				exitCode: result.exitCode || 0,
				duration: 0, // SDK doesn't provide duration
				timestamp: new Date()
			};
		} catch (error: any) {
			return {
				success: false,
				output: '',
				error: error.message || String(error),
				exitCode: 1,
				duration: 0,
				timestamp: new Date()
			};
		}
	}

	async getProviderInfo(): Promise<{
		version: string;
		status: 'healthy' | 'degraded' | 'unavailable';
		limits: {
			maxSandboxes: number;
			maxConcurrentSessions: number;
			maxFileSize: number;
			maxExecutionTime: number;
		};
		usage: {
			activeSandboxes: number;
			totalSandboxes: number;
			resourceUsage: {
				cpu: number;
				memory: number;
				storage: number;
			};
		};
	}> {
		await this.ensureInitialized();

		try {
			const sandboxes = await this.daytona.list();
			return {
				version: '0.103.0', // SDK version
				status: 'healthy',
				limits: {
					maxSandboxes: daytonaConfig.limits.maxConcurrentWorkspaces,
					maxConcurrentSessions: daytonaConfig.limits.maxConcurrentSessions,
					maxFileSize: daytonaConfig.limits.maxFileSize,
					maxExecutionTime: daytonaConfig.limits.maxExecutionTime
				},
				usage: {
					activeSandboxes: sandboxes.length,
					totalSandboxes: sandboxes.length,
					resourceUsage: {
						cpu: 0, // Not available from SDK
						memory: 0,
						storage: 0
					}
				}
			};
		} catch (error) {
			return {
				version: 'unknown',
				status: 'unavailable',
				limits: {
					maxSandboxes: 0,
					maxConcurrentSessions: 0,
					maxFileSize: 0,
					maxExecutionTime: 0
				},
				usage: {
					activeSandboxes: 0,
					totalSandboxes: 0,
					resourceUsage: {
						cpu: 0,
						memory: 0,
						storage: 0
					}
				}
			};
		}
	}

	async cleanup(): Promise<void> {
		// Clean up any active connections or resources
		this.eventListeners.clear();
		this.initialized = false;
	}

	// Event management methods
	on<K extends keyof SandboxProviderEvents>(event: K, listener: SandboxProviderEvents[K]): void {
		if (!this.eventListeners.has(event)) {
			this.eventListeners.set(event, []);
		}
		this.eventListeners.get(event)!.push(listener);
	}

	off<K extends keyof SandboxProviderEvents>(event: K, listener: SandboxProviderEvents[K]): void {
		const listeners = this.eventListeners.get(event) || [];
		const index = listeners.indexOf(listener);
		if (index > -1) {
			listeners.splice(index, 1);
		}
	}

	// Private helper methods
	private async ensureInitialized(): Promise<void> {
		if (!this.initialized) {
			await this.initialize();
		}
	}

	private mapSandboxToEnvironment(sandbox: DaytonaSandbox): SandboxEnvironment {
		return {
			id: sandbox.id,
			name: sandbox.id, // SDK doesn't provide name
			provider: 'daytona',
			status: this.mapSandboxStateToStatus(sandbox.state),
			template: undefined,
			runtime: undefined,
			resources: {
				cpu: sandbox.cpu || 1,
				memory: sandbox.memory || 1024,
				storage: sandbox.disk || 10240,
				bandwidth: 100
			},
			network: {
				ports: [],
				publicUrl: undefined,
				sshUrl: undefined
			},
			metadata: {},
			createdAt: sandbox.createdAt ? new Date(sandbox.createdAt) : new Date(),
			lastActivity: new Date(),
			expiresAt: undefined
		};
	}

	private mapSandboxStateToStatus(state: any): SandboxStatus {
		switch (state) {
			case 'started':
				return 'running';
			case 'stopped':
				return 'stopped';
			default:
				return 'initializing';
		}
	}

	private emit<K extends keyof SandboxProviderEvents>(
		event: K,
		...args: Parameters<SandboxProviderEvents[K]>
	): void {
		const listeners = this.eventListeners.get(event) || [];
		listeners.forEach((listener) => {
			try {
				listener(...args);
			} catch (error) {
				console.error(`Error in ${event} event listener:`, error);
			}
		});
	}

	// Stub implementations for methods not yet implemented
	async updateSandbox(
		sandboxId: string,
		updates: SandboxUpdateOptions
	): Promise<SandboxEnvironment> {
		throw new Error('updateSandbox not implemented');
	}

	async startSandbox(sandboxId: string): Promise<SandboxEnvironment> {
		throw new Error('startSandbox not implemented');
	}

	async stopSandbox(sandboxId: string): Promise<SandboxEnvironment> {
		throw new Error('stopSandbox not implemented');
	}

	async restartSandbox(sandboxId: string): Promise<SandboxEnvironment> {
		throw new Error('restartSandbox not implemented');
	}

	async getMetrics(sandboxId: string): Promise<SandboxMetrics | null> {
		return null; // Not implemented
	}

	async deleteFile(
		sandboxId: string,
		filePath: string,
		options?: {
			recursive?: boolean;
			force?: boolean;
		}
	): Promise<boolean> {
		await this.ensureInitialized();

		try {
			// Get the Daytona sandbox instance
			const sandboxes = await this.daytona.list();
			const daytonaSandbox = sandboxes.find((s) => s.id === sandboxId);
			if (!daytonaSandbox) return false;

			await daytonaSandbox.fs.deleteFile(filePath, options?.recursive);
			return true;
		} catch (error) {
			throw new Error(`Failed to delete file from Daytona workspace: ${error}`);
		}
	}

	async createDirectory(
		sandboxId: string,
		dirPath: string,
		options?: {
			recursive?: boolean;
			permissions?: string;
		}
	): Promise<boolean> {
		await this.ensureInitialized();

		try {
			// Get the Daytona sandbox instance
			const sandboxes = await this.daytona.list();
			const daytonaSandbox = sandboxes.find((s) => s.id === sandboxId);
			if (!daytonaSandbox) return false;

			await daytonaSandbox.fs.createFolder(dirPath, options?.permissions || '755');
			return true;
		} catch (error) {
			throw new Error(`Failed to create directory in Daytona workspace: ${error}`);
		}
	}

	async forwardPort(
		sandboxId: string,
		internalPort: number,
		options?: {
			externalPort?: number;
			protocol?: 'tcp' | 'udp';
			public?: boolean;
		}
	): Promise<{ externalPort: number; url?: string }> {
		throw new Error('forwardPort not implemented');
	}

	async removePortForward(sandboxId: string, externalPort: number): Promise<boolean> {
		throw new Error('removePortForward not implemented');
	}

	async connectTerminal(
		sandboxId: string,
		options?: {
			cols?: number;
			rows?: number;
			environment?: Record<string, string>;
		}
	): Promise<{ sessionId: string; wsUrl?: string; sshConnection?: any }> {
		throw new Error('connectTerminal not implemented');
	}

	async disconnectTerminal(sessionId: string): Promise<boolean> {
		throw new Error('disconnectTerminal not implemented');
	}

	async sendTerminalInput(sessionId: string, input: string): Promise<boolean> {
		throw new Error('sendTerminalInput not implemented');
	}

	async resizeTerminal(sessionId: string, cols: number, rows: number): Promise<boolean> {
		throw new Error('resizeTerminal not implemented');
	}

	async uploadFiles(
		sandboxId: string,
		files: Record<string, string | Buffer>,
		options?: {
			baseDir?: string;
			overwrite?: boolean;
			createDirs?: boolean;
		}
	): Promise<{ uploaded: string[]; failed: string[] }> {
		await this.ensureInitialized();

		const uploaded: string[] = [];
		const failed: string[] = [];
		const baseDir = options?.baseDir || '/workspace';

		for (const [filePath, content] of Object.entries(files)) {
			try {
				const fullPath = filePath.startsWith('/') ? filePath : `${baseDir}/${filePath}`;
				await this.writeFile(sandboxId, fullPath, content, {
					createDirs: options?.createDirs,
					encoding: typeof content === 'string' ? 'utf-8' : 'binary'
				});
				uploaded.push(filePath);
			} catch (error) {
				failed.push(filePath);
			}
		}

		return { uploaded, failed };
	}

	async downloadFiles(
		sandboxId: string,
		filePaths: string[],
		options?: {
			baseDir?: string;
			compress?: boolean;
		}
	): Promise<Record<string, Buffer>> {
		await this.ensureInitialized();

		const files: Record<string, Buffer> = {};
		const baseDir = options?.baseDir || '/workspace';

		for (const filePath of filePaths) {
			try {
				const fullPath = filePath.startsWith('/') ? filePath : `${baseDir}/${filePath}`;
				const file = await this.readFile(sandboxId, fullPath, { encoding: 'binary' });
				if (file) {
					files[filePath] = Buffer.isBuffer(file.content)
						? file.content
						: Buffer.from(file.content);
				}
			} catch (error) {
				// Skip failed files
			}
		}

		return files;
	}

	async createSnapshot(
		sandboxId: string,
		name?: string,
		options?: {
			description?: string;
			includeRuntime?: boolean;
			compress?: boolean;
		}
	): Promise<{ snapshotId: string; size: number }> {
		throw new Error('Snapshots are not supported by Daytona provider');
	}

	async restoreSnapshot(
		sandboxId: string,
		snapshotId: string,
		options?: {
			preserveFiles?: string[];
			restartAfter?: boolean;
		}
	): Promise<boolean> {
		throw new Error('Snapshots are not supported by Daytona provider');
	}

	async getLogs(
		sandboxId: string,
		options?: {
			since?: Date;
			until?: Date;
			tail?: number;
			follow?: boolean;
		}
	): Promise<string[]> {
		throw new Error('getLogs not implemented');
	}

	async healthCheck(): Promise<{
		healthy: boolean;
		latency: number;
		error?: string;
		details?: Record<string, any>;
	}> {
		const startTime = Date.now();

		try {
			await this.daytona.list();
			return {
				healthy: true,
				latency: Date.now() - startTime
			};
		} catch (error: any) {
			const latency = Date.now() - startTime;
			return {
				healthy: false,
				latency,
				error: error.message || String(error)
			};
		}
	}
}
