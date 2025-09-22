/**
 * E2B Sandbox Provider Implementation
 * Provides integration with E2B cloud sandbox platform
 */

import type { SandboxProvider, SandboxStatus } from '$lib/types/sandbox.js';
import { e2bConfig } from '../../config/sandbox.config.js';
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

interface E2BSandbox {
	id: string;
	template: string;
	cpuCount: number;
	memoryMB: number;
	diskSizeMB: number;
	metadata?: Record<string, any>;
	createdAt: string;
	deletedAt?: string;
}

interface E2BProcess {
	pid: number;
	finished: boolean;
	exitCode?: number;
	stdout: string;
	stderr: string;
}

interface E2BFileInfo {
	name: string;
	path: string;
	isDir: boolean;
	size?: number;
	lastModified?: string;
}

interface E2BTerminal {
	pid: number;
	url: string;
}

/**
 * E2B Provider Implementation
 */
export class E2BProvider implements ISandboxProvider {
	readonly name: SandboxProvider = 'e2b';
	readonly capabilities = {
		supportsFileSystem: true,
		supportsTerminal: true,
		supportsPortForwarding: true,
		supportsSnapshots: true, // E2B supports snapshots
		supportsResourceScaling: false, // E2B doesn't support dynamic scaling
		maxConcurrentSessions: e2bConfig.limits.maxConcurrentSessions,
		supportedRuntimes: ['nodejs', 'python', 'ubuntu', 'code-interpreter']
	};

	private apiKey: string;
	private baseUrl: string;
	private initialized = false;
	private activeSandboxes = new Map<string, any>();
	private eventListeners: Map<keyof SandboxProviderEvents, Function[]> = new Map();

	constructor(config: typeof e2bConfig) {
		this.apiKey = config.apiKey;
		this.baseUrl = config.baseUrl;
	}

	async initialize(): Promise<void> {
		if (this.initialized) return;

		try {
			// Verify API connection
			const health = await this.healthCheck();
			if (!health.healthy) {
				throw new Error(`E2B API health check failed: ${health.error}`);
			}

			this.initialized = true;
		} catch (error) {
			throw new Error(`Failed to initialize E2B provider: ${error}`);
		}
	}

	async createSandbox(config: SandboxCreateOptions): Promise<SandboxEnvironment> {
		await this.ensureInitialized();

		const template = this.mapRuntimeToTemplate(config.runtime || 'nodejs');

		try {
			const createData = {
				template,
				cpuCount: config.resources?.cpu || 1,
				memoryMB: config.resources?.memory || 1024,
				diskSizeMB: config.resources?.storage || 10240,
				metadata: {
					...config.metadata,
					projectId: config.projectId,
					userId: config.userId,
					name: config.name,
					createdBy: 'aura-ide'
				}
			};

			const response = await this.apiCall('POST', '/sandboxes', createData);
			const sandbox: E2BSandbox = response;

			// Store sandbox reference
			this.activeSandboxes.set(sandbox.id, sandbox);

			const environment = this.mapSandboxToEnvironment(sandbox, template);
			this.emit('sandbox:created', environment);

			return environment;
		} catch (error) {
			throw new Error(`Failed to create E2B sandbox: ${error}`);
		}
	}

	async getSandbox(sandboxId: string): Promise<SandboxEnvironment | null> {
		await this.ensureInitialized();

		try {
			// Check if sandbox is in our cache first
			if (this.activeSandboxes.has(sandboxId)) {
				const sandbox = this.activeSandboxes.get(sandboxId);
				return this.mapSandboxToEnvironment(sandbox, sandbox.template);
			}

			// Try to get from API (though E2B doesn't provide a direct get endpoint)
			const response = await this.apiCall('GET', `/sandboxes/${sandboxId}`);
			const sandbox: E2BSandbox = response;

			this.activeSandboxes.set(sandboxId, sandbox);
			return this.mapSandboxToEnvironment(sandbox, sandbox.template);
		} catch (error: any) {
			if (error.status === 404) return null;
			throw new Error(`Failed to get E2B sandbox: ${error}`);
		}
	}

