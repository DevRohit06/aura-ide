import { env } from '$env/dynamic/private';
import type { Project, Session, User } from '$lib/types';
import type { SandboxSession } from '$lib/types/sandbox';
import { Collection, Db, MongoClient } from 'mongodb';

const DATABASE_URL = 'mongodb://localhost:27017/aura-dev';
const DATABASE_NAME = env.DATABASE_NAME || 'aura-dev';

export class DatabaseService {
	private static client: MongoClient | null = null;
	private static db: Db | null = null;

	/**
	 * Connect to MongoDB
	 */
	static async connect(): Promise<void> {
		try {
			if (!this.client) {
				this.client = new MongoClient(DATABASE_URL);
				await this.client.connect();
				this.db = this.client.db(DATABASE_NAME);
				console.log('Connected to MongoDB');
			}
		} catch (error) {
			console.error('Failed to connect to MongoDB:', error);
			throw error;
		}
	}

	/**
	 * Get database instance
	 */
	private static async getDb(): Promise<Db> {
		if (!this.db) {
			await this.connect();
		}
		return this.db!;
	}

	/**
	 * Test database connection
	 */
	static async testConnection(): Promise<void> {
		try {
			const db = await this.getDb();
			await db.admin().ping();
		} catch (error) {
			console.error('Database connection test failed:', error);
			throw error;
		}
	}

	/**
	 * Get users collection
	 */
	private static async getUsersCollection(): Promise<Collection<User>> {
		const db = await this.getDb();
		return db.collection<User>('users');
	}

	/**
	 * Get projects collection
	 */
	private static async getProjectsCollection(): Promise<Collection<Project>> {
		const db = await this.getDb();
		return db.collection<Project>('projects');
	}

	/**
	 * Get sessions collection
	 */
	private static async getSessionsCollection(): Promise<Collection<Session>> {
		const db = await this.getDb();
		return db.collection<Session>('sessions');
	}

	/**
	 * Get sandbox sessions collection
	 */
	private static async getSandboxSessionsCollection(): Promise<Collection<SandboxSession>> {
		const db = await this.getDb();
		return db.collection<SandboxSession>('sandbox_sessions');
	}

	/**
	 * Initialize database indexes
	 */
	static async initializeIndexes(): Promise<void> {
		try {
			const usersCollection = await this.getUsersCollection();
			const projectsCollection = await this.getProjectsCollection();
			const sessionsCollection = await this.getSessionsCollection();

			// User indexes
			await usersCollection.createIndex({ email: 1 }, { unique: true });
			await usersCollection.createIndex({ username: 1 }, { unique: true });
			await usersCollection.createIndex({ createdAt: 1 });

			// Project indexes
			await projectsCollection.createIndex({ ownerId: 1 });
			await projectsCollection.createIndex({ name: 1, ownerId: 1 });
			await projectsCollection.createIndex({ createdAt: 1 });
			await projectsCollection.createIndex({ status: 1 });

			// Session indexes
			await sessionsCollection.createIndex({ userId: 1 });
			await sessionsCollection.createIndex({ projectId: 1 });
			await sessionsCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
			await sessionsCollection.createIndex({ type: 1 });
			await sessionsCollection.createIndex({ status: 1 });

			console.log('Database indexes initialized');
		} catch (error) {
			console.error('Failed to initialize database indexes:', error);
			throw error;
		}
	}

	// User operations
	static async createUser(user: User): Promise<User> {
		try {
			const collection = await this.getUsersCollection();
			await collection.insertOne(user);
			return user;
		} catch (error) {
			console.error('Failed to create user:', error);
			throw error;
		}
	}

	static async findUserById(id: string): Promise<User | null> {
		try {
			const collection = await this.getUsersCollection();
			return await collection.findOne({ id });
		} catch (error) {
			console.error('Failed to find user by ID:', error);
			throw error;
		}
	}

	static async findUserByEmail(email: string): Promise<User | null> {
		try {
			const collection = await this.getUsersCollection();
			return await collection.findOne({ email: email.toLowerCase() });
		} catch (error) {
			console.error('Failed to find user by email:', error);
			throw error;
		}
	}

