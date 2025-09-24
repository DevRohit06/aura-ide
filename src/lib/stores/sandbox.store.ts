import type { Directory, File, FileSystemItem } from '$lib/types/files';
import { toast } from 'svelte-sonner';
import { derived, get, writable } from 'svelte/store';
import { fileActions, filesStore } from './files.store';

// Sandbox file operations state
interface SandboxFileState {
	isLoading: boolean;
	currentSandboxId: string | null;
	loadedFiles: Map<string, FileSystemItem>;
	lastSync: Date | null;
}

const defaultState: SandboxFileState = {
	isLoading: false,
	currentSandboxId: null,
	loadedFiles: new Map(),
	lastSync: null
};

// Sandbox file store
export const sandboxFileStore = writable<SandboxFileState>(defaultState);

// Sandbox file actions
export const sandboxFileActions = {
	/**
	 * Load files from sandbox into frontend stores
	 * Mirrors the logic used by sandbox to load files
	 */
	async loadFilesFromSandbox(sandboxId: string, basePath = '/'): Promise<void> {
		sandboxFileStore.update((state) => ({
			...state,
			isLoading: true,
			currentSandboxId: sandboxId
		}));

		try {
			// Fetch file list from sandbox API
			const response = await fetch(
				`/api/sandbox/${sandboxId}/files?path=${encodeURIComponent(basePath)}&recursive=true`
			);

			if (!response.ok) {
				throw new Error(`Failed to fetch files: ${response.statusText}`);
			}

			const data = await response.json();
			const sandboxFiles: FileSystemItem[] = [];

			// Convert sandbox file format to frontend FileSystemItem format
			for (const fileEntry of data.files) {
				const fileItem = await this.convertSandboxFileToFileSystemItem(sandboxId, fileEntry);
				if (fileItem) {
					sandboxFiles.push(fileItem);
				}
			}

			// Update the files store with loaded files
			fileActions.loadFiles(sandboxFiles);

			// Update sandbox file state
			sandboxFileStore.update((state) => ({
				...state,
				isLoading: false,
				loadedFiles: new Map(sandboxFiles.map((file) => [file.id, file])),
				lastSync: new Date()
			}));

			toast.success(`Loaded ${sandboxFiles.length} files from sandbox`);
		} catch (error) {
			console.error('Failed to load files from sandbox:', error);
			sandboxFileStore.update((state) => ({ ...state, isLoading: false }));
			toast.error('Failed to load files from sandbox');
			throw error;
		}
	},

	/**
	 * Load a single file from sandbox
	 * Mirrors the readFile logic from sandbox service
	 */
	async loadFileFromSandbox(sandboxId: string, filePath: string): Promise<File | null> {
		try {
			const response = await fetch(
				`/api/sandbox/${sandboxId}/files/${encodeURIComponent(filePath.slice(1))}`
			);

			if (!response.ok) {
				if (response.status === 404) {
					return null;
				}
				throw new Error(`Failed to fetch file: ${response.statusText}`);
			}

			const data = await response.json();

			const fileItem: File = {
				id: `${sandboxId}:${filePath}`,
				name: filePath.split('/').pop() || 'unknown',
				path: filePath,
				type: 'file',
				content: data.content,
				size: data.size || data.content.length,
				modifiedAt: data.modified ? new Date(data.modified) : new Date(),
				createdAt: new Date(), // Not provided by API
				isDirty: false,
				language: this.detectLanguage(filePath),
				encoding: data.encoding || 'utf-8'
			};

			// Update the files store
			fileActions.addFile(fileItem);

			return fileItem;
		} catch (error) {
			console.error('Failed to load file from sandbox:', error);
			throw error;
		}
	},

	/**
	 * Sync a file back to sandbox
	 * Mirrors the writeFile logic from sandbox service
	 */
	async syncFileToSandbox(sandboxId: string, fileId: string): Promise<void> {
		const files = get(filesStore);
		const file = files.get(fileId);

		if (!file || file.type !== 'file') {
			throw new Error('File not found or not a file');
		}

		const fileData = file as File;

		try {
			const response = await fetch(
				`/api/sandbox/${sandboxId}/files/${encodeURIComponent(file.path.slice(1))}`,
				{
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						content: fileData.content,
						encoding: fileData.encoding || 'utf-8'
					})
				}
			);

			if (!response.ok) {
				throw new Error(`Failed to sync file: ${response.statusText}`);
			}

			// Mark file as clean
			fileActions.setFileDirty(fileId, false);
			toast.success('File synced to sandbox');
		} catch (error) {
			console.error('Failed to sync file to sandbox:', error);
			toast.error('Failed to sync file to sandbox');
			throw error;
		}
	},

	/**
	 * Convert sandbox file entry to FileSystemItem
	 * Helper method to transform sandbox API response to frontend format
	 */
	async convertSandboxFileToFileSystemItem(
		sandboxId: string,
		fileEntry: any
	): Promise<FileSystemItem | null> {
		const path = fileEntry.path;
		const name = path.split('/').pop() || 'unknown';
		const id = `${sandboxId}:${path}`;

		if (fileEntry.type === 'directory') {
			const directory: Directory = {
				id,
				name,
				path,
				type: 'directory',
				children: [],
				expanded: false,
				createdAt: new Date(),
				modifiedAt: fileEntry.modified ? new Date(fileEntry.modified) : new Date()
			};
			return directory;
		} else {
			// For files, we need to fetch content
			try {
				const fileData = await this.loadFileFromSandbox(sandboxId, path);
				return fileData;
			} catch (error) {
				console.warn(`Failed to load file content for ${path}:`, error);
				// Return file without content if loading fails
				const file: File = {
					id,
					name,
					path,
					type: 'file',
					content: '',
					size: fileEntry.size || 0,
					modifiedAt: fileEntry.modified ? new Date(fileEntry.modified) : new Date(),
					createdAt: new Date(),
					isDirty: false,
					language: this.detectLanguage(path),
					encoding: 'utf-8'
				};
				return file;
			}
		}
	},

	/**
	 * Detect programming language from file extension
	 */
	detectLanguage(filePath: string): string {
		const ext = filePath.split('.').pop()?.toLowerCase();
		const languageMap: Record<string, string> = {
			js: 'javascript',
			jsx: 'javascript',
			ts: 'typescript',
			tsx: 'typescript',
			py: 'python',
			java: 'java',
			c: 'c',
			cpp: 'cpp',
			cc: 'cpp',
			cxx: 'cpp',
			h: 'c',
			hpp: 'cpp',
			cs: 'csharp',
			php: 'php',
			rb: 'ruby',
			go: 'go',
			rs: 'rust',
			sh: 'shell',
			bash: 'shell',
			zsh: 'shell',
			fish: 'shell',
			html: 'html',
			css: 'css',
			scss: 'scss',
			sass: 'sass',
			less: 'less',
			json: 'json',
			xml: 'xml',
			yaml: 'yaml',
			yml: 'yaml',
			md: 'markdown',
			txt: 'text',
			sql: 'sql',
			dockerfile: 'dockerfile',
			dockerignore: 'gitignore'
		};
		return languageMap[ext || ''] || 'text';
	},

	/**
	 * Clear loaded files
	 */
	clearLoadedFiles(): void {
		sandboxFileStore.update((state) => ({
			...state,
			loadedFiles: new Map(),
			currentSandboxId: null,
			lastSync: null
		}));
		fileActions.clear();
	}
};

// Export derived stores for convenience
export const isLoadingSandboxFiles = derived(sandboxFileStore, ($state) => $state.isLoading);
export const currentSandboxId = derived(sandboxFileStore, ($state) => $state.currentSandboxId);
export const loadedFileCount = derived(sandboxFileStore, ($state) => $state.loadedFiles.size);
