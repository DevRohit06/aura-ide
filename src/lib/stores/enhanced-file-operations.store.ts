import { fileOperationsAPI } from '$lib/services/file-operations-api.service';
import type {
    CreateFileData,
    DeleteFileData,
    FileValidationResult,
    MoveFileData,
    RenameFileData
} from '$lib/types/file-operations';
import type { Directory, File, FileSystemItem } from '$lib/types/files';
import { toast } from 'svelte-sonner';
import { derived, get, writable } from 'svelte/store';
import { fileStateActions } from './file-states.store';
import { fileActions, filesStore } from './files.store';
import { currentSandboxId } from './sandbox.store';
import { tabActions } from './tabs.store';
// Dynamic imports for SSR compatibility
// import { SandboxManager } from '$lib/services/sandbox/sandbox-manager'; // Import dynamically to avoid SSR issues

// Enhanced file operations state
interface FileOperationsState {
	isLoading: boolean;
	currentOperation: string | null;
	operationProgress: number;
	lastError: string | null;
	pendingOperations: FileOperation[];
	recentOperations: FileOperation[];
}

interface FileOperation {
	id: string;
	type: 'create' | 'delete' | 'rename' | 'move' | 'save' | 'saveAll';
	timestamp: Date;
	data: any;
	status: 'pending' | 'success' | 'error';
	error?: string;
}

// Default state
const defaultState: FileOperationsState = {
	isLoading: false,
	currentOperation: null,
	operationProgress: 0,
	lastError: null,
	pendingOperations: [],
	recentOperations: []
};

// File operations store
export const fileOperationsStore = writable<FileOperationsState>(defaultState);

// Derived stores
export const isFileOperationInProgress = derived(fileOperationsStore, ($state) => $state.isLoading);

export const currentFileOperation = derived(
	fileOperationsStore,
	($state) => $state.currentOperation
);

