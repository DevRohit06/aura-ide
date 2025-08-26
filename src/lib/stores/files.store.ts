import { writable } from 'svelte/store';
import type { FileSystemItem, File } from '@/types/files';

// File system store (for file tree data)
export const filesStore = writable<Map<string, FileSystemItem>>(new Map());

// File actions
export const fileActions = {
	// Add a file to the file system
	addFile: (file: FileSystemItem) => {
		filesStore.update((files) => {
			files.set(file.id, file);
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
	updateFileContent: (fileId: string, content: string) => {
		filesStore.update((files) => {
			const item = files.get(fileId);
			if (item && item.type === 'file') {
				const file = item as File;
				const updatedFile: File = {
					...file,
					content,
					modifiedAt: new Date(),
					isDirty: true
				};
				files.set(fileId, updatedFile);
			}
			return files;
		});
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
	},

	// Load files from data
	loadFiles: (filesData: FileSystemItem[]) => {
		filesStore.set(new Map(filesData.map((file) => [file.id, file])));
	},

	// Persistence
	persistFiles: () => {
		if (typeof window === 'undefined') return;

		filesStore.subscribe((files) => {
			const serializedFiles = Array.from(files.entries());
			localStorage.setItem('aura-files', JSON.stringify(serializedFiles));
		})();
	},

	restoreFiles: () => {
		if (typeof window === 'undefined') return;

		const saved = localStorage.getItem('aura-files');
		if (saved) {
			try {
				const parsed = JSON.parse(saved);
				filesStore.set(new Map(parsed));
			} catch (error) {
				console.warn('Failed to restore files:', error);
			}
		}
	}
};

// Auto-persist files
if (typeof window !== 'undefined') {
	filesStore.subscribe((files) => {
		clearTimeout((globalThis as any).filesPersistTimeout);
		(globalThis as any).filesPersistTimeout = setTimeout(() => {
			const serializedFiles = Array.from(files.entries());
			localStorage.setItem('aura-files', JSON.stringify(serializedFiles));
		}, 1000);
	});

	// Restore files on load
	fileActions.restoreFiles();
}
