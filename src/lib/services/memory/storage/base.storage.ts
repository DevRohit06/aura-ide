import type { MemoryItem, Session } from '@/types/session.types';

// memory/storage/base.storage.ts
export abstract class BaseStorage {
	abstract getSession(sessionId: string): Promise<Session | null>;
	abstract createSession(session: Omit<Session, 'id' | 'createdAt'>): Promise<Session>;
	abstract updateSession(sessionId: string, updates: Partial<Session>): Promise<Session>;
	abstract deleteSession(sessionId: string): Promise<boolean>;
	abstract listSessions(userId?: string): Promise<Session[]>;

	abstract getMemory(sessionId: string, namespace: string[], key?: string): Promise<MemoryItem[]>;
	abstract setMemory(
		memory: Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt'>
	): Promise<MemoryItem>;
	abstract deleteMemory(sessionId: string, memoryId: string): Promise<boolean>;
	abstract searchMemory(sessionId: string, query: string, limit?: number): Promise<MemoryItem[]>;
}
