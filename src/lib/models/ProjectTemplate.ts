import { ObjectId } from 'mongodb';
import { SandboxDatabase } from '../database/sandbox.js';
import type { ProjectTemplate } from '../types/sandbox.js';

/**
 * Model for managing project templates
 */
export class ProjectTemplateModel {
	/**
	 * Create a new project template
	 */
	static async create(
		data: Omit<ProjectTemplate, '_id' | 'created_at' | 'updated_at'>
	): Promise<ProjectTemplate> {
		const db = await SandboxDatabase.getDb();
		const collection = db.collection<ProjectTemplate>('project_templates');

		const now = new Date();
		const template: Omit<ProjectTemplate, '_id'> = {
			...data,
			created_at: now,
			updated_at: now
		};

		const result = await collection.insertOne(template as ProjectTemplate);

		return {
			_id: result.insertedId,
			...template
		} as ProjectTemplate;
	}

	/**
	 * Find template by ID
	 */
	static async findById(id: string | ObjectId): Promise<ProjectTemplate | null> {
		const db = await SandboxDatabase.getDb();
		const collection = db.collection<ProjectTemplate>('project_templates');

		const objectId = typeof id === 'string' ? new ObjectId(id) : id;
		return await collection.findOne({ _id: objectId });
	}

	/**
	 * Find template by StackBlitz path
	 */
	static async findByStackBlitzPath(path: string): Promise<ProjectTemplate | null> {
		const db = await SandboxDatabase.getDb();
		const collection = db.collection<ProjectTemplate>('project_templates');

		return await collection.findOne({ stackblitz_path: path });
	}

	/**
	 * List templates with filtering and pagination
	 */
	static async list(
		options: {
			category?: string;
			type?: string;
			search?: string;
			is_active?: boolean;
			limit?: number;
			offset?: number;
			sort_by?: 'popularity_score' | 'name' | 'created_at';
			sort_order?: 'asc' | 'desc';
		} = {}
	): Promise<{ templates: ProjectTemplate[]; total: number }> {
		const db = await SandboxDatabase.getDb();
		const collection = db.collection<ProjectTemplate>('project_templates');

		// Build query
		const query: any = {};

		if (options.category) {
			query.category = options.category;
		}

		if (options.type) {
			query.type = options.type;
		}

		if (options.is_active !== undefined) {
			query.is_active = options.is_active;
		}

		if (options.search) {
			query.$text = { $search: options.search };
		}

		// Build sort
		const sortField = options.sort_by || 'popularity_score';
		const sortOrder = options.sort_order === 'asc' ? 1 : -1;
		const sort = { [sortField]: sortOrder };

		// Get total count
		const total = await collection.countDocuments(query);

		// Get templates
		let cursor = collection.find(query).sort(sort as any);

		if (options.offset) {
			cursor = cursor.skip(options.offset);
		}

		if (options.limit) {
			cursor = cursor.limit(options.limit);
		}

		const templates = await cursor.toArray();

		return { templates, total };
	}

	/**
	 * Update template
	 */
	static async update(
		id: string | ObjectId,
		updates: Partial<Omit<ProjectTemplate, '_id' | 'created_at'>>
	): Promise<ProjectTemplate | null> {
		const db = await SandboxDatabase.getDb();
		const collection = db.collection<ProjectTemplate>('project_templates');

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

		if (!result) {
			return null;
		}
		return result;
	}

	/**
	 * Delete template
	 */
	static async delete(id: string | ObjectId): Promise<boolean> {
		const db = await SandboxDatabase.getDb();
		const collection = db.collection<ProjectTemplate>('project_templates');

		const objectId = typeof id === 'string' ? new ObjectId(id) : id;
		const result = await collection.deleteOne({ _id: objectId });

		return result.deletedCount > 0;
	}

	/**
	 * Get popular templates
	 */
	static async getPopular(limit: number = 10): Promise<ProjectTemplate[]> {
		const db = await SandboxDatabase.getDb();
		const collection = db.collection<ProjectTemplate>('project_templates');

		return await collection
			.find({ is_active: true })
			.sort({ popularity_score: -1 })
			.limit(limit)
			.toArray();
	}

	/**
	 * Get categories with counts
	 */
	static async getCategories(): Promise<Array<{ category: string; count: number }>> {
		const db = await SandboxDatabase.getDb();
		const collection = db.collection<ProjectTemplate>('project_templates');

		const result = await collection
			.aggregate([
				{ $match: { is_active: true } },
				{ $group: { _id: '$category', count: { $sum: 1 } } },
				{ $sort: { count: -1 } },
				{ $project: { category: '$_id', count: 1, _id: 0 } }
			])
			.toArray();

		return result;
	}

	/**
	 * Search templates
	 */
	static async search(searchTerm: string, limit: number = 20): Promise<ProjectTemplate[]> {
		const db = await SandboxDatabase.getDb();
		const collection = db.collection<ProjectTemplate>('project_templates');

		return await collection
			.find({
				$text: { $search: searchTerm },
				is_active: true
			})
			.sort({ score: { $meta: 'textScore' } })
			.limit(limit)
			.toArray();
	}

	/**
	 * Increment popularity score
	 */
	static async incrementPopularity(id: string | ObjectId): Promise<void> {
		const db = await SandboxDatabase.getDb();
		const collection = db.collection<ProjectTemplate>('project_templates');

		const objectId = typeof id === 'string' ? new ObjectId(id) : id;
		await collection.updateOne(
			{ _id: objectId },
			{
				$inc: { popularity_score: 1 },
				$set: { updated_at: new Date() }
			}
		);
	}
}
