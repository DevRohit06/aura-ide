/**
 * File Operations Test
 * Tests the new API-only file management system
 */

import { enhancedFileActions } from '$lib/stores/enhanced-file-operations.store.js';
import { fileActions, filesStore } from '$lib/stores/files.store.js';
import { cleanupFileStorage, hasFileStorageEntries } from '$lib/utils/storage-cleanup.js';
import { get } from 'svelte/store';

/**
 * Test localStorage cleanup
 */
export async function testStorageCleanup(): Promise<boolean> {
	console.log('🧪 Testing localStorage cleanup...');

	// Add some test data to localStorage (simulating old data)
	if (typeof window !== 'undefined') {
		localStorage.setItem(
			'aura-files',
			JSON.stringify([['test', { id: 'test', name: 'test.txt' }]])
		);
		localStorage.setItem('aura-file-states', JSON.stringify([['test', { isDirty: true }]]));
		localStorage.setItem('aura-tabs', JSON.stringify({ openFiles: ['test'] }));

		console.log('📝 Added test localStorage entries');
		console.log('🔍 Storage entries before cleanup:', hasFileStorageEntries());

		// Run cleanup
		cleanupFileStorage();

		// Check if cleanup worked
		const hasEntries = hasFileStorageEntries();
		console.log('🔍 Storage entries after cleanup:', hasEntries);

		return !hasEntries;
	}

	return true;
}

/**
 * Test file operations API
 */
export async function testFileOperationsAPI(): Promise<boolean> {
	console.log('🧪 Testing file operations API...');

	try {
		// Create a test file
		const testFile = {
			id: 'test-file-123',
			name: 'test-api.txt',
			path: '/test-api.txt',
			type: 'file' as const,
			content: 'Hello from API test!',
			parentId: null,
			size: 20,
			createdAt: new Date(),
			modifiedAt: new Date(),
			language: 'text',
			encoding: 'utf-8' as const,
			mimeType: 'text/plain',
			isDirty: true,
			isReadOnly: false,
			permissions: {
				read: true,
				write: true,
				execute: false,
				delete: true,
				share: false,
				owner: 'test-user',
				collaborators: []
			},
			metadata: {
				extension: '.txt',
				iconName: 'file-text',
				isHidden: false,
				isSystemFile: false,
				isTemporary: false,
				isBackup: false,
				bookmarks: [],
				breakpoints: [],
				lastCursorPosition: { line: 0, column: 0 },
				searchHistory: [],
				foldingRanges: []
			}
		};

		// Add file to store
		fileActions.addFile(testFile);
		console.log('📁 Added test file to store');

		// Verify file is in store
		const files = get(filesStore);
		const storedFile = files.get(testFile.id);
		if (!storedFile) {
			console.error('❌ File not found in store after adding');
			return false;
		}
		console.log('✅ File found in store');

		// Test save operation (this should trigger API call)
		console.log('💾 Testing save operation...');
		const saveResult = await enhancedFileActions.saveFile(testFile.id, 'test-project-123');

		if (saveResult) {
			console.log('✅ Save operation completed successfully');
		} else {
			console.error('❌ Save operation failed');
			return false;
		}

		// Clean up
		fileActions.removeFile(testFile.id);
		console.log('🧹 Cleaned up test file');

		return true;
	} catch (error) {
		console.error('❌ File operations test failed:', error);
		return false;
	}
}

/**
 * Run all tests
 */
export async function runFileManagementTests(): Promise<void> {
	console.log('🚀 Starting file management tests...');

	const results = {
		storageCleanup: await testStorageCleanup(),
		fileOperationsAPI: await testFileOperationsAPI()
	};

	console.log('📊 Test Results:');
	console.log('  - Storage Cleanup:', results.storageCleanup ? '✅ PASS' : '❌ FAIL');
	console.log('  - File Operations API:', results.fileOperationsAPI ? '✅ PASS' : '❌ FAIL');

	const allPassed = Object.values(results).every((result) => result);
	console.log(`\n🎯 Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

	if (allPassed) {
		console.log('🎉 File management system is working correctly with API-only approach!');
	} else {
		console.warn('⚠️ Some issues detected in file management system');
	}
}
