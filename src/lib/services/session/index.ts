/**
 * Session Management Services
 * Exports all session-related services and managers
 */

import { SandboxSessionService } from './sandbox-session.service.js';
import { SessionLifecycleManager } from './session-lifecycle.manager.js';
import { SessionResourceMonitor } from './session-resource.monitor.js';

export { SandboxSessionService, SessionLifecycleManager, SessionResourceMonitor };

// Re-export types for convenience
export type { ResourceUsage, SandboxSession, SessionMetrics } from '../../types/sandbox.js';

// Service factory for easier initialization
export class SessionManagerFactory {
	private static sessionService: SandboxSessionService | null = null;
	private static lifecycleManager: SessionLifecycleManager | null = null;
	private static resourceMonitor: SessionResourceMonitor | null = null;

	/**
	 * Initialize all session management services
	 */
	static async initialize(options?: {
		enableLifecycle?: boolean;
		enableResourceMonitoring?: boolean;
		lifecycleOptions?: any;
		monitoringOptions?: any;
	}): Promise<{
		sessionService: SandboxSessionService;
		lifecycleManager?: SessionLifecycleManager;
		resourceMonitor?: SessionResourceMonitor;
	}> {
		const {
			enableLifecycle = true,
			enableResourceMonitoring = true,
			lifecycleOptions,
			monitoringOptions
		} = options || {};

		// Initialize session service
		this.sessionService = SandboxSessionService.getInstance();

		// Initialize lifecycle manager
		let lifecycleManager: SessionLifecycleManager | undefined;
		if (enableLifecycle) {
			this.lifecycleManager = SessionLifecycleManager.getInstance(lifecycleOptions);
			lifecycleManager = this.lifecycleManager;
		}

		// Initialize resource monitor
		let resourceMonitor: SessionResourceMonitor | undefined;
		if (enableResourceMonitoring) {
			this.resourceMonitor = SessionResourceMonitor.getInstance(monitoringOptions);
			resourceMonitor = this.resourceMonitor;
		}

		console.log('Session management services initialized');

		return {
			sessionService: this.sessionService,
			lifecycleManager,
			resourceMonitor
		};
	}

	/**
	 * Get session service instance
	 */
	static getSessionService(): SandboxSessionService {
		if (!this.sessionService) {
			this.sessionService = SandboxSessionService.getInstance();
		}
		return this.sessionService;
	}

	/**
	 * Get lifecycle manager instance
	 */
	static getLifecycleManager(): SessionLifecycleManager | null {
		return this.lifecycleManager;
	}

	/**
	 * Get resource monitor instance
	 */
	static getResourceMonitor(): SessionResourceMonitor | null {
		return this.resourceMonitor;
	}

	/**
	 * Shutdown all session management services
	 */
	static async shutdown(graceful = true): Promise<void> {
		console.log(`Initiating ${graceful ? 'graceful' : 'emergency'} shutdown of session services`);

		if (this.resourceMonitor) {
			this.resourceMonitor.stopMonitoring();
		}

		if (this.lifecycleManager) {
			if (graceful) {
				await this.lifecycleManager.gracefulShutdown();
			} else {
				await this.lifecycleManager.emergencyShutdown();
			}
		}

		if (this.sessionService) {
			await this.sessionService.forceCleanupAll();
		}

		// Reset instances
		this.sessionService = null;
		this.lifecycleManager = null;
		this.resourceMonitor = null;

		console.log('Session management services shutdown completed');
	}

	/**
	 * Health check for all services
	 */
	static getHealthStatus(): {
		sessionService: boolean;
		lifecycleManager: boolean;
		resourceMonitor: boolean;
		details: {
			activeSessions: number;
			lifecycleStatus?: any;
			monitoringStatus?: any;
		};
	} {
		const sessionService = this.sessionService;
		const activeSessions = sessionService ? sessionService.getActiveSessionsCount() : 0;

		return {
			sessionService: !!sessionService,
			lifecycleManager: !!this.lifecycleManager,
			resourceMonitor: !!this.resourceMonitor,
			details: {
				activeSessions,
				lifecycleStatus: this.lifecycleManager?.getHealthStatus(),
				monitoringStatus: this.resourceMonitor?.getHealthStatus()
			}
		};
	}
}

export default SessionManagerFactory;
