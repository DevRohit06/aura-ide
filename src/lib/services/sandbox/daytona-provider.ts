/**
 * Daytona Sandbox Provider Implementation
 * Provides integration with Daytona workspace management platform
 */

import type { SandboxProvider, SandboxStatus } from '$lib/types/sandbox.js';
import { daytonaConfig } from '../../config/sandbox.config.js';
import type {
	ExecutionResult,
	FileSystemEntry,
	ISandboxProvider,
	SandboxConfig,
	SandboxCreateOptions,
	SandboxEnvironment,
	SandboxFile,
	SandboxMetrics,
	SandboxProviderEvents,
	SandboxUpdateOptions
} from './sandbox-provider.interface.js';

interface DaytonaWorkspace {
	id: string;
	name: string;
	projectId: string;
	gitpodUrl?: string;
	state: 'running' | 'stopped' | 'paused' | 'failed';
	ide: {
		name: string;
		url: string;
	};
	workspace: {
		id: string;
		name: string;
		class: string;
		context: {
			repository: {
				owner: string;
				name: string;
				ref: string;
				revision: string;
			};
		};
	};
	machine: {
		machineType: {
			name: string;
			displayName: string;
			options: {
				class1: string;
				class2: string;
				class3: string;
			};
		};
	};
	creationTime: string;
	startedTime?: string;
	stoppedTime?: string;
}

interface DaytonaProject {
	name: string;
	repository: {
		url: string;
		branch?: string;
	};
	workspaceTemplate?: string;
	envVars?: Record<string, string>;
}

interface DaytonaCommand {
	command: string;
	args?: string[];
	workingDir?: string;
	env?: Record<string, string>;
}

interface DaytonaFileOperation {
	operation: 'create' | 'update' | 'delete' | 'move';
	path: string;
	content?: string;
	destination?: string;
}

