import { SandboxDatabase } from '../database/sandbox.js';
import type { ProjectStorage } from '../types/sandbox.js';

/**
 * Model for managing project storage
 */
export class ProjectStorageModel {
	/**
	 * Create a new project storage record
	 */
	static async create(
		data: Omit<ProjectStorage, '_id' | 'created_at' | 'updated_at'>
	): Promise<ProjectStorage> {
		const db = await SandboxDatabase.getDb();
		const collection = db.collection<ProjectStorage>('project_storage');

		const now = new Date();
		const storage: Omit<ProjectStorage, '_id'> = {
			...data,
			created_at: now,
			updated_at: now
		};

		const result = await collection.insertOne(storage as ProjectStorage);

		return {
			_id: result.insertedId,
			...storage
		} as ProjectStorage;
	}

	/**
	 * Find storage by project ID
	 */
	static async findByProjectId(projectId: string): Promise<ProjectStorage | null> {
		const db = await SandboxDatabase.getDb();
		const collection = db.collection<ProjectStorage>('project_storage');

		return await collection.findOne({ project_id: projectId });
	}

	/**
	 * Update storage record
	 */
	static async update(
		projectId: string,
		updates: Partial<Omit<ProjectStorage, '_id' | 'project_id' | 'created_at'>>
	): Promise<ProjectStorage | null> {
		const db = await SandboxDatabase.getDb();
		const collection = db.collection<ProjectStorage>('project_storage');

		const updateData = {
			...updates,
			updated_at: new Date()
		};

		const result = await collection.findOneAndUpdate(
			{ project_id: projectId },
			{ $set: updateData },
			{ returnDocument: 'after' }
		);

		return result;
	}

	/**
	 * Update upload status
	 */
	static async updateUploadStatus(
		projectId: string,
		status: ProjectStorage['upload_status'],
		metadata?: Record<string, any>
	): Promise<void> {
		const db = await SandboxDatabase.getDb();
		const collection = db.collection<ProjectStorage>('project_storage');

		const updateData: any = {
			upload_status: status,
			updated_at: new Date()
		};

		if (metadata) {
			updateData.metadata = metadata;
		}

		if (status === 'completed') {
			updateData.last_sync_at = new Date();
		}

		await collection.updateOne({ project_id: projectId }, { $set: updateData });
	}

	/**
	 * Update file count and size
	 */
	static async updateFileStats(
		projectId: string,
		fileCount: number,
		totalSize: number
	): Promise<void> {
		const db = await SandboxDatabase.getDb();
		const collection = db.collection<ProjectStorage>('project_storage');

		await collection.updateOne(
			{ project_id: projectId },
			{
				$set: {
					file_count: fileCount,
					total_size_bytes: totalSize,
					updated_at: new Date()
				}
			}
		);
	}

	/**
	 * Delete storage record
	 */
	static async delete(projectId: string): Promise<boolean> {
		const db = await SandboxDatabase.getDb();
		const collection = db.collection<ProjectStorage>('project_storage');

		const result = await collection.deleteOne({ project_id: projectId });
		return result.deletedCount > 0;
	}

	/**
	 * Get storage statistics
	 */
	static async getStorageStats(): Promise<{
		totalProjects: number;
		totalSize: number;
		averageSize: number;
		storageByProvider: Array<{ provider: string; count: number; size: number }>;
	}> {
		const db = await SandboxDatabase.getDb();
		const collection = db.collection<ProjectStorage>('project_storage');

		const stats = await collection
			.aggregate([
				{
					$group: {
						_id: null,
						totalProjects: { $sum: 1 },
						totalSize: { $sum: '$total_size_bytes' },
						averageSize: { $avg: '$total_size_bytes' }
					}
				}
			])
			.toArray();

		const providerStats = await collection
			.aggregate([
				{
					$group: {
						_id: '$storage_provider',
						count: { $sum: 1 },
						size: { $sum: '$total_size_bytes' }
					}
				},
				{
					$project: {
						provider: '$_id',
						count: 1,
						size: 1,
						_id: 0
					}
				}
			])
			.toArray();

		return {
			totalProjects: stats[0]?.totalProjects || 0,
			totalSize: stats[0]?.totalSize || 0,
			averageSize: stats[0]?.averageSize || 0,
			storageByProvider: providerStats as Array<{ provider: string; count: number; size: number }>
		};
	}

	/**
	 * Find projects needing sync
	 */
	static async findStaleProjects(olderThanMinutes: number = 60): Promise<ProjectStorage[]> {
		const db = await SandboxDatabase.getDb();
		const collection = db.collection<ProjectStorage>('project_storage');

		const cutoffDate = new Date();
		cutoffDate.setMinutes(cutoffDate.getMinutes() - olderThanMinutes);

		return await collection
			.find({
				upload_status: 'completed',
				$or: [{ last_sync_at: { $lt: cutoffDate } }, { last_sync_at: { $exists: false } }]
			})
			.toArray();
	}

	/**
	 * Get projects by storage provider
	 */
	static async findByProvider(
		provider: ProjectStorage['storage_provider']
	): Promise<ProjectStorage[]> {
		const db = await SandboxDatabase.getDb();
		const collection = db.collection<ProjectStorage>('project_storage');

		return await collection.find({ storage_provider: provider }).toArray();
	}
}
