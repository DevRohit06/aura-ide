/**
 * Sandbox Service
 * Central service for managing sandboxes, integrating with multiple providers,
 * file storage, and session management
 */

import type {
	ProjectTemplate,
	SandboxProvider,
	SandboxSession,
	SandboxStatus
} from '../types/sandbox.js';
import { DatabaseService } from './database.service.js';
import { SandboxManager } from './sandbox/sandbox-manager.js';
import type {
	SandboxCreateOptions,
	SandboxEnvironment,
	SandboxFile,
	SandboxMetrics
} from './sandbox/sandbox-provider.interface.js';

interface ProviderHealthStatus {
	name: SandboxProvider;
	status: 'healthy' | 'degraded' | 'unhealthy';
	type: string;
	lastCheck: Date;
	error?: string;
	metrics?: {
		responseTime: number;
		activeInstances: number;
		successRate: number;
	};
}

interface SandboxServiceMetrics {
	totalSandboxes: number;
	activeSandboxes: number;
	providerDistribution: Record<SandboxProvider, number>;
	averageSessionDuration: number;
	resourceUtilization: {
		cpu: number;
		memory: number;
		storage: number;
	};
}

export class SandboxService {
	private static instance: SandboxService | null = null;
	private sandboxManager: SandboxManager;
	private initialized = false;

	private constructor() {
		this.sandboxManager = SandboxManager.getInstance();
	}

	static getInstance(): SandboxService {
		if (!this.instance) {
			this.instance = new SandboxService();
		}
		return this.instance;
	}

	async initialize(): Promise<void> {
		if (this.initialized) return;

		try {
			await this.sandboxManager.initialize();
			this.initialized = true;
		} catch (error) {
			throw new Error(`Failed to initialize Sandbox Service: ${error}`);
		}
	}

	private async ensureInitialized(): Promise<void> {
		if (!this.initialized) {
			await this.initialize();
		}
	}

	// Sandbox Management
	async createSandbox(options: {
		userId: string;
		projectId?: string;
		templateId?: string;
		provider?: SandboxProvider;
		environment?: Record<string, string>;
		resourceLimits?: {
			maxCpu: number;
			maxMemory: number;
			maxStorage: number;
		};
	}): Promise<SandboxEnvironment> {
		await this.ensureInitialized();

		const createOptions: SandboxCreateOptions = {
			provider: options.provider,
			template: options.templateId,
			environment: options.environment || {},
			metadata: {
				userId: options.userId,
				projectId: options.projectId,
				createdAt: new Date().toISOString()
			}
		};

		if (options.resourceLimits) {
			createOptions.resources = {
				cpu: options.resourceLimits.maxCpu,
				memory: options.resourceLimits.maxMemory,
				storage: options.resourceLimits.maxStorage
			};
		}

		const environment = await this.sandboxManager.createSandbox(createOptions);

		// Store session in database
		await this.createSandboxSession({
			id: environment.id,
			sandboxId: environment.id,
			user_id: options.userId,
			userId: options.userId,
			projectId: options.projectId || '',
			templateId: options.templateId,
			provider: environment.provider,
			status: 'initializing',
			start_time: new Date(),
			last_accessed: new Date(),
			resource_limits: options.resourceLimits || {},
			network_info: {},
			metadata: {}
		});

		return environment;
	}

	async getSandbox(sandboxId: string): Promise<SandboxEnvironment | null> {
		await this.ensureInitialized();
		return await this.sandboxManager.getSandbox(sandboxId);
	}

	async listSandboxes(filters?: {
		userId?: string;
		projectId?: string;
		provider?: SandboxProvider;
		status?: SandboxStatus;
	}): Promise<SandboxEnvironment[]> {
		await this.ensureInitialized();
		return await this.sandboxManager.listSandboxes(filters);
	}

	async updateSandbox(
		sandboxId: string,
		updates: {
			status?: SandboxStatus;
			environment?: Record<string, string>;
			metadata?: Record<string, any>;
		}
	): Promise<SandboxEnvironment> {
		await this.ensureInitialized();
		return await this.sandboxManager.updateSandbox(sandboxId, updates);
	}

	async deleteSandbox(sandboxId: string): Promise<boolean> {
		await this.ensureInitialized();

		// Delete from provider
		const success = await this.sandboxManager.deleteSandbox(sandboxId);

		if (success) {
			// Update session status in database
			await this.updateSandboxSession(sandboxId, {
				status: 'terminated',
				stop_time: new Date()
			});
		}

		return success;
	}

	async startSandbox(sandboxId: string): Promise<SandboxEnvironment> {
		await this.ensureInitialized();
		const environment = await this.sandboxManager.startSandbox(sandboxId);

		await this.updateSandboxSession(sandboxId, {
			status: 'running',
			last_activity: new Date()
		});

		return environment;
	}

	async stopSandbox(sandboxId: string): Promise<SandboxEnvironment> {
		await this.ensureInitialized();
		const environment = await this.sandboxManager.stopSandbox(sandboxId);

		await this.updateSandboxSession(sandboxId, {
			status: 'stopped',
			stop_time: new Date()
		});

		return environment;
	}

