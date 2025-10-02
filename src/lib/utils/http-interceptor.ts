import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { toast } from 'svelte-sonner';
import { ApiError, logError, showErrorToast } from './error-handling';

// Global request/response interceptor configuration
interface InterceptorConfig {
	baseUrl?: string;
	defaultTimeout?: number;
	retryAttempts?: number;
	retryDelay?: number;
	enableLogging?: boolean;
	onUnauthorized?: () => void;
	onForbidden?: () => void;
	onServerError?: (error: ApiError) => void;
}

// Default configuration
const defaultConfig: InterceptorConfig = {
	defaultTimeout: 30000, // 30 seconds
	retryAttempts: 2,
	retryDelay: 1000,
	enableLogging: true,
	onUnauthorized: () => {
		if (browser) {
			toast.error('Please log in to continue');
			goto('/auth/login');
		}
	},
	onForbidden: () => {
		if (browser) {
			toast.error('You do not have permission to perform this action');
		}
	},
	onServerError: (error: ApiError) => {
		if (browser) {
			logError(error, 'HTTP Interceptor');
			showErrorToast(error);
		}
	}
};

let config: InterceptorConfig = { ...defaultConfig };

// Configure the interceptor
export function configureInterceptor(newConfig: Partial<InterceptorConfig>): void {
	config = { ...config, ...newConfig };
}

// Request interceptor function
async function interceptRequest(url: string, options: RequestInit = {}): Promise<RequestInit> {
	// Add default headers
	const headers = new Headers(options.headers);

	if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
		headers.set('Content-Type', 'application/json');
	}

	// Add authentication headers if available
	if (browser && !headers.has('Authorization')) {
		const token = localStorage.getItem('auth_token');
		if (token) {
			headers.set('Authorization', `Bearer ${token}`);
		}
	}

	// Add timestamp for caching prevention on mutations
	if (options.method && !['GET', 'HEAD'].includes(options.method.toUpperCase())) {
		headers.set('X-Request-Time', new Date().toISOString());
	}

	// Set up timeout
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), config.defaultTimeout);

	const interceptedOptions: RequestInit = {
		...options,
		headers,
		signal: options.signal || controller.signal
	};

	// Store timeout ID for cleanup
	(interceptedOptions as any)._timeoutId = timeoutId;

	if (config.enableLogging && browser) {
		console.group(`🌐 HTTP Request: ${options.method?.toUpperCase() || 'GET'} ${url}`);
		console.log('Options:', interceptedOptions);
		console.groupEnd();
	}

	return interceptedOptions;
}

// Response interceptor function
async function interceptResponse(
	response: Response,
	originalUrl: string,
	options: RequestInit
): Promise<Response> {
	// Clear timeout
	const timeoutId = (options as any)._timeoutId;
	if (timeoutId) {
		clearTimeout(timeoutId);
	}

	if (config.enableLogging && browser) {
		console.group(`📡 HTTP Response: ${response.status} ${originalUrl}`);
		console.log('Status:', response.status, response.statusText);
		console.log('Headers:', Object.fromEntries(response.headers.entries()));
		console.groupEnd();
	}

	// Handle specific status codes
	if (!response.ok) {
		const apiError = await createApiErrorFromResponse(response, originalUrl);

		// Handle specific error cases
		switch (response.status) {
			case 401:
				if (config.onUnauthorized) {
					config.onUnauthorized();
				}
				break;
			case 403:
				if (config.onForbidden) {
					config.onForbidden();
				}
				break;
			case 500:
			case 502:
			case 503:
			case 504:
				if (config.onServerError) {
					config.onServerError(apiError);
				}
				break;
		}

		throw apiError;
	}

	return response;
}

// Create API error from response
async function createApiErrorFromResponse(response: Response, url: string): Promise<ApiError> {
	let errorData: any = {};

	try {
		const contentType = response.headers.get('content-type');
		if (contentType?.includes('application/json')) {
			errorData = await response.json();
		} else {
			errorData = { message: await response.text() };
		}
	} catch {
		// If we can't parse the response, use default error message
		errorData = { message: 'An error occurred while processing the request' };
	}

	return new ApiError({
		message:
			errorData.error || errorData.message || `Request failed with status ${response.status}`,
		statusCode: response.status,
		code: errorData.code || `HTTP_${response.status}`,
		details: {
			url,
			...errorData.details
		}
	});
}

