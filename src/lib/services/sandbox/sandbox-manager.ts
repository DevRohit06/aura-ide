/**
 * Sandbox Manager Service
 * Central service for managing sandbox operations across providers
 */

import { sandboxConfig } from '../../config/sandbox.config.js';
import type { SandboxProvider, SandboxStatus } from '../../types/sandbox.js';
import { fileChangeBroadcaster } from '../file-change-broadcaster.js';
import { SandboxProviderFactory } from './provider-factory.js';
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

interface LoadBalancingState {
	roundRobinIndex: number;
	providerLoads: Map<SandboxProvider, number>;
	lastHealthCheck: Map<SandboxProvider, Date>;
}

interface SandboxSession {
	id: string;
	sandboxId: string;
	provider: SandboxProvider;
	userId?: string;
	projectId?: string;
	createdAt: Date;
	lastActivity: Date;
	metadata: Record<string, any>;
}

/**
 * Central Sandbox Manager
 */
export class SandboxManager {
	private static instance: SandboxManager | null = null;
	private factory: SandboxProviderFactory;
	private initialized = false;
	private loadBalancing: LoadBalancingState;
	private activeSessions = new Map<string, SandboxSession>();
	private eventListeners: Map<keyof SandboxProviderEvents, Function[]> = new Map();
	private healthCheckInterval?: NodeJS.Timeout;
	private metricsInterval?: NodeJS.Timeout;

	private constructor() {
		this.factory = SandboxProviderFactory.getInstance();
		this.loadBalancing = {
			roundRobinIndex: 0,
			providerLoads: new Map(),
			lastHealthCheck: new Map()
		};
	}

	static getInstance(): SandboxManager {
		if (!this.instance) {
			this.instance = new SandboxManager();
		}
		return this.instance;
	}

	async initialize(): Promise<void> {
		if (this.initialized) {
			console.log('✅ [SandboxManager] Already initialized, skipping');
			return;
		}

		console.log('🚀 [SandboxManager] Starting initialization', {
			timestamp: new Date().toISOString()
		});

		try {
			// Initialize all available providers
			console.log('🔧 [SandboxManager] Initializing all providers');
			await this.factory.initializeAllProviders();

			const availableProviders = this.factory.getAvailableProviders();
			console.log('✅ [SandboxManager] Providers initialized', {
				availableProviders,
				providerCount: availableProviders.length
			});

			// Setup provider event listeners
			console.log('🔗 [SandboxManager] Setting up provider event listeners');
			this.setupProviderEventListeners();

			// Start metrics collection if enabled
			if (sandboxConfig.monitoring.metrics.enabled) {
				console.log('📊 [SandboxManager] Starting metrics collection');
				this.startMetricsCollection();
			} else {
				console.log('⚠️ [SandboxManager] Metrics collection disabled in config');
			}

			this.initialized = true;
			console.log('✅ [SandboxManager] Initialization completed successfully', {
				timestamp: new Date().toISOString()
			});
		} catch (error) {
			console.error('❌ [SandboxManager] Initialization failed', {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				timestamp: new Date().toISOString()
			});
			throw new Error(`Failed to initialize Sandbox Manager: ${error}`);
		}
	}
	async createSandbox(options: SandboxCreateOptions): Promise<SandboxEnvironment> {
		await this.ensureInitialized();

		const provider = await this.selectProvider(options.provider);

		try {
			const environment = await provider.createSandbox(options);

			// Create session tracking
			const session: SandboxSession = {
				id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
				sandboxId: environment.id,
				provider: environment.provider,
				userId: options.userId,
				projectId: options.projectId,
				createdAt: new Date(),
				lastActivity: new Date(),
				metadata: options.metadata || {}
			};

			this.activeSessions.set(session.id, session);

			// Update load balancing state
			this.updateProviderLoad(environment.provider, 1);

			return environment;
		} catch (error) {
			// Try failover if enabled
			if (sandboxConfig.provider.failover.enabled && !options.provider) {
				return await this.createSandboxWithFailover(options, provider.name);
			}
			throw error;
		}
	}

