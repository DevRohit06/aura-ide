import { toast } from 'svelte-sonner';
import type { z } from 'zod';

// Error types for better type safety
export interface ApiError {
	message: string;
	code?: string;
	statusCode: number;
	details?: Record<string, any>;
}

export interface ValidationError {
	field: string;
	message: string;
	code?: string;
}

export interface ErrorResponse {
	success: false;
	error: string;
	message?: string;
	details?: Record<string, any>;
	validationErrors?: ValidationError[];
}

// HTTP status code categorization
export const isClientError = (statusCode: number): boolean => statusCode >= 400 && statusCode < 500;
export const isServerError = (statusCode: number): boolean => statusCode >= 500 && statusCode < 600;
export const isNetworkError = (error: any): boolean =>
	error instanceof TypeError && error.message === 'Failed to fetch';

// Error messages for common HTTP status codes
const HTTP_ERROR_MESSAGES: Record<number, string> = {
	400: 'Bad request. Please check your input and try again.',
	401: 'Authentication required. Please log in to continue.',
	403: 'You do not have permission to perform this action.',
	404: 'The requested resource was not found.',
	409: 'A conflict occurred. The resource may already exist.',
	422: 'The data provided is invalid. Please check your input.',
	429: 'Too many requests. Please wait a moment before trying again.',
	500: 'An internal server error occurred. Please try again later.',
	502: 'The server is temporarily unavailable. Please try again later.',
	503: 'The service is temporarily unavailable. Please try again later.',
	504: 'The request timed out. Please try again.'
};

// Generic error handling function
export function getErrorMessage(error: unknown): string {
	if (typeof error === 'string') {
		return error;
	}

	if (error instanceof Error) {
		return error.message;
	}

	if (error && typeof error === 'object' && 'message' in error) {
		return String(error.message);
	}

	return 'An unexpected error occurred';
}

// HTTP error handling
export function handleHttpError(response: Response, defaultMessage?: string): ApiError {
	const statusCode = response.status;
	const message = HTTP_ERROR_MESSAGES[statusCode] || defaultMessage || 'An error occurred';

	return new ApiError({
		message,
		statusCode,
		code: `HTTP_${statusCode}`
	});
}

// API response handler
export async function handleApiResponse<T>(response: Response): Promise<T> {
	if (!response.ok) {
		let errorData: any = {};

		try {
			errorData = await response.json();
		} catch {
			// If we can't parse the response, use the default error message
		}

		const apiError = new ApiError({
			message:
				errorData.error ||
				errorData.message ||
				HTTP_ERROR_MESSAGES[response.status] ||
				'An error occurred',
			statusCode: response.status,
			code: errorData.code || `HTTP_${response.status}`,
			details: errorData.details || {}
		});

		throw apiError;
	}

	try {
		return await response.json();
	} catch (error) {
		throw new ApiError({
			message: 'Failed to parse server response',
			statusCode: 500,
			code: 'PARSE_ERROR'
		});
	}
}

// Centralized fetch wrapper with error handling
export async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
	try {
		const response = await fetch(url, {
			headers: {
				'Content-Type': 'application/json',
				...options.headers
			},
			...options
		});

		return await handleApiResponse<T>(response);
	} catch (error) {
		if (isNetworkError(error)) {
			throw new ApiError({
				message: 'Network error. Please check your connection and try again.',
				statusCode: 0,
				code: 'NETWORK_ERROR'
			});
		}

		// Re-throw ApiError instances
		if (error instanceof ApiError) {
			throw error;
		}

		// Handle other errors
		throw new ApiError({
			message: getErrorMessage(error),
			statusCode: 500,
			code: 'UNKNOWN_ERROR'
		});
	}
}

// Custom ApiError class
export class ApiError extends Error {
	public statusCode: number;
	public code?: string;
	public details?: Record<string, any>;

	constructor(error: {
		message: string;
		statusCode: number;
		code?: string;
		details?: Record<string, any>;
	}) {
		super(error.message);
		this.name = 'ApiError';
		this.statusCode = error.statusCode;
		this.code = error.code;
		this.details = error.details;
	}

	get isClientError(): boolean {
		return isClientError(this.statusCode);
	}

	get isServerError(): boolean {
		return isServerError(this.statusCode);
	}

	get isAuthError(): boolean {
		return this.statusCode === 401 || this.statusCode === 403;
	}

