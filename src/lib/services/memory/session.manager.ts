// memory/session.manager.ts
import { MemorySaver } from '@langchain/langgraph';
import type {
	MemoryItem,
	Session,
	SessionConfig,
	SessionMetadata
} from '../../types/session.types';
import { BaseStorage } from './storage/base.storage';
import { MemoryStorage } from './storage/memory.storage';
import { RedisStorage } from './storage/redis.storage';

export class SessionManager {
	private storage: BaseStorage;
	private config: SessionConfig;
	private memorySaver: MemorySaver;

	constructor(config: SessionConfig) {
		this.config = {
			maxAge: 24 * 60 * 60, // 24 hours default
			maxMessages: 1000,
			persistMemory: true,
			memoryTypes: ['conversation'],
			storageBackend: 'memory',
			...config
		};

		this.storage = this.initializeStorage();
		this.memorySaver = new MemorySaver();
	}

	private initializeStorage(): BaseStorage {
		switch (this.config.storageBackend) {
			case 'redis':
				return new RedisStorage();
			case 'memory':
			default:
				return new MemoryStorage();
		}
	}

	/**
	 * Get or create a session
	 */
	async getOrCreateSession(
		sessionId?: string,
		options?: {
			name?: string;
			path?: string;
			userId?: string;
			agentId?: string;
			customProperties?: Record<string, any>;
		}
	): Promise<Session> {
		if (sessionId) {
			const existing = await this.storage.getSession(sessionId);
			if (existing) {
				// Update last active time
				return this.storage.updateSession(sessionId, {
					lastActiveAt: new Date()
				});
			}
		}

		// Create new session
		const newSessionData = {
			name: options?.name,
			path: options?.path,
			metadata: {
				userId: options?.userId,
				agentId: options?.agentId,
				messageCount: 0,
				totalTokens: 0,
				totalCost: 0,
				customProperties: options?.customProperties || {},
				tags: []
			} as SessionMetadata,
			lastActiveAt: new Date(),
			expiresAt: this.config.maxAge ? new Date(Date.now() + this.config.maxAge * 1000) : undefined,
			status: 'active' as const
		};

		return this.storage.createSession(newSessionData);
	}

	/**
	 * Update session with usage metrics
	 */
	async updateSessionMetrics(
		sessionId: string,
		metrics: {
			messageCount?: number;
			tokenUsage?: number;
			cost?: number;
			customProperties?: Record<string, any>;
		}
	): Promise<Session> {
		const session = await this.storage.getSession(sessionId);
		if (!session) {
			throw new Error(`Session ${sessionId} not found`);
		}

		const updatedMetadata: SessionMetadata = {
			...session.metadata,
			messageCount: (session.metadata.messageCount || 0) + (metrics.messageCount || 0),
			totalTokens: (session.metadata.totalTokens || 0) + (metrics.tokenUsage || 0),
			totalCost: (session.metadata.totalCost || 0) + (metrics.cost || 0),
			customProperties: {
				...session.metadata.customProperties,
				...metrics.customProperties
			}
		};

		return this.storage.updateSession(sessionId, {
			metadata: updatedMetadata
		});
	}

	/**
	 * Store conversation memory
	 */
	async storeConversationMemory(
		sessionId: string,
		messages: Array<{ role: string; content: string; timestamp?: Date }>,
		type: 'conversation' | 'summary' | 'entity' = 'conversation'
	): Promise<MemoryItem> {
		if (!this.config.persistMemory) {
			throw new Error('Memory persistence is disabled');
		}

		const namespace = [sessionId, 'conversation', type];
		const key = `messages_${Date.now()}`;

		return this.storage.setMemory({
			sessionId,
			namespace,
			key,
			content: {
				messages,
				type,
				timestamp: new Date()
			},
			type
		});
	}

	/**
	 * Store entity memory (facts about users, preferences, etc.)
	 */
	async storeEntityMemory(
		sessionId: string,
		entityType: string,
		entityId: string,
		facts: Record<string, any>
	): Promise<MemoryItem> {
		if (!this.config.persistMemory) {
			throw new Error('Memory persistence is disabled');
		}

		const namespace = [sessionId, 'entities', entityType];
		const key = entityId;

		return this.storage.setMemory({
			sessionId,
			namespace,
			key,
			content: {
				entityType,
				entityId,
				facts,
				lastUpdated: new Date()
			},
			type: 'entity'
		});
	}

	/**
	 * Retrieve conversation history
	 */
	async getConversationHistory(sessionId: string, limit?: number): Promise<MemoryItem[]> {
		const namespace = [sessionId, 'conversation'];
		const memories = await this.storage.getMemory(sessionId, namespace);

		// Sort by creation date and limit if specified
		const sorted = memories.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

		return limit ? sorted.slice(0, limit) : sorted;
	}

	/**
	 * Search memories by content
	 */
	async searchMemories(sessionId: string, query: string, limit = 10): Promise<MemoryItem[]> {
		return this.storage.searchMemory(sessionId, query, limit);
	}

	/**
	 * Get entity memories
	 */
	async getEntityMemories(sessionId: string, entityType?: string): Promise<MemoryItem[]> {
		const namespace = entityType ? [sessionId, 'entities', entityType] : [sessionId, 'entities'];

		return this.storage.getMemory(sessionId, namespace);
	}

	/**
	 * Clean up expired sessions
	 */
	async cleanupExpiredSessions(): Promise<number> {
		const sessions = await this.storage.listSessions();
		let cleaned = 0;

		for (const session of sessions) {
			if (session.expiresAt && session.expiresAt < new Date()) {
				await this.storage.deleteSession(session.id);
				cleaned++;
			}
		}

		return cleaned;
	}

	/**
	 * Get session statistics
	 */
	async getSessionStats(sessionId: string): Promise<{
		messageCount: number;
		totalTokens: number;
		totalCost: number;
		memoryItems: number;
		duration: number; // in milliseconds
	}> {
		const session = await this.storage.getSession(sessionId);
		if (!session) {
			throw new Error(`Session ${sessionId} not found`);
		}

		const memories = await this.storage.getMemory(sessionId, []);

		return {
			messageCount: session.metadata.messageCount,
			totalTokens: session.metadata.totalTokens,
			totalCost: session.metadata.totalCost,
			memoryItems: memories.length,
			duration: session.lastActiveAt.getTime() - session.createdAt.getTime()
		};
	}

	/**
	 * Export session data
	 */
	async exportSession(sessionId: string): Promise<{
		session: Session;
		memories: MemoryItem[];
	}> {
		const session = await this.storage.getSession(sessionId);
		if (!session) {
			throw new Error(`Session ${sessionId} not found`);
		}

		const memories = await this.storage.getMemory(sessionId, []);

		return { session, memories };
	}

	/**
	 * Delete session and all associated data
	 */
	async deleteSession(sessionId: string): Promise<boolean> {
		return this.storage.deleteSession(sessionId);
	}

	/**
	 * List sessions for a user
	 */
	async getUserSessions(userId: string): Promise<Session[]> {
		return this.storage.listSessions(userId);
	}

	/**
	 * Get LangGraph checkpointer for this session
	 */
	getCheckpointer(): MemorySaver {
		return this.memorySaver;
	}

	/**
	 * Cleanup resources
	 */
	async cleanup(): Promise<void> {
		if (this.storage instanceof RedisStorage) {
			await this.storage.disconnect();
		}
	}
}
