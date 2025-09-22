/**
 * Sandbox Session Service
 * Manages the lifecycle of sandbox sessions with resource tracking and cleanup
 */

import { ObjectId } from 'mongodb';
import { sandboxConfig } from '../../config/sandbox.config.js';
import type {
	ResourceUsage,
	SandboxProvider,
	SandboxSession,
	SandboxStatus,
	SessionMetrics
} from '../../types/sandbox.js';
import { DatabaseService } from '../database.service.js';
import { SandboxManager } from '../sandbox/sandbox-manager.js';

interface SessionState {
	session: SandboxSession;
	lastActivity: Date;
	resourceUsage: ResourceUsage;
	cleanup: {
		timer?: NodeJS.Timeout;
		scheduled: boolean;
		gracePeriod: number;
	};
}

interface SessionCleanupOptions {
	gracePeriod?: number;
	force?: boolean;
	preserveFiles?: boolean;
	reason?: string;
}

interface SessionHealthCheck {
	sessionId: string;
	status: SandboxStatus;
	lastResponse: Date;
	errorCount: number;
	warnings: string[];
}

export class SandboxSessionService {
	private static instance: SandboxSessionService | null = null;
	private activeSessions = new Map<string, SessionState>();
	private sessionsByUser = new Map<string, Set<string>>();
	private sessionsByProject = new Map<string, Set<string>>();
	private cleanupQueue = new Set<string>();
	private metricsInterval?: NodeJS.Timeout;
	private healthCheckInterval?: NodeJS.Timeout;

	private constructor() {
		this.startBackgroundTasks();
	}

	static getInstance(): SandboxSessionService {
		if (!this.instance) {
			this.instance = new SandboxSessionService();
		}
		return this.instance;
	}

	/**
	 * Create a new sandbox session
	 */
	async createSession(options: {
		userId: string;
		projectId: string;
		templateId?: string;
		provider?: SandboxProvider;
		environment?: string;
		metadata?: Record<string, any>;
	}): Promise<SandboxSession> {
		const { userId, projectId, templateId, provider, environment, metadata } = options;

		// Check user session limits
		await this.enforceUserLimits(userId);

		// Create sandbox through manager
		const sandboxManager = SandboxManager.getInstance();
		const sandbox = await sandboxManager.createSandbox({
			template: templateId || 'blank',
			runtime: environment || 'node',
			environment: { NODE_ENV: environment || 'node' },
			userId,
			projectId,
			provider,
			metadata: {
				...metadata,
				createdBy: 'session-service',
				sessionType: 'interactive'
			}
		});

		// Create session record
		const now = new Date();
		const session: SandboxSession = {
			_id: new ObjectId(),
			id: this.generateSessionId(),
			sandboxId: sandbox.id,
			userId,
			user_id: userId,
			projectId,
			project_id: projectId,
			templateId,
			provider: sandbox.provider,
			status: 'active',
			environment: sandbox.runtime ? { RUNTIME: sandbox.runtime } : {},
			start_time: now,
			created_at: now,
			updated_at: now,
			last_activity: now,
			last_accessed: now,
			expires_at: new Date(now.getTime() + sandboxConfig.session.maxDuration),
			metadata: metadata || {},
			resource_limits: {},
			network_info: {},
			metrics: {
				cpuUsage: 0,
				memoryUsage: 0,
				storageUsage: 0,
				networkIO: 0,
				executionCount: 0,
				lastCollected: now
			},
			resources: {
				maxCpu: sandboxConfig.resources.cpu.max,
				maxMemory: sandboxConfig.resources.memory.max,
				maxStorage: sandboxConfig.resources.storage.max,
				maxNetworkIO: sandboxConfig.resources.network.maxBandwidth
			}
		};

		// Store in database
		await DatabaseService.createSandboxSession(session);

		// Track in memory
		const sessionState: SessionState = {
			session,
			lastActivity: now,
			resourceUsage: {
				cpu: 0,
				memory: 0,
				storage: 0,
				network: 0
			},
			cleanup: {
				scheduled: false,
				gracePeriod: sandboxConfig.session.idleTimeout
			}
		};

		this.activeSessions.set(session.id, sessionState);
		this.addSessionToUser(userId, session.id);
		this.addSessionToProject(projectId, session.id);

		// Schedule cleanup
		this.scheduleCleanup(session.id);

		return session;
	}

