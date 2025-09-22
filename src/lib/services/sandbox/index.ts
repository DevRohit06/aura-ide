/**
 * Sandbox Services Index
 * Exports all sandbox-related services and types
 */

// Core interfaces
export type {
	ExecutionResult,
	FileSystemEntry,
	ISandboxProvider,
	ISandboxProviderFactory,
	PortMapping,
	SandboxConfig,
	SandboxCreateOptions,
	SandboxEnvironment,
	SandboxFile,
	SandboxMetrics,
	SandboxProviderEvents,
	SandboxUpdateOptions
} from './sandbox-provider.interface.js';

// Provider implementations
export { DaytonaProvider } from './daytona-provider.js';
export { E2BProvider } from './e2b-provider.js';
export { LocalProvider } from './local-provider.js';

// Factory and manager
export { SandboxProviderFactory } from './provider-factory.js';
export { SandboxManager, sandboxManager } from './sandbox-manager.js';

// Re-export types from config
export { sandboxConfig } from '$lib/config/sandbox.config.js';
export type { SandboxConfig as ConfigType } from '$lib/config/sandbox.config.js';