	async getSandbox(
		sandboxId: string,
		provider?: SandboxProvider
	): Promise<SandboxEnvironment | null> {
		await this.ensureInitialized();

		if (provider) {
			const providerInstance = this.factory.getProvider(provider);
			if (!providerInstance) {
				throw new Error(`Provider ${provider} not available`);
			}
			return await providerInstance.getSandbox(sandboxId);
		}

		// Try all providers if no specific provider given
		const providers = this.factory.getAvailableProviders();
		for (const providerType of providers) {
			try {
				const providerInstance = this.factory.getProvider(providerType);
				if (providerInstance) {
					const environment = await providerInstance.getSandbox(sandboxId);
					if (environment) return environment;
				}
			} catch (error) {
				// Continue to next provider
			}
		}

		return null;
	}

	async listSandboxes(filters?: {
		userId?: string;
		projectId?: string;
		status?: SandboxStatus;
		template?: string;
		provider?: SandboxProvider;
	}): Promise<SandboxEnvironment[]> {
		await this.ensureInitialized();

		const environments: SandboxEnvironment[] = [];
		const providers = filters?.provider ? [filters.provider] : this.factory.getAvailableProviders();

		for (const providerType of providers) {
			try {
				const provider = this.factory.getProvider(providerType);
				if (provider) {
					const providerEnvironments = await provider.listSandboxes(filters);
					environments.push(...providerEnvironments);
				}
			} catch (error) {
				// Continue with other providers
			}
		}

		return environments;
	}

	async updateSandbox(
		sandboxId: string,
		options: SandboxUpdateOptions,
		provider?: SandboxProvider
	): Promise<SandboxEnvironment> {
		await this.ensureInitialized();

		const providerInstance = await this.getProviderForSandbox(sandboxId, provider);
		return await providerInstance.updateSandbox(sandboxId, options);
	}

	async startSandbox(sandboxId: string, provider?: SandboxProvider): Promise<SandboxEnvironment> {
		await this.ensureInitialized();

		const providerInstance = await this.getProviderForSandbox(sandboxId, provider);
		const environment = await providerInstance.startSandbox(sandboxId);

		this.updateSessionActivity(sandboxId);
		return environment;
	}

	async stopSandbox(sandboxId: string, provider?: SandboxProvider): Promise<SandboxEnvironment> {
		await this.ensureInitialized();

		const providerInstance = await this.getProviderForSandbox(sandboxId, provider);
		const environment = await providerInstance.stopSandbox(sandboxId);

		this.updateSessionActivity(sandboxId);
		return environment;
	}

	async restartSandbox(sandboxId: string, provider?: SandboxProvider): Promise<SandboxEnvironment> {
		await this.ensureInitialized();

		const providerInstance = await this.getProviderForSandbox(sandboxId, provider);
		const environment = await providerInstance.restartSandbox(sandboxId);

		this.updateSessionActivity(sandboxId);
		return environment;
	}

	async deleteSandbox(sandboxId: string, provider?: SandboxProvider): Promise<boolean> {
		await this.ensureInitialized();

		const providerInstance = await this.getProviderForSandbox(sandboxId, provider);
		const success = await providerInstance.deleteSandbox(sandboxId);

		if (success) {
			// Remove session tracking
			const session = this.findSessionBySandboxId(sandboxId);
			if (session) {
				this.activeSessions.delete(session.id);
				this.updateProviderLoad(session.provider, -1);
			}
		}

		return success;
	}

	async getMetrics(sandboxId: string, provider?: SandboxProvider): Promise<SandboxMetrics | null> {
		await this.ensureInitialized();

		const providerInstance = await this.getProviderForSandbox(sandboxId, provider);
		const metrics = await providerInstance.getMetrics(sandboxId);

		this.updateSessionActivity(sandboxId);
		return metrics;
	}

