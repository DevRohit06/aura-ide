import { env } from '$env/dynamic/private';
import type { Project, Session, User } from '$lib/types';
import type {
	ChatMessage,
	ChatThread,
	MessageSearchQuery,
	MessageTemplate,
	ThreadSearchQuery,
	ThreadTemplate
} from '$lib/types/chat';
import type { SandboxSession } from '$lib/types/sandbox';
import { Collection, Db, MongoClient } from 'mongodb';

const DATABASE_URL = env.DATABASE_URL || 'mongodb://localhost:27017/aura-dev';
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
		if (!this.db) {
			throw new Error('Database connection failed: db is null');
		}
		return this.db;
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
	 * Get chat threads collection
	 */
	private static async getChatThreadsCollection(): Promise<Collection<ChatThread>> {
		const db = await this.getDb();
		return db.collection<ChatThread>('chat_threads');
	}

	/**
	 * Get chat messages collection
	 */
	private static async getChatMessagesCollection(): Promise<Collection<ChatMessage>> {
		const db = await this.getDb();
		return db.collection<ChatMessage>('chat_messages');
	}

	/**
	 * Get message templates collection
	 */
	private static async getMessageTemplatesCollection(): Promise<Collection<MessageTemplate>> {
		const db = await this.getDb();
		return db.collection<MessageTemplate>('message_templates');
	}

	/**
	 * Get thread templates collection
	 */
	private static async getThreadTemplatesCollection(): Promise<Collection<ThreadTemplate>> {
		const db = await this.getDb();
		return db.collection<ThreadTemplate>('thread_templates');
	}

	/**
	 * Initialize database indexes
	 */
	static async initializeIndexes(): Promise<void> {
		try {
			const usersCollection = await this.getUsersCollection();
			const projectsCollection = await this.getProjectsCollection();
			const sessionsCollection = await this.getSessionsCollection();
			const chatThreadsCollection = await this.getChatThreadsCollection();
			const chatMessagesCollection = await this.getChatMessagesCollection();
			const messageTemplatesCollection = await this.getMessageTemplatesCollection();
			const threadTemplatesCollection = await this.getThreadTemplatesCollection();

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

			// Chat thread indexes
			await chatThreadsCollection.createIndex({ userId: 1 });
			await chatThreadsCollection.createIndex({ projectId: 1 });
			await chatThreadsCollection.createIndex({ createdAt: 1 });
			await chatThreadsCollection.createIndex({ updatedAt: 1 });
			await chatThreadsCollection.createIndex({ lastMessageAt: 1 });
			await chatThreadsCollection.createIndex({ isArchived: 1 });
			await chatThreadsCollection.createIndex({ isPinned: 1 });
			await chatThreadsCollection.createIndex({ tags: 1 });
			await chatThreadsCollection.createIndex({ title: 'text', description: 'text' });

			// Chat message indexes
			await chatMessagesCollection.createIndex({ threadId: 1 });
			await chatMessagesCollection.createIndex({ projectId: 1 });
			await chatMessagesCollection.createIndex({ userId: 1 });
			await chatMessagesCollection.createIndex({ timestamp: 1 });
			await chatMessagesCollection.createIndex({ role: 1 });
			await chatMessagesCollection.createIndex({ parentMessageId: 1 });
			await chatMessagesCollection.createIndex({ 'fileContext.filePath': 1 });
			await chatMessagesCollection.createIndex({ content: 'text', contentMarkdown: 'text' });

			// Template indexes
			await messageTemplatesCollection.createIndex({ category: 1 });
			await messageTemplatesCollection.createIndex({ createdBy: 1 });
			await messageTemplatesCollection.createIndex({ usage: -1 });
			await messageTemplatesCollection.createIndex({ name: 'text', content: 'text' });

			await threadTemplatesCollection.createIndex({ category: 1 });
			await threadTemplatesCollection.createIndex({ createdBy: 1 });
			await threadTemplatesCollection.createIndex({ usage: -1 });
			await threadTemplatesCollection.createIndex({ tags: 1 });
			await threadTemplatesCollection.createIndex({ name: 'text', description: 'text' });

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

	static async findProjectBySandboxId(sandboxId: string): Promise<Project | null> {
		try {
			const collection = await this.getProjectsCollection();
			return await collection.findOne({ sandboxId });
		} catch (error) {
			console.error('Failed to find project by sandbox ID:', error);
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

	// Chat Thread operations
	static async createChatThread(thread: ChatThread): Promise<ChatThread> {
		try {
			const collection = await this.getChatThreadsCollection();
			await collection.insertOne(thread);
			return thread;
		} catch (error) {
			console.error('Failed to create chat thread:', error);
			throw error;
		}
	}

	static async findChatThreadById(id: string): Promise<ChatThread | null> {
		try {
			const collection = await this.getChatThreadsCollection();
			return await collection.findOne({ id });
		} catch (error) {
			console.error('Failed to find chat thread by ID:', error);
			throw error;
		}
	}

	static async searchChatThreads(query: ThreadSearchQuery): Promise<ChatThread[]> {
		try {
			const collection = await this.getChatThreadsCollection();
			const filter: any = {};

			if (query.userId) filter.userId = query.userId;
			if (query.projectId) filter.projectId = query.projectId;
			if (query.isArchived !== undefined) filter.isArchived = query.isArchived;
			if (query.isPinned !== undefined) filter.isPinned = query.isPinned;
			if (query.tags && query.tags.length > 0) filter.tags = { $in: query.tags };
			if (query.createdAfter) filter.createdAt = { ...filter.createdAt, $gte: query.createdAfter };
			if (query.createdBefore)
				filter.createdAt = { ...filter.createdAt, $lte: query.createdBefore };
			if (query.query) {
				filter.$text = { $search: query.query };
			}

			const sortField = query.sortBy || 'updatedAt';
			const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

			return await collection
				.find(filter)
				.sort({ [sortField]: sortOrder })
				.skip(query.offset || 0)
				.limit(query.limit || 50)
				.toArray();
		} catch (error) {
			console.error('Failed to search chat threads:', error);
			throw error;
		}
	}

	static async updateChatThread(
		id: string,
		updates: Partial<ChatThread>
	): Promise<ChatThread | null> {
		try {
			const collection = await this.getChatThreadsCollection();
			const result = await collection.findOneAndUpdate(
				{ id },
				{ $set: { ...updates, updatedAt: new Date() } },
				{ returnDocument: 'after' }
			);
			return result || null;
		} catch (error) {
			console.error('Failed to update chat thread:', error);
			throw error;
		}
	}

	static async deleteChatThread(id: string): Promise<boolean> {
		try {
			const collection = await this.getChatThreadsCollection();
			const result = await collection.deleteOne({ id });

			// Also delete all messages in this thread
			if (result.deletedCount > 0) {
				await this.deleteChatMessagesByThreadId(id);
			}

			return result.deletedCount > 0;
		} catch (error) {
			console.error('Failed to delete chat thread:', error);
			throw error;
		}
	}

	static async archiveChatThread(id: string): Promise<boolean> {
		try {
			const collection = await this.getChatThreadsCollection();
			const result = await collection.updateOne(
				{ id },
				{ $set: { isArchived: true, updatedAt: new Date() } }
			);
			return result.modifiedCount > 0;
		} catch (error) {
			console.error('Failed to archive chat thread:', error);
			throw error;
		}
	}

	// Chat Message operations
	static async createChatMessage(message: ChatMessage): Promise<ChatMessage> {
		try {
			const collection = await this.getChatMessagesCollection();
			await collection.insertOne(message);

			// Update thread's lastMessageAt and increment message count
			const threadsCollection = await this.getChatThreadsCollection();
			await threadsCollection.updateOne(
				{ id: message.threadId },
				{
					$set: { lastMessageAt: message.timestamp, updatedAt: new Date() },
					$inc: { 'statistics.messageCount': 1 }
				}
			);

			return message;
		} catch (error) {
			console.error('Failed to create chat message:', error);
			throw error;
		}
	}

	static async findChatMessageById(id: string): Promise<ChatMessage | null> {
		try {
			const collection = await this.getChatMessagesCollection();
			return await collection.findOne({ id });
		} catch (error) {
			console.error('Failed to find chat message by ID:', error);
			throw error;
		}
	}

	static async findChatMessagesByThreadId(
		threadId: string,
		limit = 100,
		offset = 0
	): Promise<ChatMessage[]> {
		try {
			const collection = await this.getChatMessagesCollection();
			return await collection
				.find({ threadId })
				.sort({ timestamp: 1 })
				.skip(offset)
				.limit(limit)
				.toArray();
		} catch (error) {
			console.error('Failed to find chat messages by thread ID:', error);
			throw error;
		}
	}

	static async searchChatMessages(query: MessageSearchQuery): Promise<ChatMessage[]> {
		try {
			const collection = await this.getChatMessagesCollection();
			const filter: any = {};

			if (query.threadId) filter.threadId = query.threadId;
			if (query.projectId) filter.projectId = query.projectId;
			if (query.userId) filter.userId = query.userId;
			if (query.role) filter.role = query.role;
			if (query.parentMessageId) filter.parentMessageId = query.parentMessageId;
			if (query.hasFileContext !== undefined) {
				filter.fileContext = query.hasFileContext ? { $exists: true } : { $exists: false };
			}
			if (query.createdAfter) filter.timestamp = { ...filter.timestamp, $gte: query.createdAfter };
			if (query.createdBefore)
				filter.timestamp = { ...filter.timestamp, $lte: query.createdBefore };
			if (query.query) {
				filter.$text = { $search: query.query };
			}

			let sortCriteria: any;
			if (query.sortBy === 'relevance' && query.query) {
				sortCriteria = { score: { $meta: 'textScore' } };
			} else {
				const field = query.sortBy || 'timestamp';
				const order = query.sortOrder === 'asc' ? 1 : -1;
				sortCriteria = { [field]: order };
			}

			return await collection
				.find(filter)
				.sort(sortCriteria)
				.skip(query.offset || 0)
				.limit(query.limit || 50)
				.toArray();
		} catch (error) {
			console.error('Failed to search chat messages:', error);
			throw error;
		}
	}

	static async updateChatMessage(
		id: string,
		updates: Partial<ChatMessage>
	): Promise<ChatMessage | null> {
		try {
			const collection = await this.getChatMessagesCollection();
			const result = await collection.findOneAndUpdate(
				{ id },
				{ $set: { ...updates, updatedAt: new Date() } },
				{ returnDocument: 'after' }
			);
			return result || null;
		} catch (error) {
			console.error('Failed to update chat message:', error);
			throw error;
		}
	}

	static async deleteChatMessage(id: string): Promise<boolean> {
		try {
			const collection = await this.getChatMessagesCollection();
			const result = await collection.deleteOne({ id });
			return result.deletedCount > 0;
		} catch (error) {
			console.error('Failed to delete chat message:', error);
			throw error;
		}
	}

	static async deleteChatMessagesByThreadId(threadId: string): Promise<number> {
		try {
			const collection = await this.getChatMessagesCollection();
			const result = await collection.deleteMany({ threadId });
			return result.deletedCount;
		} catch (error) {
			console.error('Failed to delete chat messages by thread ID:', error);
			throw error;
		}
	}

	static async addMessageReaction(messageId: string, reaction: any): Promise<ChatMessage | null> {
		try {
			const collection = await this.getChatMessagesCollection();
			const result = await collection.findOneAndUpdate(
				{ id: messageId },
				{
					$addToSet: { reactions: reaction },
					$set: { updatedAt: new Date() }
				},
				{ returnDocument: 'after' }
			);
			return result || null;
		} catch (error) {
			console.error('Failed to add message reaction:', error);
			throw error;
		}
	}

	static async removeMessageReaction(
		messageId: string,
		reactionId: string
	): Promise<ChatMessage | null> {
		try {
			const collection = await this.getChatMessagesCollection();
			const result = await collection.findOneAndUpdate(
				{ id: messageId },
				{
					$pull: { reactions: { id: reactionId } },
					$set: { updatedAt: new Date() }
				},
				{ returnDocument: 'after' }
			);
			return result || null;
		} catch (error) {
			console.error('Failed to remove message reaction:', error);
			throw error;
		}
	}

	/**
	 * Get recent messages for a specific project across all threads
	 */
	static async getRecentMessagesForProject(
		projectId: string,
		userId: string,
		limit = 50
	): Promise<ChatMessage[]> {
		try {
			return await this.searchChatMessages({
				projectId,
				userId,
				sortBy: 'timestamp',
				sortOrder: 'desc',
				limit
			});
		} catch (error) {
			console.error('Failed to get recent messages for project:', error);
			throw error;
		}
	}

	// Message Template operations
	static async createMessageTemplate(template: MessageTemplate): Promise<MessageTemplate> {
		try {
			const collection = await this.getMessageTemplatesCollection();
			await collection.insertOne(template);
			return template;
		} catch (error) {
			console.error('Failed to create message template:', error);
			throw error;
		}
	}

	static async findMessageTemplateById(id: string): Promise<MessageTemplate | null> {
		try {
			const collection = await this.getMessageTemplatesCollection();
			return await collection.findOne({ id });
		} catch (error) {
			console.error('Failed to find message template by ID:', error);
			throw error;
		}
	}

	static async findMessageTemplatesByCategory(category: string): Promise<MessageTemplate[]> {
		try {
			const collection = await this.getMessageTemplatesCollection();
			return await collection
				.find({ category: category as any })
				.sort({ usage: -1, name: 1 })
				.toArray();
		} catch (error) {
			console.error('Failed to find message templates by category:', error);
			throw error;
		}
	}

	static async findPopularMessageTemplates(limit = 10): Promise<MessageTemplate[]> {
		try {
			const collection = await this.getMessageTemplatesCollection();
			return await collection.find({}).sort({ usage: -1 }).limit(limit).toArray();
		} catch (error) {
			console.error('Failed to find popular message templates:', error);
			throw error;
		}
	}

	static async incrementMessageTemplateUsage(id: string): Promise<void> {
		try {
			const collection = await this.getMessageTemplatesCollection();
			await collection.updateOne(
				{ id },
				{
					$inc: { usage: 1 },
					$set: { updatedAt: new Date() }
				}
			);
		} catch (error) {
			console.error('Failed to increment message template usage:', error);
			throw error;
		}
	}

	// Thread Template operations
	static async createThreadTemplate(template: ThreadTemplate): Promise<ThreadTemplate> {
		try {
			const collection = await this.getThreadTemplatesCollection();
			await collection.insertOne(template);
			return template;
		} catch (error) {
			console.error('Failed to create thread template:', error);
			throw error;
		}
	}

	static async findThreadTemplateById(id: string): Promise<ThreadTemplate | null> {
		try {
			const collection = await this.getThreadTemplatesCollection();
			return await collection.findOne({ id });
		} catch (error) {
			console.error('Failed to find thread template by ID:', error);
			throw error;
		}
	}

	static async findThreadTemplatesByCategory(category: string): Promise<ThreadTemplate[]> {
		try {
			const collection = await this.getThreadTemplatesCollection();
			return await collection.find({ category }).sort({ usage: -1, name: 1 }).toArray();
		} catch (error) {
			console.error('Failed to find thread templates by category:', error);
			throw error;
		}
	}

	static async incrementThreadTemplateUsage(id: string): Promise<void> {
		try {
			const collection = await this.getThreadTemplatesCollection();
			await collection.updateOne(
				{ id },
				{
					$inc: { usage: 1 },
					$set: { updatedAt: new Date() }
				}
			);
		} catch (error) {
			console.error('Failed to increment thread template usage:', error);
			throw error;
		}
	}

	// Utility methods for chat context management
	static async getThreadContext(threadId: string, messageLimit = 20): Promise<ChatMessage[]> {
		try {
			const collection = await this.getChatMessagesCollection();
			return await collection
				.find({ threadId })
				.sort({ timestamp: -1 })
				.limit(messageLimit)
				.toArray();
		} catch (error) {
			console.error('Failed to get thread context:', error);
			throw error;
		}
	}

	static async exportThreadToMarkdown(threadId: string): Promise<string> {
		try {
			const thread = await this.findChatThreadById(threadId);
			const messages = await this.findChatMessagesByThreadId(threadId);

			if (!thread) throw new Error('Thread not found');

			let markdown = `# ${thread.title}\n\n`;
			if (thread.description) {
				markdown += `${thread.description}\n\n`;
			}

			markdown += `**Created:** ${thread.createdAt.toISOString()}\n`;
			markdown += `**Last Updated:** ${thread.updatedAt.toISOString()}\n`;
			if (thread.tags.length > 0) {
				markdown += `**Tags:** ${thread.tags.join(', ')}\n`;
			}
			markdown += '\n---\n\n';

			for (const message of messages) {
				const timestamp = message.timestamp.toLocaleString();
				const roleIcon =
					message.role === 'user' ? '👤' : message.role === 'assistant' ? '🤖' : '⚙️';

				markdown += `## ${roleIcon} ${message.role.charAt(0).toUpperCase() + message.role.slice(1)} - ${timestamp}\n\n`;

				if (message.fileContext) {
					markdown += `*Context: ${message.fileContext.fileName || message.fileContext.filePath}*\n\n`;
				}

				markdown += `${message.contentMarkdown || message.content}\n\n`;

				if (message.metadata?.model) {
					markdown += `*Model: ${message.metadata.model}`;
					if (message.metadata.tokens) {
						markdown += ` | Tokens: ${message.metadata.tokens}`;
					}
					if (message.metadata.latency) {
						markdown += ` | Latency: ${message.metadata.latency}ms`;
					}
					markdown += '*\n\n';
				}

				markdown += '---\n\n';
			}

			return markdown;
		} catch (error) {
			console.error('Failed to export thread to markdown:', error);
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
