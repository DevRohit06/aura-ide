/**
 * Integration example showing how performance utilities work together
 * This demonstrates the usage patterns for the optimization utilities
 */

import {
	debounce,
	performanceMonitor,
	memoryTracker,
	VirtualScrollManager,
	getLanguageExtension,
	preloadCommonExtensions
} from './index';
import type { FileSystemItem } from '$lib/types/files';

/**
 * Example: Optimized file tree component with performance monitoring
 */
export class OptimizedFileTreeExample {
	private virtualScrollManager: VirtualScrollManager;
	private debouncedSearch: (term: string) => void;
	private files = new Map<string, FileSystemItem>();
	private expandedFolders = new Set<string>();

	constructor(containerHeight: number) {
		// Initialize virtual scroll manager
		this.virtualScrollManager = new VirtualScrollManager({
			itemHeight: 24,
			containerHeight,
			overscan: 5,
			scrollTop: 0
		});

		// Create debounced search function
		this.debouncedSearch = debounce(this.performSearch.bind(this), 300);

		// Start memory tracking
		memoryTracker.startTracking(30000); // Every 30 seconds

		// Preload common language extensions
		preloadCommonExtensions();
	}

	/**
	 * Load files with performance monitoring
	 */
	async loadFiles(files: FileSystemItem[]) {
		return performanceMonitor.timeAsync(
			'file-tree-load',
			'file-operation',
			async () => {
				// Convert array to map for efficient lookups
				this.files.clear();
				for (const file of files) {
					this.files.set(file.id, file);
				}

				// Update virtual scroll manager
				this.updateVirtualizedTree();

				// Record memory usage
				memoryTracker.takeSnapshot();
			},
			{ fileCount: files.length }
		);
	}

	/**
	 * Handle search input with debouncing
	 */
	onSearchInput(searchTerm: string) {
		this.debouncedSearch(searchTerm);
	}

	/**
	 * Perform search operation
	 */
	private performSearch(searchTerm: string) {
		performanceMonitor.timeSync(
			'file-tree-search',
			'user-interaction',
			() => {
				// Filter and update virtualized tree
				this.updateVirtualizedTree(searchTerm);
			},
			{ searchTerm, fileCount: this.files.size }
		);
	}

	/**
	 * Handle scroll events with throttling
	 */
	onScroll = debounce((scrollTop: number) => {
		performanceMonitor.timeSync(
			'file-tree-scroll',
			'render',
			() => {
				this.virtualScrollManager.updateScrollPosition(scrollTop);
			},
			{ scrollTop }
		);
	}, 16); // ~60fps

	/**
	 * Toggle folder expansion
	 */
	toggleFolder(folderId: string) {
		performanceMonitor.timeSync(
			'folder-toggle',
			'user-interaction',
			() => {
				if (this.expandedFolders.has(folderId)) {
					this.expandedFolders.delete(folderId);
				} else {
					this.expandedFolders.add(folderId);
				}
				this.updateVirtualizedTree();
			},
			{ folderId, expandedCount: this.expandedFolders.size }
		);
	}

	/**
	 * Update virtualized tree
	 */
	private updateVirtualizedTree(searchTerm?: string) {
		// This would use the flattenFileTree and filterVirtualizedTree utilities
		// Implementation details omitted for brevity
		console.log('Updating virtualized tree', { searchTerm, fileCount: this.files.size });
	}

	/**
	 * Get performance report
	 */
	getPerformanceReport() {
		return performanceMonitor.generateReport();
	}

	/**
	 * Get memory statistics
	 */
	getMemoryStats() {
		return memoryTracker.getMemoryStats();
	}

	/**
	 * Cleanup resources
	 */
	destroy() {
		memoryTracker.stopTracking();
		performanceMonitor.clearMetrics();
	}
}

/**
 * Example: Optimized code editor with lazy loading
 */
export class OptimizedCodeEditorExample {
	private debouncedContentUpdate: (content: string, fileId: string) => void;
	private loadedExtensions = new Map<string, any>();

	constructor() {
		// Create debounced content update
		this.debouncedContentUpdate = debounce(this.updateFileContent.bind(this), 500);

		// Subscribe to memory alerts
		memoryTracker.subscribeToAlerts((alert) => {
			console.warn('Memory alert:', alert.message, alert.suggestions);
		});
	}

	/**
	 * Load file with language extension
	 */
	async loadFile(file: FileSystemItem) {
		return performanceMonitor.timeAsync(
			'editor-load-file',
			'file-operation',
			async () => {
				// Get file extension
				const extension = file.path.split('.').pop() || '';

				// Lazy load language extension
				const languageExtension = await getLanguageExtension(`.${extension}`);

				if (languageExtension) {
					this.loadedExtensions.set(file.id, languageExtension);
				}

				// Record memory usage after loading
				memoryTracker.takeSnapshot();
			},
			{ fileId: file.id, extension: file.path.split('.').pop() }
		);
	}

	/**
	 * Handle content changes with debouncing
	 */
	onContentChange(content: string, fileId: string) {
		this.debouncedContentUpdate(content, fileId);
	}

	/**
	 * Update file content
	 */
	private updateFileContent(content: string, fileId: string) {
		performanceMonitor.recordMetric('editor-content-update', content.length, 'user-interaction', {
			fileId,
			contentLength: content.length
		});

		// Actual content update logic would go here
		console.log('Updating file content', { fileId, length: content.length });
	}

	/**
	 * Force immediate save
	 */
	saveFile(content: string, fileId: string) {
		// Bypass debouncing for immediate save
		this.updateFileContent(content, fileId);
	}
}

/**
 * Example usage and initialization
 */
export function initializePerformanceOptimizations() {
	// Start global performance monitoring
	memoryTracker.startTracking(60000); // Every minute

	// Subscribe to performance metrics
	performanceMonitor.subscribe((metric) => {
		// Log slow operations
		if (metric.value > 1000) {
			// > 1 second
			console.warn('Slow operation detected:', metric.name, `${metric.value}ms`);
		}
	});

	// Subscribe to memory alerts
	memoryTracker.subscribeToAlerts((alert) => {
		if (alert.type === 'critical') {
			// Show user notification for critical memory usage
			console.error('Critical memory usage:', alert.message);
		}
	});

	// Preload common extensions
	preloadCommonExtensions().catch(console.warn);

	console.log('Performance optimizations initialized');
}

/**
 * Example cleanup function
 */
export function cleanupPerformanceOptimizations() {
	memoryTracker.stopTracking();
	performanceMonitor.clearMetrics();
	memoryTracker.clearSnapshots();

	console.log('Performance optimizations cleaned up');
}