	async executeCommand(
		sandboxId: string,
		command: string,
		options?: {
			workingDir?: string;
			timeout?: number;
			environment?: Record<string, string>;
			provider?: SandboxProvider;
		}
	): Promise<ExecutionResult> {
		console.log('⚡ [SandboxManager] Starting executeCommand', {
			sandboxId,
			command,
			workingDir: options?.workingDir,
			timeout: options?.timeout,
			provider: options?.provider,
			timestamp: new Date().toISOString()
		});

		await this.ensureInitialized();

		try {
			console.log('🔍 [SandboxManager] Getting provider for sandbox', {
				sandboxId,
				requestedProvider: options?.provider
			});

			const providerInstance = await this.getProviderForSandbox(sandboxId, options?.provider);

			console.log('✅ [SandboxManager] Provider found, executing command', {
				providerType: providerInstance.constructor.name,
				sandboxId,
				command
			});

			const startTime = Date.now();
			const result = await providerInstance.executeCommand(sandboxId, command, {
				workingDir: options?.workingDir,
				timeout: options?.timeout,
				environment: options?.environment
			});
			const executionTime = Date.now() - startTime;

			console.log('⚡ [SandboxManager] Command execution completed', {
				sandboxId,
				command,
				success: result.success,
				exitCode: result.exitCode,
				outputLength: result.output?.length || 0,
				outputPreview:
					result.output?.substring(0, 200) + (result.output?.length > 200 ? '...' : ''),
				error: result.error,
				duration: result.duration,
				measuredExecutionTime: executionTime,
				timestamp: new Date().toISOString()
			});

			this.updateSessionActivity(sandboxId);
			return result;
		} catch (error) {
			console.error('❌ [SandboxManager] executeCommand failed', {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				sandboxId,
				command,
				options,
				timestamp: new Date().toISOString()
			});
			throw error;
		}
	}

	async listFiles(
		sandboxId: string,
		path?: string,
		options?: {
			recursive?: boolean;
			includeHidden?: boolean;
			maxDepth?: number;
			provider?: SandboxProvider;
		}
	): Promise<FileSystemEntry[]> {
		console.log('📁 [SandboxManager] Starting listFiles', {
			sandboxId,
			path,
			options,
			timestamp: new Date().toISOString()
		});

		await this.ensureInitialized();

		try {
			console.log('🔍 [SandboxManager] Getting provider for listFiles', {
				sandboxId,
				requestedProvider: options?.provider
			});

			const providerInstance = await this.getProviderForSandbox(sandboxId, options?.provider);

			console.log('✅ [SandboxManager] Provider found, listing files', {
				providerType: providerInstance.constructor.name,
				sandboxId,
				path: path || 'default'
			});

			const startTime = Date.now();
			const files = await providerInstance.listFiles(sandboxId, path, {
				recursive: options?.recursive,
				includeHidden: options?.includeHidden,
				maxDepth: options?.maxDepth
			});
			const executionTime = Date.now() - startTime;

			console.log('📁 [SandboxManager] File listing completed', {
				sandboxId,
				fileCount: files.length,
				fileTypes: files.reduce(
					(acc, f) => {
						acc[f.type] = (acc[f.type] || 0) + 1;
						return acc;
					},
					{} as Record<string, number>
				),
				executionTime,
				timestamp: new Date().toISOString()
			});

			this.updateSessionActivity(sandboxId);
			return files;
		} catch (error) {
			console.error('❌ [SandboxManager] listFiles failed', {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				sandboxId,
				path,
				options,
				timestamp: new Date().toISOString()
			});
			throw error;
		}
	}

	async readFile(
		sandboxId: string,
		filePath: string,
		options?: {
			encoding?: 'utf-8' | 'base64' | 'binary';
			maxSize?: number;
			provider?: SandboxProvider;
		}
	): Promise<SandboxFile | null> {
		await this.ensureInitialized();

		const providerInstance = await this.getProviderForSandbox(sandboxId, options?.provider);
		const file = await providerInstance.readFile(sandboxId, filePath, {
			encoding: options?.encoding,
			maxSize: options?.maxSize
		});

		this.updateSessionActivity(sandboxId);
		return file;
	}

