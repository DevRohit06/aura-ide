/**
 * Storage Cleanup Utility
 * Removes file-related data from localStorage to ensure API-only file management
 */

// List of file-related localStorage keys to remove
const FILE_RELATED_KEYS = [
	'aura-files',
	'aura-file-states',
	'aura-tabs' // Tabs store file references
] as const;

/**
 * Clean up file-related localStorage entries
 * Call this during app initialization to ensure clean state
 */
export function cleanupFileStorage(): void {
	if (typeof window === 'undefined') return;

	let cleanedCount = 0;

	FILE_RELATED_KEYS.forEach((key) => {
		if (localStorage.getItem(key) !== null) {
			localStorage.removeItem(key);
			cleanedCount++;
			console.log(`🧹 Cleaned up localStorage key: ${key}`);
		}
	});

	if (cleanedCount > 0) {
		console.log(`✅ Cleaned up ${cleanedCount} file-related localStorage entries`);
	}
}

/**
 * Check if file-related localStorage entries exist
 */
export function hasFileStorageEntries(): boolean {
	if (typeof window === 'undefined') return false;

	return FILE_RELATED_KEYS.some((key) => localStorage.getItem(key) !== null);
}

/**
 * Get summary of file-related localStorage usage
 */
export function getFileStorageSummary(): { key: string; size: number; exists: boolean }[] {
	if (typeof window === 'undefined') return [];

	return FILE_RELATED_KEYS.map((key) => {
		const value = localStorage.getItem(key);
		return {
			key,
			exists: value !== null,
			size: value ? new Blob([value]).size : 0
		};
	});
}
