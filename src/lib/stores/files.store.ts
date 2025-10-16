import type { File, FileSystemItem } from '@/types/files';
import { derived, writable } from 'svelte/store';

// File system store (for file tree data)
export const filesStore = writable<Map<string, FileSystemItem>>(new Map());

// Store for tracking recently changed files (for visual indicators)
export const recentlyChangedFiles = writable<
	Map<string, { type: 'created' | 'modified' | 'deleted'; timestamp: number }>
>(new Map());

// Derived store for files with change indicators
export const filesWithChangeIndicators = derived(
	[filesStore, recentlyChangedFiles],
	([$filesStore, $recentlyChangedFiles]) => {
		const result = new Map<string, FileSystemItem & { changeIndicator?: string }>();

		for (const [path, file] of $filesStore) {
			const change = $recentlyChangedFiles.get(path);
			if (change && Date.now() - change.timestamp < 5000) {
				// Show indicator for 5 seconds
				result.set(path, { ...file, changeIndicator: change.type });
			} else {
				result.set(path, file);
			}
		}

		return result;
	}
);

// File actions
export const fileActions = {
	// Add a file to the file system
	addFile: (file: FileSystemItem) => {
		filesStore.update((files) => {
			files.set(file.path, file);
			return files;
		});
	},

	// Remove a file from the file system
	removeFile: (fileId: string) => {
		filesStore.update((files) => {
			files.delete(fileId);
			return files;
		});
	},

	// Update file properties
	updateFile: (fileId: string, updates: Partial<FileSystemItem>) => {
		filesStore.update((files) => {
			const file = files.get(fileId);
			if (file) {
				files.set(fileId, { ...file, ...updates });
			}
			return files;
		});
	},

	// Update file content (for File type only)
	updateFileContent: (fileId: string, content: string, fromRemote = false) => {
		filesStore.update((files) => {
			const item = files.get(fileId);
			if (item && item.type === 'file') {
				const file = item as File;
				const updatedFile: File = {
					...file,
					content,
					modifiedAt: new Date(),
					isDirty: !fromRemote // Don't mark as dirty if update came from remote
				};
				files.set(fileId, updatedFile);
			}
			return files;
		});

		// Mark as recently changed if from remote
		if (fromRemote) {
			recentlyChangedFiles.update((changes) => {
				changes.set(fileId, { type: 'modified', timestamp: Date.now() });
				return changes;
			});

			// Clear indicator after 5 seconds
			setTimeout(() => {
				recentlyChangedFiles.update((changes) => {
					changes.delete(fileId);
					return changes;
				});
			}, 5000);
		}
	},

	// Handle file creation from remote
	handleRemoteFileCreated: (path: string, content: string, metadata?: Record<string, any>) => {
		filesStore.update((files) => {
			const existingFile = files.get(path);

			// If file already exists, update it instead of creating new
			if (existingFile && existingFile.type === 'file') {
				console.log(`✨ File already exists, updating: ${path}`);
				const updatedFile: File = {
					...(existingFile as File),
					content,
					modifiedAt: new Date(),
					isDirty: false,
					size: content.length,
					metadata: {
						...(existingFile as File).metadata,
						lineCount: content.split('\n').length,
						characterCount: content.length,
						wordCount: content.split(/\s+/).length
					}
				};
				files.set(path, updatedFile);
			} else {
				// Create new file
				console.log(`✨ Creating new file: ${path}`);
				const ext = path.split('.').pop()?.toLowerCase() || '';
				const newFile: File = {
					id: path,
					name: path.split('/').pop() || path,
					path,
					type: 'file',
					content,
					parentId: null,
					language: getLanguageFromPath(path),
					encoding: 'utf-8',
					mimeType: 'text/plain',
					isDirty: false,
					isReadOnly: false,
					createdAt: new Date(),
					modifiedAt: new Date(),
					size: content.length,
					permissions: {
						read: true,
						write: true,
						execute: false,
						delete: true,
						share: false,
						owner: 'current-user',
						collaborators: []
					},
					metadata: {
						extension: ext,
						lineCount: content.split('\n').length,
						characterCount: content.length,
						wordCount: content.split(/\s+/).length,
						lastCursor: null,
						bookmarks: [],
						breakpoints: [],
						folds: [],
						searchHistory: []
					}
				};
				files.set(path, newFile);
			}

			return files;
		});

		// Mark as recently created/modified
		recentlyChangedFiles.update((changes) => {
			changes.set(path, { type: 'created', timestamp: Date.now() });
			return changes;
		});

		// Clear indicator after 5 seconds
		setTimeout(() => {
			recentlyChangedFiles.update((changes) => {
				changes.delete(path);
				return changes;
			});
		}, 5000);

		console.log(`✨ File created/updated remotely: ${path}`);
	},

	// Handle file modification from remote
	handleRemoteFileModified: (path: string, content: string) => {
		fileActions.updateFileContent(path, content, true);
		console.log(`📝 File modified remotely: ${path}`);
	},

	// Handle file deletion from remote
	handleRemoteFileDeleted: (path: string) => {
		filesStore.update((files) => {
			files.delete(path);
			return files;
		});

		// Mark as recently deleted (brief indicator before removal)
		recentlyChangedFiles.update((changes) => {
			changes.set(path, { type: 'deleted', timestamp: Date.now() });
			return changes;
		});

		// Clear indicator after 1 second
		setTimeout(() => {
			recentlyChangedFiles.update((changes) => {
				changes.delete(path);
				return changes;
			});
		}, 1000);

		console.log(`🗑️ File deleted remotely: ${path}`);
	},

	// Handle file rename from remote
	handleRemoteFileRenamed: (oldPath: string, newPath: string) => {
		filesStore.update((files) => {
			const file = files.get(oldPath);
			if (file) {
				files.delete(oldPath);
				const renamedFile = {
					...file,
					id: newPath,
					path: newPath,
					name: newPath.split('/').pop() || newPath,
					modifiedAt: new Date()
				};
				files.set(newPath, renamedFile);
			}
			return files;
		});

		// Mark both paths as changed
		recentlyChangedFiles.update((changes) => {
			changes.set(oldPath, { type: 'deleted', timestamp: Date.now() });
			changes.set(newPath, { type: 'created', timestamp: Date.now() });
			return changes;
		});

		// Clear indicators after 5 seconds
		setTimeout(() => {
			recentlyChangedFiles.update((changes) => {
				changes.delete(oldPath);
				changes.delete(newPath);
				return changes;
			});
		}, 5000);

		console.log(`↔️ File renamed remotely: ${oldPath} → ${newPath}`);
	},

	// Set file dirty state
	setFileDirty: (fileId: string, isDirty: boolean) => {
		filesStore.update((files) => {
			const item = files.get(fileId);
			if (item && item.type === 'file') {
				const file = item as File;
				const updatedFile: File = { ...file, isDirty };
				files.set(fileId, updatedFile);
			}
			return files;
		});
	},

	// Clear all files
	clear: () => {
		filesStore.set(new Map());
		recentlyChangedFiles.set(new Map());
	},

	// Load files from data
	loadFiles: (filesData: FileSystemItem[]) => {
		filesStore.set(new Map(filesData.map((file) => [file.path, file])));
		console.log(`📁 Loaded ${filesData.length} files from API`);
	}
};

// Helper function to determine language from file path
function getLanguageFromPath(path: string): string {
	const ext = path.split('.').pop()?.toLowerCase();
	const langMap: Record<string, string> = {
		js: 'javascript',
		jsx: 'javascript',
		ts: 'typescript',
		tsx: 'typescript',
		py: 'python',
		html: 'html',
		css: 'css',
		json: 'json',
		md: 'markdown',
		svelte: 'svelte',
		vue: 'vue',
		rs: 'rust',
		go: 'go',
		java: 'java',
		cpp: 'cpp',
		c: 'c'
	};
	return langMap[ext || ''] || 'text';
}