	get isValidationError(): boolean {
		return this.statusCode === 422 || this.statusCode === 400;
	}
}

// Validation error handling
export function formatZodErrors(error: z.ZodError): ValidationError[] {
	return error.issues.map((issue) => ({
		field: issue.path.join('.'),
		message: issue.message,
		code: issue.code
	}));
}

export function getFieldError(errors: ValidationError[], fieldName: string): string | undefined {
	const fieldError = errors.find((error) => error.field === fieldName);
	return fieldError?.message;
}

export function hasFieldError(errors: ValidationError[], fieldName: string): boolean {
	return errors.some((error) => error.field === fieldName);
}

// Toast notification helpers
export function showErrorToast(error: unknown, fallbackMessage = 'An error occurred'): void {
	if (error instanceof ApiError) {
		if (error.isServerError) {
			toast.error('Server Error', {
				description: error.message
			});
		} else if (error.isAuthError) {
			toast.error('Authentication Error', {
				description: error.message
			});
		} else {
			toast.error(error.message);
		}
	} else {
		const message = getErrorMessage(error);
		toast.error(message || fallbackMessage);
	}
}

export function showSuccessToast(message: string, description?: string): void {
	toast.success(message, description ? { description } : undefined);
}

export function showWarningToast(message: string, description?: string): void {
	toast.warning(message, description ? { description } : undefined);
}

export function showInfoToast(message: string, description?: string): void {
	toast.info(message, description ? { description } : undefined);
}

// Form submission wrapper with error handling
export async function handleFormSubmission<T>(
	submitFn: () => Promise<T>,
	options: {
		loadingMessage?: string;
		successMessage?: string;
		onSuccess?: (result: T) => void;
		onError?: (error: ApiError) => void;
		suppressErrorToast?: boolean;
	} = {}
): Promise<{ success: boolean; data?: T; error?: ApiError }> {
	const {
		loadingMessage = 'Processing...',
		successMessage,
		onSuccess,
		onError,
		suppressErrorToast = false
	} = options;

	try {
		// Show loading toast
		if (loadingMessage) {
			toast.loading(loadingMessage);
		}

		const result = await submitFn();

		// Show success toast
		if (successMessage) {
			showSuccessToast(successMessage);
		}

		// Call success callback
		if (onSuccess) {
			onSuccess(result);
		}

		return { success: true, data: result };
	} catch (error) {
		const apiError =
			error instanceof ApiError
				? error
				: new ApiError({
						message: getErrorMessage(error),
						statusCode: 500,
						code: 'UNKNOWN_ERROR'
					});

		// Show error toast (unless suppressed)
		if (!suppressErrorToast) {
			showErrorToast(apiError);
		}

		// Call error callback
		if (onError) {
			onError(apiError);
		}

		return { success: false, error: apiError };
	}
}

// Retry mechanism for failed requests
export async function retryApiRequest<T>(
	requestFn: () => Promise<T>,
	maxRetries = 3,
	delayMs = 1000
): Promise<T> {
	let lastError: any;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await requestFn();
		} catch (error) {
			lastError = error;

			// Don't retry client errors (4xx)
			if (error instanceof ApiError && error.isClientError) {
				throw error;
			}

			// If this is the last attempt, throw the error
			if (attempt === maxRetries) {
				throw error;
			}

			// Wait before retrying (exponential backoff)
			await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
		}
	}

	throw lastError;
}

// Development error logging
export function logError(error: unknown, context?: string): void {
	if (import.meta.env.DEV) {
		console.group(`🚨 Error${context ? ` in ${context}` : ''}`);
		console.error(error);

		if (error instanceof ApiError) {
			console.table({
				message: error.message,
				statusCode: error.statusCode,
				code: error.code,
				details: error.details
			});
		}

		console.groupEnd();
	}
}

// Global error boundary for unexpected errors
export function setupGlobalErrorHandler(): void {
	if (typeof window !== 'undefined') {
		window.addEventListener('unhandledrejection', (event) => {
			logError(event.reason, 'Unhandled Promise Rejection');

			// Show user-friendly error message
			showErrorToast(
				'An unexpected error occurred. Please refresh the page and try again.',
				'Unexpected Error'
			);
		});

		window.addEventListener('error', (event) => {
			logError(event.error, 'Unhandled Error');

			// Show user-friendly error message
			showErrorToast(
				'An unexpected error occurred. Please refresh the page and try again.',
				'Unexpected Error'
			);
		});
	}
}
