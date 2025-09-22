import type { ComponentType } from 'svelte';

import FolderIcon from '@lucide/svelte/icons/folder';
import FolderOpenIcon from '@lucide/svelte/icons/folder-open';

// Icon mapping type
type IconComponent = ComponentType<any>;

/**
 * Get the directory icon (open or closed)
 */
export function getDirectoryIcon(isExpanded: boolean = false): IconComponent {
	return isExpanded ? FolderOpenIcon : FolderIcon;
}

/**
 * Extract file extension from filename
 */
export function getFileExtension(fileName: string): string | null {
	if (!fileName || fileName.startsWith('.')) {
		return null;
	}

	const lastDotIndex = fileName.lastIndexOf('.');
	if (lastDotIndex === -1) {
		return null;
	}

	return fileName.substring(lastDotIndex + 1).toLowerCase();
}

/**
 * Check if a file is a specific type
 */
export function isFileType(fileName: string, type: string): boolean {
	const category = getFileCategory(fileName, false);
	return category === type;
}

/**
 * Get files by category
 */
export function getFilesByCategory(files: string[]): Record<string, string[]> {
	const categorized: Record<string, string[]> = {};

	files.forEach((fileName) => {
		const category = getFileCategory(fileName);
		if (!categorized[category]) {
			categorized[category] = [];
		}
		categorized[category].push(fileName);
	});

	return categorized;
}
