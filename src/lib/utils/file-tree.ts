type FileNode = {
	id: string;
	name: string;
	type: 'file' | 'directory';
	path: string;
	children?: FileNode[];
};

/**
 * Converts FileNode structure to the array format expected by the sidebar component
 */
export function convertFileTreeToSidebarFormat(nodes: FileNode[]): (string | any[])[] {
	return nodes.map((node) => convertNodeToSidebarFormat(node));
}

function convertNodeToSidebarFormat(node: FileNode): string | any[] {
	if (node.type === 'file') {
		return node.name;
	}

	if (node.type === 'directory' && node.children) {
		const children = node.children.map((child) => convertNodeToSidebarFormat(child));
		return [node.name, ...children];
	}

	return node.name;
}

/**
 * Finds a file node by path in the tree structure
 */
export function findFileByPath(nodes: FileNode[], targetPath: string): FileNode | null {
	for (const node of nodes) {
		if (node.path === targetPath) {
			return node;
		}
		if (node.type === 'directory' && node.children) {
			const found = findFileByPath(node.children, targetPath);
			if (found) return found;
		}
	}
	return null;
}

/**
 * Finds a directory node by path in the tree structure
 */
export function findDirectoryByPath(nodes: FileNode[], targetPath: string): FileNode | null {
	for (const node of nodes) {
		if (node.path === targetPath && node.type === 'directory') {
			return node;
		}
		if (node.type === 'directory' && node.children) {
			const found = findDirectoryByPath(node.children, targetPath);
			if (found) return found;
		}
	}
	return null;
}

/**
 * Gets all files (not directories) from the tree structure
 */
export function getAllFiles(nodes: FileNode[]): FileNode[] {
	const files: FileNode[] = [];

	function traverse(nodes: FileNode[]) {
		for (const node of nodes) {
			if (node.type === 'file') {
				files.push(node);
			} else if (node.type === 'directory' && node.children) {
				traverse(node.children);
			}
		}
	}

	traverse(nodes);
	return files;
}

/**
 * Gets all directories from the tree structure
 */
export function getAllDirectories(nodes: FileNode[]): FileNode[] {
	const directories: FileNode[] = [];

	function traverse(nodes: FileNode[]) {
		for (const node of nodes) {
			if (node.type === 'directory') {
				directories.push(node);
				if (node.children) {
					traverse(node.children);
				}
			}
		}
	}

	traverse(nodes);
	return directories;
}

/**
 * Gets the parent path of a given file path
 */
export function getParentPath(filePath: string): string {
	const parts = filePath.split('/');
	return parts.slice(0, -1).join('/');
}

/**
 * Gets the filename from a path
 */
export function getFileName(filePath: string): string {
	const parts = filePath.split('/');
	return parts[parts.length - 1];
}

/**
 * Gets the file extension from a filename or path
 */