	async writeFile(
		sandboxId: string,
		filePath: string,
		content: string | Buffer,
		options?: {
			encoding?: 'utf-8' | 'base64' | 'binary';
			createDirs?: boolean;
			backup?: boolean;
			provider?: SandboxProvider;
			userId?: string;
			projectId?: string;
		}
	): Promise<boolean> {
		await this.ensureInitialized();

		const providerInstance = await this.getProviderForSandbox(sandboxId, options?.provider);
		const success = await providerInstance.writeFile(sandboxId, filePath, content, {
			encoding: options?.encoding,
			createDirs: options?.createDirs,
			backup: options?.backup
		});

		// Broadcast file change event for real-time UI updates
		if (success) {
			const session = this.activeSessions.get(sandboxId);
			const contentString = typeof content === 'string' ? content : content.toString('utf-8');

			// Use 'created' type - the file handlers will handle both creates and updates
			console.log(`📡 [SandboxManager] Broadcasting file change for:`, filePath, {
				contentLength: contentString.length,
				sandboxId,
				projectId: options?.projectId || session?.projectId
			});

			fileChangeBroadcaster.broadcast({
				type: 'created', // Use 'created' - handlers will update existing files
				path: filePath,
				content: contentString,
				timestamp: Date.now(),
				sandboxId,
				projectId: options?.projectId || session?.projectId,
				userId: options?.userId || session?.userId,
				metadata: {
					encoding: options?.encoding || 'utf-8',
					source: 'agent'
				}
			});
		}

		this.updateSessionActivity(sandboxId);
		return success;
	}

	async deleteFile(
		sandboxId: string,
		filePath: string,
		options?: {
			recursive?: boolean;
			force?: boolean;
			provider?: SandboxProvider;
			userId?: string;
			projectId?: string;
		}
	): Promise<boolean> {
		await this.ensureInitialized();

		const providerInstance = await this.getProviderForSandbox(sandboxId, options?.provider);
		const success = await providerInstance.deleteFile(sandboxId, filePath, {
			recursive: options?.recursive,
			force: options?.force
		});

		// Broadcast file deletion event for real-time UI updates
		if (success) {
			const session = this.activeSessions.get(sandboxId);
			fileChangeBroadcaster.broadcast({
				type: 'deleted',
				path: filePath,
				timestamp: Date.now(),
				sandboxId,
				projectId: options?.projectId || session?.projectId,
				userId: options?.userId || session?.userId,
				metadata: {
					source: 'agent'
				}
			});
		}

		this.updateSessionActivity(sandboxId);
		return success;
	}

	async createDirectory(
		sandboxId: string,
		dirPath: string,
		options?: {
			recursive?: boolean;
			permissions?: string;
			provider?: SandboxProvider;
		}
	): Promise<boolean> {
		await this.ensureInitialized();

		const providerInstance = await this.getProviderForSandbox(sandboxId, options?.provider);
		const success = await providerInstance.createDirectory(sandboxId, dirPath, {
			recursive: options?.recursive,
			permissions: options?.permissions
		});

		this.updateSessionActivity(sandboxId);
		return success;
	}

	async uploadFiles(
		sandboxId: string,
		files: Record<string, string | Buffer>,
		options?: {
			baseDir?: string;
			overwrite?: boolean;
			createDirs?: boolean;
			provider?: SandboxProvider;
		}
	): Promise<{ uploaded: string[]; failed: string[] }> {
		await this.ensureInitialized();

		const providerInstance = await this.getProviderForSandbox(sandboxId, options?.provider);
		const result = await providerInstance.uploadFiles(sandboxId, files, {
			baseDir: options?.baseDir,
			overwrite: options?.overwrite,
			createDirs: options?.createDirs
		});

		this.updateSessionActivity(sandboxId);
		return result;
	}