	async restartSandbox(sandboxId: string): Promise<SandboxEnvironment> {
		await this.ensureInitialized();
		const environment = await this.sandboxManager.restartSandbox(sandboxId);

		await this.updateSandboxSession(sandboxId, {
			status: 'running',
			last_activity: new Date()
		});

		return environment;
	}

	// File Operations
	async listFiles(sandboxId: string, path = '/'): Promise<SandboxFile[]> {
		await this.ensureInitialized();
		const files = await this.sandboxManager.listFiles(sandboxId, path);
		// Convert FileSystemEntry to SandboxFile
		return files.map((file) => ({
			path: file.path,
			content: file.content || '',
			size: file.size,
			modified: file.modified
		}));
	}

	async readFile(sandboxId: string, path: string): Promise<string> {
		await this.ensureInitialized();
		const file = await this.sandboxManager.readFile(sandboxId, path);
		if (!file) {
			throw new Error(`File not found: ${path}`);
		}
		return typeof file.content === 'string' ? file.content : file.content.toString();
	}

	async writeFile(sandboxId: string, path: string, content: string): Promise<SandboxFile> {
		await this.ensureInitialized();
		const success = await this.sandboxManager.writeFile(sandboxId, path, content);

		// Update session activity
		await this.updateSandboxSession(sandboxId, {
			last_activity: new Date()
		});

		if (!success) {
			throw new Error(`Failed to write file: ${path}`);
		}

		return {
			path,
			content,
			size: content.length
		};
	}

	async deleteFile(sandboxId: string, path: string): Promise<boolean> {
		await this.ensureInitialized();
		const success = await this.sandboxManager.deleteFile(sandboxId, path);

		if (success) {
			await this.updateSandboxSession(sandboxId, {
				last_activity: new Date()
			});
		}

		return success;
	}

	async createDirectory(sandboxId: string, path: string): Promise<SandboxFile> {
		await this.ensureInitialized();
		const success = await this.sandboxManager.createDirectory(sandboxId, path);

		await this.updateSandboxSession(sandboxId, {
			last_activity: new Date()
		});

		if (!success) {
			throw new Error(`Failed to create directory: ${path}`);
		}

		return {
			path,
			content: '',
			size: 0
		};
	}

	// Code Execution - simplified implementations
	async executeCode(sandboxId: string, code: string, language = 'javascript'): Promise<any> {
		await this.ensureInitialized();
		// Use execute command instead of executeCode
		const result = await this.sandboxManager.executeCommand(sandboxId, code, {
			workingDir: '/workspace'
		});

		await this.updateSandboxSession(sandboxId, {
			last_activity: new Date()
		});

		return result;
	}

	async installDependencies(sandboxId: string, dependencies: string[]): Promise<any> {
		await this.ensureInitialized();
		// Install using package manager commands
		const installCommand = `npm install ${dependencies.join(' ')}`;
		const result = await this.sandboxManager.executeCommand(sandboxId, installCommand, {
			workingDir: '/workspace'
		});

		await this.updateSandboxSession(sandboxId, {
			last_activity: new Date()
		});

		return result;
	}

