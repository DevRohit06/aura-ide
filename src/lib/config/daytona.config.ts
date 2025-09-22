/**
 * Daytona Configuration
 * Configuration settings for Daytona workspace provider
 */

import { env } from '$env/dynamic/private';

export interface DaytonaConfig {
	apiKey: string;
	defaultTimeout: number;
	retryAttempts: number;
	maxWorkspaces: number;
	workspaceTemplate: string;
	defaultLanguage: string;
	enableGitIntegration: boolean;
	enablePortForwarding: boolean;
	workspaceDefaults: {
		cpu: string;
		memory: string;
		storage: string;
	};
}

// Default configuration values
const defaultConfig: Omit<DaytonaConfig, 'apiKey' | 'baseUrl'> = {
	defaultTimeout: 30000, // 30 seconds
	retryAttempts: 3,
	maxWorkspaces: 10,
	workspaceTemplate: 'universal',
	defaultLanguage: 'typescript',
	enableGitIntegration: true,
	enablePortForwarding: true,
	workspaceDefaults: {
		cpu: '2',
		memory: '4Gi',
		storage: '10Gi'
	}
};

// Environment-based configuration
export const daytonaConfig: DaytonaConfig = {
	apiKey: env.DAYTONA_API_KEY || '',
	...defaultConfig
};

// Validation function
export function validateDaytonaConfig(): void {
	if (!daytonaConfig.apiKey) {
		console.warn('Daytona API key not configured. Set DAYTONA_API_KEY environment variable.');
	}

	if (!daytonaConfig.baseUrl) {
		throw new Error('Daytona base URL is required');
	}

	if (daytonaConfig.defaultTimeout < 1000) {
		throw new Error('Daytona timeout must be at least 1000ms');
	}

	if (daytonaConfig.retryAttempts < 1) {
		throw new Error('Daytona retry attempts must be at least 1');
	}

	if (daytonaConfig.maxWorkspaces < 1) {
		throw new Error('Daytona max workspaces must be at least 1');
	}
}

// Available Daytona workspace templates
export const daytonaTemplates = {
	universal: {
		name: 'Universal',
		description: 'Multi-language development environment',
		languages: ['javascript', 'typescript', 'python', 'go', 'rust', 'java'],
		preInstalled: ['node', 'python', 'git', 'docker']
	},
	node: {
		name: 'Node.js',
		description: 'Node.js and npm development environment',
		languages: ['javascript', 'typescript'],
		preInstalled: ['node', 'npm', 'yarn', 'git']
	},
	python: {
		name: 'Python',
		description: 'Python development environment',
		languages: ['python'],
		preInstalled: ['python', 'pip', 'virtualenv', 'git']
	},
	go: {
		name: 'Go',
		description: 'Go development environment',
		languages: ['go'],
		preInstalled: ['go', 'git']
	},
	rust: {
		name: 'Rust',
		description: 'Rust development environment',
		languages: ['rust'],
		preInstalled: ['rust', 'cargo', 'git']
	},
	java: {
		name: 'Java',
		description: 'Java development environment',
		languages: ['java'],
		preInstalled: ['java', 'maven', 'gradle', 'git']
	}
} as const;

export type DaytonaTemplate = keyof typeof daytonaTemplates;

// Daytona-specific error types
export enum DaytonaErrorType {
	AUTHENTICATION_FAILED = 'DAYTONA_AUTH_FAILED',
	WORKSPACE_CREATION_FAILED = 'DAYTONA_WORKSPACE_CREATION_FAILED',
	WORKSPACE_NOT_FOUND = 'DAYTONA_WORKSPACE_NOT_FOUND',
	WORKSPACE_START_FAILED = 'DAYTONA_WORKSPACE_START_FAILED',
	WORKSPACE_STOP_FAILED = 'DAYTONA_WORKSPACE_STOP_FAILED',
	FILE_OPERATION_FAILED = 'DAYTONA_FILE_OPERATION_FAILED',
	GIT_OPERATION_FAILED = 'DAYTONA_GIT_OPERATION_FAILED',
	COMMAND_EXECUTION_FAILED = 'DAYTONA_COMMAND_EXECUTION_FAILED',
	NETWORK_ERROR = 'DAYTONA_NETWORK_ERROR',
	QUOTA_EXCEEDED = 'DAYTONA_QUOTA_EXCEEDED',
	INVALID_CONFIGURATION = 'DAYTONA_INVALID_CONFIGURATION'
}
