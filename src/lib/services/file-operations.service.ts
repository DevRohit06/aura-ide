import { get } from 'svelte/store';
import { toast } from 'svelte-sonner';
import { enhancedFileActions } from '$lib/stores/enhanced-file-operations.store';
import { filesStore } from '$lib/stores/files.store';
import { tabActions } from '$lib/stores/tabs.store';
import type { FileSystemItem, File, Directory } from '$lib/types/files';
import type {
	CreateFileData,
	DeleteFileData,
	RenameFileData,
	MoveFileData
} from '$lib/types/file-operations';

// Clipboard state for copy/cut operations
interface ClipboardState {
	files: FileSystemItem[];
	operation: 'copy' | 'cut';
	timestamp: Date;
}

let clipboard: ClipboardState | null = null;

// File templates
const FILE_TEMPLATES: Record<string, string> = {
	js: `// JavaScript file
console.log('Hello, World!');
`,
	ts: `// TypeScript file
console.log('Hello, World!');
`,
	jsx: `import React from 'react';

const Component = () => {
	return (
		<div>
			<h1>Hello, World!</h1>
		</div>
	);
};

export default Component;
`,
	tsx: `import React from 'react';

interface Props {
	// Define your props here
}

const Component: React.FC<Props> = () => {
	return (
		<div>
			<h1>Hello, World!</h1>
		</div>
	);
};

export default Component;
`,
	svelte: `<script lang="ts">
	// Component logic here
</script>

<div>
	<h1>Hello, World!</h1>
</div>

<style>
	/* Component styles here */
</style>
`,
	html: `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Document</title>
</head>
<body>
	<h1>Hello, World!</h1>
</body>
</html>
`,
	css: `/* CSS Styles */
body {
	font-family: Arial, sans-serif;
	margin: 0;
	padding: 20px;
}
`,
	scss: `// SCSS Styles
$primary-color: #007bff;

body {
	font-family: Arial, sans-serif;
	margin: 0;
	padding: 20px;
	color: $primary-color;
}
`,
	json: `{
	"name": "example",
	"version": "1.0.0",
	"description": "Example JSON file"
}
`,
	md: `# Markdown Document

This is a **markdown** document.

## Features

- Lists
- *Emphasis*
- [Links](https://example.com)
- \`Code\`

## Code Block

\`\`\`javascript
console.log('Hello, World!');
\`\`\`
`,
	py: `#!/usr/bin/env python3
"""
Python script
"""

def main():
    print("Hello, World!")

if __name__ == "__main__":
    main()
`,
	'README.md': `# Project Name

Brief description of your project.

## Installation

\`\`\`bash
npm install
\`\`\`

## Usage

\`\`\`bash
npm start
\`\`\`

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.
`
};

export class FileOperationsService {
	// Create file with template
	static async createFile(
		parentPath: string,
		name: string,
		template?: string
	): Promise<string | null> {
		const extension = name.split('.').pop()?.toLowerCase() || '';
		let content = '';

		// Use provided template or get from templates
		if (template) {
			content = template;
		} else if (FILE_TEMPLATES[name]) {
			content = FILE_TEMPLATES[name];
		} else if (FILE_TEMPLATES[extension]) {
			content = FILE_TEMPLATES[extension];
		}

		const createData: CreateFileData = {
			name,
			path: parentPath,
			type: 'file',
			content,
			template: template || extension
		};

		return await enhancedFileActions.createFile(createData);
	}

	// Create directory
	static async createDirectory(parentPath: string, name: string): Promise<string | null> {
		const createData: CreateFileData = {
			name,
			path: parentPath,
			type: 'directory'
		};

		return await enhancedFileActions.createFile(createData);
	}

	// Delete file with confirmation
	static async deleteFile(file: FileSystemItem, skipConfirmation = false): Promise<boolean> {
		if (!skipConfirmation) {
			// Return false to indicate confirmation is needed
			// The UI should handle showing the confirmation dialog
			return false;
		}

		const deleteData: DeleteFileData = {
			id: file.id,
			confirm: true
		};

		return await enhancedFileActions.deleteFile(deleteData);
	}

	// Rename file
	static async renameFile(file: FileSystemItem, newName: string): Promise<boolean> {
		const renameData: RenameFileData = {
			id: file.id,
			newName
		};

		return await enhancedFileActions.renameFile(renameData);
	}

