import { SandboxDatabase } from '../database/sandbox.js';

/**
 * Database initialization script for sandbox collections
 */
export async function initializeSandboxDatabase(): Promise<void> {
	try {
		console.log('Initializing sandbox database...');

		// Initialize collections and indexes
		await SandboxDatabase.initializeCollections();

		// Get stats
		const stats = await SandboxDatabase.getCollectionStats();
		console.log('Database initialization complete. Collection stats:', stats);

		// Health check
		const health = await SandboxDatabase.healthCheck();
		console.log('Database health check:', health);
	} catch (error) {
		console.error('Failed to initialize sandbox database:', error);
		throw error;
	}
}

/**
 * Database cleanup script (for development/testing)
 */
export async function resetSandboxDatabase(): Promise<void> {
	try {
		console.log('⚠️  Resetting sandbox database...');

		// Drop all collections
		await SandboxDatabase.dropCollections();

		// Recreate collections and indexes
		await SandboxDatabase.initializeCollections();

		console.log('✅ Database reset complete');
	} catch (error) {
		console.error('Failed to reset sandbox database:', error);
		throw error;
	}
}

/**
 * Get database statistics
 */
export async function getSandboxDatabaseStats(): Promise<Record<string, any>> {
	try {
		const stats = await SandboxDatabase.getCollectionStats();
		const health = await SandboxDatabase.healthCheck();

		return {
			health,
			collections: stats,
			timestamp: new Date().toISOString()
		};
	} catch (error) {
		console.error('Failed to get database stats:', error);
		throw error;
	}
}
