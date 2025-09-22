import { ObjectId } from 'mongodb';
import { SandboxDatabase } from '../database/sandbox.js';
import type { SandboxSession } from '../types/sandbox.js';

/**
 * Model for managing sandbox sessions
 */
export class SandboxSessionModel {
	/**
	 * Create a new sandbox session
	 */
	static async create(
		data: Omit<SandboxSession, '_id' | 'created_at' | 'updated_at'>
	): Promise<SandboxSession> {
		const db = await SandboxDatabase.getDb();
		const collection = db.collection<SandboxSession>('sandbox_sessions');

		const now = new Date();
		const session: Omit<SandboxSession, '_id'> = {
			...data,
			created_at: now,
			updated_at: now
		};

		const result = await collection.insertOne(session as SandboxSession);

		return {
			_id: result.insertedId,
			...session
		} as SandboxSession;
	}

	/**
	 * Find session by ID
	 */
	static async findById(id: string | ObjectId): Promise<SandboxSession | null> {
		const db = await SandboxDatabase.getDb();
		const collection = db.collection<SandboxSession>('sandbox_sessions');

		const objectId = typeof id === 'string' ? new ObjectId(id) : id;
		return await collection.findOne({ _id: objectId });
	}

	/**
	 * Find sessions by user ID
	 */
	static async findByUserId(
		userId: string,
		options: {
			status?: string[];
			limit?: number;
			includeInactive?: boolean;
		} = {}
	): Promise<SandboxSession[]> {
		const db = await SandboxDatabase.getDb();
		const collection = db.collection<SandboxSession>('sandbox_sessions');

		const query: any = { user_id: userId };

		if (options.status && options.status.length > 0) {
			query.status = { $in: options.status };
		} else if (!options.includeInactive) {
			query.status = { $in: ['initializing', 'running'] };
		}

		let cursor = collection.find(query).sort({ last_activity: -1 });

		if (options.limit) {
			cursor = cursor.limit(options.limit);
		}

		return await cursor.toArray();
	}

	/**
	 * Find session by project ID
	 */
	static async findByProjectId(
		projectId: string,
		activeOnly: boolean = true
	): Promise<SandboxSession | null> {
		const db = await SandboxDatabase.getDb();
		const collection = db.collection<SandboxSession>('sandbox_sessions');

		const query: any = { project_id: projectId };

		if (activeOnly) {
			query.status = { $in: ['initializing', 'running'] };
		}

		return await collection.findOne(query, { sort: { last_activity: -1 } });
	}

	/**
	 * Update session
	 */
	static async update(
		id: string | ObjectId,
		updates: Partial<Omit<SandboxSession, '_id' | 'created_at'>>
	): Promise<SandboxSession | null> {
		const db = await SandboxDatabase.getDb();
		const collection = db.collection<SandboxSession>('sandbox_sessions');

		const objectId = typeof id === 'string' ? new ObjectId(id) : id;
		const updateData = {
			...updates,
			updated_at: new Date()
		};

		const result = await collection.findOneAndUpdate(
			{ _id: objectId },
			{ $set: updateData },
			{ returnDocument: 'after' }
		);

		return result;
	}

	/**
	 * Update session activity
	 */
	static async updateActivity(id: string | ObjectId): Promise<void> {
		const db = await SandboxDatabase.getDb();
		const collection = db.collection<SandboxSession>('sandbox_sessions');

		const objectId = typeof id === 'string' ? new ObjectId(id) : id;
		await collection.updateOne(
			{ _id: objectId },
			{
				$set: {
					last_activity: new Date(),
					updated_at: new Date()
				}
			}
		);
	}

	/**
	 * Stop session
	 */
	static async stop(id: string | ObjectId): Promise<SandboxSession | null> {
		const db = await SandboxDatabase.getDb();
		const collection = db.collection<SandboxSession>('sandbox_sessions');

		const objectId = typeof id === 'string' ? new ObjectId(id) : id;
		const now = new Date();

		const result = await collection.findOneAndUpdate(
			{ _id: objectId },
			{
				$set: {
					status: 'stopped',
					stop_time: now,
					updated_at: now
				}
			},
			{ returnDocument: 'after' }
		);

		return result;
	}

	/**
	 * Find expired sessions
	 */
	static async findExpired(): Promise<SandboxSession[]> {
		const db = await SandboxDatabase.getDb();
		const collection = db.collection<SandboxSession>('sandbox_sessions');

		const now = new Date();

		return await collection
			.find({
				status: { $in: ['initializing', 'running'] },
				$or: [
					{ auto_stop_time: { $lte: now } },
					{ last_activity: { $lte: new Date(now.getTime() - 3600000) } } // 1 hour ago
				]
			})
			.toArray();
	}

	/**
	 * Get active sessions count by user
	 */
	static async getActiveSessionsCount(userId: string): Promise<number> {
		const db = await SandboxDatabase.getDb();
		const collection = db.collection<SandboxSession>('sandbox_sessions');

		return await collection.countDocuments({
			user_id: userId,
			status: { $in: ['initializing', 'running'] }
		});
	}

	/**
	 * Get sessions by provider
	 */
	static async findByProvider(
		provider: string,
		activeOnly: boolean = true
	): Promise<SandboxSession[]> {
		const db = await SandboxDatabase.getDb();
		const collection = db.collection<SandboxSession>('sandbox_sessions');

		const query: any = { provider };

		if (activeOnly) {
			query.status = { $in: ['initializing', 'running'] };
		}

		return await collection.find(query).sort({ last_activity: -1 }).toArray();
	}

	/**
	 * Delete session
	 */
	static async delete(id: string | ObjectId): Promise<boolean> {
		const db = await SandboxDatabase.getDb();
		const collection = db.collection<SandboxSession>('sandbox_sessions');

		const objectId = typeof id === 'string' ? new ObjectId(id) : id;
		const result = await collection.deleteOne({ _id: objectId });

		return result.deletedCount > 0;
	}

	/**
	 * Cleanup old sessions
	 */
	static async cleanup(olderThanDays: number = 7): Promise<number> {
		const db = await SandboxDatabase.getDb();
		const collection = db.collection<SandboxSession>('sandbox_sessions');

		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

		const result = await collection.deleteMany({
			status: { $in: ['stopped', 'error', 'timeout'] },
			updated_at: { $lt: cutoffDate }
		});

		return result.deletedCount;
	}
}
