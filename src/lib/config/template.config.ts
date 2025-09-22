/**
 * Template Management Configuration
 * Configuration for StackBlitz integration and template caching
 */

import { env } from '$env/dynamic/private';
import type { TemplateConfig } from './types.js';

export const templateConfig: TemplateConfig = {
	enabled: env.TEMPLATE_ENABLED !== 'false',

	stackblitz: {
		apiBaseUrl: env.STACKBLITZ_API_URL || 'https://api.stackblitz.com',
		startersRepository: env.STACKBLITZ_STARTERS_REPO || 'stackblitz/starters',
		cacheTimeout: parseInt(env.STACKBLITZ_CACHE_TIMEOUT || '3600000'), // 1 hour
		maxConcurrentDownloads: parseInt(env.STACKBLITZ_MAX_DOWNLOADS || '5')
	},

	github: {
		token: env.GITHUB_TOKEN || '',
		rateLimitPerHour: parseInt(env.GITHUB_RATE_LIMIT || '5000'),
		defaultBranch: env.GITHUB_DEFAULT_BRANCH || 'main'
	},

	cache: {
		enabled: env.TEMPLATE_CACHE_ENABLED !== 'false',
		ttlHours: parseInt(env.TEMPLATE_CACHE_TTL_HOURS || '24'),
		maxSize: parseInt(env.TEMPLATE_CACHE_MAX_SIZE || '1000'), // 1000 templates
		compressionEnabled: env.TEMPLATE_CACHE_COMPRESSION !== 'false'
	}
};

/**
 * Popular StackBlitz templates mapping
 */
export const stackblitzTemplates = {
	// JavaScript/TypeScript
	vanilla: 'javascript',
	'vanilla-ts': 'typescript',
	node: 'node',

	// React
	react: 'react',
	'react-ts': 'react-ts',
	nextjs: 'nextjs',
	'nextjs-ts': 'nextjs-ts',

	// Vue
	vue: 'vue',
	'vue-ts': 'vue-ts',
	nuxtjs: 'nuxtjs',

	// Svelte
	svelte: 'svelte',
	sveltekit: 'sveltekit',

	// Angular
	angular: 'angular',
	'angular-cli': 'angular-cli',

	// Other frameworks
	astro: 'astro',
	vite: 'vite',
	'vite-react': 'vite-react',
	'vite-vue': 'vite-vue',
	'vite-svelte': 'vite-svelte',

	// Backend
	express: 'express',
	fastify: 'fastify',
	nestjs: 'nestjs',

	// Static site generators
	gatsby: 'gatsby',
	eleventy: '11ty',
	jekyll: 'jekyll',

	// CSS frameworks
	bootstrap: 'bootstrap',
	tailwind: 'tailwindcss',
	bulma: 'bulma'
} as const;

/**
 * Template categories for organization
 */
export const templateCategories = {
	frontend: ['react', 'vue', 'svelte', 'angular', 'vanilla'],
	fullstack: ['nextjs', 'nuxtjs', 'sveltekit', 'astro'],
	backend: ['node', 'express', 'fastify', 'nestjs'],
	static: ['gatsby', 'eleventy', 'jekyll'],
	mobile: ['react-native', 'ionic'],
	desktop: ['electron', 'tauri'],
	css: ['bootstrap', 'tailwind', 'bulma'],
	'build-tools': ['vite', 'webpack', 'parcel']
} as const;

/**
 * Validate template configuration
 */
export function validateTemplateConfig(config: TemplateConfig): {
	isValid: boolean;
	errors: string[];
} {
	const errors: string[] = [];

	if (!config.github.token) {
		errors.push('GITHUB_TOKEN is required for template synchronization');
	}

	if (config.stackblitz.cacheTimeout < 300000) {
		// 5 minutes minimum
		errors.push('StackBlitz cache timeout must be at least 5 minutes');
	}

	if (config.stackblitz.maxConcurrentDownloads < 1) {
		errors.push('Maximum concurrent downloads must be at least 1');
	}

	if (config.cache.ttlHours < 1) {
		errors.push('Template cache TTL must be at least 1 hour');
	}

	return {
		isValid: errors.length === 0,
		errors
	};
}

/**
 * Get StackBlitz template identifier
 */
export function getStackBlitzTemplate(framework: string): string {
	return stackblitzTemplates[framework as keyof typeof stackblitzTemplates] || framework;
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(
	category: keyof typeof templateCategories
): readonly string[] {
	return templateCategories[category] || [];
}

/**
 * Check if template system is properly configured
 */
export function isTemplateConfigured(): boolean {
	return !!(templateConfig.github.token && templateConfig.enabled);
}
