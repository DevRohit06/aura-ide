/**
 * Performance Monitoring Service
 * Tracks and reports application performance metrics
 */

interface PerformanceMetric {
	name: string;
	value: number;
	unit: string;
	timestamp: Date;
	tags?: Record<string, string>;
}

interface PerformanceAlert {
	metric: string;
	threshold: number;
	actual: number;
	severity: 'low' | 'medium' | 'high' | 'critical';
	timestamp: Date;
	resolved: boolean;
}

class PerformanceMonitor {
	private metrics: Map<string, PerformanceMetric[]> = new Map();
	private alerts: PerformanceAlert[] = [];
	private thresholds: Map<string, { warning: number; critical: number }> = new Map();
	private observers: PerformanceObserver[] = [];

	constructor() {
		this.setupDefaultThresholds();
		this.initializeObservers();
	}

	/**
	 * Setup default performance thresholds
	 */
	private setupDefaultThresholds() {
		this.thresholds.set('response_time', { warning: 1000, critical: 3000 }); // ms
		this.thresholds.set('memory_usage', { warning: 80, critical: 95 }); // percentage
		this.thresholds.set('cpu_usage', { warning: 70, critical: 90 }); // percentage
		this.thresholds.set('error_rate', { warning: 5, critical: 10 }); // percentage
		this.thresholds.set('active_connections', { warning: 1000, critical: 1500 });
	}

