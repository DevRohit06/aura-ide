/**
 * Local Sandbox Provider Implementation
 * Provides local development sandbox functionality
 */

import type { SandboxProvider, SandboxStatus } from '$lib/types/sandbox.js';
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';
import { localConfig } from '../../config/sandbox.config.js';
import type {
	ExecutionResult,
	FileSystemEntry,
	ISandboxProvider,
	PortMapping,
	SandboxCreateOptions,
	SandboxEnvironment,
	SandboxFile,
	SandboxMetrics,
	SandboxProviderEvents,
	SandboxUpdateOptions
} from './sandbox-provider.interface.js';

const execAsync = promisify(exec);

interface LocalSandbox {
	id: string;
	name: string;
	path: string;
	status: SandboxStatus;
	pid?: number;
	resources: {
		cpu: number;
		memory: number;
		storage: number;
	};
	ports: PortMapping[];
	metadata: Record<string, any>;
	createdAt: Date;
	lastActivity: Date;
}

/**
 * Local Provider Implementation (for development)
 */
export class LocalProvider implements ISandboxProvider {
	readonly name: SandboxProvider = 'local';
	readonly capabilities = {
		supportsFileSystem: true,
		supportsTerminal: true,
		supportsPortForwarding: false, // Limited local port forwarding
		supportsSnapshots: true, // Via directory copying
		supportsResourceScaling: false,
		maxConcurrentSessions: localConfig.limits.maxConcurrentSandboxes,
		supportedRuntimes: ['node', 'python', 'shell', 'static']
	};

	private basePath: string;
	private initialized = false;
	private sandboxes = new Map<string, LocalSandbox>();
	private eventListeners: Map<keyof SandboxProviderEvents, Function[]> = new Map();
	private cleanupInterval?: NodeJS.Timeout;

	constructor(config: typeof localConfig) {
		this.basePath = config.basePath;
	}

	async initialize(): Promise<void> {
		if (this.initialized) return;

		try {
			// Ensure base directory exists
			await fs.mkdir(this.basePath, { recursive: true });

			// Load existing sandboxes
			await this.loadExistingSandboxes();

			// Setup cleanup if enabled
			if (localConfig.cleanup.autoCleanup) {
				this.cleanupInterval = setInterval(
					() => this.performCleanup(),
					localConfig.cleanup.cleanupInterval
				);
			}

			this.initialized = true;
		} catch (error) {
			throw new Error(`Failed to initialize Local provider: ${error}`);
		}
	}

	async createSandbox(config: SandboxCreateOptions): Promise<SandboxEnvironment> {
		await this.ensureInitialized();

		const sandboxId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		const sandboxPath = path.join(this.basePath, sandboxId);

		try {
			// Create sandbox directory
			await fs.mkdir(sandboxPath, { recursive: true });

			// Create sandbox metadata
			const sandbox: LocalSandbox = {
				id: sandboxId,
				name: config.name || sandboxId,
				path: sandboxPath,
				status: 'running',
				resources: {
					cpu: config.resources?.cpu || 1,
					memory: config.resources?.memory || 1024,
					storage: config.resources?.storage || 10240
				},
				ports: config.ports || [],
				metadata: {
					...config.metadata,
					projectId: config.projectId,
					userId: config.userId,
					runtime: config.runtime || 'node',
					createdBy: 'aura-ide'
				},
				createdAt: new Date(),
				lastActivity: new Date()
			};

			// Initialize sandbox with template if provided
			if (config.template) {
				await this.initializeSandboxTemplate(sandboxPath, config.template);
			}

			// Save sandbox metadata
			await this.saveSandboxMetadata(sandbox);
			this.sandboxes.set(sandboxId, sandbox);

			const environment = this.mapSandboxToEnvironment(sandbox);
			this.emit('sandbox:created', environment);

			return environment;
		} catch (error) {
			// Cleanup on failure
			try {
				await fs.rm(sandboxPath, { recursive: true, force: true });
			} catch (cleanupError) {
				// Ignore cleanup errors
			}
			throw new Error(`Failed to create local sandbox: ${error}`);
		}
	}

	async getSandbox(sandboxId: string): Promise<SandboxEnvironment | null> {
		await this.ensureInitialized();

		const sandbox = this.sandboxes.get(sandboxId);
		if (!sandbox) return null;

		// Update last activity
		sandbox.lastActivity = new Date();
		await this.saveSandboxMetadata(sandbox);

		return this.mapSandboxToEnvironment(sandbox);
	}

