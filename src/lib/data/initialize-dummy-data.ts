import { fileActions } from '$lib/stores/files.store.js';
import { tabActions } from '$lib/stores/tabs.store.js';
import { fileStateActions } from '$lib/stores/file-states.store.js';
import { filesStore } from '$lib/stores/files.store.js';
import { completeFileSystem } from './dummy-files.js';
import { get } from 'svelte/store';

/**
 * Initialize the editor stores with dummy data
 */
export function initializeDummyData() {
	// Only initialize if not already done
	const currentFiles = get(filesStore);
	if (currentFiles.size > 0) {
		console.log('Data already initialized, skipping');
		return;
	}

	console.log('Initializing dummy data...');

	// Clear existing data
	fileActions.clear();

	// Load all files and directories
	completeFileSystem.forEach((item) => {
		fileActions.addFile(item);

		// Initialize file states for files that are dirty
		if (item.type === 'file' && (item as any).isDirty) {
			fileStateActions.initializeFileState(item.id, { isDirty: true });
		}
	});

	// Open some files by default to demonstrate tabs
	tabActions.openFile('readme-md');
	tabActions.openFile('page-svelte');
	tabActions.openFile('utils-ts');

	// Set README as active file
	tabActions.switchToFile('readme-md');

	console.log('Dummy data initialized with', completeFileSystem.length, 'items');
}
