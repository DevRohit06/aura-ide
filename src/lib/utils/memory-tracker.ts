/**
 * Memory usage tracking utilities for Aura IDE
 */

import { performanceMonitor } from './performance-monitor';

export interface MemorySnapshot {
	timestamp: number;
	jsHeapSizeLimit: number;
	totalJSHeapSize: number;
	usedJSHeapSize: number;
	files: {
		count: number;
		totalSize: number;
		largestFile: number;
	};
	editor: {
		openTabs: number;
		totalContent: number;
		undoHistory: number;
	};
	ui: {
		components: number;
		eventListeners: number;
	};
}

export interface MemoryAlert {
	type: 'warning' | 'critical';
	message: string;
	currentUsage: number;
	threshold: number;
	suggestions: string[];
}

/**
 * Memory tracker for monitoring application memory usage
 */
class MemoryTracker {
	private snapshots: MemorySnapshot[] = [];
	private maxSnapshots = 100;
	private alertThresholds = {
		warning: 0.7, // 70% of heap limit
		critical: 0.9 // 90% of heap limit
	};
	private observers: ((snapshot: MemorySnapshot) => void)[] = [];
	private alertObservers: ((alert: MemoryAlert) => void)[] = [];
	private trackingInterval: ReturnType<typeof setInterval> | null = null;

	/**
	 * Start automatic memory tracking
	 */
	startTracking(intervalMs: number = 30000) {
		if (this.trackingInterval) {
			this.stopTracking();
		}

		this.trackingInterval = setInterval(() => {
			this.takeSnapshot();
		}, intervalMs);

		// Take initial snapshot
		this.takeSnapshot();
	}

	/**
	 * Stop automatic memory tracking
	 */
	stopTracking() {
		if (this.trackingInterval) {
			clearInterval(this.trackingInterval);
			this.trackingInterval = null;
		}
	}

	/**
	 * Take a memory snapshot
	 */
	takeSnapshot(): MemorySnapshot {
		const memoryInfo = this.getMemoryInfo();
		const fileStats = this.getFileMemoryStats();
		const editorStats = this.getEditorMemoryStats();
		const uiStats = this.getUIMemoryStats();

		const snapshot: MemorySnapshot = {
			timestamp: Date.now(),
			jsHeapSizeLimit: memoryInfo.jsHeapSizeLimit,
			totalJSHeapSize: memoryInfo.totalJSHeapSize,
			usedJSHeapSize: memoryInfo.usedJSHeapSize,
			files: fileStats,
			editor: editorStats,
			ui: uiStats
		};

		this.snapshots.push(snapshot);

		// Limit stored snapshots
		if (this.snapshots.length > this.maxSnapshots) {
			this.snapshots = this.snapshots.slice(-this.maxSnapshots);
		}

		// Check for memory alerts
		this.checkMemoryAlerts(snapshot);

		// Notify observers
		this.observers.forEach((observer) => observer(snapshot));

		// Record performance metric
		performanceMonitor.recordMetric('memory-snapshot', snapshot.usedJSHeapSize, 'memory', snapshot);

		return snapshot;
	}

	/**
	 * Get browser memory information
	 */
	private getMemoryInfo() {
		if ('memory' in performance) {
			const memory = (performance as any).memory;
			return {
				jsHeapSizeLimit: memory.jsHeapSizeLimit || 0,
				totalJSHeapSize: memory.totalJSHeapSize || 0,
				usedJSHeapSize: memory.usedJSHeapSize || 0
			};
		}

		// Fallback for browsers without memory API
		return {
			jsHeapSizeLimit: 0,
			totalJSHeapSize: 0,
			usedJSHeapSize: 0
		};
	}

	/**
	 * Estimate file-related memory usage
	 */
	private getFileMemoryStats() {
		// This would integrate with the file store to get actual stats
		// For now, providing a structure that can be filled by the file store
		return {
			count: 0,
			totalSize: 0,
			largestFile: 0
		};
	}

	/**
	 * Estimate editor-related memory usage
	 */
	private getEditorMemoryStats() {
		// This would integrate with the editor store to get actual stats
		return {
			openTabs: 0,
			totalContent: 0,
			undoHistory: 0
		};
	}

	/**
	 * Estimate UI-related memory usage
	 */
	private getUIMemoryStats() {
		// Count DOM elements and event listeners
		const components = document.querySelectorAll('[data-component]').length;

		// Rough estimate of event listeners (not accurate but gives an idea)
		const eventListeners = this.estimateEventListeners();

		return {
			components,
			eventListeners
		};
	}

	/**
	 * Estimate number of event listeners (rough approximation)
	 */
	private estimateEventListeners(): number {
		// This is a rough estimate based on interactive elements
		const interactiveElements = document.querySelectorAll(
			'button, input, select, textarea, [onclick], [onchange], [onkeydown], [onkeyup]'
		).length;

		// Assume average of 2 listeners per interactive element
		return interactiveElements * 2;
	}