	async listSandboxes(filters?: {
		userId?: string;
		projectId?: string;
		status?: SandboxStatus;
		template?: string;
	}): Promise<SandboxEnvironment[]> {
		await this.ensureInitialized();

		const environments: SandboxEnvironment[] = [];

		for (const sandbox of this.sandboxes.values()) {
			// Apply filters
			if (filters?.userId && sandbox.metadata.userId !== filters.userId) continue;
			if (filters?.projectId && sandbox.metadata.projectId !== filters.projectId) continue;
			if (filters?.status && sandbox.status !== filters.status) continue;
			if (filters?.template && sandbox.metadata.template !== filters.template) continue;

			environments.push(this.mapSandboxToEnvironment(sandbox));
		}

		return environments;
	}

	async updateSandbox(
		sandboxId: string,
		options: SandboxUpdateOptions
	): Promise<SandboxEnvironment> {
		await this.ensureInitialized();

		const sandbox = this.sandboxes.get(sandboxId);
		if (!sandbox) {
			throw new Error('Sandbox not found');
		}

		// Update sandbox properties
		if (options.resources) {
			Object.assign(sandbox.resources, options.resources);
		}

		if (options.environment) {
			sandbox.metadata.environment = {
				...sandbox.metadata.environment,
				...options.environment
			};
		}

		if (options.ports) {
			sandbox.ports = options.ports;
		}

		if (options.metadata) {
			Object.assign(sandbox.metadata, options.metadata);
		}

		sandbox.lastActivity = new Date();
		await this.saveSandboxMetadata(sandbox);

		return this.mapSandboxToEnvironment(sandbox);
	}

	async startSandbox(sandboxId: string): Promise<SandboxEnvironment> {
		await this.ensureInitialized();

		const sandbox = this.sandboxes.get(sandboxId);
		if (!sandbox) {
			throw new Error('Sandbox not found');
		}

		sandbox.status = 'running';
		sandbox.lastActivity = new Date();
		await this.saveSandboxMetadata(sandbox);

		const environment = this.mapSandboxToEnvironment(sandbox);
		this.emit('sandbox:started', environment);
		return environment;
	}

	async stopSandbox(sandboxId: string): Promise<SandboxEnvironment> {
		await this.ensureInitialized();

		const sandbox = this.sandboxes.get(sandboxId);
		if (!sandbox) {
			throw new Error('Sandbox not found');
		}

		// Kill any running processes
		if (sandbox.pid) {
			try {
				process.kill(sandbox.pid, 'SIGTERM');
			} catch (error) {
				// Process might already be dead
			}
		}

		sandbox.status = 'stopped';
		sandbox.lastActivity = new Date();
		await this.saveSandboxMetadata(sandbox);

		const environment = this.mapSandboxToEnvironment(sandbox);
		this.emit('sandbox:stopped', environment);
		return environment;
	}

	async restartSandbox(sandboxId: string): Promise<SandboxEnvironment> {
		await this.stopSandbox(sandboxId);
		await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for stop
		return await this.startSandbox(sandboxId);
	}

	async deleteSandbox(sandboxId: string): Promise<boolean> {
		await this.ensureInitialized();

		const sandbox = this.sandboxes.get(sandboxId);
		if (!sandbox) return false;

		try {
			// Stop sandbox first
			await this.stopSandbox(sandboxId);

			// Remove sandbox directory
			await fs.rm(sandbox.path, { recursive: true, force: true });

			// Remove from memory
			this.sandboxes.delete(sandboxId);

			this.emit('sandbox:deleted', sandboxId);
			return true;
		} catch (error) {
			throw new Error(`Failed to delete local sandbox: ${error}`);
		}
	}

