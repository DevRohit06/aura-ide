import { env } from '$env/dynamic/private';
import { Db, MongoClient } from 'mongodb';
import type { MongoIndexConfig } from '../types/sandbox.js';
import { SANDBOX_COLLECTIONS } from '../types/sandbox.js';

const MONGODB_URI = env.DATABASE_URL || env.MONGODB_URI || 'mongodb://localhost:27017/aura-dev';
const DATABASE_NAME = env.MONGODB_DB_NAME || 'aura-dev';

/**
 * Database connection singleton for sandbox operations
 */
export class SandboxDatabase {
	private static client: MongoClient | null = null;
	private static db: Db | null = null;

	/**
	 * Get the MongoDB database instance
	 */
	static async getDb(): Promise<Db> {
		if (!this.db) {
			this.client = new MongoClient(MONGODB_URI);
			await this.client.connect();
			this.db = this.client.db(DATABASE_NAME);
		}
		return this.db;
	}

	/**
	 * Close the database connection
	 */
	static async close(): Promise<void> {
		if (this.client) {
			await this.client.close();
			this.client = null;
			this.db = null;
		}
	}

	/**
	 * Initialize all sandbox collections and indexes
	 */
	static async initializeCollections(): Promise<void> {
		const db = await this.getDb();

		// Create collections if they don't exist
		const existingCollections = await db.listCollections().toArray();
		const existingNames = existingCollections.map((col: any) => col.name);

		for (const collectionName of SANDBOX_COLLECTIONS) {
			if (!existingNames.includes(collectionName)) {
				await db.createCollection(collectionName);
				console.log(`Created collection: ${collectionName}`);
			}
		}

		// Create indexes
		await this.createIndexes();
	}

	/**
	 * Create all required indexes for optimal performance
	 */
	static async createIndexes(): Promise<void> {
		const db = await this.getDb();

		const indexConfigs: MongoIndexConfig[] = [
			{
				collection: 'project_templates',
				indexes: [
					{ fields: { type: 1 } },
					{ fields: { category: 1 } },
					{ fields: { is_active: 1 } },
					{ fields: { popularity_score: -1 } },
					{ fields: { stackblitz_path: 1 }, options: { unique: true } },
					{
						fields: { name: 'text', description: 'text' },
						options: { name: 'templates_text_search' }
					}
				]
			},
			{
				collection: 'template_dependencies',
				indexes: [
					{ fields: { template_id: 1 } },
					{ fields: { dependency_name: 1 } },
					{ fields: { template_id: 1, dependency_name: 1 }, options: { unique: true } }
				]
			},
			{
				collection: 'project_storage',
				indexes: [
					{ fields: { project_id: 1 }, options: { unique: true } },
					{ fields: { storage_provider: 1 } },
					{ fields: { upload_status: 1 } },
					{ fields: { last_sync_at: 1 } }
				]
			},
			{
				collection: 'sandbox_sessions',
				indexes: [
					{ fields: { user_id: 1 } },
					{ fields: { project_id: 1 } },
					{ fields: { provider: 1 } },
					{ fields: { status: 1 } },
					{ fields: { last_activity: 1 } },
					{ fields: { auto_stop_time: 1 } },
					{ fields: { provider_session_id: 1 }, options: { sparse: true } },
					{ fields: { user_id: 1, status: 1 } }
				]
			},
			{
				collection: 'code_executions',
				indexes: [
					{ fields: { sandbox_session_id: 1 } },
					{ fields: { user_id: 1 } },
					{ fields: { language: 1 } },
					{ fields: { executed_at: -1 } },
					{ fields: { success: 1 } },
					{ fields: { sandbox_session_id: 1, executed_at: -1 } }
				]
			},
			{
				collection: 'sandbox_file_changes',
				indexes: [
					{ fields: { sandbox_session_id: 1 } },
					{ fields: { file_path: 1 } },
					{ fields: { operation: 1 } },
					{ fields: { created_at: -1 } },
					{ fields: { sandbox_session_id: 1, created_at: -1 } }
				]
			},
			{
				collection: 'template_cache',
				indexes: [
					{ fields: { template_id: 1 }, options: { unique: true } },
					{ fields: { cache_key: 1 } },
					{
						fields: { expires_at: 1 },
						options: { expireAfterSeconds: 0, name: 'template_cache_ttl' }
					}
				]
			},
			{
				collection: 'sandbox_usage_analytics',
				indexes: [
					{ fields: { user_id: 1 } },
					{ fields: { provider: 1 } },
					{ fields: { event_type: 1 } },
					{ fields: { created_at: -1 } },
					{ fields: { sandbox_session_id: 1 }, options: { sparse: true } },
					{ fields: { user_id: 1, created_at: -1 } }
				]
			}
		];

		for (const config of indexConfigs) {
			const collection = db.collection(config.collection);

			for (const indexDef of config.indexes) {
				try {
					await collection.createIndex(indexDef.fields, indexDef.options || {});
					console.log(`Created index on ${config.collection}:`, indexDef.fields);
				} catch (error) {
					// Index might already exist
					if (error instanceof Error && !error.message.includes('already exists')) {
						console.error(`Error creating index on ${config.collection}:`, error);
					}
				}
			}
		}
	}

	/**
	 * Drop all sandbox collections (for cleanup/reset)
	 */
	static async dropCollections(): Promise<void> {
		const db = await this.getDb();

		for (const collectionName of SANDBOX_COLLECTIONS) {
			try {
				await db.collection(collectionName).drop();
				console.log(`Dropped collection: ${collectionName}`);
			} catch (error) {
				// Collection might not exist
				if (error instanceof Error && !error.message.includes('ns not found')) {
					console.error(`Error dropping collection ${collectionName}:`, error);
				}
			}
		}
	}

	/**
	 * Get collection statistics
	 */
	static async getCollectionStats(): Promise<Record<string, any>> {
		const db = await this.getDb();
		const stats: Record<string, any> = {};

		for (const collectionName of SANDBOX_COLLECTIONS) {
			try {
				const collection = db.collection(collectionName);
				const count = await collection.countDocuments();
				const indexes = await collection.indexes();

				stats[collectionName] = {
					documentCount: count,
					indexCount: indexes.length,
					indexes: indexes.map((idx: any) => idx.name)
				};
			} catch (error) {
				stats[collectionName] = { error: error instanceof Error ? error.message : 'Unknown error' };
			}
		}

		return stats;
	}

	/**
	 * Health check for database connection
	 */
	static async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string }> {
		try {
			const db = await this.getDb();
			await db.admin().ping();
			return { status: 'healthy' };
		} catch (error) {
			return {
				status: 'unhealthy',
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}
}

// Collection names constant for imports
