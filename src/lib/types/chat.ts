/**
 * Chat and thread management types for Aura IDE
 * Supports threaded conversations with markdown message storage
 */

export interface ChatMessage {
	id: string;
	threadId: string;
	projectId?: string; // Project context for filtering messages
	userId?: string; // User who created the message
	content: string;
	contentMarkdown: string; // Stored markdown version
	role: 'user' | 'assistant' | 'system';
	timestamp: Date;
	isLoading?: boolean;
	parentMessageId?: string; // For threaded replies
	metadata?: {
		model?: string;
		provider?: string;
		tokens?: number;
		cost?: number;
		latency?: number;
		temperature?: number;
		contextFiles?: string[]; // File paths that influenced this message
		systemPromptId?: string;
		errorDetails?: string;
		toolCalls?: Array<{
			name: string;
			arguments: Record<string, any>;
			id: string;
			type: string;
		}>;
		hasToolCalls?: boolean;
		toolCallCount?: number;
		toolResults?: Array<{
			tool_call_id?: string;
			tool_name?: string;
			content: any;
			success: boolean;
			message: string;
		}>;
		interruptAction?: string;
		appliedEdits?: number;
		agentInterrupt?: {
			toolCalls: Array<{
				name: string;
				parameters: Record<string, any>;
				id?: string;
			}>;
			stateSnapshot?: {
				currentFile?: string | null;
				sandboxId?: string | null;
				fileContent?: string | null;
			};
			reason?: string;
		};
	};
	fileContext?: {
		fileName?: string;
		filePath?: string;
		language?: string;
		lineRange?: {
			start: number;
			end: number;
		};
	};
	reactions?: MessageReaction[];
	editHistory?: MessageEdit[];
	createdAt: Date;
	updatedAt: Date;
}

export interface MessageReaction {
	id: string;
	userId: string;
	emoji: string;
	timestamp: Date;
}

export interface MessageEdit {
	id: string;
	previousContent: string;
	previousContentMarkdown: string;
	editedAt: Date;
	reason?: string;
}

export interface ChatThread {
	id: string;
	projectId?: string;
	userId: string;
	title: string;
	description?: string;
	parentThreadId?: string; // For nested thread hierarchies
	isArchived: boolean;
	isPinned: boolean;
	tags: string[];
	participants: ThreadParticipant[];
	settings: ThreadSettings;
	statistics: ThreadStatistics;
	createdAt: Date;
	updatedAt: Date;
	lastMessageAt?: Date;
}

export interface ThreadParticipant {
	userId: string;
	role: 'owner' | 'collaborator' | 'viewer';
	joinedAt: Date;
	lastReadAt?: Date;
	permissions: ThreadPermissions;
}

export interface ThreadPermissions {
	canWrite: boolean;
	canDelete: boolean;
	canManageParticipants: boolean;
	canEditSettings: boolean;
}

export interface ThreadSettings {
	isPublic: boolean;
	allowGuestMessages: boolean;
	autoArchiveAfterDays?: number;
	maxMessagesPerHour?: number;
	enableMarkdownRendering: boolean;
	defaultModel?: string;
	defaultTemperature?: number;
	systemPromptId?: string;
	contextWindowSize: number;
}

export interface ThreadStatistics {
	messageCount: number;
	participantCount: number;
	totalTokensUsed: number;
	totalCost: number;
	averageResponseTime: number;
	lastActivityAt?: Date;
}

export interface ChatContext {
	threadId: string;
	recentMessages: ChatMessage[];
	contextFiles: ContextFile[];
	systemPrompt?: string;
	variables?: Record<string, any>;
}

export interface ContextFile {
	path: string;
	content: string;
	language: string;
	relevanceScore: number;
	includedAt: Date;
	lineRange?: {
		start: number;
		end: number;
	};
}

export interface ThreadSearchQuery {
	userId?: string;
	projectId?: string;
	query?: string;
	tags?: string[];
	isArchived?: boolean;
	isPinned?: boolean;
	createdAfter?: Date;
	createdBefore?: Date;
	hasMessages?: boolean;
	sortBy?: 'createdAt' | 'updatedAt' | 'lastMessageAt' | 'messageCount';
	sortOrder?: 'asc' | 'desc';
	limit?: number;
	offset?: number;
}

export interface MessageSearchQuery {
	threadId?: string;
	projectId?: string; // Filter messages by project
	userId?: string;
	query?: string;
	role?: ChatMessage['role'];
	hasFileContext?: boolean;
	createdAfter?: Date;
	createdBefore?: Date;
	parentMessageId?: string;
	sortBy?: 'timestamp' | 'relevance';
	sortOrder?: 'asc' | 'desc';
	limit?: number;
	offset?: number;
}

export interface ThreadExport {
	thread: ChatThread;
	messages: ChatMessage[];
	exportedAt: Date;
	format: 'markdown' | 'json' | 'html';
	includeMetadata: boolean;
}

export interface MessageTemplate {
	id: string;
	name: string;
	content: string;
	contentMarkdown: string;
	category: 'code-review' | 'debugging' | 'documentation' | 'general' | 'custom';
	variables: string[];
	usage: number;
	createdBy: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface ThreadTemplate {
	id: string;
	name: string;
	description: string;
	defaultSettings: ThreadSettings;
	initialMessages: Pick<ChatMessage, 'content' | 'contentMarkdown' | 'role'>[];
	category: string;
	tags: string[];
	usage: number;
	createdBy: string;
	createdAt: Date;
	updatedAt: Date;
}