	async getMetrics(sandboxId: string): Promise<SandboxMetrics | null> {
		await this.ensureInitialized();

		const sandbox = this.sandboxes.get(sandboxId);
		if (!sandbox) return null;

		try {
			// Get directory size
			const storageUsage = await this.getDirectorySize(sandbox.path);

			// Basic metrics (limited in local environment)
			const metrics: SandboxMetrics = {
				cpu: {
					usage: 0, // Not easily measurable locally
					limit: sandbox.resources.cpu
				},
				memory: {
					usage: 0, // Not easily measurable locally
					limit: sandbox.resources.memory,
					percentage: 0
				},
				storage: {
					usage: Math.round(storageUsage / 1024 / 1024), // Convert to MB
					limit: sandbox.resources.storage,
					percentage: (storageUsage / 1024 / 1024 / sandbox.resources.storage) * 100
				},
				network: {
					bytesIn: 0,
					bytesOut: 0,
					connectionsActive: 0
				},
				uptime: Date.now() - sandbox.createdAt.getTime(),
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

		const sandbox = this.sandboxes.get(sandboxId);
		if (!sandbox) {
			throw new Error('Sandbox not found');
		}

		const startTime = Date.now();
		const workingDir = options?.workingDir
			? path.resolve(sandbox.path, options.workingDir)
			: sandbox.path;

		try {
			const env = {
				...process.env,
				...options?.environment
			};

			const { stdout, stderr } = await execAsync(command, {
				cwd: workingDir,
				env,
				timeout: options?.timeout || 30000,
				maxBuffer: 1024 * 1024 // 1MB
			});

			const duration = Date.now() - startTime;
			sandbox.lastActivity = new Date();

			return {
				success: true,
				output: stdout,
				error: stderr || undefined,
				exitCode: 0,
				duration,
				timestamp: new Date()
			};
		} catch (error: any) {
			const duration = Date.now() - startTime;
			return {
				success: false,
				output: '',
				error: error.message || String(error),
				exitCode: error.code || 1,
				duration,
				timestamp: new Date()
			};
		}
	}

	async listFiles(
		sandboxId: string,
		dirPath = '.',
		options?: {
			recursive?: boolean;
			includeHidden?: boolean;
			maxDepth?: number;
		}
	): Promise<FileSystemEntry[]> {
		await this.ensureInitialized();

		const sandbox = this.sandboxes.get(sandboxId);
		if (!sandbox) {
			throw new Error('Sandbox not found');
		}

		const fullPath = path.resolve(sandbox.path, dirPath);

		try {
			const entries: FileSystemEntry[] = [];

			if (options?.recursive) {
				await this.listFilesRecursive(fullPath, entries, options);
			} else {
				const items = await fs.readdir(fullPath, { withFileTypes: true });

				for (const item of items) {
					if (!options?.includeHidden && item.name.startsWith('.')) continue;

					const itemPath = path.join(fullPath, item.name);
					const relativePath = path.relative(sandbox.path, itemPath);
					const stat = await fs.stat(itemPath);

					entries.push({
						path: relativePath,
						type: item.isDirectory() ? 'directory' : 'file',
						size: item.isFile() ? stat.size : undefined,
						modified: stat.mtime,
						permissions: this.getPermissions(stat.mode)
					});
				}
			}

			return entries;
		} catch (error) {
			throw new Error(`Failed to list files: ${error}`);
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

		const sandbox = this.sandboxes.get(sandboxId);
		if (!sandbox) return null;

		const fullPath = path.resolve(sandbox.path, filePath);

		try {
			const stat = await fs.stat(fullPath);

			if (options?.maxSize && stat.size > options.maxSize) {
				throw new Error(`File too large: ${stat.size} bytes`);
			}

			const encoding = options?.encoding || 'utf-8';
			let content: string | Buffer;

			if (encoding === 'binary') {
				content = await fs.readFile(fullPath);
			} else {
				content = await fs.readFile(fullPath, encoding === 'utf-8' ? 'utf-8' : 'base64');
			}

			return {
				path: filePath,
				content,
				encoding,
				size: stat.size,
				modified: stat.mtime
			};
		} catch (error: any) {
			if (error.code === 'ENOENT') return null;
			throw new Error(`Failed to read file: ${error}`);
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

		const sandbox = this.sandboxes.get(sandboxId);
		if (!sandbox) return false;

		const fullPath = path.resolve(sandbox.path, filePath);

		try {
			// Create directories if needed
			if (options?.createDirs !== false) {
				await fs.mkdir(path.dirname(fullPath), { recursive: true });
			}

			// Backup existing file if requested
			if (options?.backup) {
				try {
					await fs.copyFile(fullPath, `${fullPath}.backup`);
				} catch (error) {
					// Ignore backup errors for new files
				}
			}

			// Write file
			const encoding = options?.encoding || 'utf-8';
			if (encoding === 'binary' || Buffer.isBuffer(content)) {
				await fs.writeFile(fullPath, content);
			} else {
				await fs.writeFile(fullPath, content, encoding === 'utf-8' ? 'utf-8' : 'base64');
			}

			this.emit('file:changed', sandboxId, filePath, 'modified');
			return true;
		} catch (error) {
			throw new Error(`Failed to write file: ${error}`);
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

		const sandbox = this.sandboxes.get(sandboxId);
		if (!sandbox) return false;

		const fullPath = path.resolve(sandbox.path, filePath);

		try {
			const stat = await fs.stat(fullPath);

			if (stat.isDirectory()) {
				await fs.rm(fullPath, {
					recursive: options?.recursive !== false,
					force: options?.force !== false
				});
			} else {
				await fs.unlink(fullPath);
			}

			this.emit('file:changed', sandboxId, filePath, 'deleted');
			return true;
		} catch (error: any) {
			if (error.code === 'ENOENT' && options?.force) return true;
			throw new Error(`Failed to delete file: ${error}`);
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

		const sandbox = this.sandboxes.get(sandboxId);
		if (!sandbox) return false;

		const fullPath = path.resolve(sandbox.path, dirPath);

		try {
			await fs.mkdir(fullPath, { recursive: options?.recursive !== false });

			// Set permissions if specified
			if (options?.permissions) {
				await fs.chmod(fullPath, parseInt(options.permissions, 8));
			}

			this.emit('file:changed', sandboxId, dirPath, 'created');
			return true;
		} catch (error) {
			throw new Error(`Failed to create directory: ${error}`);
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

		for (const [filePath, content] of Object.entries(files)) {
			try {
				const targetPath = options?.baseDir ? path.join(options.baseDir, filePath) : filePath;

				await this.writeFile(sandboxId, targetPath, content, {
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

		for (const filePath of filePaths) {
			try {
				const targetPath = options?.baseDir ? path.join(options.baseDir, filePath) : filePath;

				const file = await this.readFile(sandboxId, targetPath, { encoding: 'binary' });
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

		const sandbox = this.sandboxes.get(sandboxId);
		if (!sandbox) {
			throw new Error('Sandbox not found');
		}

		const snapshotId = `snapshot-${sandboxId}-${Date.now()}`;
		const snapshotPath = path.join(this.basePath, 'snapshots', snapshotId);

		try {
			await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
			await this.copyDirectory(sandbox.path, snapshotPath);

			// Save snapshot metadata
			const metadata = {
				id: snapshotId,
				sandboxId,
				name: name || snapshotId,
				description: options?.description,
				createdAt: new Date(),
				size: await this.getDirectorySize(snapshotPath)
			};

			await fs.writeFile(
				path.join(snapshotPath, '.snapshot-metadata.json'),
				JSON.stringify(metadata, null, 2)
			);

			return {
				snapshotId,
				size: metadata.size
			};
		} catch (error) {
			throw new Error(`Failed to create snapshot: ${error}`);
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

		const sandbox = this.sandboxes.get(sandboxId);
		if (!sandbox) {
			throw new Error('Sandbox not found');
		}

		const snapshotPath = path.join(this.basePath, 'snapshots', snapshotId);

		try {
			// Check if snapshot exists
			await fs.access(snapshotPath);

			// Preserve specified files
			const preservedFiles: Record<string, Buffer> = {};
			if (options?.preserveFiles) {
				for (const filePath of options.preserveFiles) {
					try {
						const file = await this.readFile(sandboxId, filePath, { encoding: 'binary' });
						if (file && Buffer.isBuffer(file.content)) {
							preservedFiles[filePath] = file.content;
						}
					} catch (error) {
						// Ignore missing files
					}
				}
			}

			// Clear sandbox directory
			await fs.rm(sandbox.path, { recursive: true, force: true });
			await fs.mkdir(sandbox.path, { recursive: true });

			// Restore from snapshot
			await this.copyDirectory(snapshotPath, sandbox.path);

			// Restore preserved files
			for (const [filePath, content] of Object.entries(preservedFiles)) {
				await this.writeFile(sandboxId, filePath, content, { encoding: 'binary' });
			}

			// Restart if requested
			if (options?.restartAfter) {
				await this.restartSandbox(sandboxId);
			}

			return true;
		} catch (error) {
			throw new Error(`Failed to restore snapshot: ${error}`);
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

		const sandbox = this.sandboxes.get(sandboxId);
		if (!sandbox) return [];

		const logPath = path.join(sandbox.path, '.logs', 'sandbox.log');

		try {
			const content = await fs.readFile(logPath, 'utf-8');
			const lines = content.split('\n').filter((line) => line.trim());

			// Apply filters
			let filteredLines = lines;

			if (options?.since || options?.until) {
				filteredLines = lines.filter((line) => {
					// Simple timestamp extraction (assuming ISO format at start of line)
					const timestampMatch = line.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
					if (!timestampMatch) return true;

					const timestamp = new Date(timestampMatch[0]);
					if (options.since && timestamp < options.since) return false;
					if (options.until && timestamp > options.until) return false;
					return true;
				});
			}

			if (options?.tail && options.tail > 0) {
				filteredLines = filteredLines.slice(-options.tail);
			}

			return filteredLines;
		} catch (error) {
			return [];
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

		const sandbox = this.sandboxes.get(sandboxId);
		if (!sandbox) {
			throw new Error('Sandbox not found');
		}

		// For local provider, we can't provide true terminal access
		// This would require a websocket server implementation
		const sessionId = `terminal-${sandboxId}-${Date.now()}`;

		this.emit('terminal:connected', sandboxId, sessionId);

		return {
			sessionId,
			wsUrl: undefined, // Would need websocket server
			sshConnection: undefined
		};
	}

	async disconnectTerminal(sessionId: string): Promise<boolean> {
		this.emit('terminal:disconnected', '', sessionId);
		return true;
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
		// Local provider doesn't support true port forwarding
		// This would require network proxy implementation
		return {
			externalPort: options?.externalPort || internalPort,
			url: `http://localhost:${options?.externalPort || internalPort}`
		};
	}

	async removePortForward(sandboxId: string, externalPort: number): Promise<boolean> {
		// No-op for local provider
		return true;
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

		const activeSandboxes = Array.from(this.sandboxes.values()).filter(
			(s) => s.status === 'running'
		).length;

		let totalStorageUsage = 0;
		for (const sandbox of this.sandboxes.values()) {
			try {
				totalStorageUsage += await this.getDirectorySize(sandbox.path);
			} catch (error) {
				// Ignore errors
			}
		}

		return {
			version: '1.0.0',
			status: localConfig.enabled ? 'healthy' : 'unavailable',
			limits: {
				maxSandboxes: localConfig.limits.maxConcurrentSandboxes,
				maxConcurrentSessions: localConfig.limits.maxConcurrentSandboxes,
				maxFileSize: localConfig.limits.maxFileSize,
				maxExecutionTime: localConfig.limits.maxExecutionTime
			},
			usage: {
				activeSandboxes,
				totalSandboxes: this.sandboxes.size,
				resourceUsage: {
					cpu: 0, // Not easily measurable
					memory: 0,
					storage: Math.round(totalStorageUsage / 1024 / 1024) // MB
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
			// Check if base directory is accessible
			await fs.access(this.basePath);

			// Check if we can create a test file
			const testPath = path.join(this.basePath, '.health-check');
			await fs.writeFile(testPath, 'test');
			await fs.unlink(testPath);

			const latency = Date.now() - startTime;

			return {
				healthy: true,
				latency,
				details: {
					basePath: this.basePath,
					enabled: localConfig.enabled,
					sandboxes: this.sandboxes.size
				}
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

	async cleanup(): Promise<void> {
		// Stop cleanup interval
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
		}

		// Stop all sandboxes
		for (const [sandboxId] of this.sandboxes) {
			try {
				await this.stopSandbox(sandboxId);
			} catch (error) {
				// Ignore cleanup errors
			}
		}

		this.sandboxes.clear();
		this.eventListeners.clear();
		this.initialized = false;
	}

	// Private helper methods

	private async ensureInitialized(): Promise<void> {
		if (!this.initialized) {
			await this.initialize();
		}
	}

	private async loadExistingSandboxes(): Promise<void> {
		try {
			const items = await fs.readdir(this.basePath, { withFileTypes: true });

			for (const item of items) {
				if (!item.isDirectory()) continue;
				if (item.name === 'snapshots') continue;

				try {
					const metadataPath = path.join(this.basePath, item.name, '.sandbox-metadata.json');
					const metadata = await fs.readFile(metadataPath, 'utf-8');
					const sandbox: LocalSandbox = JSON.parse(metadata);

					// Convert date strings back to Date objects
					sandbox.createdAt = new Date(sandbox.createdAt);
					sandbox.lastActivity = new Date(sandbox.lastActivity);

					this.sandboxes.set(sandbox.id, sandbox);
				} catch (error) {
					// Skip invalid sandboxes
				}
			}
		} catch (error) {
			// Base directory might not exist yet
		}
	}

	private async saveSandboxMetadata(sandbox: LocalSandbox): Promise<void> {
		const metadataPath = path.join(sandbox.path, '.sandbox-metadata.json');
		await fs.writeFile(metadataPath, JSON.stringify(sandbox, null, 2));
	}

	private async initializeSandboxTemplate(sandboxPath: string, template: string): Promise<void> {
		// Basic template initialization
		switch (template) {
			case 'node':
				await fs.writeFile(
					path.join(sandboxPath, 'package.json'),
					JSON.stringify(
						{
							name: 'sandbox-project',
							version: '1.0.0',
							main: 'index.js',
							scripts: {
								start: 'node index.js'
							}
						},
						null,
						2
					)
				);
				await fs.writeFile(
					path.join(sandboxPath, 'index.js'),
					'console.log("Hello from Aura IDE sandbox!");'
				);
				break;

			case 'python':
				await fs.writeFile(
					path.join(sandboxPath, 'main.py'),
					'print("Hello from Aura IDE sandbox!")'
				);
				break;

			case 'static':
				await fs.writeFile(
					path.join(sandboxPath, 'index.html'),
					'<!DOCTYPE html><html><head><title>Sandbox</title></head><body><h1>Hello from Aura IDE sandbox!</h1></body></html>'
				);
				break;
		}
	}

	private async performCleanup(): Promise<void> {
		const now = Date.now();
		const maxAge = localConfig.cleanup.maxAge;

		for (const [sandboxId, sandbox] of this.sandboxes) {
			if (now - sandbox.lastActivity.getTime() > maxAge) {
				try {
					await this.deleteSandbox(sandboxId);
				} catch (error) {
					// Ignore cleanup errors
				}
			}
		}
	}

	private async getDirectorySize(dirPath: string): Promise<number> {
		let size = 0;

		try {
			const items = await fs.readdir(dirPath, { withFileTypes: true });

			for (const item of items) {
				const itemPath = path.join(dirPath, item.name);

				if (item.isDirectory()) {
					size += await this.getDirectorySize(itemPath);
				} else {
					const stat = await fs.stat(itemPath);
					size += stat.size;
				}
			}
		} catch (error) {
			// Ignore errors
		}

		return size;
	}

	private async copyDirectory(src: string, dest: string): Promise<void> {
		await fs.mkdir(dest, { recursive: true });

		const items = await fs.readdir(src, { withFileTypes: true });

		for (const item of items) {
			const srcPath = path.join(src, item.name);
			const destPath = path.join(dest, item.name);

			if (item.isDirectory()) {
				await this.copyDirectory(srcPath, destPath);
			} else {
				await fs.copyFile(srcPath, destPath);
			}
		}
	}

	private async listFilesRecursive(
		dirPath: string,
		entries: FileSystemEntry[],
		options: { includeHidden?: boolean; maxDepth?: number },
		currentDepth = 0
	): Promise<void> {
		if (options.maxDepth && currentDepth >= options.maxDepth) return;

		const items = await fs.readdir(dirPath, { withFileTypes: true });

		for (const item of items) {
			if (!options.includeHidden && item.name.startsWith('.')) continue;

			const itemPath = path.join(dirPath, item.name);
			const stat = await fs.stat(itemPath);

			entries.push({
				path: itemPath,
				type: item.isDirectory() ? 'directory' : 'file',
				size: item.isFile() ? stat.size : undefined,
				modified: stat.mtime,
				permissions: this.getPermissions(stat.mode)
			});

			if (item.isDirectory()) {
				await this.listFilesRecursive(itemPath, entries, options, currentDepth + 1);
			}
		}
	}

	private getPermissions(mode: number): string {
		const permissions = (mode & parseInt('777', 8)).toString(8);
		return permissions.padStart(3, '0');
	}

	private mapSandboxToEnvironment(sandbox: LocalSandbox): SandboxEnvironment {
		return {
			id: sandbox.id,
			name: sandbox.name,
			provider: 'local',
			status: sandbox.status,
			template: sandbox.metadata.template,
			runtime: sandbox.metadata.runtime,
			resources: sandbox.resources,
			network: {
				ports: sandbox.ports,
				publicUrl: undefined
			},
			metadata: sandbox.metadata,
			createdAt: sandbox.createdAt,
			lastActivity: sandbox.lastActivity,
			expiresAt: undefined
		};
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