export function getFileExtension(filePath: string): string {
	const fileName = getFileName(filePath);
	const parts = fileName.split('.');
	return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Maps file extensions to programming languages
 */
export function getLanguageFromExtension(extension: string): string {
	const languageMap: Record<string, string> = {
		js: 'javascript',
		jsx: 'javascript',
		ts: 'typescript',
		tsx: 'typescript',
		py: 'python',
		html: 'html',
		htm: 'html',
		css: 'css',
		scss: 'css',
		sass: 'css',
		less: 'css',
		json: 'json',
		md: 'markdown',
		markdown: 'markdown',
		xml: 'xml',
		yml: 'yaml',
		yaml: 'yaml',
		toml: 'toml',
		ini: 'ini',
		cfg: 'ini',
		conf: 'ini',
		sh: 'bash',
		bash: 'bash',
		zsh: 'bash',
		fish: 'bash',
		sql: 'sql',
		php: 'php',
		rb: 'ruby',
		go: 'go',
		rs: 'rust',
		java: 'java',
		kt: 'kotlin',
		swift: 'swift',
		c: 'c',
		cpp: 'cpp',
		cc: 'cpp',
		cxx: 'cpp',
		h: 'c',
		hpp: 'cpp',
		cs: 'csharp',
		fs: 'fsharp',
		vb: 'vb',
		lua: 'lua',
		r: 'r',
		scala: 'scala',
		clj: 'clojure',
		hs: 'haskell',
		elm: 'elm',
		ex: 'elixir',
		exs: 'elixir',
		erl: 'erlang',
		pl: 'perl',
		pm: 'perl',
		vue: 'vue',
		svelte: 'svelte'
	};

	return languageMap[extension] || 'text';
}

/**
 * Gets the language for a file based on its path
 */
export function getLanguageFromPath(filePath: string): string {
	const extension = getFileExtension(filePath);
	return getLanguageFromExtension(extension);
}

/**
 * Filters files by extension
 */
export function filterFilesByExtension(nodes: FileNode[], extensions: string[]): FileNode[] {
	const allFiles = getAllFiles(nodes);
	return allFiles.filter((file) => {
		const ext = getFileExtension(file.path);
		return extensions.includes(ext);
	});
}

/**
 * Searches for files by name (supports partial matching)
 */
export function searchFilesByName(nodes: FileNode[], query: string): FileNode[] {
	const allFiles = getAllFiles(nodes);
	const lowerQuery = query.toLowerCase();

	return allFiles.filter(
		(file) =>
			file.name.toLowerCase().includes(lowerQuery) || file.path.toLowerCase().includes(lowerQuery)
	);
}

/**
 * Gets the depth of a file/directory in the tree
 */
export function getPathDepth(filePath: string): number {
	return filePath.split('/').length - 1;
}

/**
 * Sorts nodes alphabetically with directories first
 */
export function sortNodes(nodes: FileNode[]): FileNode[] {
	return [...nodes].sort((a, b) => {
		// Directories first
		if (a.type === 'directory' && b.type === 'file') return -1;
		if (a.type === 'file' && b.type === 'directory') return 1;

		// Then alphabetically
		return a.name.localeCompare(b.name);
	});
}

/**
 * Creates a breadcrumb array from a file path
 */
export function createBreadcrumbs(filePath: string): Array<{ name: string; path: string }> {
	const parts = filePath.split('/').filter(Boolean);
	const breadcrumbs: Array<{ name: string; path: string }> = [];

	let currentPath = '';
	for (const part of parts) {
		currentPath += (currentPath ? '/' : '') + part;
		breadcrumbs.push({
			name: part,
			path: currentPath
		});
	}

	return breadcrumbs;
}

/**
 * Checks if a file path is a descendant of a directory path
 */
export function isDescendantOf(filePath: string, directoryPath: string): boolean {
	return filePath.startsWith(directoryPath + '/');
}

/**
 * Gets all descendants of a directory
 */
export function getDirectoryDescendants(nodes: FileNode[], directoryPath: string): FileNode[] {
	const directory = findDirectoryByPath(nodes, directoryPath);
	if (!directory || !directory.children) return [];

	const descendants: FileNode[] = [];

	function traverse(children: FileNode[]) {
		for (const child of children) {
			descendants.push(child);
			if (child.type === 'directory' && child.children) {
				traverse(child.children);
			}
		}
	}

	traverse(directory.children);
	return descendants;
}

/**
 * Calculates the total size of a directory
 */
export function getDirectorySize(nodes: FileNode[], directoryPath: string): number {
	const descendants = getDirectoryDescendants(nodes, directoryPath);
	return descendants
		.filter((node) => node.type === 'file')
		.reduce((total, file) => total + (file.size || 0), 0);
}

/**
 * Formats file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
	if (bytes === 0) return '0 B';

	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Formats the last modified date
 */
export function formatLastModified(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays === 0) {
		return 'Today';
	} else if (diffDays === 1) {
		return 'Yesterday';
	} else if (diffDays < 7) {
		return `${diffDays} days ago`;
	} else if (diffDays < 30) {
		const weeks = Math.floor(diffDays / 7);
		return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
	} else if (diffDays < 365) {
		const months = Math.floor(diffDays / 30);
		return `${months} month${months > 1 ? 's' : ''} ago`;
	} else {
		const years = Math.floor(diffDays / 365);
		return `${years} year${years > 1 ? 's' : ''} ago`;
	}
}

/**
 * Validates a file path
 */
export function isValidPath(path: string): boolean {
	// Basic validation - no empty strings, no double slashes, etc.
	if (!path || path.includes('//') || path.startsWith('/') || path.endsWith('/')) {
		return false;
	}

	// Check for invalid characters (this can be expanded based on OS)
	const invalidChars = /[<>:"|?*\0]/;
	return !invalidChars.test(path);
}

/**
 * Normalizes a file path (removes redundant parts)
 */
export function normalizePath(path: string): string {
	return path.split('/').filter(Boolean).join('/');
}
