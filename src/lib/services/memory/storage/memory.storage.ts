// memory/storage/memory.storage.ts
import type { MemoryItem, Session } from '../../../types/session.types';
import { BaseStorage } from './base.storage';

export class MemoryStorage extends BaseStorage {
	private sessions = new Map<string, Session>();
	private memories = new Map<string, MemoryItem[]>();

	async getSession(sessionId: string): Promise<Session | null> {
		const session = this.sessions.get(sessionId);
		if (!session) return null;

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

		this.sessions.set(session.id, session);
		this.memories.set(session.id, []);

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

		this.sessions.set(sessionId, updated);
		return updated;
	}

	async deleteSession(sessionId: string): Promise<boolean> {
		const deleted = this.sessions.delete(sessionId);
		this.memories.delete(sessionId);
		return deleted;
	}

	async listSessions(userId?: string): Promise<Session[]> {
		const sessions = Array.from(this.sessions.values());

		if (userId) {
			return sessions.filter((session) => session.metadata.userId === userId);
		}

		return sessions;
	}

	async getMemory(sessionId: string, namespace: string[], key?: string): Promise<MemoryItem[]> {
		const sessionMemories = this.memories.get(sessionId) || [];

		let filtered = sessionMemories.filter((memory) =>
			this.namespaceMatches(memory.namespace, namespace)
		);

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

		const sessionMemories = this.memories.get(memoryData.sessionId) || [];
		sessionMemories.push(memory);
		this.memories.set(memoryData.sessionId, sessionMemories);

		return memory;
	}

	async deleteMemory(sessionId: string, memoryId: string): Promise<boolean> {
		const sessionMemories = this.memories.get(sessionId) || [];
		const initialLength = sessionMemories.length;

		const filtered = sessionMemories.filter((memory) => memory.id !== memoryId);
		this.memories.set(sessionId, filtered);

		return filtered.length < initialLength;
	}

	async searchMemory(sessionId: string, query: string, limit = 10): Promise<MemoryItem[]> {
		const sessionMemories = this.memories.get(sessionId) || [];

		// Simple text-based search (in production, use vector search)
		const matches = sessionMemories.filter((memory) => {
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
}
