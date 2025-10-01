import { env } from '$env/dynamic/private';
import type { Directory, File, FileSystemItem } from '$lib/types/files';
import { Db, MongoClient, ObjectId } from 'mongodb';

export interface CreateFileData {
	name: string;
	path: string;
	content: string;
	type: 'file' | 'directory';
	parentId: string | null;
	metadata?: Record<string, any>;
}

export interface UpdateFileData {
	content?: string;
	name?: string;
	path?: string;
	modifiedAt?: Date;
	metadata?: Record<string, any>;
}

export class FilesService {
	private static db: Db | null = null;
	private static readonly collectionName = 'files';

	static async getDb(): Promise<Db> {
		if (!this.db) {
			const connectionString = env.DATABASE_URL || 'mongodb://localhost:27017/aura';
			const client = new MongoClient(connectionString);
			await client.connect();
			this.db = client.db();
		}
		return this.db;
	}

	/**
	 * Create a new file or directory
	 */
	static async createFile(data: CreateFileData): Promise<FileSystemItem> {
		const db = await this.getDb();
		const collection = db.collection(this.collectionName);

		const now = new Date();
		const fileDoc = {
			...data,
			id: new ObjectId().toString(),
			createdAt: now,
			modifiedAt: now,
			size: data.type === 'file' ? data.content?.length || 0 : 0,
			isReadOnly: false,
			isHidden: false,
			...data.metadata
		};

		await collection.insertOne(fileDoc);

		return this.mapDocumentToFileSystemItem(fileDoc);
	}

	/**
	 * Get file by path
	 */
	static async getFileByPath(path: string): Promise<FileSystemItem | null> {
		const db = await this.getDb();
		const collection = db.collection(this.collectionName);

		const doc = await collection.findOne({ path });
		return doc ? this.mapDocumentToFileSystemItem(doc) : null;
	}

	/**
	 * Get file by ID
	 */
	static async getFileById(id: string): Promise<FileSystemItem | null> {
		const db = await this.getDb();
		const collection = db.collection(this.collectionName);

		const doc = await collection.findOne({ id });
		return doc ? this.mapDocumentToFileSystemItem(doc) : null;
	}

	/**
	 * Update file by path
	 */
	static async updateFileByPath(
		path: string,
		data: UpdateFileData
	): Promise<FileSystemItem | null> {
		const db = await this.getDb();
		const collection = db.collection(this.collectionName);

		const updateDoc = {
			...data,
			modifiedAt: new Date(),
			...(data.content !== undefined && { size: data.content.length })
		};

		const result = await collection.findOneAndUpdate(
			{ path },
			{ $set: updateDoc },
			{ returnDocument: 'after' }
		);

		return result ? this.mapDocumentToFileSystemItem(result) : null;
	}

	/**
	 * Update file by ID
	 */
	static async updateFileById(id: string, data: UpdateFileData): Promise<FileSystemItem | null> {
		const db = await this.getDb();
		const collection = db.collection(this.collectionName);

		const updateDoc = {
			...data,
			modifiedAt: new Date(),
			...(data.content !== undefined && { size: data.content.length })
		};

		const result = await collection.findOneAndUpdate(
			{ id },
			{ $set: updateDoc },
			{ returnDocument: 'after' }
		);

		return result ? this.mapDocumentToFileSystemItem(result) : null;
	}

	/**
	 * Delete file by path
	 */
	static async deleteFileByPath(path: string): Promise<boolean> {
		const db = await this.getDb();
		const collection = db.collection(this.collectionName);

		const result = await collection.deleteOne({ path });
		return result.deletedCount > 0;
	}

	/**
	 * Delete file by ID
	 */
	static async deleteFileById(id: string): Promise<boolean> {
		const db = await this.getDb();
		const collection = db.collection(this.collectionName);

		const result = await collection.deleteOne({ id });
		return result.deletedCount > 0;
	}

	/**
	 * Get files by parent path (for listing directories)
	 */
	static async getFilesByParentPath(parentPath: string): Promise<FileSystemItem[]> {
		const db = await this.getDb();
		const collection = db.collection(this.collectionName);

		// Find files where the parent directory matches
		const docs = await collection
			.find({
				path: { $regex: `^${parentPath.replace(/\/$/, '')}/[^/]+$` }
			})
			.toArray();

		return docs.map((doc) => this.mapDocumentToFileSystemItem(doc));
	}

	/**
	 * Get all files in a project
	 */
	static async getFilesByProject(projectId: string): Promise<FileSystemItem[]> {
		const db = await this.getDb();
		const collection = db.collection(this.collectionName);

		const docs = await collection
			.find({
				'metadata.projectId': projectId
			})
			.toArray();

		return docs.map((doc) => this.mapDocumentToFileSystemItem(doc));
	}

	/**
	 * Search files by name or content
	 */
	static async searchFiles(query: string, projectId?: string): Promise<FileSystemItem[]> {
		const db = await this.getDb();
		const collection = db.collection(this.collectionName);

		const searchQuery: any = {
			$or: [
				{ name: { $regex: query, $options: 'i' } },
				{ content: { $regex: query, $options: 'i' } }
			]
		};

		if (projectId) {
			searchQuery['metadata.projectId'] = projectId;
		}

		const docs = await collection.find(searchQuery).toArray();
		return docs.map((doc) => this.mapDocumentToFileSystemItem(doc));
	}

	/**
	 * Get file history/versions
	 */
	static async getFileHistory(path: string, limit = 10): Promise<FileSystemItem[]> {
		const db = await this.getDb();
		const collection = db.collection(`${this.collectionName}_history`);

		const docs = await collection.find({ path }).sort({ modifiedAt: -1 }).limit(limit).toArray();

		return docs.map((doc) => this.mapDocumentToFileSystemItem(doc));
	}

	/**
	 * Create file history entry
	 */
	static async createFileHistory(file: FileSystemItem): Promise<void> {
		const db = await this.getDb();
		const collection = db.collection(`${this.collectionName}_history`);

		await collection.insertOne({
			...file,
			historyId: new ObjectId().toString(),
			archivedAt: new Date()
		});
	}

	/**
	 * Map MongoDB document to FileSystemItem
	 */
	private static mapDocumentToFileSystemItem(doc: any): FileSystemItem {
		const baseItem = {
			id: doc.id,
			name: doc.name,
			path: doc.path,
			type: doc.type,
			parentId: doc.parentId,
			createdAt: doc.createdAt,
			modifiedAt: doc.modifiedAt,
			size: doc.size || 0,
			isReadOnly: doc.isReadOnly || false,
			isHidden: doc.isHidden || false,
			permissions: doc.permissions || { read: true, write: true, execute: false }
		};

		if (doc.type === 'file') {
			return {
				...baseItem,
				type: 'file',
				content: doc.content || '',
				language: doc.language || 'plaintext',
				encoding: doc.encoding || 'utf-8',
				mimeType: doc.mimeType || 'text/plain',
				isDirty: false,
				metadata: doc.metadata || {}
			} as File;
		} else {
			return {
				...baseItem,
				type: 'directory',
				children: doc.children || [],
				isExpanded: doc.isExpanded || false,
				isRoot: doc.isRoot || false,
				content: ''
			} as Directory;
		}
	}
}

// Export singleton instance
export const filesService = FilesService;
