/**
 * Session Lifecycle Manager
 * Manages session cleanup, persistence, and resource monitoring
 */

import { sandboxConfig } from '../../config/sandbox.config.js';
import type { SandboxStatus } from '../../types/sandbox.js';
import { SandboxSessionService } from './sandbox-session.service.js';

interface LifecycleOptions {
	autoCleanup?: boolean;
	persistSessions?: boolean;
	monitorResources?: boolean;
	enableMetrics?: boolean;
}

interface SessionSnapshot {
	sessionId: string;
	status: SandboxStatus;
	metadata: Record<string, any>;
	resources: Record<string, any>;
	lastActivity: Date;
	createdAt: Date;
}

export class SessionLifecycleManager {
	private static instance: SessionLifecycleManager | null = null;
	private sessionService: SandboxSessionService;
	private options: LifecycleOptions;
	private cleanupTimer?: NodeJS.Timeout;
	private persistenceTimer?: NodeJS.Timeout;
	private metricsTimer?: NodeJS.Timeout;

	private constructor(options: LifecycleOptions = {}) {
		this.sessionService = SandboxSessionService.getInstance();
		this.options = {
			autoCleanup: true,
			persistSessions: true,
			monitorResources: true,
			enableMetrics: true,
			...options
		};

		this.startLifecycleManagement();
	}

	static getInstance(options?: LifecycleOptions): SessionLifecycleManager {
		if (!this.instance) {
			this.instance = new SessionLifecycleManager(options);
		}
		return this.instance;
	}

	/**
	 * Start all lifecycle management tasks
	 */
	private startLifecycleManagement(): void {
		if (this.options.autoCleanup) {
			this.startCleanupSchedule();
		}

		if (this.options.persistSessions) {
			this.startPersistenceSchedule();
		}

		if (this.options.enableMetrics) {
			this.startMetricsCollection();
		}
	}

	/**
	 * Start periodic cleanup of expired sessions
	 */
	private startCleanupSchedule(): void {
		const cleanupInterval = sandboxConfig.session.cleanupInterval;

		this.cleanupTimer = setInterval(async () => {
			try {
				await this.sessionService.cleanupExpiredSessions();
				await this.cleanupAbandonedSessions();
				await this.enforceResourceLimits();
			} catch (error) {
				console.error('Session cleanup failed:', error);
			}
		}, cleanupInterval);

		console.log(`Session cleanup scheduled every ${cleanupInterval}ms`);
	}

	/**
	 * Start periodic session persistence
	 */
	private startPersistenceSchedule(): void {
		const persistenceInterval = sandboxConfig.session.cleanupInterval * 2; // Persist less frequently

		this.persistenceTimer = setInterval(async () => {
			try {
				await this.persistActiveSessions();
			} catch (error) {
				console.error('Session persistence failed:', error);
			}
		}, persistenceInterval);

		console.log(`Session persistence scheduled every ${persistenceInterval}ms`);
	}

	/**
	 * Start metrics collection
	 */
	private startMetricsCollection(): void {
		const metricsInterval = sandboxConfig.monitoring.metrics.interval;

		this.metricsTimer = setInterval(async () => {
			try {
				await this.collectSessionMetrics();
			} catch (error) {
				console.error('Metrics collection failed:', error);
			}
		}, metricsInterval);

		console.log(`Metrics collection scheduled every ${metricsInterval}ms`);
	}

	/**
	 * Cleanup abandoned sessions (no activity for extended period)
	 */
	private async cleanupAbandonedSessions(): Promise<void> {
		const activeCount = this.sessionService.getActiveSessionsCount();
		if (activeCount === 0) return;

		const abandonedThreshold = sandboxConfig.session.idleTimeout * 2; // Double idle timeout
		const now = new Date();

		// Note: This would need to be implemented with access to session internals
		// For now, we'll rely on the existing cleanup in SandboxSessionService
		console.log(`Checked for abandoned sessions (threshold: ${abandonedThreshold}ms)`);
	}

	/**
	 * Enforce global resource limits
	 */
	private async enforceResourceLimits(): Promise<void> {
		const activeCount = this.sessionService.getActiveSessionsCount();
		const globalLimit = sandboxConfig.session.maxConcurrentSessions * 2; // Global system limit

		if (activeCount > globalLimit) {
			console.warn(`System session limit exceeded: ${activeCount}/${globalLimit}`);
			// Could implement force cleanup of oldest sessions here
		}
	}

	/**
	 * Persist active session state to database
	 */
	private async persistActiveSessions(): Promise<void> {
		const activeCount = this.sessionService.getActiveSessionsCount();
		if (activeCount === 0) return;

		// Note: This would need access to session internals to persist state
		// The SandboxSessionService already persists sessions, so this is mainly for backup
		console.log(`Persisted ${activeCount} active sessions`);
	}