	async downloadFiles(
		sandboxId: string,
		filePaths: string[],
		options?: {
			baseDir?: string;
			compress?: boolean;
			provider?: SandboxProvider;
		}
	): Promise<Record<string, Buffer>> {
		await this.ensureInitialized();

		const providerInstance = await this.getProviderForSandbox(sandboxId, options?.provider);
		const files = await providerInstance.downloadFiles(sandboxId, filePaths, {
			baseDir: options?.baseDir,
			compress: options?.compress
		});

		this.updateSessionActivity(sandboxId);
		return files;
	}

	async createSnapshot(
		sandboxId: string,
		name?: string,
		options?: {
			description?: string;
			includeRuntime?: boolean;
			compress?: boolean;
			provider?: SandboxProvider;
		}
	): Promise<{ snapshotId: string; size: number }> {
		await this.ensureInitialized();

		const providerInstance = await this.getProviderForSandbox(sandboxId, options?.provider);
		const snapshot = await providerInstance.createSnapshot(sandboxId, name, {
			description: options?.description,
			includeRuntime: options?.includeRuntime,
			compress: options?.compress
		});

		this.updateSessionActivity(sandboxId);
		return snapshot;
	}

	async restoreSnapshot(
		sandboxId: string,
		snapshotId: string,
		options?: {
			preserveFiles?: string[];
			restartAfter?: boolean;
			provider?: SandboxProvider;
		}
	): Promise<boolean> {
		await this.ensureInitialized();

		const providerInstance = await this.getProviderForSandbox(sandboxId, options?.provider);
		const success = await providerInstance.restoreSnapshot(sandboxId, snapshotId, {
			preserveFiles: options?.preserveFiles,
			restartAfter: options?.restartAfter
		});

		this.updateSessionActivity(sandboxId);
		return success;
	}

	async connectTerminal(
		sandboxId: string,
		options?: {
			shell?: string;
			workingDir?: string;
			rows?: number;
			cols?: number;
			provider?: SandboxProvider;
		}
	): Promise<{
		sessionId: string;
		sshConnection?: any;
	}> {
		await this.ensureInitialized();

		const providerInstance = await this.getProviderForSandbox(sandboxId, options?.provider);
		const terminal = await providerInstance.connectTerminal(sandboxId, {
			shell: options?.shell,
			workingDir: options?.workingDir,
			rows: options?.rows,
			cols: options?.cols
		});

		this.updateSessionActivity(sandboxId);
		return terminal;
	}

	async forwardPort(
		sandboxId: string,
		internalPort: number,
		options?: {
			externalPort?: number;
			protocol?: 'tcp' | 'udp';
			public?: boolean;
			provider?: SandboxProvider;
		}
	): Promise<{ externalPort: number; url?: string }> {
		await this.ensureInitialized();

		const providerInstance = await this.getProviderForSandbox(sandboxId, options?.provider);
		const port = await providerInstance.forwardPort(sandboxId, internalPort, {
			externalPort: options?.externalPort,
			protocol: options?.protocol,
			public: options?.public
		});

		this.updateSessionActivity(sandboxId);
		return port;
	}

	// Provider management methods

	async getAvailableProviders(): Promise<SandboxProvider[]> {
		return this.factory.getAvailableProviders();
	}

	async getProviderInfo(provider: SandboxProvider): Promise<any> {
		await this.ensureInitialized();
		return await this.factory.getProviderInfo(provider);
	}

	async getProviderCapabilities(
		provider: SandboxProvider
	): Promise<ISandboxProvider['capabilities'] | null> {
		return this.factory.getProviderCapabilities(provider);
	}

	async healthCheckProviders(): Promise<
		Record<
			SandboxProvider,
			{
				healthy: boolean;
				latency: number;
				error?: string;
			}
		>
	> {
		await this.ensureInitialized();
		return await this.factory.healthCheckAllProviders();
	}

	// Session management methods