	async listSandboxes(filters?: {
		userId?: string;
		projectId?: string;
		status?: SandboxStatus;
		template?: string;
	}): Promise<SandboxEnvironment[]> {
		await this.ensureInitialized();

		// E2B doesn't have a list endpoint, so we return cached sandboxes
		const sandboxes: SandboxEnvironment[] = [];

		for (const [id, sandbox] of this.activeSandboxes) {
			try {
				const environment = this.mapSandboxToEnvironment(sandbox, sandbox.template);

				// Apply filters
				if (filters?.userId && environment.metadata.userId !== filters.userId) continue;
				if (filters?.projectId && environment.metadata.projectId !== filters.projectId) continue;
				if (filters?.status && environment.status !== filters.status) continue;
				if (filters?.template && environment.template !== filters.template) continue;

				sandboxes.push(environment);
			} catch (error) {
				// Skip invalid sandboxes
				continue;
			}
		}

		return sandboxes;
	}

	async updateSandbox(
		sandboxId: string,
		options: SandboxUpdateOptions
	): Promise<SandboxEnvironment> {
		throw new Error('E2B does not support sandbox updates after creation');
	}

	async startSandbox(sandboxId: string): Promise<SandboxEnvironment> {
		await this.ensureInitialized();

		// E2B sandboxes are started when created, but we can check if it's accessible
		try {
			const sandbox = await this.getSandbox(sandboxId);
			if (!sandbox) {
				throw new Error('Sandbox not found');
			}

			// Test sandbox accessibility
			await this.executeCommand(sandboxId, 'echo "test"', { timeout: 5000 });

			const updatedSandbox = { ...sandbox, status: 'running' as SandboxStatus };
			this.emit('sandbox:started', updatedSandbox);
			return updatedSandbox;
		} catch (error: any) {
			this.emit(
				'sandbox:error',
				sandboxId,
				error instanceof Error ? error : new Error(String(error))
			);
			throw new Error(`Failed to start E2B sandbox: ${error}`);
		}
	}

	async stopSandbox(sandboxId: string): Promise<SandboxEnvironment> {
		await this.ensureInitialized();

		// E2B sandboxes are stopped by deletion
		try {
			await this.deleteSandbox(sandboxId);

			const sandbox = this.activeSandboxes.get(sandboxId);
			const environment = sandbox
				? this.mapSandboxToEnvironment(sandbox, sandbox.template)
				: {
						id: sandboxId,
						name: 'Unknown',
						provider: 'e2b' as SandboxProvider,
						status: 'stopped' as SandboxStatus,
						resources: { cpu: 1, memory: 1024, storage: 10240 },
						network: { ports: [] },
						metadata: {},
						createdAt: new Date(),
						lastActivity: new Date()
					};

			environment.status = 'stopped';
			this.emit('sandbox:stopped', environment);
			return environment;
		} catch (error: any) {
			this.emit(
				'sandbox:error',
				sandboxId,
				error instanceof Error ? error : new Error(String(error))
			);
			throw new Error(`Failed to stop E2B sandbox: ${error}`);
		}
	}

	async restartSandbox(sandboxId: string): Promise<SandboxEnvironment> {
		// For E2B, restart means recreate
		const oldSandbox = await this.getSandbox(sandboxId);
		if (!oldSandbox) {
			throw new Error('Sandbox not found');
		}

		await this.deleteSandbox(sandboxId);

		return await this.createSandbox({
			template: oldSandbox.template,
			runtime: oldSandbox.runtime,
			resources: oldSandbox.resources,
			metadata: oldSandbox.metadata
		});
	}

	async deleteSandbox(sandboxId: string): Promise<boolean> {
		await this.ensureInitialized();

		try {
			await this.apiCall('DELETE', `/sandboxes/${sandboxId}`);
			this.activeSandboxes.delete(sandboxId);
			this.emit('sandbox:deleted', sandboxId);
			return true;
		} catch (error: any) {
			this.emit(
				'sandbox:error',
				sandboxId,
				error instanceof Error ? error : new Error(String(error))
			);
			throw new Error(`Failed to delete E2B sandbox: ${error}`);
		}
	}