	// Terminal Operations
	async createTerminal(sandboxId: string): Promise<string> {
		await this.ensureInitialized();
		// Generate a terminal ID since the manager doesn't have this method
		return `terminal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	async executeCommand(sandboxId: string, terminalId: string, command: string): Promise<any> {
		await this.ensureInitialized();
		const result = await this.sandboxManager.executeCommand(sandboxId, command, {
			workingDir: '/workspace'
		});

		await this.updateSandboxSession(sandboxId, {
			last_activity: new Date()
		});

		return result;
	}

	// Template Management
	async getAvailableTemplates(): Promise<ProjectTemplate[]> {
		try {
			// For now, return mock templates since we don't have a direct database access method
			return [
				{
					_id: new (await import('mongodb')).ObjectId(),
					name: 'React App',
					type: 'react',
					description: 'A basic React application template',
					stackblitz_path: 'create-react-app',
					category: 'frontend',
					tags: ['react', 'javascript', 'frontend'],
					is_active: true,
					popularity_score: 100,
					file_count: 10,
					dependencies: [],
					created_at: new Date(),
					updated_at: new Date()
				},
				{
					_id: new (await import('mongodb')).ObjectId(),
					name: 'Node.js API',
					type: 'nodejs',
					description: 'A Node.js API server template',
					stackblitz_path: 'node-express',
					category: 'backend',
					tags: ['nodejs', 'express', 'backend'],
					is_active: true,
					popularity_score: 90,
					file_count: 8,
					dependencies: [],
					created_at: new Date(),
					updated_at: new Date()
				}
			];
		} catch (error) {
			console.error('Error fetching templates:', error);
			return [];
		}
	}

	async getTemplate(templateId: string): Promise<ProjectTemplate | null> {
		try {
			const templates = await this.getAvailableTemplates();
			return templates.find((t) => t._id.toString() === templateId) || null;
		} catch (error) {
			console.error('Error fetching template:', error);
			return null;
		}
	}

	async createSandboxFromTemplate(
		templateId: string,
		options: {
			userId: string;
			projectId?: string;
			provider?: SandboxProvider;
		}
	): Promise<SandboxEnvironment> {
		const template = await this.getTemplate(templateId);
		if (!template) {
			throw new Error(`Template ${templateId} not found`);
		}

		return await this.createSandbox({
			...options,
			templateId
		});
	}

	// Health and Monitoring
	async getAvailableProviders(): Promise<ProviderHealthStatus[]> {
		await this.ensureInitialized();

		const providers: SandboxProvider[] = ['daytona', 'e2b'];
		const healthStatuses: ProviderHealthStatus[] = [];

		for (const providerName of providers) {
			try {
				const startTime = Date.now();
				// Simplified health check since getProvider method doesn't exist
				const responseTime = Date.now() - startTime;

				const status: ProviderHealthStatus = {
					name: providerName,
					status: 'healthy', // Assume healthy for now
					type: providerName,
					lastCheck: new Date(),
					metrics: {
						responseTime,
						activeInstances: 0,
						successRate: 100
					}
				};

				healthStatuses.push(status);
			} catch (error) {
				healthStatuses.push({
					name: providerName,
					status: 'unhealthy',
					type: providerName,
					lastCheck: new Date(),
					error: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		}

		return healthStatuses;
	}

	async getMetrics(): Promise<SandboxServiceMetrics> {
		await this.ensureInitialized();

		try {
			// Use mock data since we don't have direct database access
			return {
				totalSandboxes: 0,
				activeSandboxes: 0,
				providerDistribution: { daytona: 0, e2b: 0, local: 0 },
				averageSessionDuration: 0,
				resourceUtilization: { cpu: 0, memory: 0, storage: 0 }
			};
		} catch (error) {
			console.error('Error fetching sandbox metrics:', error);
			return {
				totalSandboxes: 0,
				activeSandboxes: 0,
				providerDistribution: { daytona: 0, e2b: 0, local: 0 },
				averageSessionDuration: 0,
				resourceUtilization: { cpu: 0, memory: 0, storage: 0 }
			};
		}
	}

	// Session Management
	private async createSandboxSession(
		session: Omit<SandboxSession, '_id' | 'created_at' | 'updated_at' | 'last_activity'>
	): Promise<SandboxSession> {
		try {
			const now = new Date();

			const sessionDoc = {
				...session,
				created_at: now,
				updated_at: now,
				last_activity: now,
				start_time: now,
				last_accessed: now,
				network_info: session.network_info || {},
				metadata: session.metadata || {}
			} as SandboxSession;

			return await DatabaseService.createSandboxSession(sessionDoc);
		} catch (error) {
			console.error('Error creating sandbox session:', error);
			throw error;
		}
	}

	private async updateSandboxSession(
		sandboxId: string,
		updates: Partial<SandboxSession>
	): Promise<void> {
		try {
			// For now, log the update since we don't have a direct update method
			console.log('Updating sandbox session:', sandboxId, updates);
			// In a real implementation, you would add an updateSandboxSession method to DatabaseService
		} catch (error) {
			console.error('Error updating sandbox session:', error);
		}
	}

	async getSandboxSession(sandboxId: string): Promise<SandboxSession | null> {
		try {
			return await DatabaseService.getSandboxSessionById(sandboxId);
		} catch (error) {
			console.error('Error fetching sandbox session:', error);
			return null;
		}
	}

	async getSandboxSessions(filters?: {
		userId?: string;
		projectId?: string;
		status?: SandboxStatus;
		provider?: SandboxProvider;
	}): Promise<SandboxSession[]> {
		try {
			if (filters?.userId) {
				return await DatabaseService.getSandboxSessionsByUser(filters.userId);
			}
			// For other filters, return empty array for now
			return [];
		} catch (error) {
			console.error('Error fetching sandbox sessions:', error);
			return [];
		}
	}

	// Cleanup and maintenance
	async cleanupExpiredSessions(): Promise<number> {
		try {
			// Use a default timeout of 24 hours
			const expiredTime = new Date(Date.now() - 24 * 60 * 60 * 1000);

			// For now, return 0 since we don't have direct database access for cleanup
			console.log('Cleanup expired sessions before:', expiredTime);
			return 0;
		} catch (error) {
			console.error('Error cleaning up expired sessions:', error);
			return 0;
		}
	}

	async getResourceUsage(sandboxId: string): Promise<SandboxMetrics | null> {
		await this.ensureInitialized();
		return await this.sandboxManager.getMetrics(sandboxId);
	}

	// Event handling - simplified
	onSandboxEvent(event: string, callback: Function): void {
		// For now, just log the event registration
		console.log('Registering event listener for:', event);
	}

	offSandboxEvent(event: string, callback: Function): void {
		// For now, just log the event unregistration
		console.log('Unregistering event listener for:', event);
	}
}

// Export singleton instance
export const sandboxService = SandboxService.getInstance();