	/**
	 * Initialize performance observers
	 */
	private initializeObservers() {
		if (typeof window === 'undefined') return; // Server-side

		try {
			// Navigation timing observer
			const navObserver = new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) {
					if (entry.entryType === 'navigation') {
						const navEntry = entry as PerformanceNavigationTiming;
						this.recordMetric('page_load_time', navEntry.loadEventEnd - navEntry.fetchStart, 'ms');
						this.recordMetric(
							'dom_content_loaded',
							navEntry.domContentLoadedEventEnd - navEntry.fetchStart,
							'ms'
						);
						this.recordMetric(
							'first_contentful_paint',
							navEntry.domContentLoadedEventEnd - navEntry.fetchStart,
							'ms'
						);
					}
				}
			});
			navObserver.observe({ entryTypes: ['navigation'] });
			this.observers.push(navObserver);

			// Resource timing observer
			const resourceObserver = new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) {
					if (entry.entryType === 'resource') {
						const resourceEntry = entry as PerformanceResourceTiming;
						this.recordMetric(
							'resource_load_time',
							resourceEntry.responseEnd - resourceEntry.fetchStart,
							'ms',
							{
								resource_type: resourceEntry.initiatorType,
								resource_name: resourceEntry.name
							}
						);
					}
				}
			});
			resourceObserver.observe({ entryTypes: ['resource'] });
			this.observers.push(resourceObserver);

			// Measure observer for custom metrics
			const measureObserver = new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) {
					if (entry.entryType === 'measure') {
						this.recordMetric(entry.name, entry.duration, 'ms');
					}
				}
			});
			measureObserver.observe({ entryTypes: ['measure'] });
			this.observers.push(measureObserver);
		} catch (error) {
			console.warn('Performance observers not supported:', error);
		}
	}

	/**
	 * Record a performance metric
	 */
	recordMetric(name: string, value: number, unit: string, tags?: Record<string, string>) {
		const metric: PerformanceMetric = {
			name,
			value,
			unit,
			timestamp: new Date(),
			tags
		};

		if (!this.metrics.has(name)) {
			this.metrics.set(name, []);
		}

		const metrics = this.metrics.get(name)!;
		metrics.push(metric);

		// Keep only last 1000 metrics per type
		if (metrics.length > 1000) {
			metrics.shift();
		}

		// Check for threshold violations
		this.checkThresholds(name, value);
	}

	/**
	 * Start timing a custom operation
	 */
	startTiming(operationName: string) {
		if (typeof performance !== 'undefined') {
			performance.mark(`${operationName}-start`);
		}
	}

	/**
	 * End timing a custom operation
	 */
	endTiming(operationName: string) {
		if (typeof performance !== 'undefined') {
			performance.mark(`${operationName}-end`);
			performance.measure(operationName, `${operationName}-start`, `${operationName}-end`);
		}
	}

	/**
	 * Record API response time
	 */
	recordApiCall(endpoint: string, method: string, responseTime: number, statusCode: number) {
		this.recordMetric('api_response_time', responseTime, 'ms', {
			endpoint,
			method,
			status_code: statusCode.toString()
		});

		// Record error rate
		if (statusCode >= 400) {
			this.recordMetric('api_error', 1, 'count', {
				endpoint,
				method,
				status_code: statusCode.toString()
			});
		}
	}

	/**
	 * Record memory usage
	 */
	recordMemoryUsage() {
		if (typeof performance !== 'undefined' && 'memory' in performance) {
			const memory = (performance as any).memory;
			this.recordMetric('memory_used', memory.usedJSHeapSize, 'bytes');
			this.recordMetric('memory_total', memory.totalJSHeapSize, 'bytes');
			this.recordMetric('memory_limit', memory.jsHeapSizeLimit, 'bytes');

			const usagePercentage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
			this.recordMetric('memory_usage', usagePercentage, 'percentage');
		}
	}

	/**
	 * Check if metric value exceeds thresholds
	 */
	private checkThresholds(metricName: string, value: number) {
		const threshold = this.thresholds.get(metricName);
		if (!threshold) return;

		let severity: 'low' | 'medium' | 'high' | 'critical' | null = null;

		if (value >= threshold.critical) {
			severity = 'critical';
		} else if (value >= threshold.warning) {
			severity = 'high';
		}

		if (severity) {
			const alert: PerformanceAlert = {
				metric: metricName,
				threshold: severity === 'critical' ? threshold.critical : threshold.warning,
				actual: value,
				severity,
				timestamp: new Date(),
				resolved: false
			};

			this.alerts.push(alert);

			// Trigger alert callback if configured
			console.warn(
				`Performance alert: ${metricName} (${value}) exceeded ${severity} threshold (${alert.threshold})`
			);
		}
	}

	/**
	 * Get metrics for a specific name
	 */
	getMetrics(name: string, since?: Date): PerformanceMetric[] {
		const metrics = this.metrics.get(name) || [];

		if (since) {
			return metrics.filter((m) => m.timestamp >= since);
		}

		return metrics;
	}

	/**
	 * Get aggregated metrics
	 */
	getAggregatedMetrics(
		name: string,
		since?: Date
	): {
		count: number;
		average: number;
		min: number;
		max: number;
		p95: number;
		p99: number;
	} {
		const metrics = this.getMetrics(name, since);

		if (metrics.length === 0) {
			return { count: 0, average: 0, min: 0, max: 0, p95: 0, p99: 0 };
		}

		const values = metrics.map((m) => m.value).sort((a, b) => a - b);
		const count = values.length;
		const sum = values.reduce((a, b) => a + b, 0);

		return {
			count,
			average: sum / count,
			min: values[0],
			max: values[count - 1],
			p95: values[Math.floor(count * 0.95)],
			p99: values[Math.floor(count * 0.99)]
		};
	}

	/**
	 * Get all active alerts
	 */
	getActiveAlerts(): PerformanceAlert[] {
		return this.alerts.filter((a) => !a.resolved);
	}

	/**
	 * Resolve an alert
	 */
	resolveAlert(alertIndex: number) {
		if (this.alerts[alertIndex]) {
			this.alerts[alertIndex].resolved = true;
		}
	}

	/**
	 * Set custom threshold
	 */
	setThreshold(metricName: string, warning: number, critical: number) {
		this.thresholds.set(metricName, { warning, critical });
	}

	/**
	 * Generate performance report
	 */
	generateReport(since?: Date): {
		summary: {
			total_metrics: number;
			active_alerts: number;
			performance_score: number;
		};
		metrics: Record<string, any>;
		alerts: PerformanceAlert[];
	} {
		const activeAlerts = this.getActiveAlerts();
		let totalMetrics = 0;

		const metrics: Record<string, any> = {};
		for (const [name, metricList] of this.metrics.entries()) {
			const filteredMetrics = since ? metricList.filter((m) => m.timestamp >= since) : metricList;
			totalMetrics += filteredMetrics.length;

			if (filteredMetrics.length > 0) {
				metrics[name] = this.getAggregatedMetrics(name, since);
			}
		}

		// Calculate performance score (0-100)
		const criticalAlerts = activeAlerts.filter((a) => a.severity === 'critical').length;
		const highAlerts = activeAlerts.filter((a) => a.severity === 'high').length;

		let performanceScore = 100;
		performanceScore -= criticalAlerts * 20;
		performanceScore -= highAlerts * 10;
		performanceScore = Math.max(0, performanceScore);

		return {
			summary: {
				total_metrics: totalMetrics,
				active_alerts: activeAlerts.length,
				performance_score: performanceScore
			},
			metrics,
			alerts: activeAlerts
		};
	}

	/**
	 * Start periodic monitoring
	 */
	startPeriodicMonitoring(intervalMs: number = 30000) {
		setInterval(() => {
			this.recordMemoryUsage();

			// Record other system metrics if available
			if (typeof navigator !== 'undefined' && 'connection' in navigator) {
				const connection = (navigator as any).connection;
				if (connection) {
					this.recordMetric('network_downlink', connection.downlink, 'mbps');
					this.recordMetric('network_rtt', connection.rtt, 'ms');
				}
			}
		}, intervalMs);
	}

	/**
	 * Cleanup observers
	 */
	cleanup() {
		this.observers.forEach((observer) => {
			observer.disconnect();
		});
		this.observers = [];
	}
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// Auto-start periodic monitoring
if (typeof window !== 'undefined') {
	performanceMonitor.startPeriodicMonitoring();
}

export { PerformanceMonitor };
export type { PerformanceAlert, PerformanceMetric };
