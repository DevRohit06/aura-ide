/**
 * Performance utilities index
 * Exports all performance optimization utilities
 */

// Core performance utilities
export * from './performance';
export * from './performance-monitor';
export * from './memory-tracker';
export * from './virtualization';
export * from './lazy-loading';

// Re-export commonly used utilities
export { debounce, throttle, createDebouncedEditorUpdate } from './performance';
export { performanceMonitor, performanceUtils, timed, timedAsync } from './performance-monitor';
export { memoryTracker, memoryUtils } from './memory-tracker';
export {
	flattenFileTree,
	calculateVisibleRange,
	VirtualScrollManager,
	filterVirtualizedTree
} from './virtualization';
export {
	createLazyModule,
	getLanguageExtension,
	getThemeExtension,
	preloadCommonExtensions,
	createLazyComponent,
	lazyLoadOnIntersection
} from './lazy-loading';
// Integration examples and initialization utilities
export {
	OptimizedFileTreeExample,
	OptimizedCodeEditorExample,
	initializePerformanceOptimizations,
	cleanupPerformanceOptimizations
} from './performance-integration-example';