	/**
	 * Check for memory alerts
	 */
	private checkMemoryAlerts(snapshot: MemorySnapshot) {
		if (snapshot.jsHeapSizeLimit === 0) return; // No memory API available

		const usageRatio = snapshot.usedJSHeapSize / snapshot.jsHeapSizeLimit;

		if (usageRatio >= this.alertThresholds.critical) {
			const alert: MemoryAlert = {
				type: 'critical',
				message: 'Critical memory usage detected',
				currentUsage: snapshot.usedJSHeapSize,
				threshold: snapshot.jsHeapSizeLimit * this.alertThresholds.critical,
				suggestions: [
					'Close unused tabs',
					'Clear editor history',
					'Restart the application',
					'Reduce number of open files'
				]
			};
			this.alertObservers.forEach((observer) => observer(alert));
		} else if (usageRatio >= this.alertThresholds.warning) {
			const alert: MemoryAlert = {
				type: 'warning',
				message: 'High memory usage detected',
				currentUsage: snapshot.usedJSHeapSize,
				threshold: snapshot.jsHeapSizeLimit * this.alertThresholds.warning,
				suggestions: [
					'Consider closing some tabs',
					'Clear unnecessary data',
					'Monitor memory usage'
				]
			};
			this.alertObservers.forEach((observer) => observer(alert));
		}
	}

	/**
	 * Get memory usage trend
	 */
	getMemoryTrend(minutes: number = 10): MemorySnapshot[] {
		const cutoffTime = Date.now() - minutes * 60 * 1000;
		return this.snapshots.filter((snapshot) => snapshot.timestamp >= cutoffTime);
	}

	/**
	 * Get memory usage statistics
	 */
	getMemoryStats() {
		if (this.snapshots.length === 0) return null;

		const recent = this.snapshots.slice(-10); // Last 10 snapshots
		const usedHeapSizes = recent.map((s) => s.usedJSHeapSize);

		return {
			current: this.snapshots[this.snapshots.length - 1],
			average: usedHeapSizes.reduce((sum, size) => sum + size, 0) / usedHeapSizes.length,
			peak: Math.max(...usedHeapSizes),
			trend: this.calculateTrend(usedHeapSizes)
		};
	}

	/**
	 * Calculate memory usage trend
	 */
	private calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
		if (values.length < 2) return 'stable';

		const first = values[0];
		const last = values[values.length - 1];
		const change = (last - first) / first;

		if (change > 0.1) return 'increasing';
		if (change < -0.1) return 'decreasing';
		return 'stable';
	}

	/**
	 * Force garbage collection (if available)
	 */
	forceGarbageCollection(): boolean {
		if ('gc' in window && typeof (window as any).gc === 'function') {
			(window as any).gc();
			return true;
		}
		return false;
	}

	/**
	 * Clear memory snapshots
	 */
	clearSnapshots() {
		this.snapshots = [];
	}

	/**
	 * Subscribe to memory snapshots
	 */
	subscribe(observer: (snapshot: MemorySnapshot) => void) {
		this.observers.push(observer);
		return () => {
			const index = this.observers.indexOf(observer);
			if (index > -1) {
				this.observers.splice(index, 1);
			}
		};
	}

	/**
	 * Subscribe to memory alerts
	 */
	subscribeToAlerts(observer: (alert: MemoryAlert) => void) {
		this.alertObservers.push(observer);
		return () => {
			const index = this.alertObservers.indexOf(observer);
			if (index > -1) {
				this.alertObservers.splice(index, 1);
			}
		};
	}

	/**
	 * Set alert thresholds
	 */
	setAlertThresholds(warning: number, critical: number) {
		this.alertThresholds = { warning, critical };
	}

	/**
	 * Get all snapshots
	 */
	getAllSnapshots(): MemorySnapshot[] {
		return [...this.snapshots];
	}
}

// Export singleton instance
export const memoryTracker = new MemoryTracker();

/**
 * Memory optimization utilities
 */
export const memoryUtils = {
	/**
	 * Estimate object size in bytes (rough approximation)
	 */
	estimateObjectSize(obj: any): number {
		const jsonString = JSON.stringify(obj);
		return new Blob([jsonString]).size;
	},

	/**
	 * Deep clone with memory optimization
	 */
	optimizedClone<T>(obj: T): T {
		// Use structured cloning if available (more memory efficient)
		if ('structuredClone' in globalThis) {
			return structuredClone(obj);
		}

		// Fallback to JSON clone
		return JSON.parse(JSON.stringify(obj));
	},

	/**
	 * Weak reference utility for memory-sensitive caching
	 */
	createWeakCache<K extends object, V>(): {
		set: (key: K, value: V) => void;
		get: (key: K) => V | undefined;
		has: (key: K) => boolean;
		delete: (key: K) => boolean;
	} {
		const cache = new WeakMap<K, V>();

		return {
			set: (key: K, value: V) => cache.set(key, value),
			get: (key: K) => cache.get(key),
			has: (key: K) => cache.has(key),
			delete: (key: K) => cache.delete(key)
		};
	},

	/**
	 * Memory-efficient string interning
	 */
	createStringInterner(): {
		intern: (str: string) => string;
		size: () => number;
		clear: () => void;
	} {
		const internMap = new Map<string, string>();

		return {
			intern: (str: string) => {
				if (internMap.has(str)) {
					return internMap.get(str)!;
				}
				internMap.set(str, str);
				return str;
			},
			size: () => internMap.size,
			clear: () => internMap.clear()
		};
	}
};