// Utility functions
function generateId(): string {
	return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateFilePath(parentPath: string, fileName: string): string {
	if (parentPath === '/' || parentPath === '') {
		return `/${fileName}`;
	}
	return `${parentPath}/${fileName}`;
}

function validateFileName(name: string): FileValidationResult {
	const errors: any[] = [];
	const warnings: any[] = [];

	// Check for empty name
	if (!name || name.trim().length === 0) {
		errors.push({
			type: 'syntax',
			message: 'File name cannot be empty',
			severity: 'error',
			source: 'validation'
		});
	}

	// Check for invalid characters
	const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
	if (invalidChars.test(name)) {
		errors.push({
			type: 'syntax',
			message: 'File name contains invalid characters',
			severity: 'error',
			source: 'validation'
		});
	}

	// Check for reserved names (Windows)
	const reservedNames = [
		'CON',
		'PRN',
		'AUX',
		'NUL',
		'COM1',
		'COM2',
		'COM3',
		'COM4',
		'COM5',
		'COM6',
		'COM7',
		'COM8',
		'COM9',
		'LPT1',
		'LPT2',
		'LPT3',
		'LPT4',
		'LPT5',
		'LPT6',
		'LPT7',
		'LPT8',
		'LPT9'
	];
	if (reservedNames.includes(name.toUpperCase())) {
		errors.push({
			type: 'syntax',
			message: 'File name is reserved by the system',
			severity: 'error',
			source: 'validation'
		});
	}

	// Check for leading/trailing spaces or dots
	if (name !== name.trim() || name.startsWith('.') || name.endsWith('.')) {
		warnings.push({
			type: 'best-practice',
			message: 'File name should not start/end with spaces or dots',
			suggestion: 'Use a cleaner file name'
		});
	}

	return {
		isValid: errors.length === 0,
		errors,
		warnings
	};
}

function checkFileExists(
	files: Map<string, FileSystemItem>,
	parentId: string | null,
	name: string
): boolean {
	for (const file of files.values()) {
		if (file.parentId === parentId && file.name === name) {
			return true;
		}
	}
	return false;
}

// Helper functions
function getLanguageFromExtension(extension: string): string {
	const languageMap: Record<string, string> = {
		js: 'javascript',
		ts: 'typescript',
		jsx: 'javascript',
		tsx: 'typescript',
		py: 'python',
		html: 'html',
		css: 'css',
		scss: 'scss',
		sass: 'sass',
		json: 'json',
		md: 'markdown',
		yml: 'yaml',
		yaml: 'yaml',
		xml: 'xml',
		svg: 'xml',
		php: 'php',
		rb: 'ruby',
		go: 'go',
		rs: 'rust',
		java: 'java',
		c: 'c',
		cpp: 'cpp',
		h: 'c',
		hpp: 'cpp',
		cs: 'csharp',
		sh: 'shell',
		bash: 'shell',
		zsh: 'shell',
		fish: 'shell',
		sql: 'sql',
		r: 'r',
		swift: 'swift',
		kt: 'kotlin',
		scala: 'scala',
		clj: 'clojure',
		hs: 'haskell',
		elm: 'elm',
		dart: 'dart',
		lua: 'lua',
		pl: 'perl',
		vim: 'vim'
	};

	return languageMap[extension.toLowerCase()] || 'text';
}

function getMimeTypeFromExtension(extension: string): string {
	const mimeMap: Record<string, string> = {
		js: 'application/javascript',
		ts: 'application/typescript',
		jsx: 'application/javascript',
		tsx: 'application/typescript',
		json: 'application/json',
		html: 'text/html',
		css: 'text/css',
		scss: 'text/scss',
		sass: 'text/sass',
		md: 'text/markdown',
		txt: 'text/plain',
		xml: 'application/xml',
		svg: 'image/svg+xml',
		yml: 'application/x-yaml',
		yaml: 'application/x-yaml'
	};

	return mimeMap[extension.toLowerCase()] || 'text/plain';
}

async function updateChildrenPaths(
	files: Map<string, FileSystemItem>,
	parentId: string,
	oldParentPath: string,
	newParentPath: string
): Promise<void> {
	const parent = files.get(parentId) as Directory;
	if (!parent || parent.type !== 'directory') return;

	for (const childId of parent.children) {
		const child = files.get(childId);
		if (!child) continue;

		const newChildPath = child.path.replace(oldParentPath, newParentPath);
		fileActions.updateFile(childId, {
			path: newChildPath,
			modifiedAt: new Date()
		});

		// Recursively update if it's a directory
		if (child.type === 'directory') {
			await updateChildrenPaths(files, childId, child.path, newChildPath);
		}
	}
}

// Helper function to check if a directory is a descendant of another
async function isDescendant(
	files: Map<string, FileSystemItem>,
	potentialDescendantId: string,
	ancestorId: string
): Promise<boolean> {
	let currentId: string | null = potentialDescendantId;

	while (currentId) {
		if (currentId === ancestorId) {
			return true;
		}

		const currentFile = files.get(currentId);
		if (!currentFile) break;

		currentId = currentFile.parentId;
	}

	return false;
}

// Enhanced file operations actions
export const enhancedFileActions = {
	// Set operation state
	setOperationState(updates: Partial<FileOperationsState>) {
		fileOperationsStore.update((state) => ({ ...state, ...updates }));
	},

	// Add operation to history
	addOperation(operation: Omit<FileOperation, 'id' | 'timestamp'>) {
		const fullOperation: FileOperation = {
			...operation,
			id: generateId(),
			timestamp: new Date()
		};

		fileOperationsStore.update((state) => ({
			...state,
			recentOperations: [fullOperation, ...state.recentOperations].slice(0, 50) // Keep last 50 operations
		}));

		return fullOperation.id;
	},

	// Create file or directory
	async createFile(data: CreateFileData): Promise<string | null> {
		try {
			enhancedFileActions.setOperationState({
				isLoading: true,
				currentOperation: 'create',
				operationProgress: 0,
				lastError: null
			});

			// Validate file name
			const validation = validateFileName(data.name);
			if (!validation.isValid) {
				const errorMessage = validation.errors[0]?.message || 'Invalid file name';
				throw new Error(errorMessage);
			}

			// Show warnings if any
			if (validation.warnings.length > 0) {
				validation.warnings.forEach((warning) => {
					toast.warning(warning.message);
				});
			}

			const files = get(filesStore);

			// Find parent directory
			let parentId: string | null = null;
			let parentPath = '/';

			if (data.path !== '/') {
				for (const [id, file] of files) {
					if (file.path === data.path && file.type === 'directory') {
						parentId = id;
						parentPath = file.path;
						break;
					}
				}
			}

			// Check if file already exists
			if (checkFileExists(files, parentId, data.name)) {
				throw new Error(`A file or directory named "${data.name}" already exists`);
			}

			enhancedFileActions.setOperationState({ operationProgress: 30 });

			// Generate new file data
			const fileId = generateId();
			const filePath = generateFilePath(parentPath, data.name);
			const now = new Date();

			const newFile: FileSystemItem = {
				id: fileId,
				name: data.name,
				path: filePath,
				content: data.content || '',
				parentId,
				type: data.type,
				createdAt: now,
				modifiedAt: now,
				permissions: {
					read: true,
					write: true,
					execute: data.type === 'directory',
					delete: true,
					share: false,
					owner: 'current-user',
					collaborators: []
				}
			};

			// Add type-specific properties
			if (data.type === 'file') {
				const fileExtension = data.name.split('.').pop() || '';
				(newFile as File).language = getLanguageFromExtension(fileExtension);
				(newFile as File).encoding = 'utf-8';
				(newFile as File).mimeType = getMimeTypeFromExtension(fileExtension);
				(newFile as File).isDirty = false;
				(newFile as File).isReadOnly = false;
				(newFile as File).metadata = {
					extension: fileExtension,
					lineCount: (data.content || '').split('\n').length,
					characterCount: (data.content || '').length,
					wordCount: (data.content || '').split(/\s+/).filter((w) => w.length > 0).length,
					lastCursor: null,
					bookmarks: [],
					breakpoints: [],
					folds: [],
					searchHistory: []
				};
			} else {
				(newFile as Directory).children = [];
				(newFile as Directory).isExpanded = false;
				(newFile as Directory).isRoot = parentId === null;
			}

			enhancedFileActions.setOperationState({ operationProgress: 60 });

			// Add to store
			fileActions.addFile(newFile);

			// Update parent directory if needed
			if (parentId) {
				const parent = files.get(parentId) as Directory;
				if (parent && parent.type === 'directory') {
					fileActions.updateFile(parentId, {
						children: [...parent.children, fileId],
						modifiedAt: now
					} as any);
				}
			}

			enhancedFileActions.setOperationState({ operationProgress: 90 });

			// Initialize file state if it's a file
			if (data.type === 'file') {
				fileStateActions.initializeFileState(fileId);
			}

			// Record operation
			enhancedFileActions.addOperation({
				type: 'create',
				data,
				status: 'success'
			});

			enhancedFileActions.setOperationState({
				isLoading: false,
				currentOperation: null,
				operationProgress: 100
			});

			toast.success(
				`${data.type === 'file' ? 'File' : 'Directory'} "${data.name}" created successfully`
			);

			return fileId;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to create file';

			enhancedFileActions.setOperationState({
				isLoading: false,
				currentOperation: null,
				operationProgress: 0,
				lastError: errorMessage
			});

			enhancedFileActions.addOperation({
				type: 'create',
				data,
				status: 'error',
				error: errorMessage
			});

			toast.error(errorMessage);
			return null;
		}
	},

	// Delete file or directory with confirmation
	async deleteFile(data: DeleteFileData): Promise<boolean> {
		try {
			const files = get(filesStore);
			const fileToDelete = files.get(data.id);

			if (!fileToDelete) {
				throw new Error('File not found');
			}

			// If confirmation is required and not provided, return false
			if (!data.confirm) {
				return false;
			}

			enhancedFileActions.setOperationState({
				isLoading: true,
				currentOperation: 'delete',
				operationProgress: 0,
				lastError: null
			});

			// Close file if it's open
			if (tabActions.isFileOpen(data.id)) {
				tabActions.closeFile(data.id);
			}

			enhancedFileActions.setOperationState({ operationProgress: 20 });

			// If it's a directory, recursively delete children
			if (fileToDelete.type === 'directory') {
				const directory = fileToDelete as Directory;
				for (const childId of directory.children) {
					await enhancedFileActions.deleteFile({ id: childId, confirm: true });
				}
			}

			enhancedFileActions.setOperationState({ operationProgress: 60 });

			// Remove from parent directory
			if (fileToDelete.parentId) {
				const parent = files.get(fileToDelete.parentId) as Directory;
				if (parent && parent.type === 'directory') {
					fileActions.updateFile(fileToDelete.parentId, {
						children: parent.children.filter((id) => id !== data.id),
						modifiedAt: new Date()
					} as any);
				}
			}

			enhancedFileActions.setOperationState({ operationProgress: 80 });

			// Remove file state
			fileStateActions.removeFileState(data.id);

			// Remove from files store
			fileActions.removeFile(data.id);

			enhancedFileActions.setOperationState({ operationProgress: 100 });

			// Record operation
			enhancedFileActions.addOperation({
				type: 'delete',
				data,
				status: 'success'
			});

			enhancedFileActions.setOperationState({
				isLoading: false,
				currentOperation: null,
				operationProgress: 0
			});

			toast.success(
				`${fileToDelete.type === 'file' ? 'File' : 'Directory'} "${fileToDelete.name}" deleted successfully`
			);

			return true;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to delete file';

			enhancedFileActions.setOperationState({
				isLoading: false,
				currentOperation: null,
				operationProgress: 0,
				lastError: errorMessage
			});

			enhancedFileActions.addOperation({
				type: 'delete',
				data,
				status: 'error',
				error: errorMessage
			});

			toast.error(errorMessage);
			return false;
		}
	},

	// Rename file or directory with validation and conflict resolution
	async renameFile(data: RenameFileData): Promise<boolean> {
		try {
			const files = get(filesStore);
			const fileToRename = files.get(data.id);

			if (!fileToRename) {
				throw new Error('File not found');
			}

			// Validate new name
			const validation = validateFileName(data.newName);
			if (!validation.isValid) {
				const errorMessage = validation.errors[0]?.message || 'Invalid file name';
				throw new Error(errorMessage);
			}

			// Check for conflicts
			if (checkFileExists(files, fileToRename.parentId, data.newName)) {
				throw new Error(`A file or directory named "${data.newName}" already exists`);
			}

			enhancedFileActions.setOperationState({
				isLoading: true,
				currentOperation: 'rename',
				operationProgress: 0,
				lastError: null
			});

			const oldName = fileToRename.name;
			const oldPath = fileToRename.path;
			const newPath = fileToRename.path.replace(new RegExp(`${oldName}$`), data.newName);

			enhancedFileActions.setOperationState({ operationProgress: 30 });

			// Update file properties
			const updates: Partial<FileSystemItem> = {
				name: data.newName,
				path: newPath,
				modifiedAt: new Date()
			};

			// Update file-specific properties if needed
			if (fileToRename.type === 'file') {
				const fileExtension = data.newName.split('.').pop() || '';
				(updates as Partial<File>).metadata = {
					...(fileToRename as File).metadata,
					extension: fileExtension
				};
				(updates as Partial<File>).language = getLanguageFromExtension(fileExtension);
				(updates as Partial<File>).mimeType = getMimeTypeFromExtension(fileExtension);
			}

			fileActions.updateFile(data.id, updates);

			enhancedFileActions.setOperationState({ operationProgress: 60 });

			// If it's a directory, update all children paths recursively
			if (fileToRename.type === 'directory') {
				await updateChildrenPaths(files, data.id, oldPath, newPath);
			}

			enhancedFileActions.setOperationState({ operationProgress: 90 });

			// Record operation
			enhancedFileActions.addOperation({
				type: 'rename',
				data,
				status: 'success'
			});

			enhancedFileActions.setOperationState({
				isLoading: false,
				currentOperation: null,
				operationProgress: 100
			});

			toast.success(`Renamed "${oldName}" to "${data.newName}"`);

			return true;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to rename file';

			enhancedFileActions.setOperationState({
				isLoading: false,
				currentOperation: null,
				operationProgress: 0,
				lastError: errorMessage
			});

			enhancedFileActions.addOperation({
				type: 'rename',
				data,
				status: 'error',
				error: errorMessage
			});

			toast.error(errorMessage);
			return false;
		}
	},

	// Move file or directory for drag-and-drop operations
	async moveFile(data: MoveFileData): Promise<boolean> {
		try {
			const files = get(filesStore);
			const fileToMove = files.get(data.id);
			const newParent = files.get(data.newParentId);

			if (!fileToMove) {
				throw new Error('File not found');
			}

			if (data.newParentId && (!newParent || newParent.type !== 'directory')) {
				throw new Error('Invalid destination directory');
			}

			// Prevent moving a directory into itself or its children
			if (fileToMove.type === 'directory' && data.newParentId) {
				if (await isDescendant(files, data.newParentId, data.id)) {
					throw new Error('Cannot move a directory into itself or its subdirectories');
				}
			}

			// Check for name conflicts in destination
			if (checkFileExists(files, data.newParentId, fileToMove.name)) {
				throw new Error(
					`A file or directory named "${fileToMove.name}" already exists in the destination`
				);
			}

			enhancedFileActions.setOperationState({
				isLoading: true,
				currentOperation: 'move',
				operationProgress: 0,
				lastError: null
			});

			const oldParentId = fileToMove.parentId;
			const oldPath = fileToMove.path;

			enhancedFileActions.setOperationState({ operationProgress: 20 });

			// Remove from old parent
			if (oldParentId) {
				const oldParent = files.get(oldParentId) as Directory;
				if (oldParent && oldParent.type === 'directory') {
					fileActions.updateFile(oldParentId, {
						children: oldParent.children.filter((id) => id !== data.id),
						modifiedAt: new Date()
					} as any);
				}
			}

			enhancedFileActions.setOperationState({ operationProgress: 40 });

			// Add to new parent
			if (data.newParentId) {
				const newParentDir = newParent as Directory;
					fileActions.updateFile(data.newParentId, {
						children: [...newParentDir.children, data.id],
						modifiedAt: new Date()
					} as any);
			}

			enhancedFileActions.setOperationState({ operationProgress: 60 });

			// Update file properties
			fileActions.updateFile(data.id, {
				parentId: data.newParentId,
				path: data.newPath,
				modifiedAt: new Date()
			});

			enhancedFileActions.setOperationState({ operationProgress: 80 });

			// If it's a directory, update all children paths recursively
			if (fileToMove.type === 'directory') {
				await updateChildrenPaths(files, data.id, oldPath, data.newPath);
			}

			// Record operation
			enhancedFileActions.addOperation({
				type: 'move',
				data,
				status: 'success'
			});

			enhancedFileActions.setOperationState({
				isLoading: false,
				currentOperation: null,
				operationProgress: 100
			});

			toast.success(`Moved "${fileToMove.name}" successfully`);

			return true;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to move file';

			enhancedFileActions.setOperationState({
				isLoading: false,
				currentOperation: null,
				operationProgress: 0,
				lastError: errorMessage
			});

			enhancedFileActions.addOperation({
				type: 'move',
				data,
				status: 'error',
				error: errorMessage
			});

			toast.error(errorMessage);
			return false;
		}
	},

	// Save single file using the new API
	async saveFile(fileId: string, projectId?: string): Promise<boolean> {
		try {
			console.log('🔄 Starting file save operation for fileId:', fileId, 'projectId:', projectId);

			const files = get(filesStore);
			const file = files.get(fileId) as File;

			if (!file) {
				console.error('❌ File not found in store:', fileId);
				throw new Error('File not found');
			}

			if (file.type !== 'file') {
				console.error('❌ Cannot save directory:', file);
				throw new Error('Cannot save a directory');
			}

			if (file.isReadOnly) {
				console.error('❌ File is read-only:', file.path);
				throw new Error('File is read-only');
			}

			console.log('📁 File to save:', {
				path: file.path,
				contentLength: file.content?.length || 0
			});

			enhancedFileActions.setOperationState({
				isLoading: true,
				currentOperation: 'save',
				operationProgress: 0,
				lastError: null
			});

			enhancedFileActions.setOperationState({ operationProgress: 30 });

			// Get current sandbox ID
			const sandboxId = get(currentSandboxId);
			console.log('🏗️ Using sandboxId:', sandboxId);

			// Use the new file operations API (only on client side)
			if (typeof window !== 'undefined') {
				console.log('🌐 Making API call to save file...');

				const savePayload = {
					path: file.path,
					content: file.content || '',
					projectId,
					sandboxId: sandboxId || undefined,
					metadata: {
						modifiedAt: new Date().toISOString(),
						size: (file.content || '').length
					}
				};

				console.log('📤 API payload:', {
					...savePayload,
					content: `[${savePayload.content.length} chars]` // Don't log full content
				});

				const result = await fileOperationsAPI.saveFile(savePayload);

				console.log('📥 API response:', result);

				enhancedFileActions.setOperationState({ operationProgress: 80 });

				if (!result.success) {
					console.error('❌ API call failed:', result);
					throw new Error(result.error || 'Failed to save file via API');
				}

				console.log('✅ API call successful - file saved via API');
			} else {
				console.log('🖥️ Running on server side, skipping API call');
			}

			// Update local file state
			const now = new Date();
			fileActions.updateFile(fileId, {
				modifiedAt: now
			});

			// Update file state
			fileStateActions.setFileDirty(fileId, false);

			enhancedFileActions.setOperationState({ operationProgress: 90 });

			// Record operation
			enhancedFileActions.addOperation({
				type: 'save',
				data: { fileId },
				status: 'success'
			});

			enhancedFileActions.setOperationState({
				isLoading: false,
				currentOperation: null,
				operationProgress: 100
			});

			toast.success(`Saved "${file.name}"`);

			return true;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to save file';

			enhancedFileActions.setOperationState({
				isLoading: false,
				currentOperation: null,
				operationProgress: 0,
				lastError: errorMessage
			});

			enhancedFileActions.addOperation({
				type: 'save',
				data: { fileId },
				status: 'error',
				error: errorMessage
			});

			toast.error(errorMessage);
			return false;
		}
	},

	// Save all dirty files
	async saveAllFiles(projectId?: string): Promise<boolean> {
		try {
			const dirtyFiles = fileStateActions.getDirtyFiles();

			if (dirtyFiles.length === 0) {
				toast.info('No files to save');
				return true;
			}

			enhancedFileActions.setOperationState({
				isLoading: true,
				currentOperation: 'saveAll',
				operationProgress: 0,
				lastError: null
			});

			let savedCount = 0;
			const totalFiles = dirtyFiles.length;
			const failedFiles: string[] = [];

			for (const fileId of dirtyFiles) {
				try {
					await enhancedFileActions.saveFile(fileId, projectId);
					savedCount++;
				} catch (error) {
					const files = get(filesStore);
					const file = files.get(fileId);
					failedFiles.push(file?.name || fileId);
				}

				enhancedFileActions.setOperationState({
					operationProgress: Math.round((savedCount / totalFiles) * 100)
				});
			}

			// Record operation
			enhancedFileActions.addOperation({
				type: 'saveAll',
				data: { totalFiles, savedCount, failedFiles },
				status: failedFiles.length === 0 ? 'success' : 'error',
				error: failedFiles.length > 0 ? `Failed to save: ${failedFiles.join(', ')}` : undefined
			});

			enhancedFileActions.setOperationState({
				isLoading: false,
				currentOperation: null,
				operationProgress: 100
			});

			if (failedFiles.length === 0) {
				toast.success(`Saved ${savedCount} file${savedCount !== 1 ? 's' : ''}`);
			} else {
				toast.error(`Saved ${savedCount}/${totalFiles} files. Failed: ${failedFiles.join(', ')}`);
			}

			return failedFiles.length === 0;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to save files';

			enhancedFileActions.setOperationState({
				isLoading: false,
				currentOperation: null,
				operationProgress: 0,
				lastError: errorMessage
			});

			enhancedFileActions.addOperation({
				type: 'saveAll',
				data: {},
				status: 'error',
				error: errorMessage
			});

			toast.error(errorMessage);
			return false;
		}
	},

	// Error recovery mechanisms
	async retryLastOperation(): Promise<boolean> {
		const state = get(fileOperationsStore);
		const lastFailedOperation = state.recentOperations.find((op) => op.status === 'error');

		if (!lastFailedOperation) {
			toast.info('No failed operations to retry');
			return false;
		}

		try {
			switch (lastFailedOperation.type) {
				case 'create':
					return (await enhancedFileActions.createFile(lastFailedOperation.data)) !== null;
				case 'delete':
					return await enhancedFileActions.deleteFile(lastFailedOperation.data);
				case 'rename':
					return await enhancedFileActions.renameFile(lastFailedOperation.data);
				case 'move':
					return await enhancedFileActions.moveFile(lastFailedOperation.data);
				case 'save':
					return await enhancedFileActions.saveFile(lastFailedOperation.data.fileId);
				case 'saveAll':
					return await enhancedFileActions.saveAllFiles();
				default:
					toast.error('Unknown operation type');
					return false;
			}
		} catch (error) {
			toast.error('Retry failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
			return false;
		}
	},

	// Clear error state
	clearError() {
		enhancedFileActions.setOperationState({ lastError: null });
	},

	// Clear operation history
	clearOperationHistory() {
		fileOperationsStore.update((state) => ({
			...state,
			recentOperations: []
		}));
	},

	// Get operation statistics
	getOperationStats() {
		const state = get(fileOperationsStore);
		const total = state.recentOperations.length;
		const successful = state.recentOperations.filter((op) => op.status === 'success').length;
		const failed = state.recentOperations.filter((op) => op.status === 'error').length;
		const pending = state.recentOperations.filter((op) => op.status === 'pending').length;

		return {
			total,
			successful,
			failed,
			pending,
			successRate: total > 0 ? (successful / total) * 100 : 0
		};
	},

	// Bulk operations
	async bulkDelete(fileIds: string[]): Promise<{ successful: string[]; failed: string[] }> {
		const successful: string[] = [];
		const failed: string[] = [];

		for (const fileId of fileIds) {
			try {
				const success = await enhancedFileActions.deleteFile({ id: fileId, confirm: true });
				if (success) {
					successful.push(fileId);
				} else {
					failed.push(fileId);
				}
			} catch (error) {
				failed.push(fileId);
			}
		}

		return { successful, failed };
	},

	// Validation helpers
	validateFileOperation(operation: string, data: any): FileValidationResult {
		const errors: any[] = [];
		const warnings: any[] = [];

		switch (operation) {
			case 'create':
				const createValidation = validateFileName(data.name);
				errors.push(...createValidation.errors);
				warnings.push(...createValidation.warnings);
				break;
			case 'rename':
				const renameValidation = validateFileName(data.newName);
				errors.push(...renameValidation.errors);
				warnings.push(...renameValidation.warnings);
				break;
			// Add more validation cases as needed
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings
		};
	}
};

// Export the enhanced store and actions
export { fileOperationsStore as enhancedFileOperationsStore };