	// Move file (drag and drop)
	static async moveFile(
		file: FileSystemItem,
		newParentId: string | null,
		newPath: string
	): Promise<boolean> {
		const moveData: MoveFileData = {
			id: file.id,
			newParentId,
			newPath
		};

		return await enhancedFileActions.moveFile(moveData);
	}

	// Copy file to clipboard
	static copyFile(file: FileSystemItem): void {
		clipboard = {
			files: [file],
			operation: 'copy',
			timestamp: new Date()
		};

		toast.success(`Copied "${file.name}" to clipboard`);
	}

	// Cut file to clipboard
	static cutFile(file: FileSystemItem): void {
		clipboard = {
			files: [file],
			operation: 'cut',
			timestamp: new Date()
		};

		toast.success(`Cut "${file.name}" to clipboard`);
	}

	// Paste file from clipboard
	static async pasteFile(targetPath: string, targetParentId: string | null): Promise<boolean> {
		if (!clipboard || clipboard.files.length === 0) {
			toast.error('Nothing to paste');
			return false;
		}

		// Check if clipboard is not too old (5 minutes)
		const clipboardAge = Date.now() - clipboard.timestamp.getTime();
		if (clipboardAge > 5 * 60 * 1000) {
			clipboard = null;
			toast.error('Clipboard expired');
			return false;
		}

		const file = clipboard.files[0];
		const files = get(filesStore);

		try {
			if (clipboard.operation === 'copy') {
				// Create a copy of the file
				const newName = await FileOperationsService.generateUniqueFileName(
					files,
					targetParentId,
					file.name
				);

				if (file.type === 'file') {
					const fileData = file as File;
					return (
						(await FileOperationsService.createFile(targetPath, newName, fileData.content)) !== null
					);
				} else {
					// For directories, we'd need to recursively copy all contents
					return (await FileOperationsService.createDirectory(targetPath, newName)) !== null;
				}
			} else if (clipboard.operation === 'cut') {
				// Move the file
				const newPath = targetPath === '/' ? `/${file.name}` : `${targetPath}/${file.name}`;
				const success = await FileOperationsService.moveFile(file, targetParentId, newPath);

				if (success) {
					clipboard = null; // Clear clipboard after successful cut operation
				}

				return success;
			}
		} catch (error) {
			toast.error('Failed to paste: ' + (error instanceof Error ? error.message : 'Unknown error'));
			return false;
		}

		return false;
	}

	// Check if clipboard has content
	static hasClipboardContent(): boolean {
		if (!clipboard) return false;

		// Check if clipboard is not too old (5 minutes)
		const clipboardAge = Date.now() - clipboard.timestamp.getTime();
		return clipboardAge <= 5 * 60 * 1000;
	}

	// Get clipboard operation type
	static getClipboardOperation(): 'copy' | 'cut' | null {
		return FileOperationsService.hasClipboardContent() ? clipboard!.operation : null;
	}

