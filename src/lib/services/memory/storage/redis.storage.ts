// memory/storage/redis.storage.ts
import Redis from 'ioredis';
import type { MemoryItem, Session } from '../../../types/session.types';
import { BaseStorage } from './base.storage';

export class RedisStorage extends BaseStorage {
	private redis: Redis;
	private keyPrefix: string;

	constructor(redisUrl?: string, keyPrefix = 'llm_service') {
		super();
		this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
		this.keyPrefix = keyPrefix;
	}

	private getSessionKey(sessionId: string): string {
		return `${this.keyPrefix}:session:${sessionId}`;
	}

	private getMemoryKey(sessionId: string): string {
		return `${this.keyPrefix}:memory:${sessionId}`;
	}

	private getUserSessionsKey(userId: string): string {
		return `${this.keyPrefix}:user_sessions:${userId}`;
	}

	async getSession(sessionId: string): Promise<Session | null> {
		const sessionData = await this.redis.get(this.getSessionKey(sessionId));

		if (!sessionData) return null;

		const session = JSON.parse(sessionData) as Session;

		// Convert date strings back to Date objects
		session.createdAt = new Date(session.createdAt);
		session.lastActiveAt = new Date(session.lastActiveAt);
		if (session.expiresAt) session.expiresAt = new Date(session.expiresAt);

		// Check if session is expired
		if (session.expiresAt && session.expiresAt < new Date()) {
			await this.deleteSession(sessionId);
			return null;
		}

		return session;
	}

	async createSession(sessionData: Omit<Session, 'id' | 'createdAt'>): Promise<Session> {
		const session: Session = {
			...sessionData,
			id: this.generateSessionId(),
			createdAt: new Date(),
			status: 'active'
		};

		// Store session
		await this.redis.set(this.getSessionKey(session.id), JSON.stringify(session));

		// Set expiration if specified
		if (session.expiresAt) {
			await this.redis.expireat(
				this.getSessionKey(session.id),
				Math.floor(session.expiresAt.getTime() / 1000)
			);
		}

		// Add to user sessions if userId is provided
		if (session.metadata.userId) {
			await this.redis.sadd(this.getUserSessionsKey(session.metadata.userId), session.id);
		}

		return session;
	}

	async updateSession(sessionId: string, updates: Partial<Session>): Promise<Session> {
		const existing = await this.getSession(sessionId);
		if (!existing) {
			throw new Error(`Session ${sessionId} not found`);
		}

		const updated = {
			...existing,
			...updates,
			lastActiveAt: new Date()
		};

		await this.redis.set(this.getSessionKey(sessionId), JSON.stringify(updated));

		return updated;
	}

	async deleteSession(sessionId: string): Promise<boolean> {
		const session = await this.getSession(sessionId);

		// Remove session
		const sessionDeleted = await this.redis.del(this.getSessionKey(sessionId));

		// Remove memories
		await this.redis.del(this.getMemoryKey(sessionId));

		// Remove from user sessions
		if (session?.metadata.userId) {
			await this.redis.srem(this.getUserSessionsKey(session.metadata.userId), sessionId);
		}

		return sessionDeleted > 0;
	}

	async listSessions(userId?: string): Promise<Session[]> {
		if (userId) {
			const sessionIds = await this.redis.smembers(this.getUserSessionsKey(userId));
			const sessions = await Promise.all(sessionIds.map((id) => this.getSession(id)));
			return sessions.filter(Boolean) as Session[];
		}

		// Get all session keys (expensive operation, use with caution)
		const keys = await this.redis.keys(`${this.keyPrefix}:session:*`);
		const sessions = await Promise.all(
			keys.map(async (key) => {
				const sessionId = key.split(':').pop()!;
				return this.getSession(sessionId);
			})
		);

		return sessions.filter(Boolean) as Session[];
	}

	async getMemory(sessionId: string, namespace: string[], key?: string): Promise<MemoryItem[]> {
		const memoriesData = await this.redis.hgetall(this.getMemoryKey(sessionId));

		const memories = Object.values(memoriesData)
			.map((data) => JSON.parse(data) as MemoryItem)
			.map((memory) => ({
				...memory,
				createdAt: new Date(memory.createdAt),
				updatedAt: new Date(memory.updatedAt)
			}));

		let filtered = memories.filter((memory) => this.namespaceMatches(memory.namespace, namespace));

		if (key) {
			filtered = filtered.filter((memory) => memory.key === key);
		}

		return filtered;
	}

	async setMemory(
		memoryData: Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt'>
	): Promise<MemoryItem> {
		const memory: MemoryItem = {
			...memoryData,
			id: this.generateMemoryId(),
			createdAt: new Date(),
			updatedAt: new Date()
		};

		await this.redis.hset(
			this.getMemoryKey(memoryData.sessionId),
			memory.id,
			JSON.stringify(memory)
		);

		return memory;
	}

	async deleteMemory(sessionId: string, memoryId: string): Promise<boolean> {
		const deleted = await this.redis.hdel(this.getMemoryKey(sessionId), memoryId);
		return deleted > 0;
	}

	async searchMemory(sessionId: string, query: string, limit = 10): Promise<MemoryItem[]> {
		// For Redis, implement using RediSearch for production
		const memories = await this.getMemory(sessionId, []);

		const matches = memories.filter((memory) => {
			const content = JSON.stringify(memory.content).toLowerCase();
			return content.includes(query.toLowerCase());
		});

		return matches.slice(0, limit);
	}

	private generateSessionId(): string {
		return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	private generateMemoryId(): string {
		return `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	private namespaceMatches(memoryNamespace: string[], targetNamespace: string[]): boolean {
		if (targetNamespace.length > memoryNamespace.length) return false;

		for (let i = 0; i < targetNamespace.length; i++) {
			if (memoryNamespace[i] !== targetNamespace[i]) return false;
		}

		return true;
	}

	async disconnect(): Promise<void> {
		await this.redis.disconnect();
	}
}
