// Route preloading for critical paths
export function preloadCriticalRoutes() {
	if (typeof window === 'undefined') return;

	// Preload common routes
	const criticalRoutes = ['/api/projects', '/dashboard', '/auth/login'];

	criticalRoutes.forEach((route) => {
		const link = document.createElement('link');
		link.rel = 'prefetch';
		link.href = route;
		document.head.appendChild(link);
	});
}

// Module preloading for heavy dependencies
export function preloadHeavyModules() {
	if (typeof window === 'undefined') return;

	// Preload heavy modules after initial load
	const heavyModules = [
		() => import('@codemirror/theme-one-dark'),
		() => import('thememirror'),
		() => import('$lib/components/shared/terminal')
	];

	// Use requestIdleCallback for non-blocking preload
	const preloadModule = (loader: () => Promise<any>) => {
		if ('requestIdleCallback' in window) {
			window.requestIdleCallback(() => {
				loader().catch(() => {
					// Ignore preload errors
				});
			});
		} else {
			// Fallback for browsers without requestIdleCallback
			setTimeout(() => {
				loader().catch(() => {
					// Ignore preload errors
				});
			}, 100);
		}
	};

	heavyModules.forEach(preloadModule);
}