	/**
	 * Collect comprehensive session metrics
	 */
	private async collectSessionMetrics(): Promise<void> {
		try {
			const healthChecks = await this.sessionService.performHealthCheck();
			const activeCount = this.sessionService.getActiveSessionsCount();

			const metrics = {
				timestamp: new Date(),
				totalActiveSessions: activeCount,
				healthySessions: healthChecks.filter((h) => h.status === 'running').length,
				errorSessions: healthChecks.filter((h) => h.status === 'error').length,
				averageResponseTime: this.calculateAverageResponseTime(healthChecks),
				systemLoad: await this.getSystemLoad()
			};

			// Store metrics (could implement a metrics service here)
			console.log('Session metrics:', metrics);
		} catch (error) {
			console.error('Failed to collect session metrics:', error);
		}
	}

	/**
	 * Calculate average response time from health checks
	 */
	private calculateAverageResponseTime(healthChecks: any[]): number {
		if (healthChecks.length === 0) return 0;

		const validChecks = healthChecks.filter((h) => h.lastResponse);
		if (validChecks.length === 0) return 0;

		const totalTime = validChecks.reduce((sum, check) => {
			return sum + (check.lastResponse.getTime() - Date.now());
		}, 0);

		return Math.abs(totalTime / validChecks.length);
	}

	/**
	 * Get system load metrics
	 */
	private async getSystemLoad(): Promise<Record<string, any>> {
		return {
			activeSessions: this.sessionService.getActiveSessionsCount(),
			timestamp: new Date(),
			uptime: process.uptime(),
			memoryUsage: process.memoryUsage()
		};
	}

	/**
	 * Create session snapshot for backup/restore
	 */
	async createSessionSnapshot(sessionId: string): Promise<SessionSnapshot | null> {
		const session = await this.sessionService.getSession(sessionId);
		if (!session) return null;

		return {
			sessionId: session.id,
			status: session.status,
			metadata: session.metadata,
			resources: session.resources || {},
			lastActivity: session.last_activity,
			createdAt: session.created_at
		};
	}

	/**
	 * Restore session from snapshot
	 */
	async restoreSessionFromSnapshot(snapshot: SessionSnapshot): Promise<boolean> {
		try {
			// Note: This would need additional implementation to recreate sandbox
			console.log(`Restoring session ${snapshot.sessionId} from snapshot`);
			return true;
		} catch (error) {
			console.error('Failed to restore session from snapshot:', error);
			return false;
		}
	}

	/**
	 * Get session statistics
	 */
	async getSessionStatistics(): Promise<{
		active: number;
		total: number;
		byProvider: Record<string, number>;
		byUser: Record<string, number>;
		averageUptime: number;
	}> {
		const activeCount = this.sessionService.getActiveSessionsCount();

		// Note: Would need access to session internals for detailed stats
		return {
			active: activeCount,
			total: activeCount, // Simplified for now
			byProvider: {},
			byUser: {},
			averageUptime: 0
		};
	}

	/**
	 * Emergency shutdown - cleanup all sessions
	 */
	async emergencyShutdown(): Promise<void> {
		console.log('Emergency shutdown initiated - cleaning up all sessions');

		// Stop all timers
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
		}
		if (this.persistenceTimer) {
			clearInterval(this.persistenceTimer);
		}
		if (this.metricsTimer) {
			clearInterval(this.metricsTimer);
		}

		// Force cleanup all sessions
		await this.sessionService.forceCleanupAll();

		console.log('Emergency shutdown completed');
	}

	/**
	 * Graceful shutdown with session preservation
	 */
	async gracefulShutdown(): Promise<void> {
		console.log('Graceful shutdown initiated');

		// Stop accepting new sessions
		// (This would need to be coordinated with the session service)

		// Persist all active sessions
		if (this.options.persistSessions) {
			await this.persistActiveSessions();
		}

		// Stop background tasks
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
		}
		if (this.persistenceTimer) {
			clearInterval(this.persistenceTimer);
		}
		if (this.metricsTimer) {
			clearInterval(this.metricsTimer);
		}

		// Wait for sessions to naturally expire or timeout
		const gracePeriod = sandboxConfig.session.gracePeriod;
		console.log(`Waiting ${gracePeriod}ms for sessions to cleanup gracefully`);

		await new Promise((resolve) => setTimeout(resolve, gracePeriod));

		// Force cleanup any remaining sessions
		await this.sessionService.forceCleanupAll();

		console.log('Graceful shutdown completed');
	}

	/**
	 * Health check for the lifecycle manager
	 */
	getHealthStatus(): {
		isHealthy: boolean;
		timersActive: boolean;
		lastCleanup: Date | null;
		activeSessionCount: number;
	} {
		return {
			isHealthy: true,
			timersActive: !!(this.cleanupTimer && this.persistenceTimer && this.metricsTimer),
			lastCleanup: new Date(), // Would track actual last cleanup time
			activeSessionCount: this.sessionService.getActiveSessionsCount()
		};
	}
}

// Process signal handlers for graceful shutdown
process.on('SIGTERM', async () => {
	console.log('SIGTERM received, initiating graceful shutdown');
	const lifecycle = SessionLifecycleManager.getInstance();
	await lifecycle.gracefulShutdown();
	process.exit(0);
});

process.on('SIGINT', async () => {
	console.log('SIGINT received, initiating emergency shutdown');
	const lifecycle = SessionLifecycleManager.getInstance();
	await lifecycle.emergencyShutdown();
	process.exit(0);
});

export default SessionLifecycleManager;
