/**
 * MCP Initialization Service
 * Handles MCP server startup and auto-connect for enabled servers
 */
import { logger } from '$lib/utils/logger';
import { mcpManager } from './mcp-manager.service';

let initialized = false;

/**
 * Initialize MCP servers on application startup
 * Call this from hooks.server.ts or app initialization
 */
export async function initializeMCP(): Promise<void> {
	if (initialized) {
		logger.warn('[MCP Init] Already initialized, skipping');
		return;
	}

	try {
		logger.info('[MCP Init] Starting MCP initialization...');

		// Get all enabled server configurations
		const configs = mcpManager.getAllConfigs();
		const enabledServers = configs.filter((c) => c.enabled).map((c) => c.name);

		if (enabledServers.length === 0) {
			logger.info('[MCP Init] No enabled servers found. MCP ready but inactive.');
			initialized = true;
			return;
		}

		logger.info(
			`[MCP Init] Found ${enabledServers.length} enabled servers: ${enabledServers.join(', ')}`
		);

		// Initialize enabled servers (returns void, connections happen in background)
		await mcpManager.initialize(enabledServers);

		// Give servers a moment to connect
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// Log statistics after initialization
		const stats = mcpManager.getStats();
		logger.info('[MCP Init] Statistics:', {
			totalServers: stats.totalServers,
			connectedServers: stats.connectedServers,
			totalTools: stats.totalTools,
			totalResources: stats.totalResources
		});

		initialized = true;
	} catch (error) {
		logger.error('[MCP Init] Failed to initialize MCP:', error);
		// Don't throw - allow app to start even if MCP fails
		initialized = true; // Mark as attempted
	}
}

/**
 * Shutdown MCP servers gracefully
 * Call this on application shutdown
 */
export async function shutdownMCP(): Promise<void> {
	if (!initialized) {
		return;
	}

	try {
		logger.info('[MCP Shutdown] Disconnecting all MCP servers...');
		await mcpManager.disconnectAll();
		logger.info('[MCP Shutdown] All servers disconnected');
		initialized = false;
	} catch (error) {
		logger.error('[MCP Shutdown] Error during shutdown:', error);
	}
}

/**
 * Check if MCP is initialized
 */
export function isMCPInitialized(): boolean {
	return initialized;
}
