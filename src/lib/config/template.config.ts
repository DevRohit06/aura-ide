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
 * GitHub repository templates mapping
 * Maps template IDs to GitHub repositories (primarily StackBlitz starters)
 */
export const githubTemplates = {
	// React templates from StackBlitz
	react: { owner: 'stackblitz', repo: 'starters', path: 'react' },
	'react-ts': { owner: 'stackblitz', repo: 'starters', path: 'react-ts' },

	// Vue templates from StackBlitz
	vue: { owner: 'stackblitz', repo: 'starters', path: 'vue' },
	'vue-ts': { owner: 'stackblitz', repo: 'starters', path: 'vue-ts' },

	// Svelte templates from StackBlitz
	svelte: { owner: 'stackblitz', repo: 'starters', path: 'svelte' },
	'svelte-ts': { owner: 'stackblitz', repo: 'starters', path: 'svelte-ts' },
	sveltekit: { owner: 'stackblitz', repo: 'starters', path: 'sveltekit' },

	// Next.js templates from StackBlitz
	nextjs: { owner: 'stackblitz', repo: 'starters', path: 'nextjs' },
	'nextjs-ts': { owner: 'stackblitz', repo: 'starters', path: 'nextjs-ts' },

	// Angular templates from StackBlitz
	angular: { owner: 'stackblitz', repo: 'starters', path: 'angular' },

	// Node.js templates from StackBlitz
	node: { owner: 'stackblitz', repo: 'starters', path: 'node' },
	express: { owner: 'stackblitz', repo: 'starters', path: 'express' },

	// Vanilla templates from StackBlitz
	vanilla: { owner: 'stackblitz', repo: 'starters', path: 'vanilla' },
	'vanilla-ts': { owner: 'stackblitz', repo: 'starters', path: 'vanilla-ts' },

	// Other templates from StackBlitz
	astro: { owner: 'stackblitz', repo: 'starters', path: 'astro' },
	nuxt: { owner: 'stackblitz', repo: 'starters', path: 'nuxtjs' },
	vite: { owner: 'stackblitz', repo: 'starters', path: 'vite' },
	'vite-react': { owner: 'stackblitz', repo: 'starters', path: 'vite-react' },
	'vite-react-ts': { owner: 'stackblitz', repo: 'starters', path: 'vite-react-ts' },
	'vite-vue': { owner: 'stackblitz', repo: 'starters', path: 'vite-vue' },
	'vite-vue-ts': { owner: 'stackblitz', repo: 'starters', path: 'vite-vue-ts' },
	'vite-svelte': { owner: 'stackblitz', repo: 'starters', path: 'vite-svelte' },
	'vite-svelte-ts': { owner: 'stackblitz', repo: 'starters', path: 'vite-svelte-ts' }
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
 * Get GitHub template configuration
 */
export function getGitHubTemplate(templateId: string): {
	owner: string;
	repo: string;
	path?: string;
} | null {
	const template = githubTemplates[templateId as keyof typeof githubTemplates];
	return template || null;
}

/**
 * Parse custom GitHub URL and create template config
 * Supports formats:
 * - https://github.com/owner/repo
 * - github.com/owner/repo
 * - owner/repo
 * - owner/repo@branch (with specific branch)
 */
export function parseCustomGitHubUrl(url: string): {
	owner: string;
	repo: string;
	branch?: string;
	path?: string;
} | null {
	if (!url || !url.trim()) {
		return null;
	}

	// Remove trailing slashes and .git suffix
	url = url
		.trim()
		.replace(/\.git$/, '')
		.replace(/\/$/, '');

	let owner = '';
	let repo = '';
	let branch: string | undefined;
	let path: string | undefined;

	// Extract branch if specified with @ or #
	let branchMatch = url.match(/@([^\/]+)$/);
	if (!branchMatch) {
		branchMatch = url.match(/#([^\/]+)$/);
	}
	if (branchMatch) {
		branch = branchMatch[1];
		url = url.replace(/@[^\/]+$/, '').replace(/#[^\/]+$/, '');
	}

	// Try to parse various formats
	// Format 1: https://github.com/owner/repo or https://github.com/owner/repo/tree/branch/path
	const fullUrlMatch = url.match(
		/^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)(?:\/tree\/([^\/]+)\/(.+))?/
	);
	if (fullUrlMatch) {
		owner = fullUrlMatch[1];
		repo = fullUrlMatch[2];
		if (fullUrlMatch[3] && !branch) {
			branch = fullUrlMatch[3];
		}
		if (fullUrlMatch[4]) {
			path = fullUrlMatch[4];
		}
	} else {
		// Format 2: github.com/owner/repo
		const domainMatch = url.match(/^github\.com\/([^\/]+)\/([^\/]+)/);
		if (domainMatch) {
			owner = domainMatch[1];
			repo = domainMatch[2];
		} else {
			// Format 3: owner/repo
			const shortMatch = url.match(/^([^\/]+)\/([^\/]+)$/);
			if (shortMatch) {
				owner = shortMatch[1];
				repo = shortMatch[2];
			}
		}
	}

	if (!owner || !repo) {
		return null;
	}

	return { owner, repo, branch, path };
}

/**
 * Validate custom GitHub repository URL
 */
export function validateCustomGitHubUrl(url: string): {
	isValid: boolean;
	error?: string;
	parsed?: {
		owner: string;
		repo: string;
		branch?: string;
		path?: string;
	};
} {
	const parsed = parseCustomGitHubUrl(url);

	if (!parsed) {
		return {
			isValid: false,
			error: 'Invalid GitHub URL format. Use: owner/repo or https://github.com/owner/repo'
		};
	}

	// Validate owner and repo names (GitHub username/repo rules)
	const validNamePattern = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
	const validRepoPattern = /^[a-zA-Z0-9._-]+$/;

	if (!validNamePattern.test(parsed.owner)) {
		return {
			isValid: false,
			error: 'Invalid GitHub username/organization name'
		};
	}

	if (!validRepoPattern.test(parsed.repo)) {
		return {
			isValid: false,
			error: 'Invalid repository name'
		};
	}

	if (parsed.branch) {
		// Basic branch name validation
		const validBranchPattern = /^[a-zA-Z0-9._/-]+$/;
		if (!validBranchPattern.test(parsed.branch)) {
			return {
				isValid: false,
				error: 'Invalid branch name'
			};
		}
	}

	return {
		isValid: true,
		parsed
	};
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
