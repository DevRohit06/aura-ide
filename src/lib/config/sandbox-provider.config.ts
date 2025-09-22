/**
 * Sandbox Provider Configuration
 * Configuration for managing multiple sandbox providers (Daytona, E2B, Local)
 */

import { env } from '$env/dynamic/private';
import type { SandboxProviderConfig } from './types.js';

export const sandboxProviderConfig: SandboxProviderConfig = {
	defaultProvider: (env.SANDBOX_DEFAULT_PROVIDER as 'daytona' | 'e2b' | 'local') || 'daytona',
	maxConcurrentSessions: parseInt(env.SANDBOX_MAX_CONCURRENT_SESSIONS || '10'),
	sessionTimeoutMinutes: parseInt(env.SANDBOX_SESSION_TIMEOUT_MINUTES || '60'),
	autoCleanupEnabled: env.SANDBOX_AUTO_CLEANUP !== 'false',

	resourceMonitoring: {
		enabled: env.SANDBOX_RESOURCE_MONITORING !== 'false',
		intervalSeconds: parseInt(env.SANDBOX_MONITORING_INTERVAL || '30'),
		alertThresholds: {
			cpu: parseInt(env.SANDBOX_CPU_ALERT_THRESHOLD || '80'), // 80%
			memory: parseInt(env.SANDBOX_MEMORY_ALERT_THRESHOLD || '85'), // 85%
			disk: parseInt(env.SANDBOX_DISK_ALERT_THRESHOLD || '90') // 90%
		}
	}
};

/**
 * Provider capabilities matrix
 */
export const providerCapabilities = {
	daytona: {
		codeExecution: true,
		fileSystem: true,
		networking: true,
		persistence: true,
		collaboration: true,
		portForwarding: true,
		terminalAccess: true,
		gitIntegration: true,
		customEnvironments: true,
		resourceScaling: true
	},
	e2b: {
		codeExecution: true,
		fileSystem: true,
		networking: true,
		persistence: false,
		collaboration: false,
		portForwarding: false,
		terminalAccess: true,
		gitIntegration: false,
		customEnvironments: true,
		resourceScaling: false
	},
	local: {
		codeExecution: true,
		fileSystem: true,
		networking: false,
		persistence: true,
		collaboration: false,
		portForwarding: false,
		terminalAccess: false,
		gitIntegration: false,
		customEnvironments: false,
		resourceScaling: false
	}
} as const;

/**
 * Provider selection strategy
 */
export type ProviderSelectionStrategy =
	| 'round-robin'
	| 'least-loaded'
	| 'preferred'
	| 'cost-optimized';

export const providerSelectionConfig = {
	strategy: (env.SANDBOX_PROVIDER_STRATEGY as ProviderSelectionStrategy) || 'preferred',

	// Provider preferences based on use case
	preferences: {
		'quick-execution': ['e2b', 'local', 'daytona'],
		'persistent-development': ['daytona', 'local', 'e2b'],
		collaboration: ['daytona'],
		'cost-sensitive': ['local', 'e2b', 'daytona'],
		'high-performance': ['daytona', 'e2b', 'local']
	},

	// Load balancing weights
	weights: {
		daytona: parseInt(env.SANDBOX_DAYTONA_WEIGHT || '3'),
		e2b: parseInt(env.SANDBOX_E2B_WEIGHT || '2'),
		local: parseInt(env.SANDBOX_LOCAL_WEIGHT || '1')
	}
};

/**
 * Cost estimation per provider (in cents per hour)
 */
