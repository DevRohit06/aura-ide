import { browser } from '$app/environment';
import { setupGlobalErrorHandler } from './utils/error-handling';
import { initializeHttpInterceptor } from './utils/http-interceptor';

// App initialization configuration
interface AppConfig {
	enableGlobalErrorHandler?: boolean;
	enableHttpInterceptor?: boolean;
	httpInterceptorConfig?: {
		enableLogging?: boolean;
		defaultTimeout?: number;
		retryAttempts?: number;
	};
}

// Default app configuration
const defaultAppConfig: AppConfig = {
	enableGlobalErrorHandler: true,
	enableHttpInterceptor: true,
	httpInterceptorConfig: {
		enableLogging: import.meta.env.DEV,
		defaultTimeout: 30000,
		retryAttempts: 2
	}
};

// Initialize the application with error handling and HTTP interceptors
export function initializeApp(config: AppConfig = {}): void {
	const finalConfig = { ...defaultAppConfig, ...config };

	if (!browser) return;

	console.group('🚀 Initializing Aura IDE App');

	try {
		// Set up global error handling
		if (finalConfig.enableGlobalErrorHandler) {
			setupGlobalErrorHandler();
			console.log('✅ Global error handler initialized');
		}

		// Set up HTTP interceptor
		if (finalConfig.enableHttpInterceptor) {
			initializeHttpInterceptor(finalConfig.httpInterceptorConfig);
			console.log('✅ HTTP interceptor initialized');
		}

		// Additional app-specific initialization
		initializeAppFeatures();

		console.log('🎉 App initialization complete');
	} catch (error) {
		console.error('❌ App initialization failed:', error);
	} finally {
		console.groupEnd();
	}
}

// Initialize app-specific features
function initializeAppFeatures(): void {
	// Set up theme handling
	initializeTheme();

	// Set up analytics (if enabled)
	if (import.meta.env.PROD && import.meta.env.VITE_ANALYTICS_ENABLED === 'true') {
		initializeAnalytics();
	}

	// Set up service worker (if available)
	if ('serviceWorker' in navigator && import.meta.env.PROD) {
		initializeServiceWorker();
	}
}

// Theme initialization
function initializeTheme(): void {
	try {
		const savedTheme = localStorage.getItem('theme');
		const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		const theme = savedTheme || (systemPrefersDark ? 'dark' : 'light');

		document.documentElement.setAttribute('data-theme', theme);

		// Listen for system theme changes
		window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
			if (!localStorage.getItem('theme')) {
				document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
			}
		});

		console.log('✅ Theme initialized:', theme);
	} catch (error) {
		console.warn('⚠️ Theme initialization failed:', error);
	}
}

// Analytics initialization (placeholder)
function initializeAnalytics(): void {
	try {
		// Add your analytics initialization here
		// Example: Google Analytics, Mixpanel, etc.
		console.log('✅ Analytics initialized');
	} catch (error) {
		console.warn('⚠️ Analytics initialization failed:', error);
	}
}

// Service Worker initialization
function initializeServiceWorker(): void {
	navigator.serviceWorker
		.register('/service-worker.js')
		.then((registration) => {
			console.log('✅ Service Worker registered:', registration.scope);
		})
		.catch((error) => {
			console.warn('⚠️ Service Worker registration failed:', error);
		});
}

// Utility function to check if app is running in development mode
export function isDevelopment(): boolean {
	return import.meta.env.DEV;
}

// Utility function to check if app is running in production mode
export function isProduction(): boolean {
	return import.meta.env.PROD;
}

// Utility function to get app version
export function getAppVersion(): string {
	return import.meta.env.VITE_APP_VERSION || 'unknown';
}

// Utility function to get build timestamp
export function getBuildTimestamp(): string {
	return import.meta.env.VITE_BUILD_TIMESTAMP || 'unknown';
}

// App health check
export async function performAppHealthCheck(): Promise<{
	status: 'healthy' | 'degraded' | 'unhealthy';
	checks: Array<{
		name: string;
		status: 'pass' | 'fail';
		message?: string;
	}>;
}> {
	const checks: Array<{
		name: string;
		status: 'pass' | 'fail';
		message?: string;
	}> = [];

	// Check if browser APIs are available
	checks.push({
		name: 'Local Storage',
		status: typeof Storage !== 'undefined' ? 'pass' : 'fail',
		message: typeof Storage !== 'undefined' ? 'Available' : 'Not supported'
	});

	checks.push({
		name: 'Fetch API',
		status: typeof fetch !== 'undefined' ? 'pass' : 'fail',
		message: typeof fetch !== 'undefined' ? 'Available' : 'Not supported'
	});

	checks.push({
		name: 'WebSocket',
		status: typeof WebSocket !== 'undefined' ? 'pass' : 'fail',
		message: typeof WebSocket !== 'undefined' ? 'Available' : 'Not supported'
	});

	// Check if essential DOM elements are present
	const appElement = document.getElementById('app') || document.querySelector('[data-svelte]');
	checks.push({
		name: 'App Element',
		status: appElement ? 'pass' : 'fail',
		message: appElement ? 'Found' : 'Missing app container'
	});

	// Determine overall status
	const failedChecks = checks.filter((check) => check.status === 'fail');
	let status: 'healthy' | 'degraded' | 'unhealthy';

	if (failedChecks.length === 0) {
		status = 'healthy';
	} else if (failedChecks.length <= 1) {
		status = 'degraded';
	} else {
		status = 'unhealthy';
	}

	return { status, checks };
}

// Export configuration utilities
export const appConfig = {
	setTheme: (theme: 'light' | 'dark' | 'auto') => {
		if (theme === 'auto') {
			localStorage.removeItem('theme');
			const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
			document.documentElement.setAttribute('data-theme', systemPrefersDark ? 'dark' : 'light');
		} else {
			localStorage.setItem('theme', theme);
			document.documentElement.setAttribute('data-theme', theme);
		}
	},

	getTheme: (): 'light' | 'dark' | 'auto' => {
		const saved = localStorage.getItem('theme');
		return (saved as 'light' | 'dark') || 'auto';
	}
};
