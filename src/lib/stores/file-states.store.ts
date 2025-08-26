import { writable, derived, get } from 'svelte/store';
import { activeFileId } from './tabs.store.js';
import type { FileEditorState } from '@/types/editor-state';
import type { CursorPosition, SelectionRange } from '@/types/files';

// Default file editor state
const defaultFileEditorState: FileEditorState = {
	scrollPosition: 0,
	cursorPosition: { line: 1, column: 1, timestamp: new Date() },
	selection: [],
	isDirty: false,
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
		return state?.cursorPosition || null;
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
	},

	// Persistence
	persistFileStates: () => {
		if (typeof window === 'undefined') return;

		const states = get(fileStatesStore);
		const serializedStates = Array.from(states.entries());
		localStorage.setItem('aura-file-states', JSON.stringify(serializedStates));
	},

	restoreFileStates: () => {
		if (typeof window === 'undefined') return;

		const saved = localStorage.getItem('aura-file-states');
		if (saved) {
			try {
				const parsed = JSON.parse(saved) as [string, FileEditorState][];
				const statesMap = new Map(parsed);
				fileStatesStore.set(statesMap);
			} catch (error) {
				console.warn('Failed to restore file states:', error);
			}
		}
	},

	// Reset
	reset: () => {
		fileStatesStore.set(new Map());
	}
};

// Auto-persist file states
if (typeof window !== 'undefined') {
	fileStatesStore.subscribe(() => {
		clearTimeout((globalThis as any).fileStatesPersistTimeout);
		(globalThis as any).fileStatesPersistTimeout = setTimeout(() => {
			fileStateActions.persistFileStates();
		}, 1000);
	});

	// Restore file states on load
	fileStateActions.restoreFileStates();
}
