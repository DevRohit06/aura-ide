/**
 * Session Resource Monitor
 * Monitors resource usage across sandbox sessions
 */

import { sandboxConfig } from '../../config/sandbox.config.js';
import type { ResourceUsage } from '../../types/sandbox.js';
import { SandboxSessionService } from './sandbox-session.service.js';

interface ResourceAlert {
	sessionId: string;
	alertType: 'cpu' | 'memory' | 'storage' | 'network';
	threshold: number;
	currentUsage: number;
	severity: 'warning' | 'critical';
	timestamp: Date;
	message: string;
}

interface ResourceLimit {
	cpu: number; // percentage
	memory: number; // MB
	storage: number; // MB
	network: number; // MB/s
}

interface ResourceThreshold {
	warning: ResourceLimit;
	critical: ResourceLimit;
}

interface MonitoringConfig {
	enabled: boolean;
	alerting: boolean;
	collectInterval: number;
	thresholds: ResourceThreshold;
	retentionPeriod: number; // hours
}

interface ResourceSnapshot {
	sessionId: string;
	timestamp: Date;
	usage: ResourceUsage;
	limits: ResourceLimit;
	utilization: {
		cpu: number; // percentage of limit
		memory: number; // percentage of limit
		storage: number; // percentage of limit
		network: number; // percentage of limit
	};
}

export class SessionResourceMonitor {
	private static instance: SessionResourceMonitor | null = null;
	private sessionService: SandboxSessionService;
	private config: MonitoringConfig;
	private resourceHistory = new Map<string, ResourceSnapshot[]>();
	private activeAlerts = new Map<string, ResourceAlert[]>();
	private monitoringTimer?: NodeJS.Timeout;
	private alertCallbacks = new Set<(alert: ResourceAlert) => void>();

	private constructor(config?: Partial<MonitoringConfig>) {
		this.sessionService = SandboxSessionService.getInstance();
		this.config = {
			enabled: true,
			alerting: true,
			collectInterval: 30000, // 30 seconds
			thresholds: {
				warning: {
					cpu: 70, // 70%
					memory: 1024, // 1GB
					storage: 8192, // 8GB
					network: 100 // 100MB/s
				},
				critical: {
					cpu: 90, // 90%
					memory: 1536, // 1.5GB
					storage: 9216, // 9GB
					network: 500 // 500MB/s
				}
			},
			retentionPeriod: 24, // 24 hours
			...config
		};

		if (this.config.enabled) {
			this.startMonitoring();
		}
	}

	static getInstance(config?: Partial<MonitoringConfig>): SessionResourceMonitor {
		if (!this.instance) {
			this.instance = new SessionResourceMonitor(config);
		}
		return this.instance;
	}

	/**
	 * Start resource monitoring
	 */
	private startMonitoring(): void {
		this.monitoringTimer = setInterval(async () => {
			try {
				await this.collectResourceMetrics();
				await this.checkResourceThresholds();
				await this.cleanupOldData();
			} catch (error) {
				console.error('Resource monitoring failed:', error);
			}
		}, this.config.collectInterval);

		console.log(`Resource monitoring started (interval: ${this.config.collectInterval}ms)`);
	}

	/**
	 * Stop resource monitoring
	 */
	stopMonitoring(): void {
		if (this.monitoringTimer) {
			clearInterval(this.monitoringTimer);
			this.monitoringTimer = undefined;
		}
		console.log('Resource monitoring stopped');
	}

	/**
	 * Collect resource metrics from all active sessions
	 */
	private async collectResourceMetrics(): Promise<void> {
		const activeSessionCount = this.sessionService.getActiveSessionsCount();
		if (activeSessionCount === 0) return;

		// Note: This would need access to session internals to get accurate metrics
		// For now, we'll simulate the collection process
		console.log(`Collecting resource metrics for ${activeSessionCount} active sessions`);
	}

	/**
	 * Check resource usage against thresholds
	 */
	private async checkResourceThresholds(): Promise<void> {
		for (const [sessionId, snapshots] of this.resourceHistory) {
			const latestSnapshot = snapshots[snapshots.length - 1];
			if (!latestSnapshot) continue;

			await this.checkSessionThresholds(sessionId, latestSnapshot);
		}
	}