	getActiveSessions(filters?: {
		userId?: string;
		projectId?: string;
		provider?: SandboxProvider;
	}): SandboxSession[] {
		let sessions = Array.from(this.activeSessions.values());

		if (filters?.userId) {
			sessions = sessions.filter((s) => s.userId === filters.userId);
		}
		if (filters?.projectId) {
			sessions = sessions.filter((s) => s.projectId === filters.projectId);
		}
		if (filters?.provider) {
			sessions = sessions.filter((s) => s.provider === filters.provider);
		}

		return sessions;
	}

	getSessionById(sessionId: string): SandboxSession | null {
		return this.activeSessions.get(sessionId) || null;
	}

	async cleanupInactiveSessions(maxInactiveTime = 3600000): Promise<number> {
		// 1 hour default
		const now = Date.now();
		let cleaned = 0;

		for (const [sessionId, session] of this.activeSessions) {
			if (now - session.lastActivity.getTime() > maxInactiveTime) {
				try {
					await this.deleteSandbox(session.sandboxId, session.provider);
					cleaned++;
				} catch (error) {
					// Log error but continue cleanup
				}
			}
		}

		return cleaned;
	}

	// Event management

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

	// Cleanup

	async cleanup(): Promise<void> {
		// Stop intervals
		if (this.healthCheckInterval) {
			clearInterval(this.healthCheckInterval);
		}
		if (this.metricsInterval) {
			clearInterval(this.metricsInterval);
		}

		// Cleanup all providers
		await this.factory.cleanupAllProviders();

		// Clear sessions
		this.activeSessions.clear();
		this.eventListeners.clear();
		this.initialized = false;
	}

	// Private methods

	private async ensureInitialized(): Promise<void> {
		if (!this.initialized) {
			await this.initialize();
		}
	}

	private async selectProvider(preferredProvider?: SandboxProvider): Promise<ISandboxProvider> {
		if (preferredProvider) {
			const provider = this.factory.getProvider(preferredProvider);
			if (!provider) {
				throw new Error(`Preferred provider ${preferredProvider} not available`);
			}
			return provider;
		}

		// Use load balancing
		if (sandboxConfig.provider.loadBalancing.enabled) {
			return await this.selectProviderByLoad();
		}

		// Use default provider
		const defaultProvider = this.factory.getProvider(sandboxConfig.provider.defaultProvider);
		if (!defaultProvider) {
			throw new Error(`Default provider ${sandboxConfig.provider.defaultProvider} not available`);
		}

		return defaultProvider;
	}

	private async selectProviderByLoad(): Promise<ISandboxProvider> {
		const availableProviders = this.factory.getAvailableProviders();

		if (availableProviders.length === 0) {
			throw new Error('No providers available');
		}

		switch (sandboxConfig.provider.loadBalancing.strategy) {
			case 'round-robin':
				return this.selectProviderRoundRobin(availableProviders);

			case 'least-loaded':
				return this.selectProviderLeastLoaded(availableProviders);

			case 'random':
				return this.selectProviderRandom(availableProviders);

			default:
				return this.selectProviderRoundRobin(availableProviders);
		}
	}

	private selectProviderRoundRobin(providers: SandboxProvider[]): ISandboxProvider {
		const provider = providers[this.loadBalancing.roundRobinIndex % providers.length];
		this.loadBalancing.roundRobinIndex++;

		return this.factory.getProvider(provider)!;
	}

	private selectProviderLeastLoaded(providers: SandboxProvider[]): ISandboxProvider {
		let selectedProvider = providers[0];
		let minLoad = this.loadBalancing.providerLoads.get(selectedProvider) || 0;

		for (const provider of providers) {
			const load = this.loadBalancing.providerLoads.get(provider) || 0;
			if (load < minLoad) {
				selectedProvider = provider;
				minLoad = load;
			}
		}

		return this.factory.getProvider(selectedProvider)!;
	}

	private selectProviderRandom(providers: SandboxProvider[]): ISandboxProvider {
		const randomIndex = Math.floor(Math.random() * providers.length);
		const provider = providers[randomIndex];

		return this.factory.getProvider(provider)!;
	}