	// Download file
	static downloadFile(file: FileSystemItem): void {
		if (file.type !== 'file') {
			toast.error('Cannot download directories');
			return;
		}

		try {
			const fileData = file as File;
			const blob = new Blob([fileData.content], { type: fileData.mimeType || 'text/plain' });
			const url = URL.createObjectURL(blob);

			const link = document.createElement('a');
			link.href = url;
			link.download = file.name;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);

			URL.revokeObjectURL(url);

			toast.success(`Downloaded "${file.name}"`);
		} catch (error) {
			toast.error(
				'Failed to download file: ' + (error instanceof Error ? error.message : 'Unknown error')
			);
		}
	}

	// Save file
	static async saveFile(fileId: string): Promise<boolean> {
		return await enhancedFileActions.saveFile(fileId);
	}

	// Save all files
	static async saveAllFiles(): Promise<boolean> {
		return await enhancedFileActions.saveAllFiles();
	}

	// Open file in editor
	static openFile(fileId: string): void {
		const files = get(filesStore);
		const file = files.get(fileId);

		if (!file) {
			toast.error('File not found');
			return;
		}

		if (file.type !== 'file') {
			toast.error('Cannot open directories in editor');
			return;
		}

		tabActions.openFile(fileId);
		toast.success(`Opened "${file.name}"`);
	}

	// Get file path breadcrumbs
	static getFileBreadcrumbs(
		file: FileSystemItem
	): Array<{ id: string; name: string; path: string }> {
		const files = get(filesStore);
		const breadcrumbs: Array<{ id: string; name: string; path: string }> = [];

		let currentFile: FileSystemItem | undefined = file;

		while (currentFile) {
			breadcrumbs.unshift({
				id: currentFile.id,
				name: currentFile.name,
				path: currentFile.path
			});

			if (currentFile.parentId) {
				currentFile = files.get(currentFile.parentId);
			} else {
				break;
			}
		}

		return breadcrumbs;
	}

	// Generate unique file name to avoid conflicts
	static async generateUniqueFileName(
		files: Map<string, FileSystemItem>,
		parentId: string | null,
		baseName: string
	): Promise<string> {
		let counter = 1;
		let newName = baseName;

		// Extract name and extension
		const lastDotIndex = baseName.lastIndexOf('.');
		const name = lastDotIndex > 0 ? baseName.substring(0, lastDotIndex) : baseName;
		const extension = lastDotIndex > 0 ? baseName.substring(lastDotIndex) : '';

		// Check for conflicts and increment counter
		while (FileOperationsService.checkFileExists(files, parentId, newName)) {
			newName = `${name} (${counter})${extension}`;
			counter++;
		}

		return newName;
	}

	// Check if file exists in parent directory
	private static checkFileExists(
		files: Map<string, FileSystemItem>,
		parentId: string | null,
		name: string
	): boolean {
		for (const file of files.values()) {
			if (file.parentId === parentId && file.name === name) {
				return true;
			}
		}
		return false;
	}

	// Get file icon based on type and extension
	static getFileIcon(file: FileSystemItem): string {
		if (file.type === 'directory') {
			return 'folder';
		}

		const extension = file.name.split('.').pop()?.toLowerCase() || '';

		const iconMap: Record<string, string> = {
			// Web technologies
			js: 'javascript',
			ts: 'typescript',
			jsx: 'react',
			tsx: 'react',
			vue: 'vue',
			svelte: 'svelte',
			html: 'html',
			css: 'css',
			scss: 'sass',
			sass: 'sass',
			less: 'less',

			// Data formats
			json: 'json',
			xml: 'xml',
			yaml: 'yaml',
			yml: 'yaml',
			toml: 'toml',

			// Documentation
			md: 'markdown',
			txt: 'text',
			pdf: 'pdf',

			// Images
			png: 'image',
			jpg: 'image',
			jpeg: 'image',
			gif: 'image',
			svg: 'image',
			webp: 'image',

			// Programming languages
			py: 'python',
			rb: 'ruby',
			php: 'php',
			java: 'java',
			c: 'c',
			cpp: 'cpp',
			cs: 'csharp',
			go: 'go',
			rs: 'rust',
			swift: 'swift',
			kt: 'kotlin',

			// Shell scripts
			sh: 'shell',
			bash: 'shell',
			zsh: 'shell',
			fish: 'shell',

			// Config files
			env: 'settings',
			config: 'settings',
			conf: 'settings',
			ini: 'settings',

			// Package files
			'package.json': 'npm',
			'yarn.lock': 'yarn',
			'pnpm-lock.yaml': 'pnpm',
			'Cargo.toml': 'rust',
			'requirements.txt': 'python',
			Gemfile: 'ruby',
			'composer.json': 'php'
		};

		// Check for specific filenames first
		if (iconMap[file.name]) {
			return iconMap[file.name];
		}

		// Then check by extension
		return iconMap[extension] || 'file';
	}

	// Validate file operation
	static validateOperation(operation: string, data: any): { isValid: boolean; message?: string } {
		return enhancedFileActions.validateFileOperation(operation, data);
	}

	// Get operation statistics
	static getOperationStats() {
		return enhancedFileActions.getOperationStats();
	}

	// Retry last failed operation
	static async retryLastOperation(): Promise<boolean> {
		return await enhancedFileActions.retryLastOperation();
	}

	// Clear error state
	static clearError(): void {
		enhancedFileActions.clearError();
	}
}