	async getMetrics(sandboxId: string): Promise<SandboxMetrics | null> {
		await this.ensureInitialized();

		// E2B doesn't provide detailed metrics, so we return basic info
		try {
			const sandbox = this.activeSandboxes.get(sandboxId);
			if (!sandbox) return null;

			const metrics: SandboxMetrics = {
				cpu: {
					usage: 0, // Not available
					limit: sandbox.cpuCount || 1
				},
				memory: {
					usage: 0, // Not available
					limit: sandbox.memoryMB || 1024,
					percentage: 0
				},
				storage: {
					usage: 0, // Not available
					limit: sandbox.diskSizeMB || 10240,
					percentage: 0
				},
				network: {
					bytesIn: 0,
					bytesOut: 0,
					connectionsActive: 0
				},
				uptime: Date.now() - new Date(sandbox.createdAt).getTime(),
				lastUpdated: new Date()
			};

			this.emit('sandbox:metrics', sandboxId, metrics);
			return metrics;
		} catch (error) {
			return null;
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

		const startTime = Date.now();

		try {
			const processData = {
				cmd: command,
				cwd: options?.workingDir || '/home/user',
				env: options?.environment || {},
				timeout: options?.timeout || 30000
			};

			const response = await this.apiCall('POST', `/sandboxes/${sandboxId}/processes`, processData);
			const process: E2BProcess = response;

			// Wait for process to complete
			let attempts = 0;
			const maxAttempts = Math.ceil((options?.timeout || 30000) / 1000);

			while (!process.finished && attempts < maxAttempts) {
				await new Promise((resolve) => setTimeout(resolve, 1000));
				const statusResponse = await this.apiCall(
					'GET',
					`/sandboxes/${sandboxId}/processes/${process.pid}`
				);
				Object.assign(process, statusResponse);
				attempts++;
			}

			const duration = Date.now() - startTime;

			return {
				success: process.exitCode === 0,
				output: process.stdout || '',
				error: process.stderr || undefined,
				exitCode: process.exitCode || (process.finished ? 0 : 124), // 124 = timeout
				duration,
				timestamp: new Date()
			};
		} catch (error: any) {
			const duration = Date.now() - startTime;
			return {
				success: false,
				output: '',
				error: error.message || String(error),
				exitCode: 1,
				duration,
				timestamp: new Date()
			};
		}
	}

	async listFiles(
		sandboxId: string,
		path = '/home/user',
		options?: {
			recursive?: boolean;
			includeHidden?: boolean;
			maxDepth?: number;
		}
	): Promise<FileSystemEntry[]> {
		await this.ensureInitialized();

		try {
			const response = await this.apiCall(
				'GET',
				`/sandboxes/${sandboxId}/filesystem?path=${encodeURIComponent(path)}`
			);
			const files: E2BFileInfo[] = response;

			return files.map(
				(file): FileSystemEntry => ({
					path: file.path,
					type: file.isDir ? 'directory' : 'file',
					size: file.size,
					modified: file.lastModified ? new Date(file.lastModified) : undefined,
					permissions: file.isDir ? 'drwxr-xr-x' : '-rw-r--r--'
				})
			);
		} catch (error) {
			throw new Error(`Failed to list files in E2B sandbox: ${error}`);
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
			const response = await this.apiCall(
				'GET',
				`/sandboxes/${sandboxId}/filesystem/read?path=${encodeURIComponent(filePath)}`
			);
			const content = response.content || response;

			return {
				path: filePath,
				content: content,
				encoding: options?.encoding || 'utf-8',
				size: content.length,
				modified: new Date()
			};
		} catch (error: any) {
			if (error.status === 404) return null;
			throw new Error(`Failed to read file from E2B sandbox: ${error}`);
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
			const writeData = {
				path: filePath,
				content: content.toString(),
				createDirs: options?.createDirs !== false
			};

			await this.apiCall('POST', `/sandboxes/${sandboxId}/filesystem/write`, writeData);

			this.emit('file:changed', sandboxId, filePath, 'modified');
			return true;
		} catch (error) {
			throw new Error(`Failed to write file to E2B sandbox: ${error}`);
		}
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
			await this.apiCall(
				'DELETE',
				`/sandboxes/${sandboxId}/filesystem?path=${encodeURIComponent(filePath)}`
			);

			this.emit('file:changed', sandboxId, filePath, 'deleted');
			return true;
		} catch (error) {
			throw new Error(`Failed to delete file from E2B sandbox: ${error}`);
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
			const dirData = {
				path: dirPath,
				recursive: options?.recursive !== false
			};

			await this.apiCall('POST', `/sandboxes/${sandboxId}/filesystem/mkdir`, dirData);

			this.emit('file:changed', sandboxId, dirPath, 'created');
			return true;
		} catch (error) {
			throw new Error(`Failed to create directory in E2B sandbox: ${error}`);
		}
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
		const baseDir = options?.baseDir || '/home/user';

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
		const baseDir = options?.baseDir || '/home/user';

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
		await this.ensureInitialized();

		try {
			const snapshotData = {
				name: name || `snapshot-${Date.now()}`,
				description: options?.description
			};

			const response = await this.apiCall(
				'POST',
				`/sandboxes/${sandboxId}/snapshots`,
				snapshotData
			);

			return {
				snapshotId: response.id,
				size: response.size || 0
			};
		} catch (error) {
			throw new Error(`Failed to create E2B snapshot: ${error}`);
		}
	}