// Enhanced fetch with retry logic
async function fetchWithRetry(
	url: string,
	options: RequestInit,
	attempt: number = 1
): Promise<Response> {
	try {
		const response = await fetch(url, options);
		return await interceptResponse(response, url, options);
	} catch (error) {
		// Only retry on network errors or server errors (5xx)
		const shouldRetry =
			attempt < (config.retryAttempts || 0) + 1 &&
			(error instanceof TypeError || // Network error
				(error instanceof ApiError && error.statusCode >= 500));

		if (shouldRetry) {
			const delay = (config.retryDelay || 1000) * attempt;

			if (config.enableLogging && browser) {
				console.warn(
					`⚠️ Request failed, retrying in ${delay}ms (attempt ${attempt}/${config.retryAttempts! + 1})`
				);
			}

			await new Promise((resolve) => setTimeout(resolve, delay));
			return fetchWithRetry(url, options, attempt + 1);
		}

		throw error;
	}
}

// Main intercepted fetch function
export async function interceptedFetch(url: string, options: RequestInit = {}): Promise<Response> {
	try {
		// Apply request interceptor
		const interceptedOptions = await interceptRequest(url, options);

		// Make the request with retry logic
		return await fetchWithRetry(url, interceptedOptions);
	} catch (error) {
		if (config.enableLogging && browser) {
			logError(error, `HTTP Request to ${url}`);
		}
		throw error;
	}
}

// Convenience methods for common HTTP operations
export const httpClient = {
	get: async <T = any>(
		url: string,
		options: Omit<RequestInit, 'method' | 'body'> = {}
	): Promise<T> => {
		const response = await interceptedFetch(url, { ...options, method: 'GET' });
		return response.json();
	},

	post: async <T = any>(
		url: string,
		data?: any,
		options: Omit<RequestInit, 'method' | 'body'> = {}
	): Promise<T> => {
		const response = await interceptedFetch(url, {
			...options,
			method: 'POST',
			body: data ? JSON.stringify(data) : undefined
		});
		return response.json();
	},

	put: async <T = any>(
		url: string,
		data?: any,
		options: Omit<RequestInit, 'method' | 'body'> = {}
	): Promise<T> => {
		const response = await interceptedFetch(url, {
			...options,
			method: 'PUT',
			body: data ? JSON.stringify(data) : undefined
		});
		return response.json();
	},

	patch: async <T = any>(
		url: string,
		data?: any,
		options: Omit<RequestInit, 'method' | 'body'> = {}
	): Promise<T> => {
		const response = await interceptedFetch(url, {
			...options,
			method: 'PATCH',
			body: data ? JSON.stringify(data) : undefined
		});
		return response.json();
	},

	delete: async <T = any>(url: string, options: Omit<RequestInit, 'method'> = {}): Promise<T> => {
		const response = await interceptedFetch(url, { ...options, method: 'DELETE' });

		// Handle empty responses for DELETE requests
		const contentLength = response.headers.get('content-length');
		if (contentLength === '0' || response.status === 204) {
			return {} as T;
		}

		return response.json();
	}
};

// Global fetch override (optional)
export function enableGlobalInterception(): void {
	if (browser && typeof window !== 'undefined') {
		const originalFetch = window.fetch;

		window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = typeof input === 'string' ? input : input.toString();

			// Only intercept API calls (you can customize this logic)
			if (url.startsWith('/api/') || url.startsWith('http')) {
				return interceptedFetch(url, init);
			}

			// Use original fetch for other requests
			return originalFetch(input, init);
		};

		if (config.enableLogging) {
			console.info('🔧 Global HTTP interception enabled');
		}
	}
}

// Disable global interception
export function disableGlobalInterception(): void {
	if (browser && typeof window !== 'undefined' && (window as any)._originalFetch) {
		window.fetch = (window as any)._originalFetch;
		delete (window as any)._originalFetch;

		if (config.enableLogging) {
			console.info('🔧 Global HTTP interception disabled');
		}
	}
}

// Health check endpoint wrapper
export async function healthCheck(endpoint: string = '/api/health'): Promise<{
	status: 'healthy' | 'degraded' | 'unhealthy';
	timestamp: string;
	details?: any;
}> {
	try {
		const response = await httpClient.get(endpoint);
		return response;
	} catch (error) {
		return {
			status: 'unhealthy',
			timestamp: new Date().toISOString(),
			details: { error: error instanceof Error ? error.message : 'Unknown error' }
		};
	}
}

// Export the default interceptor configuration for app initialization
export const initializeHttpInterceptor = (customConfig?: Partial<InterceptorConfig>) => {
	if (customConfig) {
		configureInterceptor(customConfig);
	}

	// Set up global error handlers if not already configured
	if (browser && !window.onunhandledrejection) {
		window.addEventListener('unhandledrejection', (event) => {
			if (event.reason instanceof ApiError) {
				logError(event.reason, 'Unhandled API Error');
			}
		});
	}

	if (config.enableLogging) {
		console.info('🚀 HTTP interceptor initialized');
	}
};