	/**
	 * Get session by ID
	 */
	async getSession(sessionId: string): Promise<SandboxSession | null> {
		const sessionState = this.activeSessions.get(sessionId);
		if (sessionState) {
			this.updateLastActivity(sessionId);
			return sessionState.session;
		}

		// Try database
		return await DatabaseService.getSandboxSessionById(sessionId);
	}

	/**
	 * Update session activity and reset cleanup timer
	 */
	updateLastActivity(sessionId: string): void {
		const sessionState = this.activeSessions.get(sessionId);
		if (!sessionState) return;

		const now = new Date();
		sessionState.lastActivity = now;
		sessionState.session.last_accessed = now;
		sessionState.session.updated_at = now;

		// Reset cleanup timer
		if (sessionState.cleanup.timer) {
			clearTimeout(sessionState.cleanup.timer);
		}
		this.scheduleCleanup(sessionId);

		// Update database asynchronously
		this.updateSessionInDatabase(sessionState.session).catch(console.error);
	}

	/**
	 * Get sessions for a user
	 */
	async getUserSessions(userId: string, includeInactive = false): Promise<SandboxSession[]> {
		const sessionIds = this.sessionsByUser.get(userId) || new Set();
		const sessions: SandboxSession[] = [];

		// Get active sessions
		for (const sessionId of sessionIds) {
			const sessionState = this.activeSessions.get(sessionId);
			if (sessionState) {
				sessions.push(sessionState.session);
			}
		}

		// Get inactive sessions from database if requested
		if (includeInactive) {
			const dbSessions = await DatabaseService.getSandboxSessionsByUser(userId);
			for (const session of dbSessions) {
				if (!sessionIds.has(session.id)) {
					sessions.push(session);
				}
			}
		}

		return sessions.sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
	}

	/**
	 * Get sessions for a project
	 */
	async getProjectSessions(projectId: string, includeInactive = false): Promise<SandboxSession[]> {
		const sessionIds = this.sessionsByProject.get(projectId) || new Set();
		const sessions: SandboxSession[] = [];

		// Get active sessions
		for (const sessionId of sessionIds) {
			const sessionState = this.activeSessions.get(sessionId);
			if (sessionState) {
				sessions.push(sessionState.session);
			}
		}

		// Get inactive sessions from database if requested
		if (includeInactive) {
			const dbSessions = await DatabaseService.getSandboxSessionsByProject(projectId);
			for (const session of dbSessions) {
				if (!sessionIds.has(session.id)) {
					sessions.push(session);
				}
			}
		}

		return sessions.sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
	}

	/**
	 * Update session metadata
	 */
	async updateSession(
		sessionId: string,
		updates: Partial<Pick<SandboxSession, 'metadata' | 'status'>>
	): Promise<SandboxSession | null> {
		const sessionState = this.activeSessions.get(sessionId);
		if (!sessionState) {
			return null;
		}

		// Update session
		Object.assign(sessionState.session, updates, {
			updated_at: new Date()
		});

		// Update database
		await this.updateSessionInDatabase(sessionState.session);
		this.updateLastActivity(sessionId);

		return sessionState.session;
	}

	/**
	 * Terminate a session
	 */
	async terminateSession(sessionId: string, options?: SessionCleanupOptions): Promise<boolean> {
		const sessionState = this.activeSessions.get(sessionId);
		if (!sessionState) {
			return false;
		}

		const { force = false, preserveFiles = false, reason = 'user_requested' } = options || {};

		try {
			// Update session status
			sessionState.session.status = 'terminating';
			await this.updateSessionInDatabase(sessionState.session);

			// Cleanup sandbox
			const sandboxManager = SandboxManager.getInstance();
			await sandboxManager.deleteSandbox(sessionState.session.sandboxId);

			// Remove from tracking
			this.removeSessionFromTracking(sessionId);

			// Update final status
			sessionState.session.status = 'terminated';
			sessionState.session.updated_at = new Date();
			await this.updateSessionInDatabase(sessionState.session);

			return true;
		} catch (error) {
			console.error(`Failed to terminate session ${sessionId}:`, error);
			if (force) {
				this.removeSessionFromTracking(sessionId);
				return true;
			}
			return false;
		}
	}