	async restoreSnapshot(
		sandboxId: string,
		snapshotId: string,
		options?: {
			preserveFiles?: string[];
			restartAfter?: boolean;
		}
	): Promise<boolean> {
		await this.ensureInitialized();

		try {
			await this.apiCall('POST', `/sandboxes/${sandboxId}/snapshots/${snapshotId}/restore`);
			return true;
		} catch (error) {
			throw new Error(`Failed to restore E2B snapshot: ${error}`);
		}
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
		await this.ensureInitialized();

		try {
			const queryParams = new URLSearchParams();
			if (options?.since) queryParams.set('since', options.since.toISOString());
			if (options?.until) queryParams.set('until', options.until.toISOString());
			if (options?.tail) queryParams.set('tail', options.tail.toString());

			const response = await this.apiCall('GET', `/sandboxes/${sandboxId}/logs?${queryParams}`);
			return response.logs || [];
		} catch (error) {
			throw new Error(`Failed to get logs from E2B sandbox: ${error}`);
		}
	}

	async connectTerminal(
		sandboxId: string,
		options?: {
			shell?: string;
			workingDir?: string;
			rows?: number;
			cols?: number;
		}
	): Promise<{
		sessionId: string;
		wsUrl?: string;
		sshConnection?: any;
	}> {
		await this.ensureInitialized();

		try {
			const terminalData = {
				cmd: options?.shell || '/bin/bash',
				cwd: options?.workingDir || '/home/user',
				size: {
					rows: options?.rows || 24,
					cols: options?.cols || 80
				}
			};

			const response = await this.apiCall('POST', `/sandboxes/${sandboxId}/terminal`, terminalData);
			const terminal: E2BTerminal = response;

			const sessionId = terminal.pid.toString();
			this.emit('terminal:connected', sandboxId, sessionId);

			return {
				sessionId,
				wsUrl: terminal.url
			};
		} catch (error) {
			throw new Error(`Failed to connect terminal to E2B sandbox: ${error}`);
		}
	}

