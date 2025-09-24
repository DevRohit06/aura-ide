import type { File } from '@/types/files';
import { derived, get, writable } from 'svelte/store';
import { filesStore } from './files.store.js';

// Tab state interface
interface TabState {
	activeFileId: string | null;
	openFiles: string[];
}

// Default tab state
const defaultTabState: TabState = {
	activeFileId: null,
	openFiles: []
};

// Tabs store
export const tabsStore = writable<TabState>(defaultTabState);

// Derived stores
export const activeFileId = derived(tabsStore, ($tabs) => $tabs.activeFileId);
export const openFiles = derived(tabsStore, ($tabs) => $tabs.openFiles);

// Derived store for active file content
export const activeFile = derived([activeFileId, filesStore], ([$activeFileId, $files]) => {
	if (!$activeFileId) return null;
	return $files.get($activeFileId) as File | null;
});

// Derived store for open files with their data
export const openFilesData = derived([openFiles, filesStore], ([$openFiles, $files]) => {
	return $openFiles
		.map((fileId) => $files.get(fileId))
		.filter((file) => file !== undefined) as File[];
});

// Tab actions
export const tabActions = {
	// Open a file
	openFile: (fileId: string) => {
		tabsStore.update((state) => {
			// Add to open files if not already open
			if (!state.openFiles.includes(fileId)) {
				state.openFiles = [...state.openFiles, fileId];
			}

			// Set as active file
			state.activeFileId = fileId;

			return state;
		});
	},

	// Close a file
	closeFile: (fileId: string) => {
		tabsStore.update((state) => {
			// Remove from open files
			const newOpenFiles = state.openFiles.filter((id) => id !== fileId);

			// If this was the active file, switch to another open file or set to null
			let newActiveFileId = state.activeFileId;
			if (state.activeFileId === fileId) {
				newActiveFileId = newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null;
			}

			return {
				...state,
				openFiles: newOpenFiles,
				activeFileId: newActiveFileId
			};
		});
	},

	// Close all files
	closeAllFiles: () => {
		tabsStore.set(defaultTabState);
	},

	// Close other files (keep only the specified one)
	closeOtherFiles: (keepFileId: string) => {
		tabsStore.update((state) => {
			return {
				...state,
				openFiles: [keepFileId],
				activeFileId: keepFileId
			};
		});
	},

	// Switch to a file (must be already open)
	switchToFile: (fileId: string) => {
		tabsStore.update((state) => {
			if (state.openFiles.includes(fileId)) {
				return {
					...state,
					activeFileId: fileId
				};
			}
			return state;
		});
	},

	// Move tab to new position
	moveTab: (fileId: string, newIndex: number) => {
		tabsStore.update((state) => {
			const currentIndex = state.openFiles.indexOf(fileId);
			if (currentIndex === -1) return state;

			const newOpenFiles = [...state.openFiles];
			const [movedFile] = newOpenFiles.splice(currentIndex, 1);
			newOpenFiles.splice(newIndex, 0, movedFile);

			return {
				...state,
				openFiles: newOpenFiles
			};
		});
	},

	// Switch to next tab
	switchToNextTab: () => {
		tabsStore.update((state) => {
			if (!state.activeFileId || state.openFiles.length <= 1) return state;

			const currentIndex = state.openFiles.indexOf(state.activeFileId);
			const nextIndex = (currentIndex + 1) % state.openFiles.length;

			return {
				...state,
				activeFileId: state.openFiles[nextIndex]
			};
		});
	},

	// Switch to previous tab
	switchToPreviousTab: () => {
		tabsStore.update((state) => {
			if (!state.activeFileId || state.openFiles.length <= 1) return state;

			const currentIndex = state.openFiles.indexOf(state.activeFileId);
			const prevIndex = currentIndex === 0 ? state.openFiles.length - 1 : currentIndex - 1;

			return {
				...state,
				activeFileId: state.openFiles[prevIndex]
			};
		});
	},

	// Utility methods
	isFileOpen: (fileId: string): boolean => {
		const state = get(tabsStore);
		return state.openFiles.includes(fileId);
	},

	isFileActive: (fileId: string): boolean => {
		const state = get(tabsStore);
		return state.activeFileId === fileId;
	},

	getTabCount: (): number => {
		const state = get(tabsStore);
		return state.openFiles.length;
	},

	// Reset to default
	reset: () => {
		tabsStore.set(defaultTabState);
		console.log('🔄 Reset tabs store');
	}
};
