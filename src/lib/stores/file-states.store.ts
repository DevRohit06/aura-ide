import type { FileEditorState } from '@/types/editor-state';
import type { CursorPosition, SelectionRange } from '@/types/files';
import { derived, get, writable } from 'svelte/store';
import { filesStore } from './files.store.js';
import { activeFileId } from './tabs.store.js';

// Default file editor state
const defaultFileEditorState: FileEditorState = {
	scrollPosition: 0,
	cursorPosition: { line: 1, column: 1, timestamp: new Date() },
	selection: [],
	isDirty: false,
	isLoading: false,
	undoHistory: [],
	redoHistory: [],
	lastSaved: new Date()
};

// File states store (Map of fileId to FileEditorState)
export const fileStatesStore = writable<Map<string, FileEditorState>>(new Map());

// Derived store for active file state
export const activeFileState = derived(
	[fileStatesStore, activeFileId],
	([$fileStates, $activeFileId]) => {
		if (!$activeFileId) return null;
		return $fileStates.get($activeFileId) || null;
	}
);

// File state actions
export const fileStateActions = {
	// Initialize file state
	initializeFileState: (fileId: string, initialState?: Partial<FileEditorState>) => {
		fileStatesStore.update((states) => {
			if (!states.has(fileId)) {
				const state = { ...defaultFileEditorState, ...initialState };
				states.set(fileId, state);
			}
			return states;
		});
	},

	// Update file state
	updateFileState: (fileId: string, updates: Partial<FileEditorState>) => {
		fileStatesStore.update((states) => {
			const currentState = states.get(fileId) || { ...defaultFileEditorState };
			states.set(fileId, { ...currentState, ...updates });
			return states;
		});
	},

	// Remove file state
	removeFileState: (fileId: string) => {
		fileStatesStore.update((states) => {
			states.delete(fileId);
			return states;
		});
	},

	// Cursor position management
	setCursorPosition: (fileId: string, position: CursorPosition) => {
		fileStateActions.updateFileState(fileId, {
			cursorPosition: { ...position, timestamp: new Date() }
		});
	},

	getCursorPosition: (fileId: string): CursorPosition | null => {
		const states = get(fileStatesStore);
		const state = states.get(fileId);
		const cursor = state?.cursorPosition;

		// Handle legacy number format or missing cursor position
		if (!cursor || typeof cursor === 'number') {
			return null;
		}

		return cursor;
	},

	// Selection management
	setSelection: (fileId: string, selection: SelectionRange[]) => {
		fileStateActions.updateFileState(fileId, { selection });
	},

	clearSelection: (fileId: string) => {
		fileStateActions.updateFileState(fileId, { selection: [] });
	},

	getSelection: (fileId: string): SelectionRange[] => {
		const states = get(fileStatesStore);
		const state = states.get(fileId);
		return state?.selection || [];
	},

	// Scroll position management
	setScrollPosition: (fileId: string, scrollPosition: number) => {
		fileStateActions.updateFileState(fileId, { scrollPosition });
	},

	getScrollPosition: (fileId: string): number => {
		const states = get(fileStatesStore);
		const state = states.get(fileId);
		return state?.scrollPosition || 0;
	},

	// Dirty state management
	setFileDirty: (fileId: string, isDirty: boolean) => {
		fileStateActions.updateFileState(fileId, {
			isDirty,
			...(isDirty ? {} : { lastSaved: new Date() })
		});
	},

	isFileDirty: (fileId: string): boolean => {
		const states = get(fileStatesStore);
		const state = states.get(fileId);
		return state?.isDirty || false;
	},

	// Loading state management
	setFileLoading: (fileId: string, isLoading: boolean) => {
		fileStateActions.updateFileState(fileId, { isLoading });
	},

	isFileLoading: (fileId: string): boolean => {
		const states = get(fileStatesStore);
		const state = states.get(fileId);
		return state?.isLoading || false;
	},

	// Undo/Redo history management
	addToUndoHistory: (fileId: string, content: string) => {
		fileStatesStore.update((states) => {
			const state = states.get(fileId) || { ...defaultFileEditorState };
			const newUndoHistory = [...state.undoHistory, content];

			// Limit undo history to 50 entries
			if (newUndoHistory.length > 50) {
				newUndoHistory.shift();
			}

			states.set(fileId, {
				...state,
				undoHistory: newUndoHistory,
				redoHistory: [] // Clear redo history when new change is made
			});
			return states;
		});
	},

	undo: (fileId: string): string | null => {
		let undoContent: string | null = null;

		fileStatesStore.update((states) => {
			const state = states.get(fileId);
			if (!state || state.undoHistory.length === 0) return states;

			const newUndoHistory = [...state.undoHistory];
			undoContent = newUndoHistory.pop() || null;

			if (undoContent) {
				const newRedoHistory = [...state.redoHistory, undoContent];
				states.set(fileId, {
					...state,
					undoHistory: newUndoHistory,
					redoHistory: newRedoHistory
				});
			}

			return states;
		});

		return undoContent;
	},

	redo: (fileId: string): string | null => {
		let redoContent: string | null = null;

		fileStatesStore.update((states) => {
			const state = states.get(fileId);
			if (!state || state.redoHistory.length === 0) return states;

			const newRedoHistory = [...state.redoHistory];
			redoContent = newRedoHistory.pop() || null;

			if (redoContent) {
				const newUndoHistory = [...state.undoHistory, redoContent];
				states.set(fileId, {
					...state,
					undoHistory: newUndoHistory,
					redoHistory: newRedoHistory
				});
			}

			return states;
		});

		return redoContent;
	},

	canUndo: (fileId: string): boolean => {
		const states = get(fileStatesStore);
		const state = states.get(fileId);
		return (state?.undoHistory.length || 0) > 0;
	},

	canRedo: (fileId: string): boolean => {
		const states = get(fileStatesStore);
		const state = states.get(fileId);
		return (state?.redoHistory.length || 0) > 0;
	},

	clearHistory: (fileId: string) => {
		fileStateActions.updateFileState(fileId, {
			undoHistory: [],
			redoHistory: []
		});
	},

	// Utility methods
	getFileState: (fileId: string): FileEditorState | null => {
		const states = get(fileStatesStore);
		return states.get(fileId) || null;
	},

	hasFileState: (fileId: string): boolean => {
		const states = get(fileStatesStore);
		return states.has(fileId);
	},

	getAllFileStates: (): Map<string, FileEditorState> => {
		return get(fileStatesStore);
	},

	getDirtyFiles: (): string[] => {
		const states = get(fileStatesStore);
		const dirtyFiles: string[] = [];

		states.forEach((state, fileId) => {
			if (state.isDirty) {
				dirtyFiles.push(fileId);
			}
		});

		return dirtyFiles;
	},

	// Save file (mark as not dirty and update last saved time)
	async saveFile(
		fileId: string,
		projectId?: string,
		sandboxId?: string,
		sandboxProvider?: string
	): Promise<boolean> {
		try {
			// Get file from store
			const files = get(filesStore);
			const file = files.get(fileId);

			if (!file) {
				console.error('❌ File not found in store:', fileId);
				return false;
			}

			if (file.type !== 'file') {
				console.error('❌ Cannot save directory:', file.path);
				return false;
			}

			if (!file.permissions.write) {
				console.error('❌ File is read-only:', file.path);
				return false;
			}

			// Get project context if not provided
			if (!projectId || !sandboxId) {
				// Try to get from URL or global context
				if (typeof window !== 'undefined') {
					const urlParts = window.location.pathname.split('/');
					const editorIndex = urlParts.indexOf('editor');
					if (editorIndex !== -1 && urlParts[editorIndex + 1]) {
						projectId = projectId || urlParts[editorIndex + 1];
					}
				}

				// Get from current project store if available
				if (!projectId) {
					const { projectActions } = await import('./current-project.store.js');
					projectId = projectActions.getCurrentProject() || undefined;
				}
			}

			console.log('💾 Saving file:', {
				path: file.path,
				projectId,
				sandboxId,
				sandboxProvider,
				contentLength: (file.content || '').length
			});

			// Call the API with all required data
			const response = await fetch('/api/files', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					operation: 'update',
					path: file.path,
					content: file.content || '',
					projectId,
					sandboxId,
					sandboxProvider,
					metadata: {
						modifiedAt: new Date().toISOString(),
						size: (file.content || '').length
					}
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				console.error('❌ Failed to save file:', errorData);
				return false;
			}

			const result = await response.json();

			if (result.success) {
				// Update local state to mark as saved
				fileStateActions.setFileDirty(fileId, false);
				fileStateActions.updateFileState(fileId, {
					lastSaved: new Date()
				});
				console.log('✅ File saved successfully:', result.data);
				return true;
			} else {
				console.error('❌ Failed to save file:', result.error);
				return false;
			}
		} catch (error) {
			console.error('Failed to save file:', error);
			return false;
		}
	},

	// Save all dirty files
	async saveAllFiles(projectId?: string): Promise<boolean> {
		try {
			// Get current project ID if not provided
			if (!projectId) {
				const { projectActions } = await import('./current-project.store.js');
				projectId = projectActions.getCurrentProject() || undefined;
			}

			const { enhancedFileActions } = await import('./enhanced-file-operations.store.js');
			return await enhancedFileActions.saveAllFiles(projectId);
		} catch (error) {
			console.error('Failed to save all files:', error);
			return false;
		}
	},

	// Bulk operations
	markAllFilesSaved: () => {
		fileStatesStore.update((states) => {
			const newStates = new Map();
			states.forEach((state, fileId) => {
				newStates.set(fileId, {
					...state,
					isDirty: false,
					lastSaved: new Date()
				});
			});
			return newStates;
		});
	},

	clearAllFileStates: () => {
		fileStatesStore.set(new Map());
		console.log('🧹 Cleared all file states');
	},

	// Reset
	reset: () => {
		fileStatesStore.set(new Map());
		console.log('🔄 Reset file states store');
	}
};

// Export derived stores for convenience
export const activeCursorPosition = derived(
	[fileStatesStore, activeFileId],
	([$states, $activeFileId]) => {
		if (!$activeFileId) return null;
		const state = $states.get($activeFileId);
		return state?.cursorPosition || null;
	}
);

export const activeScrollPosition = derived(
	[fileStatesStore, activeFileId],
	([$states, $activeFileId]) => {
		if (!$activeFileId) return 0;
		const state = $states.get($activeFileId);
		return state?.scrollPosition || 0;
	}
);

export const isDirtyFile = derived([fileStatesStore, activeFileId], ([$states, $activeFileId]) => {
	if (!$activeFileId) return false;
	const state = $states.get($activeFileId);
	return state?.isDirty || false;
});
