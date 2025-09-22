/**
 * Performance monitoring and metrics collection utilities
 */

export interface PerformanceMetric {
	name: string;
	value: number;
	timestamp: number;
	category: 'file-operation' | 'render' | 'memory' | 'network' | 'user-interaction';
	metadata?: Record<string, any>;
}

export interface PerformanceReport {
	metrics: PerformanceMetric[];
	summary: {
		averageFileOperationTime: number;
		averageRenderTime: number;
		memoryUsage: MemoryUsage;
		slowestOperations: PerformanceMetric[];
	};
	generatedAt: number;
}

export interface MemoryUsage {
	files: number;
	editor: number;
	ai: number;
	ui: number;
	total: number;
}

/**
 * Performance monitor singleton for collecting and analyzing metrics
 */
class PerformanceMonitor {
	private metrics: PerformanceMetric[] = [];
	private maxMetrics = 1000; // Limit stored metrics to prevent memory leaks
	private observers: ((metric: PerformanceMetric) => void)[] = [];

	/**
	 * Record a performance metric
	 */
	recordMetric(
		name: string,
		value: number,
		category: PerformanceMetric['category'],
		metadata?: Record<string, any>
	) {
		const metric: PerformanceMetric = {
			name,
			value,
			timestamp: Date.now(),
			category,
			metadata
		};

		this.metrics.push(metric);

		// Limit stored metrics
		if (this.metrics.length > this.maxMetrics) {
			this.metrics = this.metrics.slice(-this.maxMetrics);
		}

		// Notify observers
		this.observers.forEach((observer) => observer(metric));
	}

	/**
	 * Time a function execution and record the metric
	 */
	async timeAsync<T>(
		name: string,
		category: PerformanceMetric['category'],
		fn: () => Promise<T>,
		metadata?: Record<string, any>
	): Promise<T> {
		const startTime = performance.now();
		try {
			const result = await fn();
			const duration = performance.now() - startTime;
			this.recordMetric(name, duration, category, metadata);
			return result;
		} catch (error) {
			const duration = performance.now() - startTime;
			this.recordMetric(name, duration, category, { ...metadata, error: true });
			throw error;
		}
	}

	/**
	 * Time a synchronous function execution
	 */
	timeSync<T>(
		name: string,
		category: PerformanceMetric['category'],
		fn: () => T,
		metadata?: Record<string, any>
	): T {
		const startTime = performance.now();
		try {
			const result = fn();
			const duration = performance.now() - startTime;
			this.recordMetric(name, duration, category, metadata);
			return result;
		} catch (error) {
			const duration = performance.now() - startTime;
			this.recordMetric(name, duration, category, { ...metadata, error: true });
			throw error;
		}
	}

	/**
	 * Get metrics by category
	 */
	getMetricsByCategory(category: PerformanceMetric['category']): PerformanceMetric[] {
		return this.metrics.filter((metric) => metric.category === category);
	}

	/**
	 * Get metrics within a time range
	 */
	getMetricsInRange(startTime: number, endTime: number): PerformanceMetric[] {
		return this.metrics.filter(
			(metric) => metric.timestamp >= startTime && metric.timestamp <= endTime
		);
	}

	/**
	 * Generate performance report
	 */
	generateReport(): PerformanceReport {
		const fileOperationMetrics = this.getMetricsByCategory('file-operation');
		const renderMetrics = this.getMetricsByCategory('render');
		const memoryMetrics = this.getMetricsByCategory('memory');

		const averageFileOperationTime =
			fileOperationMetrics.length > 0
				? fileOperationMetrics.reduce((sum, m) => sum + m.value, 0) / fileOperationMetrics.length
				: 0;

		const averageRenderTime =
			renderMetrics.length > 0
				? renderMetrics.reduce((sum, m) => sum + m.value, 0) / renderMetrics.length
				: 0;

		const latestMemoryMetric = memoryMetrics[memoryMetrics.length - 1];
		const memoryUsage: MemoryUsage = (latestMemoryMetric?.metadata as MemoryUsage) || {
			files: 0,
			editor: 0,
			ai: 0,
			ui: 0,
			total: 0
		};

		const slowestOperations = [...this.metrics].sort((a, b) => b.value - a.value).slice(0, 10);

		return {
			metrics: [...this.metrics],
			summary: {
				averageFileOperationTime,
				averageRenderTime,
				memoryUsage,
				slowestOperations
			},
			generatedAt: Date.now()
		};
	}

