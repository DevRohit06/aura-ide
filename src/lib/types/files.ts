// Base file system item
export interface FileSystemItem {
	id: string;
	name: string;
	path: string;
	content: string;
	parentId: string | null;
	type: 'file' | 'directory';
	createdAt: Date;
	modifiedAt: Date;
	size?: number;
	permissions: FilePermissions;
}

// File-specific interface
export interface File extends FileSystemItem {
	type: 'file';
	content: string;
	language: string;
	encoding: 'utf-8' | 'ascii' | 'base64';
	mimeType: string;
	isDirty: boolean;
	isReadOnly: boolean;
	metadata: FileMetadata;
	editorState?: EditorState;
	aiContext?: AIContext;
}

// Directory-specific interface
export interface Directory extends FileSystemItem {
	type: 'directory';
	children: string[]; // Array of child IDs
	isExpanded: boolean;
	isRoot: boolean;
}

// File permissions
export interface FilePermissions {
	read: boolean;
	write: boolean;
	execute: boolean;
	delete: boolean;
	share: boolean;
	owner: string;
	collaborators: Collaborator[];
}

// File metadata
export interface FileMetadata {
	extension: string;
	lineCount: number;
	characterCount: number;
	wordCount: number;
	lastCursor: CursorPosition | null;
	bookmarks: Bookmark[];
	breakpoints: Breakpoint[];
	folds: FoldRange[];
	searchHistory: string[];
}

// Editor state for persistence
export interface EditorState {
	scrollTop: number;
	scrollLeft: number;
	selection: SelectionRange[];
	foldState: FoldState[];
	searchState?: SearchState;
	viewportState: ViewportState;
}

// AI context for intelligent assistance
export interface AIContext {
	embedding?: number[]; // Vector embedding for RAG
	lastAnalyzed: Date;
	complexity: number; // Code complexity score
	dependencies: string[]; // Extracted dependencies
	exports: string[]; // Exported functions/classes
	imports: string[]; // Imported modules
	functions: FunctionSignature[];
	classes: ClassSignature[];
	comments: CommentBlock[];
	todos: TodoItem[];
}

// Supporting interfaces
export interface Collaborator {
	userId: string;
	username: string;
	avatar: string;
	role: 'owner' | 'editor' | 'viewer';
	isActive: boolean;
	cursor?: CursorPosition;
	selection?: SelectionRange;
	color: string; // For collaborative cursors
}

export interface CursorPosition {
	line: number;
	column: number;
	timestamp: Date;
}

export interface SelectionRange {
	start: CursorPosition;
	end: CursorPosition;
	direction: 'forward' | 'backward';
}

export interface Bookmark {
	id: string;
	line: number;
	column: number;
	label: string;
	createdAt: Date;
}

export interface Breakpoint {
	id: string;
	line: number;
	condition?: string;
	isEnabled: boolean;
	hitCount: number;
}

export interface FoldRange {
	from: number;
	to: number;
	isCollapsed: boolean;
}

export interface FoldState {
	from: number;
	to: number;
	placeholder?: string;
}

export interface SearchState {
	query: string;
	caseSensitive: boolean;
	wholeWord: boolean;
	regex: boolean;
	replaceText?: string;
}

export interface ViewportState {
	visibleFrom: number;
	visibleTo: number;
	centerLine: number;
}

export interface FunctionSignature {
	name: string;
	line: number;
	parameters: Parameter[];
	returnType?: string;
	visibility: 'public' | 'private' | 'protected';
	isAsync: boolean;
	isGenerator: boolean;
	documentation?: string;
}

export interface ClassSignature {
	name: string;
	line: number;
	extends?: string;
	implements?: string[];
	methods: FunctionSignature[];
	properties: PropertySignature[];
	visibility: 'public' | 'private' | 'protected';
	documentation?: string;
}

export interface Parameter {
	name: string;
	type?: string;
	defaultValue?: string;
	isOptional: boolean;
	isRest: boolean;
}

export interface PropertySignature {
	name: string;
	line: number;
	type?: string;
	visibility: 'public' | 'private' | 'protected';
	isStatic: boolean;
	isReadonly: boolean;
	documentation?: string;
}

export interface CommentBlock {
	line: number;
	content: string;
	type: 'line' | 'block' | 'doc';
}

export interface TodoItem {
	line: number;
	type: 'TODO' | 'FIXME' | 'NOTE' | 'HACK' | 'XXX';
	content: string;
	assignee?: string;
	priority: 'low' | 'medium' | 'high';
	createdAt: Date;
}

// Project structure
export interface Project {
	id: string;
	name: string;
	description: string;
	rootDirectory: string;
	files: Map<string, File>;
	directories: Map<string, Directory>;
	framework: Framework;
	dependencies: Dependency[];
	scripts: ProjectScript[];
	environment: Environment;
	settings: ProjectSettings;
	collaboration: CollaborationSettings;
	createdAt: Date;
	modifiedAt: Date;
	owner: string;
	isPublic: boolean;
}

export interface Framework {
	name: string;
	version: string;
	template: string;
	buildTool: string;
	packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
}

export interface Dependency {
	name: string;
	version: string;
	type: 'dependency' | 'devDependency' | 'peerDependency';
	isInstalled: boolean;
}

export interface ProjectScript {
	name: string;
	command: string;
	description?: string;
	environment?: string;
}

export interface Environment {
	nodeVersion?: string;
	pythonVersion?: string;
	variables: Record<string, string>;
	secrets: Record<string, string>; // Encrypted
}

export interface ProjectSettings {
	autoSave: boolean;
	autoSaveDelay: number;
	formatOnSave: boolean;
	linting: boolean;
	typeChecking: boolean;
	aiAssistance: boolean;
	tabSize: number;
	insertSpaces: boolean;
	wordWrap: boolean;
	theme: 'light' | 'dark' | 'system';
	fontFamily: string;
	fontSize: number;
	lineHeight: number;
}

export interface CollaborationSettings {
	isEnabled: boolean;
	maxCollaborators: number;
	allowAnonymous: boolean;
	permissions: CollaborationPermissions;
}

export interface CollaborationPermissions {
	canEdit: boolean;
	canComment: boolean;
	canShare: boolean;
	canExport: boolean;
}