	/**
	 * Check thresholds for a specific session
	 */
	private async checkSessionThresholds(
		sessionId: string,
		snapshot: ResourceSnapshot
	): Promise<void> {
		const { usage, limits } = snapshot;

		// Check CPU threshold
		const cpuPercentage = (usage.cpu / limits.cpu) * 100;
		await this.checkThreshold(sessionId, 'cpu', cpuPercentage, this.config.thresholds, usage.cpu);

		// Check Memory threshold
		await this.checkThreshold(
			sessionId,
			'memory',
			usage.memory,
			this.config.thresholds,
			usage.memory
		);

		// Check Storage threshold
		await this.checkThreshold(
			sessionId,
			'storage',
			usage.storage,
			this.config.thresholds,
			usage.storage
		);

		// Check Network threshold
		await this.checkThreshold(
			sessionId,
			'network',
			usage.network,
			this.config.thresholds,
			usage.network
		);
	}

	/**
	 * Check individual resource threshold
	 */
	private async checkThreshold(
		sessionId: string,
		resource: keyof ResourceLimit,
		currentUsage: number,
		thresholds: ResourceThreshold,
		rawUsage: number
	): Promise<void> {
		const warningThreshold = thresholds.warning[resource];
		const criticalThreshold = thresholds.critical[resource];

		if (currentUsage >= criticalThreshold) {
			await this.triggerAlert(sessionId, resource, criticalThreshold, rawUsage, 'critical');
		} else if (currentUsage >= warningThreshold) {
			await this.triggerAlert(sessionId, resource, warningThreshold, rawUsage, 'warning');
		} else {
			// Clear any existing alerts for this resource
			await this.clearAlert(sessionId, resource);
		}
	}

	/**
	 * Trigger a resource alert
	 */
	private async triggerAlert(
		sessionId: string,
		alertType: keyof ResourceLimit,
		threshold: number,
		currentUsage: number,
		severity: 'warning' | 'critical'
	): Promise<void> {
		const alert: ResourceAlert = {
			sessionId,
			alertType,
			threshold,
			currentUsage,
			severity,
			timestamp: new Date(),
			message: `${alertType.toUpperCase()} usage ${severity}: ${currentUsage} ${this.getResourceUnit(alertType)} (threshold: ${threshold})`
		};

		// Store alert
		if (!this.activeAlerts.has(sessionId)) {
			this.activeAlerts.set(sessionId, []);
		}

		const sessionAlerts = this.activeAlerts.get(sessionId)!;
		const existingAlertIndex = sessionAlerts.findIndex((a) => a.alertType === alertType);

		if (existingAlertIndex >= 0) {
			sessionAlerts[existingAlertIndex] = alert;
		} else {
			sessionAlerts.push(alert);
		}

		// Notify callbacks
		if (this.config.alerting) {
			this.alertCallbacks.forEach((callback) => callback(alert));
		}

		console.warn(`Resource alert for session ${sessionId}:`, alert.message);
	}

	/**
	 * Clear alert for a specific resource
	 */
	private async clearAlert(sessionId: string, resource: keyof ResourceLimit): Promise<void> {
		const sessionAlerts = this.activeAlerts.get(sessionId);
		if (!sessionAlerts) return;

		const filteredAlerts = sessionAlerts.filter((alert) => alert.alertType !== resource);

		if (filteredAlerts.length === 0) {
			this.activeAlerts.delete(sessionId);
		} else {
			this.activeAlerts.set(sessionId, filteredAlerts);
		}
	}

	/**
	 * Get resource unit for display
	 */
	private getResourceUnit(resource: keyof ResourceLimit): string {
		switch (resource) {
			case 'cpu':
				return '%';
			case 'memory':
				return 'MB';
			case 'storage':
				return 'MB';
			case 'network':
				return 'MB/s';
			default:
				return '';
		}
	}

	/**
	 * Clean up old monitoring data
	 */
	private async cleanupOldData(): Promise<void> {
		const cutoffTime = new Date(Date.now() - this.config.retentionPeriod * 60 * 60 * 1000);

		for (const [sessionId, snapshots] of this.resourceHistory) {
			const filteredSnapshots = snapshots.filter((snapshot) => snapshot.timestamp > cutoffTime);

			if (filteredSnapshots.length === 0) {
				this.resourceHistory.delete(sessionId);
			} else {
				this.resourceHistory.set(sessionId, filteredSnapshots);
			}
		}
	}

	/**
	 * Add a snapshot for a session
	 */
	addResourceSnapshot(sessionId: string, snapshot: ResourceSnapshot): void {
		if (!this.resourceHistory.has(sessionId)) {
			this.resourceHistory.set(sessionId, []);
		}

		const sessionHistory = this.resourceHistory.get(sessionId)!;
		sessionHistory.push(snapshot);

		// Keep only recent snapshots to prevent memory bloat
		const maxSnapshots = 100;
		if (sessionHistory.length > maxSnapshots) {
			sessionHistory.splice(0, sessionHistory.length - maxSnapshots);
		}
	}