	/**
	 * Cleanup expired sessions
	 */
	async cleanupExpiredSessions(): Promise<void> {
		const now = new Date();
		const expiredSessions: string[] = [];

		// Check active sessions
		for (const [sessionId, sessionState] of this.activeSessions) {
			const { session, lastActivity } = sessionState;

			// Check if expired
			if (session.expires_at && session.expires_at < now) {
				expiredSessions.push(sessionId);
				continue;
			}

			// Check if idle
			const idleTime = now.getTime() - lastActivity.getTime();
			if (idleTime > sandboxConfig.session.idleTimeout) {
				expiredSessions.push(sessionId);
			}
		}

		// Cleanup expired sessions
		for (const sessionId of expiredSessions) {
			await this.terminateSession(sessionId, {
				reason: 'expired',
				preserveFiles: false
			});
		}

		console.log(`Cleaned up ${expiredSessions.length} expired sessions`);
	}

	/**
	 * Get session metrics
	 */
	async getSessionMetrics(sessionId: string): Promise<SessionMetrics | null> {
		const sessionState = this.activeSessions.get(sessionId);
		if (!sessionState) {
			return null;
		}

		const sandboxManager = SandboxManager.getInstance();
		const metrics = await sandboxManager.getMetrics(sessionState.session.sandboxId);

		return {
			sessionId,
			sandboxId: sessionState.session.sandboxId,
			uptime: Date.now() - sessionState.session.created_at.getTime(),
			lastActivity: sessionState.lastActivity,
			resourceUsage: sessionState.resourceUsage,
			sandboxMetrics: metrics
		};
	}

	/**
	 * Get all active sessions count
	 */
	getActiveSessionsCount(): number {
		return this.activeSessions.size;
	}

	/**
	 * Get user session count
	 */
	getUserSessionCount(userId: string): number {
		return this.sessionsByUser.get(userId)?.size || 0;
	}

	/**
	 * Health check for all active sessions
	 */
	async performHealthCheck(): Promise<SessionHealthCheck[]> {
		const results: SessionHealthCheck[] = [];
		const sandboxManager = SandboxManager.getInstance();

		for (const [sessionId, sessionState] of this.activeSessions) {
			try {
				const sandbox = await sandboxManager.getSandbox(sessionState.session.sandboxId);
				const status = sandbox?.status || ('error' as SandboxStatus);
				results.push({
					sessionId,
					status,
					lastResponse: new Date(),
					errorCount: 0,
					warnings: []
				});
			} catch (error) {
				results.push({
					sessionId,
					status: 'error' as SandboxStatus,
					lastResponse: new Date(),
					errorCount: 1,
					warnings: [error instanceof Error ? error.message : 'Unknown error']
				});
			}
		}

		return results;
	}

	/**
	 * Force cleanup all sessions (for shutdown)
	 */
	async forceCleanupAll(): Promise<void> {
		console.log('Force cleaning up all sessions...');

		const sessionIds = Array.from(this.activeSessions.keys());
		const cleanupPromises = sessionIds.map((sessionId) =>
			this.terminateSession(sessionId, { force: true, reason: 'shutdown' })
		);

		await Promise.allSettled(cleanupPromises);

		// Clear intervals
		if (this.metricsInterval) {
			clearInterval(this.metricsInterval);
		}
		if (this.healthCheckInterval) {
			clearInterval(this.healthCheckInterval);
		}

		console.log(`Force cleaned up ${sessionIds.length} sessions`);
	}

	// Private helper methods