/**
 * Daytona Provider Implementation
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

	private baseUrl: string;
	private apiKey: string;
	private teamId?: string;
	private initialized = false;
	private eventListeners: Map<keyof SandboxProviderEvents, Function[]> = new Map();

	constructor(config: typeof daytonaConfig) {
		this.baseUrl = config.apiUrl;
		this.apiKey = config.apiKey;
		this.teamId = config.teamId;
	}

	async initialize(): Promise<void> {
		if (this.initialized) return;

		try {
			// Verify API connection
			const health = await this.healthCheck();
			if (!health.healthy) {
				throw new Error(`Daytona API health check failed: ${health.error}`);
			}

			this.initialized = true;
		} catch (error) {
			throw new Error(`Failed to initialize Daytona provider: ${error}`);
		}
	}

	async createSandbox(config: SandboxCreateOptions): Promise<SandboxEnvironment> {
		await this.ensureInitialized();

		const projectConfig: DaytonaProject = {
			name: config.name || `project-${Date.now()}`,
			repository: {
				url: config.template || 'https://github.com/gitpod-io/template-typescript-node',
				branch: 'main'
			},
			workspaceTemplate: config.runtime || 'universal',
			envVars: config.environment
		};

		try {
			const response = await this.apiCall('POST', '/workspaces', {
				project: projectConfig,
				machineType: this.mapResourcestoMachineType(config.resources),
				metadata: {
					...config.metadata,
					projectId: config.projectId,
					userId: config.userId,
					createdBy: 'aura-ide'
				}
			});

			const workspace: DaytonaWorkspace = response.data;
			const environment = this.mapWorkspaceToEnvironment(workspace);

			this.emit('sandbox:created', environment);
			return environment;
		} catch (error) {
			throw new Error(`Failed to create Daytona workspace: ${error}`);
		}
	}

	async getSandbox(sandboxId: string): Promise<SandboxEnvironment | null> {
		await this.ensureInitialized();

		try {
			const response = await this.apiCall('GET', `/workspaces/${sandboxId}`);
			const workspace: DaytonaWorkspace = response.data;
			return this.mapWorkspaceToEnvironment(workspace);
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
			const queryParams = new URLSearchParams();
			if (filters?.userId) queryParams.set('userId', filters.userId);
			if (filters?.projectId) queryParams.set('projectId', filters.projectId);
			if (filters?.status) queryParams.set('state', this.mapStatusToState(filters.status));

			const response = await this.apiCall('GET', `/workspaces?${queryParams}`);
			const workspaces: DaytonaWorkspace[] = response.data;

			return workspaces.map((workspace) => this.mapWorkspaceToEnvironment(workspace));
		} catch (error) {
			throw new Error(`Failed to list Daytona workspaces: ${error}`);
		}
	}

	async updateSandbox(
		sandboxId: string,
		options: SandboxUpdateOptions
	): Promise<SandboxEnvironment> {
		await this.ensureInitialized();

		try {
			const updateData: any = {};

			if (options.resources) {
				updateData.machineType = this.mapResourcestoMachineType(options.resources);
			}

			if (options.environment) {
				updateData.envVars = options.environment;
			}

			if (options.metadata) {
				updateData.metadata = options.metadata;
			}

			const response = await this.apiCall('PATCH', `/workspaces/${sandboxId}`, updateData);
			const workspace: DaytonaWorkspace = response.data;
			return this.mapWorkspaceToEnvironment(workspace);
		} catch (error) {
			throw new Error(`Failed to update Daytona workspace: ${error}`);
		}
	}

	async startSandbox(sandboxId: string): Promise<SandboxEnvironment> {
		await this.ensureInitialized();

		try {
			const response = await this.apiCall('POST', `/workspaces/${sandboxId}/start`);
			const workspace: DaytonaWorkspace = response.data;
			const environment = this.mapWorkspaceToEnvironment(workspace);

			this.emit('sandbox:started', environment);
			return environment;
		} catch (error: any) {
			this.emit(
				'sandbox:error',
				sandboxId,
				error instanceof Error ? error : new Error(String(error))
			);
			throw new Error(`Failed to start Daytona workspace: ${error}`);
		}
	}

	async stopSandbox(sandboxId: string): Promise<SandboxEnvironment> {
		await this.ensureInitialized();

		try {
			const response = await this.apiCall('POST', `/workspaces/${sandboxId}/stop`);
			const workspace: DaytonaWorkspace = response.data;
			const environment = this.mapWorkspaceToEnvironment(workspace);

			this.emit('sandbox:stopped', environment);
			return environment;
		} catch (error: any) {
			this.emit(
				'sandbox:error',
				sandboxId,
				error instanceof Error ? error : new Error(String(error))
			);
			throw new Error(`Failed to stop Daytona workspace: ${error}`);
		}
	}

	async restartSandbox(sandboxId: string): Promise<SandboxEnvironment> {
		await this.stopSandbox(sandboxId);
		await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for stop
		return await this.startSandbox(sandboxId);
	}

	async deleteSandbox(sandboxId: string): Promise<boolean> {
		await this.ensureInitialized();

		try {
			await this.apiCall('DELETE', `/workspaces/${sandboxId}`);
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

	async getMetrics(sandboxId: string): Promise<SandboxMetrics | null> {
		await this.ensureInitialized();

		try {
			const response = await this.apiCall('GET', `/workspaces/${sandboxId}/metrics`);
			const metrics = response.data;

			const sandboxMetrics: SandboxMetrics = {
				cpu: {
					usage: metrics.cpu?.usage || 0,
					limit: metrics.cpu?.limit || 1
				},
				memory: {
					usage: metrics.memory?.usage || 0,
					limit: metrics.memory?.limit || 1024,
					percentage: ((metrics.memory?.usage || 0) / (metrics.memory?.limit || 1024)) * 100
				},
				storage: {
					usage: metrics.storage?.usage || 0,
					limit: metrics.storage?.limit || 10240,
					percentage: ((metrics.storage?.usage || 0) / (metrics.storage?.limit || 10240)) * 100
				},
				network: {
					bytesIn: metrics.network?.bytesIn || 0,
					bytesOut: metrics.network?.bytesOut || 0,
					connectionsActive: metrics.network?.connections || 0
				},
				uptime: metrics.uptime || 0,
				lastUpdated: new Date()
			};

			this.emit('sandbox:metrics', sandboxId, sandboxMetrics);
			return sandboxMetrics;
		} catch (error: any) {
			if (error.status === 404) return null;
			throw new Error(`Failed to get Daytona workspace metrics: ${error}`);
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
			const commandData: DaytonaCommand = {
				command,
				workingDir: options?.workingDir || '/workspace',
				env: options?.environment
			};

			const response = await this.apiCall('POST', `/workspaces/${sandboxId}/exec`, {
				...commandData,
				timeout: options?.timeout || 30000
			});

			const result = response.data;
			const duration = Date.now() - startTime;

			return {
				success: result.exitCode === 0,
				output: result.stdout || '',
				error: result.stderr || undefined,
				exitCode: result.exitCode || 0,
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
		path = '/workspace',
		options?: {
			recursive?: boolean;
			includeHidden?: boolean;
			maxDepth?: number;
		}
	): Promise<FileSystemEntry[]> {
		await this.ensureInitialized();

		try {
			const queryParams = new URLSearchParams();
			queryParams.set('path', path);
			if (options?.recursive) queryParams.set('recursive', 'true');
			if (options?.includeHidden) queryParams.set('includeHidden', 'true');
			if (options?.maxDepth) queryParams.set('maxDepth', options.maxDepth.toString());

			const response = await this.apiCall('GET', `/workspaces/${sandboxId}/files?${queryParams}`);
			const files = response.data;

			return files.map(
				(file: any): FileSystemEntry => ({
					path: file.path,
					type: file.type === 'directory' ? 'directory' : 'file',
					size: file.size,
					modified: file.modified ? new Date(file.modified) : undefined,
					permissions: file.permissions
				})
			);
		} catch (error) {
			throw new Error(`Failed to list files in Daytona workspace: ${error}`);
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
			const queryParams = new URLSearchParams();
			queryParams.set('path', filePath);
			if (options?.encoding) queryParams.set('encoding', options.encoding);
			if (options?.maxSize) queryParams.set('maxSize', options.maxSize.toString());

			const response = await this.apiCall(
				'GET',
				`/workspaces/${sandboxId}/files/content?${queryParams}`
			);
			const fileData = response.data;

			return {
				path: filePath,
				content: fileData.content,
				encoding: options?.encoding || 'utf-8',
				size: fileData.size,
				modified: fileData.modified ? new Date(fileData.modified) : undefined
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
			const fileData = {
				path: filePath,
				content: content.toString(),
				encoding: options?.encoding || 'utf-8',
				createDirs: options?.createDirs || true,
				backup: options?.backup || false
			};

			await this.apiCall('PUT', `/workspaces/${sandboxId}/files/content`, fileData);

			this.emit('file:changed', sandboxId, filePath, 'modified');
			return true;
		} catch (error) {
			throw new Error(`Failed to write file to Daytona workspace: ${error}`);
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
			const queryParams = new URLSearchParams();
			queryParams.set('path', filePath);
			if (options?.recursive) queryParams.set('recursive', 'true');
			if (options?.force) queryParams.set('force', 'true');

			await this.apiCall('DELETE', `/workspaces/${sandboxId}/files?${queryParams}`);

			this.emit('file:changed', sandboxId, filePath, 'deleted');
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
			const dirData = {
				path: dirPath,
				type: 'directory',
				recursive: options?.recursive || true,
				permissions: options?.permissions || '755'
			};

			await this.apiCall('POST', `/workspaces/${sandboxId}/files`, dirData);

			this.emit('file:changed', sandboxId, dirPath, 'created');
			return true;
		} catch (error) {
			throw new Error(`Failed to create directory in Daytona workspace: ${error}`);
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
		await this.ensureInitialized();

		try {
			const queryParams = new URLSearchParams();
			if (options?.since) queryParams.set('since', options.since.toISOString());
			if (options?.until) queryParams.set('until', options.until.toISOString());
			if (options?.tail) queryParams.set('tail', options.tail.toString());

			const response = await this.apiCall('GET', `/workspaces/${sandboxId}/logs?${queryParams}`);
			return response.data.logs || [];
		} catch (error) {
			throw new Error(`Failed to get logs from Daytona workspace: ${error}`);
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
				shell: options?.shell || '/bin/bash',
				workingDir: options?.workingDir || '/workspace',
				rows: options?.rows || 24,
				cols: options?.cols || 80
			};

			const response = await this.apiCall(
				'POST',
				`/workspaces/${sandboxId}/terminal`,
				terminalData
			);
			const terminal = response.data;

			const sessionId = terminal.sessionId;
			this.emit('terminal:connected', sandboxId, sessionId);

			return {
				sessionId,
				wsUrl: terminal.wsUrl,
				sshConnection: terminal.sshConnection
			};
		} catch (error) {
			throw new Error(`Failed to connect terminal to Daytona workspace: ${error}`);
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
				internalPort,
				externalPort: options?.externalPort,
				protocol: options?.protocol || 'tcp',
				public: options?.public || false
			};

			const response = await this.apiCall('POST', `/workspaces/${sandboxId}/ports`, portData);
			const port = response.data;

			return {
				externalPort: port.externalPort,
				url: port.url
			};
		} catch (error) {
			throw new Error(`Failed to forward port in Daytona workspace: ${error}`);
		}
	}

	async removePortForward(sandboxId: string, externalPort: number): Promise<boolean> {
		await this.ensureInitialized();

		try {
			await this.apiCall('DELETE', `/workspaces/${sandboxId}/ports/${externalPort}`);
			return true;
		} catch (error) {
			throw new Error(`Failed to remove port forward from Daytona workspace: ${error}`);
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
			const response = await this.apiCall('GET', '/info');
			const info = response.data;

			return {
				version: info.version || 'unknown',
				status: info.status || 'healthy',
				limits: {
					maxSandboxes: daytonaConfig.limits.maxConcurrentWorkspaces,
					maxConcurrentSessions: daytonaConfig.limits.maxConcurrentSessions,
					maxFileSize: daytonaConfig.limits.maxFileSize,
					maxExecutionTime: daytonaConfig.limits.maxExecutionTime
				},
				usage: {
					activeSandboxes: info.activeWorkspaces || 0,
					totalSandboxes: info.totalWorkspaces || 0,
					resourceUsage: {
						cpu: info.resourceUsage?.cpu || 0,
						memory: info.resourceUsage?.memory || 0,
						storage: info.resourceUsage?.storage || 0
					}
				}
			};
		} catch (error) {
			throw new Error(`Failed to get Daytona provider info: ${error}`);
		}
	}

	async healthCheck(): Promise<{
		healthy: boolean;
		latency: number;
		error?: string;
		details?: Record<string, any>;
	}> {
		const startTime = Date.now();

		try {
			const response = await fetch(`${this.baseUrl}/health`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
					'Content-Type': 'application/json'
				},
				signal: AbortSignal.timeout(5000)
			});

			const latency = Date.now() - startTime;

			if (response.ok) {
				const data = await response.json();
				return {
					healthy: true,
					latency,
					details: data
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
		// Clean up any active connections or resources
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

		if (this.teamId) {
			headers['X-Team-ID'] = this.teamId;
		}

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
			throw new Error(
				`Daytona API Error: ${response.status} ${response.statusText} - ${errorText}`
			);
		}

		return response.json();
	}

	private mapWorkspaceToEnvironment(workspace: DaytonaWorkspace): SandboxEnvironment {
		return {
			id: workspace.id,
			name: workspace.name,
			provider: 'daytona',
			status: this.mapStateToStatus(workspace.state),
			template: workspace.workspace?.context?.repository?.name,
			runtime: workspace.machine?.machineType?.name,
			resources: {
				cpu: this.mapMachineTypeToCpu(workspace.machine?.machineType?.name),
				memory: this.mapMachineTypeToMemory(workspace.machine?.machineType?.name),
				storage: 10 * 1024, // Default 10GB
				bandwidth: 100 // Default 100 Mbps
			},
			network: {
				ports: [], // Populated separately
				publicUrl: workspace.ide?.url,
				sshUrl: workspace.gitpodUrl
			},
			metadata: {},
			createdAt: new Date(workspace.creationTime),
			lastActivity: workspace.startedTime
				? new Date(workspace.startedTime)
				: new Date(workspace.creationTime),
			expiresAt: undefined // Daytona doesn't have explicit expiration
		};
	}

	private mapStateToStatus(state: string): SandboxStatus {
		switch (state) {
			case 'running':
				return 'running';
			case 'stopped':
				return 'stopped';
			case 'failed':
				return 'error';
			default:
				return 'initializing';
		}
	}

	private mapStatusToState(status: SandboxStatus): string {
		switch (status) {
			case 'running':
				return 'running';
			case 'stopped':
				return 'stopped';
			case 'error':
				return 'failed';
			default:
				return 'running';
		}
	}

	private mapResourcestoMachineType(resources?: Partial<SandboxConfig['resources']>): string {
		if (!resources) return 'small';

		const cpu = resources.cpu || 1;
		const memory = resources.memory || 1024;

		if (cpu >= 4 && memory >= 8192) return 'large';
		if (cpu >= 2 && memory >= 4096) return 'medium';
		return 'small';
	}

	private mapMachineTypeToCpu(machineType?: string): number {
		switch (machineType) {
			case 'large':
				return 4;
			case 'medium':
				return 2;
			case 'small':
			default:
				return 1;
		}
	}

	private mapMachineTypeToMemory(machineType?: string): number {
		switch (machineType) {
			case 'large':
				return 8192;
			case 'medium':
				return 4096;
			case 'small':
			default:
				return 1024;
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
