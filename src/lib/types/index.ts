export interface User {
	id: string;
	email: string;
	username: string;
	passwordHash: string;
	profile: UserProfile;
	preferences: UserPreferences;
	createdAt: Date;
	updatedAt: Date;
}

export interface UserProfile {
	firstName?: string;
	lastName?: string;
	avatar?: string;
	githubId?: string;
	discordId?: string;
}

export interface UserPreferences {
	theme: 'light' | 'dark' | 'system';
	defaultFramework: Framework;
	editorSettings: EditorSettings;
}

export interface EditorSettings {
	fontSize: number;
	fontFamily: string;
	tabSize: number;
	wordWrap: boolean;
	autoSave: boolean;
	theme: string;
	keyBindings: 'default' | 'vim' | 'emacs';
}

// Auth related types
export interface AuthTokens {
	accessToken: string;
	refreshToken: string;
}

export interface JWTPayload {
	userId: string;
	email: string;
	username: string;
	iat: number;
	exp: number;
}

export interface LoginRequest {
	email: string;
	password: string;
}

export interface RegisterRequest {
	email: string;
	username: string;
	password: string;
	firstName?: string;
	lastName?: string;
}

export interface AuthResponse {
	success: boolean;
	user: Omit<User, 'passwordHash'>;
	accessToken: string;
	refreshToken: string;
}

export interface RefreshRequest {
	refreshToken: string;
}

// Framework types
export type Framework =
	| 'react'
	| 'nextjs'
	| 'svelte'
	| 'vue'
	| 'angular'
	| 'astro'
	| 'vite'
	| 'express'
	| 'node'
	| 'javascript'
	| 'typescript'
	| 'static'
	| 'bootstrap';

export interface Project {
	id: string;
	name: string;
	description?: string;
	ownerId: string;
	framework: Framework;
	configuration: ProjectConfiguration;
	status: 'initializing' | 'ready' | 'error';
	sandboxProvider?: 'daytona';
	sandboxId?: string;
	createdAt: Date;
	updatedAt: Date;
	metadata?: Record<string, any>;
}

export interface ProjectConfiguration {
	typescript: boolean;
	eslint: boolean;
	prettier: boolean;
	tailwindcss: boolean;
	packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
	additionalDependencies: string[];
}

export interface FrameworkDefinition {
	id: Framework;
	name: string;
	version: string;
	description: string;
	template: string;
	starterRepo?: string; // Git repository URL for starter templates
	starterPath?: string; // Path within the starter repo (for StackBlitz starters)
}

// Session types
export interface Session {
	id: string;
	userId: string;
	projectId?: string;
	type: 'auth' | 'project' | 'editor' | 'ai-agent';
	status: 'active' | 'idle' | 'terminated';
	data: Record<string, any>;
	expiresAt: Date;
	createdAt: Date;
	lastAccessedAt: Date;
}

export interface EditorSession {
	id: string;
	projectId: string;
	userId: string;
	sandboxSessionId: string;
	activeFiles: string[];
	terminalSessions: TerminalSession[];
	aiConversationId?: string;
	status: 'connected' | 'disconnected' | 'error';
}

export interface TerminalSession {
	id: string;
	pid: number;
	cwd: string;
	command?: string;
	status: 'active' | 'completed' | 'error';
	createdAt: Date;
}

export interface SandboxSessionConfig {
	timeout: number;
	environment: Record<string, string>;
}

export interface EditorSessionState {
	files: FileSystemTree;
	terminals: TerminalSession[];
	processes: ProcessInfo[];
	ports: PortInfo[];
}

export interface FileSystemTree {
	[path: string]: {
		type: 'file' | 'directory';
		content?: string;
		size?: number;
		modified?: Date;
		permissions?: string;
	};
}

export interface ProcessInfo {
	pid: number;
	name: string;
	status: 'running' | 'stopped' | 'zombie';
	cpu: number;
	memory: number;
}

export interface PortInfo {
	port: number;
	status: 'open' | 'closed';
	process?: string;
	url?: string;
}

// AI Agent types
export interface AIAgentSession {
	id: string;
	projectId: string;
	conversationId: string;
	agentType: 'general' | 'code-reviewer' | 'debugger' | 'documentation';
	state: any; // LangGraphState
	tools: ToolConfiguration[];
}

export interface ToolConfiguration {
	name: string;
	description: string;
	parameters: Record<string, any>;
	enabled: boolean;
}

// API Response types
export interface ApiResponse<T = any> {
	success: boolean;
	data?: T;
	error?: string;
	message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
	pagination: {
		page: number;
		limit: number;
		total: number;
		pages: number;
	};
}

// Error types
export interface ApiError {
	code: string;
	message: string;
	details?: any;
}

export interface ValidationError extends ApiError {
	field: string;
	value: any;
}

// Re-export Chat types
export * from './chat.js';
