/**
 * Sandbox Provider Interface
 * Unified interface for sandbox providers (Daytona, E2B, Local)
 */

import type { SandboxProvider, SandboxStatus } from '$lib/types/sandbox.js';

export interface SandboxEnvironment {
	id: string;
	name: string;
	provider: SandboxProvider;
	status: SandboxStatus;
	template?: string;
	runtime?: string;
	resources: {
		cpu: number;
		memory: number; // MB
		storage: number; // MB
		bandwidth?: number; // Mbps
	};
	network: {
		ports: PortMapping[];
		publicUrl?: string;
		sshUrl?: string;
	};
	metadata: Record<string, any>;
	createdAt: Date;
	lastActivity: Date;
	expiresAt?: Date;
}

export interface PortMapping {
	internal: number;
	external?: number;
	protocol: 'tcp' | 'udp';
	public: boolean;
	description?: string;
}

export interface SandboxConfig {
	template?: string;
	runtime?: string;
	resources?: {
		cpu?: number;
		memory?: number;
		storage?: number;
	};
	environment?: Record<string, string>;
	ports?: PortMapping[];
	timeout?: number; // minutes
	persistent?: boolean;
	metadata?: Record<string, any>;
}

export interface SandboxMetrics {
	cpu: {
		usage: number; // percentage
		limit: number;
	};
	memory: {
		usage: number; // MB
		limit: number; // MB
		percentage: number;
	};
	storage: {
		usage: number; // MB
		limit: number; // MB
		percentage: number;
	};
	network: {
		bytesIn: number;
		bytesOut: number;
		connectionsActive: number;
	};
	uptime: number; // seconds
	lastUpdated: Date;
}

export interface FileSystemEntry {
	path: string;
	type: 'file' | 'directory';
	size?: number;
	modified?: Date;
	permissions?: string;
	content?: string; // For files only
}

export interface ExecutionResult {
	success: boolean;
	output: string;
	error?: string;
	exitCode: number;
	duration: number;
	timestamp: Date;
}

export interface SandboxFile {
	path: string;
	content: string | Buffer;
	encoding?: 'utf-8' | 'base64' | 'binary';
	size?: number;
	modified?: Date;
}

export interface SandboxCreateOptions extends SandboxConfig {
	projectId?: string;
	userId?: string;
	name?: string;
	description?: string;
	provider?: SandboxProvider;
}

export interface SandboxUpdateOptions {
	resources?: Partial<SandboxConfig['resources']>;
	environment?: Record<string, string>;
	ports?: PortMapping[];
	timeout?: number;
	metadata?: Record<string, any>;
}

/**
 * Base Sandbox Provider Interface
 */
export interface ISandboxProvider {
	readonly name: SandboxProvider;
	readonly capabilities: {
		supportsFileSystem: boolean;
		supportsTerminal: boolean;
		supportsPortForwarding: boolean;
		supportsSnapshots: boolean;
		supportsResourceScaling: boolean;
		maxConcurrentSessions: number;
		supportedRuntimes: string[];
	};

	/**
	 * Initialize the provider
	 */
	initialize(): Promise<void>;

	/**
	 * Create a new sandbox environment
	 */
	createSandbox(config: SandboxCreateOptions): Promise<SandboxEnvironment>;

	/**
	 * Get sandbox information
	 */
	getSandbox(sandboxId: string): Promise<SandboxEnvironment | null>;

	/**
	 * List all sandboxes for a user/project
	 */
	listSandboxes(filters?: {
		userId?: string;
		projectId?: string;
		status?: SandboxStatus;
		template?: string;
	}): Promise<SandboxEnvironment[]>;

	/**
	 * Update sandbox configuration
	 */
	updateSandbox(sandboxId: string, options: SandboxUpdateOptions): Promise<SandboxEnvironment>;

	/**
	 * Start a stopped sandbox
	 */
	startSandbox(sandboxId: string): Promise<SandboxEnvironment>;

	/**
	 * Stop a running sandbox
	 */
	stopSandbox(sandboxId: string): Promise<SandboxEnvironment>;

	/**
	 * Restart a sandbox
	 */
	restartSandbox(sandboxId: string): Promise<SandboxEnvironment>;

	/**
	 * Delete a sandbox permanently
	 */
	deleteSandbox(sandboxId: string): Promise<boolean>;

	/**
	 * Get real-time metrics for a sandbox
	 */
	getMetrics(sandboxId: string): Promise<SandboxMetrics | null>;

	/**
	 * Execute command in sandbox
	 */
	executeCommand(
		sandboxId: string,
		command: string,
		options?: {
			workingDir?: string;
			timeout?: number;
			environment?: Record<string, string>;
		}
	): Promise<ExecutionResult>;

