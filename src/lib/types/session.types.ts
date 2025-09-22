// types/session.types.ts
export interface SessionMetadata {
	userId?: string;
	agentId?: string;
	sessionName?: string;
	sessionPath?: string;
	messageCount: number;
	totalTokens: number;
	totalCost: number;
	customProperties: Record<string, any>;
	tags: string[];
}

export interface Session {
	id: string;
	name?: string;
	path?: string;
	metadata: SessionMetadata;
	createdAt: Date;
	lastActiveAt: Date;
	expiresAt?: Date;
	status: 'active' | 'inactive' | 'expired';
}

export interface MemoryItem {
	id: string;
	sessionId: string;
	namespace: string[];
	key: string;
	content: any;
	type: 'conversation' | 'summary' | 'entity' | 'custom';
	createdAt: Date;
	updatedAt: Date;
	metadata?: Record<string, any>;
}

export interface SessionConfig {
	maxAge?: number; // in seconds
	maxMessages?: number;
	persistMemory: boolean;
	memoryTypes: ('conversation' | 'summary' | 'entity')[];
	storageBackend: 'memory' | 'redis' | 'postgres' | 'file';
}
