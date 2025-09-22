/**
 * E2B Sandbox Configuration
 * Configuration and management for E2B sandbox provider
 */

import { env } from '$env/dynamic/private';
import type { E2BConfig } from './types.js';

export const e2bConfig: E2BConfig = {
	enabled: env.E2B_ENABLED === 'true' || true,
	retryAttempts: parseInt(env.E2B_RETRY_ATTEMPTS || '3'),
	timeout: parseInt(env.E2B_TIMEOUT || '30000'),

	apiKey: env.E2B_API_KEY || '',
	templateId: env.E2B_TEMPLATE_ID || 'code-interpreter',
	defaultEnvironment: env.E2B_DEFAULT_ENVIRONMENT || 'node',
	enableFilesystem: env.E2B_ENABLE_FILESYSTEM !== 'false',
	enableNetwork: env.E2B_ENABLE_NETWORK !== 'false',

	resourceLimits: {
		cpu: parseInt(env.E2B_CPU_LIMIT || '1000'), // 1 CPU core
		memory: parseInt(env.E2B_MEMORY_LIMIT || '2048'), // 2GB
		disk: parseInt(env.E2B_DISK_LIMIT || '10240') // 10GB
	},

	sessionDefaults: {
		timeout: parseInt(env.E2B_SESSION_TIMEOUT || '3600000'), // 1 hour
		maxExecutionTime: parseInt(env.E2B_MAX_EXECUTION_TIME || '60000'), // 1 minute
		keepAlive: env.E2B_KEEP_ALIVE === 'true'
	}
};

/**
 * E2B environment templates mapping
 */
export const e2bTemplates = {
	node: 'nodejs-18',
	python: 'python-3.11',
	typescript: 'typescript-5',
	react: 'react-18',
	vue: 'vue-3',
	svelte: 'svelte-4',
	nextjs: 'nextjs-14',
	express: 'express-4',
	fastapi: 'fastapi',
	django: 'django-4'
} as const;

/**
 * Validate E2B configuration
 */
export function validateE2BConfig(config: E2BConfig): { isValid: boolean; errors: string[] } {
	const errors: string[] = [];

	if (!config.apiKey) {
		errors.push('E2B_API_KEY is required');
	}

	if (!config.templateId) {
		errors.push('E2B_TEMPLATE_ID is required');
	}

	if (config.resourceLimits.cpu < 100) {
		errors.push('E2B CPU limit must be at least 100m');
	}

	if (config.resourceLimits.memory < 512) {
		errors.push('E2B memory limit must be at least 512MB');
	}

	if (config.sessionDefaults.timeout < 60000) {
		errors.push('E2B session timeout must be at least 60 seconds');
	}

	return {
		isValid: errors.length === 0,
		errors
	};
}

/**
 * Get E2B template ID for a given language/framework
 */
export function getE2BTemplate(framework: string): string {
	const template = e2bTemplates[framework as keyof typeof e2bTemplates];
	return template || e2bConfig.templateId;
}

/**
 * Check if E2B is properly configured
 */
export function isE2BConfigured(): boolean {
	return !!(e2bConfig.apiKey && e2bConfig.enabled);
}