	private async createSandboxWithFailover(
		options: SandboxCreateOptions,
		excludeProvider: SandboxProvider
	): Promise<SandboxEnvironment> {
		const availableProviders = this.factory
			.getAvailableProviders()
			.filter((p) => p !== excludeProvider);

		if (availableProviders.length === 0) {
			throw new Error('No fallback providers available');
		}

		const fallbackProvider = availableProviders.includes(sandboxConfig.provider.fallbackProvider)
			? sandboxConfig.provider.fallbackProvider
			: availableProviders[0];

		const provider = this.factory.getProvider(fallbackProvider);
		if (!provider) {
			throw new Error(`Fallback provider ${fallbackProvider} not available`);
		}

		return await provider.createSandbox(options);
	}

	async getProviderForSandbox(
		sandboxId: string,
		provider?: SandboxProvider
	): Promise<ISandboxProvider> {
		if (provider) {
			const providerInstance = this.factory.getProvider(provider);
			if (!providerInstance) {
				throw new Error(`Provider ${provider} not available`);
			}
			return providerInstance;
		}

		// Find provider by checking sessions
		const session = this.findSessionBySandboxId(sandboxId);
		if (session) {
			const providerInstance = this.factory.getProvider(session.provider);
			if (providerInstance) {
				return providerInstance;
			}
		}

		// Try all providers
		const providers = this.factory.getAvailableProviders();
		for (const providerType of providers) {
			try {
				const providerInstance = this.factory.getProvider(providerType);
				if (providerInstance) {
					const environment = await providerInstance.getSandbox(sandboxId);
					if (environment) return providerInstance;
				}
			} catch (error) {
				// Continue to next provider
			}
		}

		throw new Error(`Sandbox ${sandboxId} not found in any provider`);
	}

	private updateProviderLoad(provider: SandboxProvider, delta: number): void {
		const currentLoad = this.loadBalancing.providerLoads.get(provider) || 0;
		this.loadBalancing.providerLoads.set(provider, Math.max(0, currentLoad + delta));
	}

	private findSessionBySandboxId(sandboxId: string): SandboxSession | null {
		for (const session of this.activeSessions.values()) {
			if (session.sandboxId === sandboxId) {
				return session;
			}
		}
		return null;
	}

	private updateSessionActivity(sandboxId: string): void {
		const session = this.findSessionBySandboxId(sandboxId);
		if (session) {
			session.lastActivity = new Date();
		}
	}

	private setupProviderEventListeners(): void {
		const providers = this.factory.getAvailableProviders();

		for (const providerType of providers) {
			const provider = this.factory.getProvider(providerType);
			if (provider && 'on' in provider) {
				// Forward provider events
				(provider as any).on('sandbox:created', (env: SandboxEnvironment) => {
					this.emit('sandbox:created', env);
				});

				(provider as any).on('sandbox:started', (env: SandboxEnvironment) => {
					this.emit('sandbox:started', env);
				});

				(provider as any).on('sandbox:stopped', (env: SandboxEnvironment) => {
					this.emit('sandbox:stopped', env);
				});

				(provider as any).on('sandbox:deleted', (sandboxId: string) => {
					this.emit('sandbox:deleted', sandboxId);
				});

				(provider as any).on('sandbox:error', (sandboxId: string, error: Error) => {
					this.emit('sandbox:error', sandboxId, error);
				});
			}
		}
	}

	private startMetricsCollection(): void {
		this.metricsInterval = setInterval(async () => {
			// Collect metrics from all active sessions
			for (const session of this.activeSessions.values()) {
				try {
					const provider = this.factory.getProvider(session.provider);
					if (provider) {
						await provider.getMetrics(session.sandboxId);
					}
				} catch (error) {
					// Ignore metrics collection errors
				}
			}
		}, sandboxConfig.monitoring.metrics.interval);
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
}

// Export singleton instance
export const sandboxManager = SandboxManager.getInstance();