	private generateSessionId(): string {
		return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	private async enforceUserLimits(userId: string): Promise<void> {
		const userSessionCount = this.getUserSessionCount(userId);
		if (userSessionCount >= sandboxConfig.session.maxConcurrentSessions) {
			throw new Error(
				`User session limit exceeded (${userSessionCount}/${sandboxConfig.session.maxConcurrentSessions})`
			);
		}
	}

	private addSessionToUser(userId: string, sessionId: string): void {
		if (!this.sessionsByUser.has(userId)) {
			this.sessionsByUser.set(userId, new Set());
		}
		this.sessionsByUser.get(userId)!.add(sessionId);
	}

	private addSessionToProject(projectId: string, sessionId: string): void {
		if (!this.sessionsByProject.has(projectId)) {
			this.sessionsByProject.set(projectId, new Set());
		}
		this.sessionsByProject.get(projectId)!.add(sessionId);
	}

	private removeSessionFromTracking(sessionId: string): void {
		const sessionState = this.activeSessions.get(sessionId);
		if (sessionState) {
			// Clear cleanup timer
			if (sessionState.cleanup.timer) {
				clearTimeout(sessionState.cleanup.timer);
			}

			// Remove from user tracking
			const userSessions = this.sessionsByUser.get(sessionState.session.userId);
			if (userSessions) {
				userSessions.delete(sessionId);
				if (userSessions.size === 0) {
					this.sessionsByUser.delete(sessionState.session.userId);
				}
			}

			// Remove from project tracking
			const projectSessions = this.sessionsByProject.get(sessionState.session.projectId);
			if (projectSessions) {
				projectSessions.delete(sessionId);
				if (projectSessions.size === 0) {
					this.sessionsByProject.delete(sessionState.session.projectId);
				}
			}

			// Remove from active sessions
			this.activeSessions.delete(sessionId);
		}

		// Remove from cleanup queue
		this.cleanupQueue.delete(sessionId);
	}

	private scheduleCleanup(sessionId: string): void {
		const sessionState = this.activeSessions.get(sessionId);
		if (!sessionState) return;

		sessionState.cleanup.timer = setTimeout(() => {
			this.cleanupQueue.add(sessionId);
			this.terminateSession(sessionId, { reason: 'idle_timeout' }).catch(console.error);
		}, sessionState.cleanup.gracePeriod);

		sessionState.cleanup.scheduled = true;
	}

	private async updateSessionInDatabase(session: SandboxSession): Promise<void> {
		try {
			await DatabaseService.updateSandboxSession(session.id, {
				status: session.status,
				last_accessed: session.last_accessed,
				updated_at: session.updated_at,
				metadata: session.metadata,
				metrics: session.metrics
			});
		} catch (error) {
			console.error('Failed to update session in database:', error);
		}
	}

	private startBackgroundTasks(): void {
		// Metrics collection
		this.metricsInterval = setInterval(() => {
			this.collectMetrics().catch(console.error);
		}, sandboxConfig.monitoring.metrics.interval);

		// Health checks
		this.healthCheckInterval = setInterval(() => {
			this.performHealthCheck().catch(console.error);
		}, sandboxConfig.monitoring.metrics.interval);

		// Cleanup expired sessions
		setInterval(
			() => {
				this.cleanupExpiredSessions().catch(console.error);
			},
			5 * 60 * 1000
		); // Every 5 minutes
	}

	private async collectMetrics(): Promise<void> {
		const sandboxManager = SandboxManager.getInstance();

		for (const [sessionId, sessionState] of this.activeSessions) {
			try {
				const metrics = await sandboxManager.getMetrics(sessionState.session.sandboxId);
				if (metrics) {
					sessionState.resourceUsage = {
						cpu: metrics.cpu.usage,
						memory: metrics.memory.usage,
						storage: metrics.storage.usage,
						network: (metrics.network?.bytesIn || 0) + (metrics.network?.bytesOut || 0)
					};

					sessionState.session.metrics = {
						cpuUsage: metrics.cpu.usage,
						memoryUsage: metrics.memory.usage,
						storageUsage: metrics.storage.usage,
						networkIO: (metrics.network?.bytesIn || 0) + (metrics.network?.bytesOut || 0),
						executionCount: 0, // Not available in metrics
						lastCollected: new Date()
					};
				}
			} catch (error) {
				console.error(`Failed to collect metrics for session ${sessionId}:`, error);
			}
		}
	}
}
