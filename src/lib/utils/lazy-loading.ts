/**
 * Lazy loading utilities for code editor extensions and components
 */

import { performanceMonitor } from './performance-monitor';

export interface LazyLoadConfig {
	timeout?: number;
	retries?: number;
	fallback?: () => any;
}

export interface LazyModule<T = any> {
	module: T | null;
	loading: boolean;
	error: Error | null;
	load: () => Promise<T>;
}

/**
 * Cache for loaded modules to prevent duplicate loading
 */
const moduleCache = new Map<string, any>();

/**
 * Create a lazy-loaded module wrapper
 */
export function createLazyModule<T>(
	loader: () => Promise<T>,
	cacheKey: string,
	config: LazyLoadConfig = {}
): LazyModule<T> {
	const { timeout = 10000, retries = 3, fallback } = config;

	let module: T | null = null;
	let loading = false;
	let error: Error | null = null;

	const load = async (): Promise<T> => {
		// Return cached module if available
		if (moduleCache.has(cacheKey)) {
			module = moduleCache.get(cacheKey);
			return module!;
		}

		if (loading) {
			// Wait for existing load to complete
			while (loading) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
			if (module) return module;
		}

		loading = true;
		error = null;

		let attempt = 0;
		while (attempt < retries) {
			try {
				const loadPromise = performanceMonitor.timeAsync(
					`lazy-load-${cacheKey}`,
					'network',
					loader,
					{ attempt, cacheKey }
				);

				// Add timeout
				const timeoutPromise = new Promise<never>((_, reject) =>
					setTimeout(() => reject(new Error(`Timeout loading ${cacheKey}`)), timeout)
				);

				module = await Promise.race([loadPromise, timeoutPromise]);
				moduleCache.set(cacheKey, module);
				loading = false;
				return module;
			} catch (err) {
				attempt++;
				error = err instanceof Error ? err : new Error(String(err));

				if (attempt >= retries) {
					loading = false;
					if (fallback) {
						module = fallback();
						return module!;
					}
					throw error;
				}

				// Exponential backoff
				await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
			}
		}

		loading = false;
		throw error || new Error(`Failed to load ${cacheKey}`);
	};

	return {
		get module() {
			return module;
		},
		get loading() {
			return loading;
		},
		get error() {
			return error;
		},
		load
	};
}

/**
 * Lazy loading utilities for CodeMirror language extensions
 */
export const languageExtensions = {
	javascript: createLazyModule(() => import('@codemirror/lang-javascript'), 'lang-javascript'),
	typescript: createLazyModule(() => import('@codemirror/lang-javascript'), 'lang-typescript'),
	html: createLazyModule(() => import('@codemirror/lang-html'), 'lang-html'),
	css: createLazyModule(() => import('@codemirror/lang-css'), 'lang-css'),
	python: createLazyModule(() => import('@codemirror/lang-python'), 'lang-python'),
	json: createLazyModule(() => import('@codemirror/lang-json'), 'lang-json'),
	markdown: createLazyModule(() => import('@codemirror/lang-markdown'), 'lang-markdown'),
	svelte: createLazyModule(() => import('@replit/codemirror-lang-svelte'), 'lang-svelte')
};

/**
 * Get language extension based on file extension
 */
export async function getLanguageExtension(fileExtension: string) {
	const extensionMap: Record<string, keyof typeof languageExtensions> = {
		'.js': 'javascript',
		'.mjs': 'javascript',
		'.jsx': 'javascript',
		'.ts': 'typescript',
		'.tsx': 'typescript',
		'.html': 'html',
		'.htm': 'html',
		'.css': 'css',
		'.scss': 'css',
		'.sass': 'css',
		'.py': 'python',
		'.json': 'json',
		'.md': 'markdown',
		'.markdown': 'markdown',
		'.svelte': 'svelte'
	};

	const languageKey = extensionMap[fileExtension.toLowerCase()];
	if (!languageKey) {
		return null;
	}

	try {
		const languageModule = await languageExtensions[languageKey].load();

		// Handle different module structures with type safety
		if (languageKey === 'svelte') {
			const svelteModule = languageModule as any;
			return svelteModule.svelte?.() || null;
		} else if (languageKey === 'javascript' || languageKey === 'typescript') {
			const jsModule = languageModule as any;
			return (
				jsModule.javascript?.({
					typescript: languageKey === 'typescript',
					jsx: fileExtension.includes('x')
				}) || null
			);
		} else {
			// Most language modules export a function as default
			const anyModule = languageModule as any;
			const langFunction = anyModule.default || anyModule[languageKey];
			return typeof langFunction === 'function' ? langFunction() : langFunction;
		}
	} catch (error) {
		console.warn(`Failed to load language extension for ${fileExtension}:`, error);
		return null;
	}
}

/**
 * Lazy loading for CodeMirror themes
 */
export const themeExtensions = {
	oneDark: createLazyModule(() => import('@codemirror/theme-one-dark'), 'theme-one-dark'),
	basicLight: createLazyModule(
		() => import('@codemirror/view').then((m) => ({ basicLight: m.EditorView.baseTheme({}) })),
		'theme-basic-light'
	)
};

/**
 * Get theme extension
 */
export async function getThemeExtension(themeName: 'dark' | 'light') {
	try {
		if (themeName === 'dark') {
			const themeModule = await themeExtensions.oneDark.load();
			return themeModule.oneDark;
		} else {
			const themeModule = await themeExtensions.basicLight.load();
			return themeModule.basicLight;
		}
	} catch (error) {
		console.warn(`Failed to load theme extension for ${themeName}:`, error);
		return null;
	}
}

/**
 * Lazy component loader for Svelte components
 */
export function createLazyComponent<T = any>(
	loader: () => Promise<{ default: T }>,
	cacheKey: string,
	config: LazyLoadConfig = {}
) {
	const lazyModule = createLazyModule(loader, cacheKey, config);

	return {
		...lazyModule,
		load: async () => {
			const module = await lazyModule.load();
			return module.default;
		}
	};
}

/**
 * Preload commonly used extensions
 */
export async function preloadCommonExtensions() {
	const commonExtensions = ['javascript', 'typescript', 'html', 'css', 'json', 'markdown'] as const;

	const preloadPromises = commonExtensions.map(async (ext) => {
		try {
			await languageExtensions[ext].load();
		} catch (error) {
			console.warn(`Failed to preload ${ext} extension:`, error);
		}
	});

	await Promise.allSettled(preloadPromises);
}

/**
 * Intersection Observer utility for lazy loading components
 */
export function createIntersectionObserver(
	callback: (entries: IntersectionObserverEntry[]) => void,
	options: IntersectionObserverInit = {}
) {
	const defaultOptions: IntersectionObserverInit = {
		root: null,
		rootMargin: '50px',
		threshold: 0.1,
		...options
	};

	return new IntersectionObserver(callback, defaultOptions);
}

/**
 * Lazy load component when it enters viewport
 */
export function lazyLoadOnIntersection<T>(
	element: Element,
	loader: () => Promise<T>,
	cacheKey: string
): Promise<T> {
	return new Promise((resolve, reject) => {
		const lazyModule = createLazyModule(loader, cacheKey);

		const observer = createIntersectionObserver(async (entries) => {
			const entry = entries[0];
			if (entry.isIntersecting) {
				observer.disconnect();
				try {
					const module = await lazyModule.load();
					resolve(module);
				} catch (error) {
					reject(error);
				}
			}
		});

		observer.observe(element);
	});
}