export const providerCosts = {
	daytona: {
		cpu: parseInt(env.DAYTONA_COST_CPU_HOUR || '5'), // 5 cents per CPU hour
		memory: parseInt(env.DAYTONA_COST_MEMORY_GB_HOUR || '2'), // 2 cents per GB hour
		storage: parseInt(env.DAYTONA_COST_STORAGE_GB_HOUR || '1'), // 1 cent per GB hour
		networking: parseInt(env.DAYTONA_COST_NETWORK_GB || '10') // 10 cents per GB
	},
	e2b: {
		execution: parseInt(env.E2B_COST_EXECUTION || '1'), // 1 cent per execution
		compute: parseInt(env.E2B_COST_COMPUTE_MINUTE || '2'), // 2 cents per minute
		storage: parseInt(env.E2B_COST_STORAGE_GB || '5') // 5 cents per GB
	},
	local: {
		// Local has no direct costs but may have infrastructure costs
		infrastructure: parseInt(env.LOCAL_INFRASTRUCTURE_HOUR || '0')
	}
};

/**
 * Validate sandbox provider configuration
 */
export function validateSandboxProviderConfig(config: SandboxProviderConfig): {
	isValid: boolean;
	errors: string[];
} {
	const errors: string[] = [];

	const validProviders = ['daytona', 'e2b', 'local'];
	if (!validProviders.includes(config.defaultProvider)) {
		errors.push(
			`Invalid default provider: ${config.defaultProvider}. Must be one of: ${validProviders.join(', ')}`
		);
	}

	if (config.maxConcurrentSessions < 1) {
		errors.push('Maximum concurrent sessions must be at least 1');
	}

	if (config.sessionTimeoutMinutes < 5) {
		errors.push('Session timeout must be at least 5 minutes');
	}

	if (config.resourceMonitoring.intervalSeconds < 10) {
		errors.push('Resource monitoring interval must be at least 10 seconds');
	}

	return {
		isValid: errors.length === 0,
		errors
	};
}

/**
 * Select best provider for a given use case
 */
export function selectProvider(
	useCase: keyof typeof providerSelectionConfig.preferences,
	requirements?: {
		needsPersistence?: boolean;
		needsCollaboration?: boolean;
		needsNetworking?: boolean;
		needsPortForwarding?: boolean;
	}
): 'daytona' | 'e2b' | 'local' {
	const preferred = providerSelectionConfig.preferences[useCase];

	if (!requirements) {
		return preferred[0] as 'daytona' | 'e2b' | 'local';
	}

	// Filter providers based on requirements
	const suitable = preferred.filter((provider) => {
		const capabilities = providerCapabilities[provider as keyof typeof providerCapabilities];

		if (requirements.needsPersistence && !capabilities.persistence) return false;
		if (requirements.needsCollaboration && !capabilities.collaboration) return false;
		if (requirements.needsNetworking && !capabilities.networking) return false;
		if (requirements.needsPortForwarding && !capabilities.portForwarding) return false;

		return true;
	});

	return (suitable[0] || sandboxProviderConfig.defaultProvider) as 'daytona' | 'e2b' | 'local';
}

/**
 * Estimate cost for provider usage
 */
export function estimateProviderCost(
	provider: 'daytona' | 'e2b' | 'local',
	usage: {
		durationHours?: number;
		executions?: number;
		cpuHours?: number;
		memoryGBHours?: number;
		storageGB?: number;
		networkingGB?: number;
	}
): number {
	let totalCost = 0;

	switch (provider) {
		case 'daytona': {
			const costs = providerCosts.daytona;
			totalCost += (usage.cpuHours || 0) * costs.cpu;
			totalCost += (usage.memoryGBHours || 0) * costs.memory;
			totalCost += (usage.storageGB || 0) * costs.storage;
			totalCost += (usage.networkingGB || 0) * costs.networking;
			break;
		}

		case 'e2b': {
			const costs = providerCosts.e2b;
			totalCost += (usage.executions || 0) * costs.execution;
			totalCost += (usage.durationHours || 0) * 60 * costs.compute; // Convert hours to minutes
			totalCost += (usage.storageGB || 0) * costs.storage;
			break;
		}

		case 'local': {
			const costs = providerCosts.local;
			totalCost += (usage.durationHours || 0) * costs.infrastructure;
			break;
		}
	}

	return Math.round(totalCost * 100) / 100; // Round to 2 decimal places
}
