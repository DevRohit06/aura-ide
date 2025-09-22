import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce, throttle, createDebouncedEditorUpdate } from './performance';

describe('Performance Utilities', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	describe('debounce', () => {
		it('should delay function execution', () => {
			const mockFn = vi.fn();
			const debouncedFn = debounce(mockFn, 100);

			debouncedFn('test');
			expect(mockFn).not.toHaveBeenCalled();

			vi.advanceTimersByTime(100);
			expect(mockFn).toHaveBeenCalledWith('test');
		});

		it('should cancel previous calls', () => {
			const mockFn = vi.fn();
			const debouncedFn = debounce(mockFn, 100);

			debouncedFn('first');
			debouncedFn('second');

			vi.advanceTimersByTime(100);
			expect(mockFn).toHaveBeenCalledTimes(1);
			expect(mockFn).toHaveBeenCalledWith('second');
		});
	});

	describe('throttle', () => {
		it('should limit function execution rate', () => {
			const mockFn = vi.fn();
			const throttledFn = throttle(mockFn, 100);

			throttledFn('first');
			throttledFn('second');
			throttledFn('third');

			expect(mockFn).toHaveBeenCalledTimes(1);
			expect(mockFn).toHaveBeenCalledWith('first');

			vi.advanceTimersByTime(100);
			throttledFn('fourth');
			expect(mockFn).toHaveBeenCalledTimes(2);
			expect(mockFn).toHaveBeenCalledWith('fourth');
		});
	});

	describe('createDebouncedEditorUpdate', () => {
		it('should create debounced update function', () => {
			const mockUpdate = vi.fn();
			const debouncedUpdate = createDebouncedEditorUpdate(mockUpdate, 200);

			debouncedUpdate.update('content', 'file1');
			expect(mockUpdate).not.toHaveBeenCalled();

			vi.advanceTimersByTime(200);
			expect(mockUpdate).toHaveBeenCalledWith('content', 'file1');
		});

		it('should provide flush method for immediate execution', () => {
			const mockUpdate = vi.fn();
			const debouncedUpdate = createDebouncedEditorUpdate(mockUpdate, 200);

			debouncedUpdate.flush('immediate', 'file1');
			expect(mockUpdate).toHaveBeenCalledWith('immediate', 'file1');
		});
	});
});
