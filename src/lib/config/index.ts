/**
 * Configuration Module
 * Central exports for configuration management
 */

export * from './environment.js';
export * from './manager.js';
export * from './types.js';
export * from './validation.js';

// Re-export existing configs for backward compatibility
export { daytonaConfig, daytonaTemplates, validateDaytonaConfig } from './daytona.config.js';
export { r2Config } from './r2.config.js';

// Export the main configuration manager instance
export { configManager as config } from './manager.js';