	static async findUserByUsername(username: string): Promise<User | null> {
		try {
			const collection = await this.getUsersCollection();
			return await collection.findOne({ username });
		} catch (error) {
			console.error('Failed to find user by username:', error);
			throw error;
		}
	}

	static async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
		try {
			const collection = await this.getUsersCollection();
			const result = await collection.findOneAndUpdate(
				{ id },
				{ $set: updates },
				{ returnDocument: 'after' }
			);
			return result || null;
		} catch (error) {
			console.error('Failed to update user:', error);
			throw error;
		}
	}

	static async updateUserLastAccessed(id: string): Promise<void> {
		try {
			const collection = await this.getUsersCollection();
			await collection.updateOne({ id }, { $set: { updatedAt: new Date() } });
		} catch (error) {
			console.error('Failed to update user last accessed:', error);
			throw error;
		}
	}

	static async deleteUser(id: string): Promise<boolean> {
		try {
			const collection = await this.getUsersCollection();
			const result = await collection.deleteOne({ id });
			return result.deletedCount > 0;
		} catch (error) {
			console.error('Failed to delete user:', error);
			throw error;
		}
	}

	// Project operations
	static async createProject(project: Project): Promise<Project> {
		try {
			const collection = await this.getProjectsCollection();
			await collection.insertOne(project);
			return project;
		} catch (error) {
			console.error('Failed to create project:', error);
			throw error;
		}
	}

	static async findProjectById(id: string): Promise<Project | null> {
		try {
			const collection = await this.getProjectsCollection();
			return await collection.findOne({ id });
		} catch (error) {
			console.error('Failed to find project by ID:', error);
			throw error;
		}
	}

	static async findProjectsByUserId(userId: string, limit = 50, offset = 0): Promise<Project[]> {
		try {
			const collection = await this.getProjectsCollection();
			return await collection
				.find({ ownerId: userId })
				.sort({ createdAt: -1 })
				.skip(offset)
				.limit(limit)
				.toArray();
		} catch (error) {
			console.error('Failed to find projects by user ID:', error);
			throw error;
		}
	}

	static async updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
		try {
			const collection = await this.getProjectsCollection();
			const result = await collection.findOneAndUpdate(
				{ id },
				{ $set: updates },
				{ returnDocument: 'after' }
			);
			return result || null;
		} catch (error) {
			console.error('Failed to update project:', error);
			throw error;
		}
	}

	static async deleteProject(id: string): Promise<boolean> {
		try {
			const collection = await this.getProjectsCollection();
			const result = await collection.deleteOne({ id });
			return result.deletedCount > 0;
		} catch (error) {
			console.error('Failed to delete project:', error);
			throw error;
		}
	}

	// Session operations
	static async createSession(session: Session): Promise<Session> {
		try {
			const collection = await this.getSessionsCollection();
			await collection.insertOne(session);
			return session;
		} catch (error) {
			console.error('Failed to create session:', error);
			throw error;
		}
	}

	static async findSessionById(id: string): Promise<Session | null> {
		try {
			const collection = await this.getSessionsCollection();
			return await collection.findOne({ id });
		} catch (error) {
			console.error('Failed to find session by ID:', error);
			throw error;
		}
	}

	static async findActiveSessionsByUserId(userId: string): Promise<Session[]> {
		try {
			const collection = await this.getSessionsCollection();
			return await collection
				.find({
					userId,
					status: 'active',
					expiresAt: { $gt: new Date() }
				})
				.toArray();
		} catch (error) {
			console.error('Failed to find active sessions by user ID:', error);
			throw error;
		}
	}

	static async updateSession(id: string, updates: Partial<Session>): Promise<Session | null> {
		try {
			const collection = await this.getSessionsCollection();
			const result = await collection.findOneAndUpdate(
				{ id },
				{ $set: { ...updates, lastAccessedAt: new Date() } },
				{ returnDocument: 'after' }
			);
			return result || null;
		} catch (error) {
			console.error('Failed to update session:', error);
			throw error;
		}
	}

	static async deleteSession(id: string): Promise<boolean> {
		try {
			const collection = await this.getSessionsCollection();
			const result = await collection.deleteOne({ id });
			return result.deletedCount > 0;
		} catch (error) {
			console.error('Failed to delete session:', error);
			throw error;
		}
	}

	static async deleteExpiredSessions(): Promise<number> {
		try {
			const collection = await this.getSessionsCollection();
			const result = await collection.deleteMany({
				expiresAt: { $lt: new Date() }
			});
			return result.deletedCount;
		} catch (error) {
			console.error('Failed to delete expired sessions:', error);
			throw error;
		}
	}

	// Additional sandbox session methods
	static async getSessionById(id: string): Promise<any | null> {
		try {
			const collection = await this.getSessionsCollection();
			return await collection.findOne({ id });
		} catch (error) {
			console.error('Failed to get session by ID:', error);
			throw error;
		}
	}

	static async getSessionsByUser(userId: string): Promise<any[]> {
		try {
			const collection = await this.getSessionsCollection();
			return await collection.find({ userId }).sort({ updated_at: -1 }).toArray();
		} catch (error) {
			console.error('Failed to get sessions by user:', error);
			throw error;
		}
	}

	static async getSessionsByProject(projectId: string): Promise<any[]> {
		try {
			const collection = await this.getSessionsCollection();
			return await collection.find({ projectId }).sort({ updated_at: -1 }).toArray();
		} catch (error) {
			console.error('Failed to get sessions by project:', error);
			throw error;
		}
	}

	// Sandbox session specific operations
	static async createSandboxSession(session: SandboxSession): Promise<SandboxSession> {
		try {
			const collection = await this.getSandboxSessionsCollection();
			await collection.insertOne(session);
			return session;
		} catch (error) {
			console.error('Failed to create sandbox session:', error);
			throw error;
		}
	}

	static async getSandboxSessionById(id: string): Promise<SandboxSession | null> {
		try {
			const collection = await this.getSandboxSessionsCollection();
			return await collection.findOne({ id });
		} catch (error) {
			console.error('Failed to get sandbox session by ID:', error);
			throw error;
		}
	}

	static async getSandboxSessionsByUser(userId: string): Promise<SandboxSession[]> {
		try {
			const collection = await this.getSandboxSessionsCollection();
			return await collection.find({ userId }).sort({ updated_at: -1 }).toArray();
		} catch (error) {
			console.error('Failed to get sandbox sessions by user:', error);
			throw error;
		}
	}

	static async getSandboxSessionsByProject(projectId: string): Promise<SandboxSession[]> {
		try {
			const collection = await this.getSandboxSessionsCollection();
			return await collection.find({ projectId }).sort({ updated_at: -1 }).toArray();
		} catch (error) {
			console.error('Failed to get sandbox sessions by project:', error);
			throw error;
		}
	}

	static async updateSandboxSession(
		id: string,
		updates: Partial<SandboxSession>
	): Promise<SandboxSession | null> {
		try {
			const collection = await this.getSandboxSessionsCollection();
			const result = await collection.findOneAndUpdate(
				{ id },
				{ $set: { ...updates, updated_at: new Date() } },
				{ returnDocument: 'after' }
			);
			return result || null;
		} catch (error) {
			console.error('Failed to update sandbox session:', error);
			throw error;
		}
	}

	/**
	 * Close database connection
	 */
	static async disconnect(): Promise<void> {
		try {
			if (this.client) {
				await this.client.close();
				this.client = null;
				this.db = null;
				console.log('Disconnected from MongoDB');
			}
		} catch (error) {
			console.error('Failed to disconnect from MongoDB:', error);
			throw error;
		}
	}

	/**
	 * Health check
	 */
	static async healthCheck(): Promise<boolean> {
		try {
			const db = await this.getDb();
			await db.admin().ping();
			return true;
		} catch (error) {
			console.error('Database health check failed:', error);
			return false;
		}
	}
}
