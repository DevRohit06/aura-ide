import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	performanceMonitor,
	performanceUtils,
	timed,
	timedAsync
} from '$lib/utils/performance-monitor';

describe('Performance Monitor', () => {
	beforeEach(() => {
		performanceMonitor.clearMetrics();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	describe('recordMetric', () => {
		it('should record performance metrics', () => {
			performanceMonitor.recordMetric('test-operation', 100, 'file-operation');

			const report = performanceMonitor.generateReport();
			expect(report.metrics).toHaveLength(1);
			expect(report.metrics[0].name).toBe('test-operation');
			expect(report.metrics[0].value).toBe(100);
			expect(report.metrics[0].category).toBe('file-operation');
		});
	});

	describe('timeSync', () => {
		it('should time synchronous function execution', () => {
			const mockFn = vi.fn(() => 'result');

			const result = performanceMonitor.timeSync('sync-test', 'render', mockFn);

			expect(result).toBe('result');
			expect(mockFn).toHaveBeenCalled();

			const report = performanceMonitor.generateReport();
			expect(report.metrics).toHaveLength(1);
			expect(report.metrics[0].name).toBe('sync-test');
		});

		it('should record error metrics when function throws', () => {
			const mockFn = vi.fn(() => {
				throw new Error('Test error');
			});

			expect(() => {
				performanceMonitor.timeSync('error-test', 'render', mockFn);
			}).toThrow('Test error');

			const report = performanceMonitor.generateReport();
			expect(report.metrics[0].metadata?.error).toBe(true);
		});
	});

	describe('timeAsync', () => {
		it('should time asynchronous function execution', async () => {
			const mockFn = vi.fn(async () => {
				await new Promise((resolve) => setTimeout(resolve, 100));
				return 'async-result';
			});

			const result = await performanceMonitor.timeAsync('async-test', 'network', mockFn);

			expect(result).toBe('async-result');
			expect(mockFn).toHaveBeenCalled();

			const report = performanceMonitor.generateReport();
			expect(report.metrics).toHaveLength(1);
			expect(report.metrics[0].name).toBe('async-test');
		});
	});

	describe('generateReport', () => {
		it('should generate comprehensive performance report', () => {
			performanceMonitor.recordMetric('file-op-1', 50, 'file-operation');
			performanceMonitor.recordMetric('file-op-2', 100, 'file-operation');
			performanceMonitor.recordMetric('render-1', 16, 'render');

			const report = performanceMonitor.generateReport();

			expect(report.metrics).toHaveLength(3);
			expect(report.summary.averageFileOperationTime).toBe(75);
			expect(report.summary.averageRenderTime).toBe(16);
			expect(report.summary.slowestOperations).toHaveLength(3);
		});
	});

	describe('getMetricsByCategory', () => {
		it('should filter metrics by category', () => {
			performanceMonitor.recordMetric('file-op', 50, 'file-operation');
			performanceMonitor.recordMetric('render-op', 16, 'render');

			const fileMetrics = performanceMonitor.getMetricsByCategory('file-operation');
			const renderMetrics = performanceMonitor.getMetricsByCategory('render');

			expect(fileMetrics).toHaveLength(1);
			expect(renderMetrics).toHaveLength(1);
			expect(fileMetrics[0].name).toBe('file-op');
			expect(renderMetrics[0].name).toBe('render-op');
		});
	});

	describe('subscribe', () => {
		it('should notify observers of new metrics', () => {
			const observer = vi.fn();
			const unsubscribe = performanceMonitor.subscribe(observer);

			performanceMonitor.recordMetric('test', 100, 'file-operation');

			expect(observer).toHaveBeenCalledTimes(1);
			expect(observer).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'test',
					value: 100,
					category: 'file-operation'
				})
			);

			unsubscribe();
			performanceMonitor.recordMetric('test2', 200, 'render');
			expect(observer).toHaveBeenCalledTimes(1); // Should not be called after unsubscribe
		});
	});
});

describe('Performance Decorators', () => {
	beforeEach(() => {
		performanceMonitor.clearMetrics();
	});

	describe('@timed decorator', () => {
		it('should time method execution', () => {
			class TestClass {
				@timed('render')
				testMethod(value: number) {
					return value * 2;
				}
			}

			const instance = new TestClass();
			const result = instance.testMethod(5);

			expect(result).toBe(10);

			const report = performanceMonitor.generateReport();
			expect(report.metrics).toHaveLength(1);
			expect(report.metrics[0].name).toBe('TestClass.testMethod');
		});
	});

	describe('@timedAsync decorator', () => {
		it('should time async method execution', async () => {
			class TestClass {
				@timedAsync('network')
				async asyncMethod(value: number) {
					await new Promise((resolve) => setTimeout(resolve, 10));
					return value * 3;
				}
			}

			const instance = new TestClass();
			const result = await instance.asyncMethod(4);

			expect(result).toBe(12);

			const report = performanceMonitor.generateReport();
			expect(report.metrics).toHaveLength(1);
			expect(report.metrics[0].name).toBe('TestClass.asyncMethod');
		});
	});
});