	/**
	 * Get resource history for a session
	 */
	getSessionResourceHistory(sessionId: string, limit?: number): ResourceSnapshot[] {
		const history = this.resourceHistory.get(sessionId) || [];
		return limit ? history.slice(-limit) : history;
	}

	/**
	 * Get current resource usage for a session
	 */
	async getCurrentResourceUsage(sessionId: string): Promise<ResourceSnapshot | null> {
		const metrics = await this.sessionService.getSessionMetrics(sessionId);
		if (!metrics) return null;

		const resourceUsage = metrics.resourceUsage;
		const limits: ResourceLimit = {
			cpu: 100, // 100%
			memory: sandboxConfig.resources.memory.max,
			storage: sandboxConfig.resources.storage.max,
			network: sandboxConfig.resources.network.maxBandwidth
		};

		return {
			sessionId,
			timestamp: new Date(),
			usage: resourceUsage,
			limits,
			utilization: {
				cpu: (resourceUsage.cpu / limits.cpu) * 100,
				memory: (resourceUsage.memory / limits.memory) * 100,
				storage: (resourceUsage.storage / limits.storage) * 100,
				network: (resourceUsage.network / limits.network) * 100
			}
		};
	}

	/**
	 * Get active alerts for a session
	 */
	getActiveAlerts(sessionId?: string): ResourceAlert[] {
		if (sessionId) {
			return this.activeAlerts.get(sessionId) || [];
		}

		// Return all alerts
		const allAlerts: ResourceAlert[] = [];
		for (const alerts of this.activeAlerts.values()) {
			allAlerts.push(...alerts);
		}
		return allAlerts;
	}

	/**
	 * Subscribe to resource alerts
	 */
	onAlert(callback: (alert: ResourceAlert) => void): () => void {
		this.alertCallbacks.add(callback);
		return () => this.alertCallbacks.delete(callback);
	}

	/**
	 * Get resource usage summary across all sessions
	 */
	getResourceSummary(): {
		totalSessions: number;
		totalCpu: number;
		totalMemory: number;
		totalStorage: number;
		totalNetwork: number;
		averages: ResourceUsage;
		alerts: {
			total: number;
			critical: number;
			warning: number;
		};
	} {
		const allAlerts = this.getActiveAlerts();
		let totalUsage: ResourceUsage = { cpu: 0, memory: 0, storage: 0, network: 0 };
		let sessionCount = 0;

		// Calculate totals from history
		for (const snapshots of this.resourceHistory.values()) {
			const latest = snapshots[snapshots.length - 1];
			if (latest) {
				totalUsage.cpu += latest.usage.cpu;
				totalUsage.memory += latest.usage.memory;
				totalUsage.storage += latest.usage.storage;
				totalUsage.network += latest.usage.network;
				sessionCount++;
			}
		}

		return {
			totalSessions: sessionCount,
			totalCpu: totalUsage.cpu,
			totalMemory: totalUsage.memory,
			totalStorage: totalUsage.storage,
			totalNetwork: totalUsage.network,
			averages: {
				cpu: sessionCount > 0 ? totalUsage.cpu / sessionCount : 0,
				memory: sessionCount > 0 ? totalUsage.memory / sessionCount : 0,
				storage: sessionCount > 0 ? totalUsage.storage / sessionCount : 0,
				network: sessionCount > 0 ? totalUsage.network / sessionCount : 0
			},
			alerts: {
				total: allAlerts.length,
				critical: allAlerts.filter((a) => a.severity === 'critical').length,
				warning: allAlerts.filter((a) => a.severity === 'warning').length
			}
		};
	}

	/**
	 * Configure monitoring thresholds
	 */
	updateThresholds(thresholds: Partial<ResourceThreshold>): void {
		this.config.thresholds = {
			...this.config.thresholds,
			...thresholds
		};
		console.log('Resource monitoring thresholds updated');
	}

	/**
	 * Get monitoring configuration
	 */
	getConfig(): MonitoringConfig {
		return { ...this.config };
	}

	/**
	 * Health check for the resource monitor
	 */
	getHealthStatus(): {
		isRunning: boolean;
		sessionCount: number;
		alertCount: number;
		lastCollection: Date | null;
		dataRetention: number;
	} {
		return {
			isRunning: !!this.monitoringTimer,
			sessionCount: this.resourceHistory.size,
			alertCount: this.getActiveAlerts().length,
			lastCollection: new Date(), // Would track actual last collection time
			dataRetention: this.config.retentionPeriod
		};
	}
}

export default SessionResourceMonitor;
