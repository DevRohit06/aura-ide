/**
 * Performance optimization utilities for Aura IDE
 */

/**
 * Debounce function to limit the rate of function execution
 * Useful for editor updates, search input, and other high-frequency events
 */
export function debounce<T extends (...args: any[]) => any>(
	func: T,
	delay: number
): (...args: Parameters<T>) => void {
	let timeoutId: ReturnType<typeof setTimeout>;

	return (...args: Parameters<T>) => {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => func(...args), delay);
	};
}

/**
 * Throttle function to ensure function is called at most once per interval
 * Useful for scroll events and resize handlers
 */
export function throttle<T extends (...args: any[]) => any>(
	func: T,
	limit: number
): (...args: Parameters<T>) => void {
	let inThrottle: boolean;

	return (...args: Parameters<T>) => {
		if (!inThrottle) {
			func(...args);
			inThrottle = true;
			setTimeout(() => (inThrottle = false), limit);
		}
	};
}

/**
 * Debounced editor update utility specifically for CodeMirror
 * Optimizes editor content synchronization with stores
 */
export function createDebouncedEditorUpdate(
	updateCallback: (content: string, fileId: string) => void,
	delay: number = 300
) {
	const debouncedUpdate = debounce(updateCallback, delay);

	return {
		update: debouncedUpdate,
		flush: (content: string, fileId: string) => {
			// Force immediate execution if needed
			updateCallback(content, fileId);
		}
	};
}