	/**
	 * Clear all metrics
	 */
	clearMetrics() {
		this.metrics = [];
	}

	/**
	 * Subscribe to metric updates
	 */
	subscribe(observer: (metric: PerformanceMetric) => void) {
		this.observers.push(observer);
		return () => {
			const index = this.observers.indexOf(observer);
			if (index > -1) {
				this.observers.splice(index, 1);
			}
		};
	}

	/**
	 * Get current memory usage estimate
	 */
	estimateMemoryUsage(): MemoryUsage {
		// Rough estimation based on stored data
		const filesMemory = this.metrics.filter((m) => m.category === 'file-operation').length * 100; // bytes per metric
		const editorMemory = this.metrics.filter((m) => m.category === 'render').length * 50;
		const aiMemory = this.metrics.filter((m) => m.name.includes('ai')).length * 200;
		const uiMemory = this.metrics.length * 80; // Base UI memory

		const memoryUsage: MemoryUsage = {
			files: filesMemory,
			editor: editorMemory,
			ai: aiMemory,
			ui: uiMemory,
			total: filesMemory + editorMemory + aiMemory + uiMemory
		};

		// Record memory usage metric
		this.recordMetric('memory-usage', memoryUsage.total, 'memory', memoryUsage);

		return memoryUsage;
	}
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Decorator for timing method execution
 */
export function timed(category: PerformanceMetric['category']) {
	return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
		const originalMethod = descriptor.value;

		descriptor.value = function (...args: any[]) {
			const methodName = `${target.constructor.name}.${propertyKey}`;
			return performanceMonitor.timeSync(methodName, category, () =>
				originalMethod.apply(this, args)
			);
		};

		return descriptor;
	};
}

/**
 * Decorator for timing async method execution
 */
export function timedAsync(category: PerformanceMetric['category']) {
	return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
		const originalMethod = descriptor.value;

		descriptor.value = function (...args: any[]) {
			const methodName = `${target.constructor.name}.${propertyKey}`;
			return performanceMonitor.timeAsync(methodName, category, () =>
				originalMethod.apply(this, args)
			);
		};

		return descriptor;
	};
}

/**
 * Performance utilities for common operations
 */
export const performanceUtils = {
	/**
	 * Measure First Contentful Paint
	 */
	measureFCP(): Promise<number> {
		return new Promise((resolve) => {
			new PerformanceObserver((list) => {
				const entries = list.getEntries();
				const fcpEntry = entries.find((entry) => entry.name === 'first-contentful-paint');
				if (fcpEntry) {
					resolve(fcpEntry.startTime);
				}
			}).observe({ entryTypes: ['paint'] });
		});
	},

	/**
	 * Measure Largest Contentful Paint
	 */
	measureLCP(): Promise<number> {
		return new Promise((resolve) => {
			new PerformanceObserver((list) => {
				const entries = list.getEntries();
				const lcpEntry = entries[entries.length - 1];
				if (lcpEntry) {
					resolve(lcpEntry.startTime);
				}
			}).observe({ entryTypes: ['largest-contentful-paint'] });
		});
	},

	/**
	 * Measure Cumulative Layout Shift
	 */
	measureCLS(): Promise<number> {
		return new Promise((resolve) => {
			let clsValue = 0;
			new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) {
					if (!(entry as any).hadRecentInput) {
						clsValue += (entry as any).value;
					}
				}
				resolve(clsValue);
			}).observe({ entryTypes: ['layout-shift'] });
		});
	}
};