	/**
	 * Get file system information
	 */
	listFiles(
		sandboxId: string,
		path?: string,
		options?: {
			recursive?: boolean;
			includeHidden?: boolean;
			maxDepth?: number;
		}
	): Promise<FileSystemEntry[]>;

	/**
	 * Read file content
	 */
	readFile(
		sandboxId: string,
		filePath: string,
		options?: {
			encoding?: 'utf-8' | 'base64' | 'binary';
			maxSize?: number;
		}
	): Promise<SandboxFile | null>;

	/**
	 * Write file content
	 */
	writeFile(
		sandboxId: string,
		filePath: string,
		content: string | Buffer,
		options?: {
			encoding?: 'utf-8' | 'base64' | 'binary';
			createDirs?: boolean;
			backup?: boolean;
		}
	): Promise<boolean>;

	/**
	 * Delete file or directory
	 */
	deleteFile(
		sandboxId: string,
		filePath: string,
		options?: {
			recursive?: boolean;
			force?: boolean;
		}
	): Promise<boolean>;

	/**
	 * Create directory
	 */
	createDirectory(
		sandboxId: string,
		dirPath: string,
		options?: {
			recursive?: boolean;
			permissions?: string;
		}
	): Promise<boolean>;

	/**
	 * Upload multiple files to sandbox
	 */
	uploadFiles(
		sandboxId: string,
		files: Record<string, string | Buffer>,
		options?: {
			baseDir?: string;
			overwrite?: boolean;
			createDirs?: boolean;
		}
	): Promise<{ uploaded: string[]; failed: string[] }>;

	/**
	 * Download multiple files from sandbox
	 */
	downloadFiles(
		sandboxId: string,
		filePaths: string[],
		options?: {
			baseDir?: string;
			compress?: boolean;
		}
	): Promise<Record<string, Buffer>>;

	/**
	 * Create a snapshot of the sandbox
	 */
	createSnapshot(
		sandboxId: string,
		name?: string,
		options?: {
			description?: string;
			includeRuntime?: boolean;
			compress?: boolean;
		}
	): Promise<{ snapshotId: string; size: number }>;

	/**
	 * Restore sandbox from snapshot
	 */
	restoreSnapshot(
		sandboxId: string,
		snapshotId: string,
		options?: {
			preserveFiles?: string[];
			restartAfter?: boolean;
		}
	): Promise<boolean>;

	/**
	 * Get sandbox logs
	 */
	getLogs(
		sandboxId: string,
		options?: {
			since?: Date;
			until?: Date;
			tail?: number;
			follow?: boolean;
		}
	): Promise<string[]>;

	/**
	 * Establish terminal connection
	 */
	connectTerminal(
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
	}>;

	/**
	 * Disconnect terminal session
	 */
	disconnectTerminal(sessionId: string): Promise<boolean>;

	/**
	 * Setup port forwarding
	 */
	forwardPort(
		sandboxId: string,
		internalPort: number,
		options?: {
			externalPort?: number;
			protocol?: 'tcp' | 'udp';
			public?: boolean;
		}
	): Promise<{ externalPort: number; url?: string }>;

	/**
	 * Remove port forwarding
	 */
	removePortForward(sandboxId: string, externalPort: number): Promise<boolean>;

	/**
	 * Get provider-specific information
	 */
	getProviderInfo(): Promise<{
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
	}>;

	/**
	 * Health check for the provider
	 */
	healthCheck(): Promise<{
		healthy: boolean;
		latency: number;
		error?: string;
		details?: Record<string, any>;
	}>;

	/**
	 * Cleanup resources (called on shutdown)
	 */
	cleanup(): Promise<void>;
}

/**
 * Sandbox Provider Events
 */
export interface SandboxProviderEvents {
	'sandbox:created': (sandbox: SandboxEnvironment) => void;
	'sandbox:started': (sandbox: SandboxEnvironment) => void;
	'sandbox:stopped': (sandbox: SandboxEnvironment) => void;
	'sandbox:deleted': (sandboxId: string) => void;
	'sandbox:error': (sandboxId: string, error: Error) => void;
	'sandbox:metrics': (sandboxId: string, metrics: SandboxMetrics) => void;
	'terminal:connected': (sandboxId: string, sessionId: string) => void;
	'terminal:disconnected': (sandboxId: string, sessionId: string) => void;
	'file:changed': (
		sandboxId: string,
		filePath: string,
		changeType: 'created' | 'modified' | 'deleted'
	) => void;
}

/**
 * Provider Factory Interface
 */
export interface ISandboxProviderFactory {
	createProvider(type: SandboxProvider, config: any): ISandboxProvider;
	getAvailableProviders(): SandboxProvider[];
	validateConfig(type: SandboxProvider, config: any): boolean;
}
