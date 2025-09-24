import type { EditorState } from './editor-state';
import type { File, FileMetadata, FileSystemItem } from './files';

// File operation types
export type FileOperation =
	| { type: 'create'; data: CreateFileData }
	| { type: 'update'; data: UpdateFileData }
	| { type: 'delete'; data: DeleteFileData }
	| { type: 'rename'; data: RenameFileData }
	| { type: 'move'; data: MoveFileData }
	| { type: 'copy'; data: CopyFileData };

export interface CreateFileData {
	name: string;
	path: string;
	type: 'file' | 'directory';
	content?: string;
	template?: string;
}

export interface UpdateFileData {
	id: string;
	content?: string;
	metadata?: Partial<FileMetadata>;
	editorState?: Partial<EditorState>;
}

export interface DeleteFileData {
	id: string;
	confirm: boolean;
}

export interface RenameFileData {
	id: string;
	newName: string;
}

export interface MoveFileData {
	id: string;
	newParentId: string;
	newPath: string;
}

export interface CopyFileData {
	id: string;
	newName: string;
	newParentId: string;
}

// File tree representation
export interface FileTreeNode {
	item: FileSystemItem;
	children: FileTreeNode[];
	isExpanded: boolean;
	depth: number;
	hasChildren: boolean;
}

// Search and filter types
export interface FileSearchOptions {
	query: string;
	includeContent: boolean;
	caseSensitive: boolean;
	regex: boolean;
	wholeWord: boolean;
	useRegex: boolean;
	fileTypes: string[];
	excludePatterns: string[];
	maxResults: number;
}

export interface FileSearchResult {
	file: File;
	matches: SearchMatch[];
	score: number;
	preview: string;
}

export interface SearchMatch {
	line: number;
	column: number;
	text: string;
	length: number;
	context: string;
}

// File validation
export interface FileValidationResult {
	isValid: boolean;
	errors: FileValidationError[];
	warnings: FileValidationWarning[];
}

export interface FileValidationError {
	type: 'syntax' | 'type' | 'lint' | 'security';
	message: string;
	line?: number;
	column?: number;
	severity: 'error' | 'warning' | 'info';
	source: string;
}

export interface FileValidationWarning {
	type: 'deprecated' | 'performance' | 'best-practice';
	message: string;
	line?: number;
	column?: number;
	suggestion?: string;
}