	async disconnectTerminal(sessionId: string): Promise<boolean> {
		await this.ensureInitialized();

		try {
			await this.apiCall('DELETE', `/terminal/${sessionId}`);
			this.emit('terminal:disconnected', '', sessionId);
			return true;
		} catch (error) {
			throw new Error(`Failed to disconnect terminal session: ${error}`);
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
		await this.ensureInitialized();

		try {
			const portData = {
				port: internalPort,
				public: options?.public || false
			};

			const response = await this.apiCall('POST', `/sandboxes/${sandboxId}/ports`, portData);

			return {
				externalPort: internalPort, // E2B uses the same port
				url: response.url
			};
		} catch (error) {
			throw new Error(`Failed to forward port in E2B sandbox: ${error}`);
		}
	}

	async removePortForward(sandboxId: string, externalPort: number): Promise<boolean> {
		await this.ensureInitialized();

		try {
			await this.apiCall('DELETE', `/sandboxes/${sandboxId}/ports/${externalPort}`);
			return true;
		} catch (error) {
			throw new Error(`Failed to remove port forward from E2B sandbox: ${error}`);
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

		return {
			version: '1.0.0', // E2B doesn't provide version info
			status: 'healthy',
			limits: {
				maxSandboxes: e2bConfig.limits.maxConcurrentSandboxes,
				maxConcurrentSessions: e2bConfig.limits.maxConcurrentSessions,
				maxFileSize: e2bConfig.limits.maxFileSize,
				maxExecutionTime: e2bConfig.limits.maxExecutionTime
			},
			usage: {
				activeSandboxes: this.activeSandboxes.size,
				totalSandboxes: this.activeSandboxes.size,
				resourceUsage: {
					cpu: 0, // Not available
					memory: 0,
					storage: 0
				}
			}
		};
	}

	async healthCheck(): Promise<{
		healthy: boolean;
		latency: number;
		error?: string;
		details?: Record<string, any>;
	}> {
		const startTime = Date.now();

		try {
			// E2B doesn't have a health endpoint, so we try to create and delete a test sandbox
			const response = await fetch(`${this.baseUrl}/templates`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
					'Content-Type': 'application/json'
				},
				signal: AbortSignal.timeout(5000)
			});

			const latency = Date.now() - startTime;

			if (response.ok) {
				return {
					healthy: true,
					latency,
					details: { templatesAvailable: true }
				};
			} else {
				return {
					healthy: false,
					latency,
					error: `HTTP ${response.status}: ${response.statusText}`
				};
			}
		} catch (error: any) {
			const latency = Date.now() - startTime;
			return {
				healthy: false,
				latency,
				error: error.message || String(error)
			};
		}
	}

	async cleanup(): Promise<void> {
		// Clean up active sandboxes
		for (const [sandboxId] of this.activeSandboxes) {
			try {
				await this.deleteSandbox(sandboxId);
			} catch (error) {
				// Ignore cleanup errors
			}
		}

		this.activeSandboxes.clear();
		this.eventListeners.clear();
		this.initialized = false;
	}

	// Private helper methods

	private async ensureInitialized(): Promise<void> {
		if (!this.initialized) {
			await this.initialize();
		}
	}

	private async apiCall(method: string, endpoint: string, data?: any): Promise<any> {
		const url = `${this.baseUrl}${endpoint}`;
		const headers: Record<string, string> = {
			Authorization: `Bearer ${this.apiKey}`,
			'Content-Type': 'application/json'
		};

		const options: RequestInit = {
			method,
			headers,
			signal: AbortSignal.timeout(30000)
		};

		if (data) {
			options.body = JSON.stringify(data);
		}

		const response = await fetch(url, options);

		if (!response.ok) {
			const errorText = await response.text();
			const error = new Error(
				`E2B API Error: ${response.status} ${response.statusText} - ${errorText}`
			);
			(error as any).status = response.status;
			throw error;
		}

		return response.json();
	}

	private mapSandboxToEnvironment(sandbox: E2BSandbox, template: string): SandboxEnvironment {
		return {
			id: sandbox.id,
			name: sandbox.metadata?.name || `e2b-${sandbox.id}`,
			provider: 'e2b',
			status: sandbox.deletedAt ? 'stopped' : 'running',
			template: template,
			runtime: template,
			resources: {
				cpu: sandbox.cpuCount || 1,
				memory: sandbox.memoryMB || 1024,
				storage: sandbox.diskSizeMB || 10240,
				bandwidth: 100 // Default
			},
			network: {
				ports: [], // Populated separately
				publicUrl: undefined
			},
			metadata: sandbox.metadata || {},
			createdAt: new Date(sandbox.createdAt),
			lastActivity: new Date(),
			expiresAt: undefined // E2B manages expiration internally
		};
	}

	private mapRuntimeToTemplate(runtime: string): string {
		switch (runtime) {
			case 'node':
			case 'nodejs':
				return e2bConfig.templates.node;
			case 'python':
				return e2bConfig.templates.python;
			case 'universal':
			case 'ubuntu':
				return e2bConfig.templates.universal;
			default:
				return e2bConfig.templates.universal;
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
}
