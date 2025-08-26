import type { ComponentType } from 'svelte';

// Lucide icons
import FileIcon from '@lucide/svelte/icons/file';
import FileTextIcon from '@lucide/svelte/icons/file-text';
import ImageIcon from '@lucide/svelte/icons/image';
import FolderIcon from '@lucide/svelte/icons/folder';
import FolderOpenIcon from '@lucide/svelte/icons/folder-open';
import CodeIcon from '@lucide/svelte/icons/code';
import DatabaseIcon from '@lucide/svelte/icons/database';
import SettingsIcon from '@lucide/svelte/icons/settings';
import FileJsonIcon from '@lucide/svelte/icons/file-json';
import FileSpreadsheetIcon from '@lucide/svelte/icons/file-spreadsheet';
import FileVideoIcon from '@lucide/svelte/icons/file-video';
import FileAudioIcon from '@lucide/svelte/icons/file-audio';
import FileArchiveIcon from '@lucide/svelte/icons/file-archive';
import FileLockIcon from '@lucide/svelte/icons/file-lock';
import TerminalIcon from '@lucide/svelte/icons/terminal';
import GitBranchIcon from '@lucide/svelte/icons/git-branch';
import PackageIcon from '@lucide/svelte/icons/package';
import BrushIcon from '@lucide/svelte/icons/brush';
import GlobeIcon from '@lucide/svelte/icons/globe';
import LayoutIcon from '@lucide/svelte/icons/layout';
import BookIcon from '@lucide/svelte/icons/book';
import KeyIcon from '@lucide/svelte/icons/key';
import ShieldIcon from '@lucide/svelte/icons/shield';
import TestTube2Icon from '@lucide/svelte/icons/test-tube-2';
import WrenchIcon from '@lucide/svelte/icons/wrench';
import ComponentIcon from '@lucide/svelte/icons/component';
import BoxIcon from '@lucide/svelte/icons/box';

// Icon mapping type
type IconComponent = ComponentType<any>;

interface FileTypeMapping {
	[key: string]: {
		icon: IconComponent;
		color?: string;
		category: string;
	};
}

// Comprehensive file type mappings
const fileTypeMappings: FileTypeMapping = {
	// JavaScript/TypeScript
	'js': { icon: CodeIcon, color: '#f7df1e', category: 'javascript' },
	'jsx': { icon: CodeIcon, color: '#61dafb', category: 'javascript' },
	'ts': { icon: CodeIcon, color: '#3178c6', category: 'typescript' },
	'tsx': { icon: CodeIcon, color: '#61dafb', category: 'typescript' },
	'mjs': { icon: CodeIcon, color: '#f7df1e', category: 'javascript' },
	'cjs': { icon: CodeIcon, color: '#f7df1e', category: 'javascript' },

	// Web frameworks
	'svelte': { icon: ComponentIcon, color: '#ff3e00', category: 'svelte' },
	'vue': { icon: ComponentIcon, color: '#4fc08d', category: 'vue' },
	'react': { icon: ComponentIcon, color: '#61dafb', category: 'react' },

	// Web technologies
	'html': { icon: LayoutIcon, color: '#e34f26', category: 'markup' },
	'htm': { icon: LayoutIcon, color: '#e34f26', category: 'markup' },
	'css': { icon: BrushIcon, color: '#1572b6', category: 'stylesheet' },
	'scss': { icon: BrushIcon, color: '#cf649a', category: 'stylesheet' },
	'sass': { icon: BrushIcon, color: '#cf649a', category: 'stylesheet' },
	'less': { icon: BrushIcon, color: '#1d365d', category: 'stylesheet' },
	'stylus': { icon: BrushIcon, color: '#b3d107', category: 'stylesheet' },

	// Configuration files
	'json': { icon: FileJsonIcon, color: '#cbcb41', category: 'config' },
	'jsonc': { icon: FileJsonIcon, color: '#cbcb41', category: 'config' },
	'json5': { icon: FileJsonIcon, color: '#cbcb41', category: 'config' },
	'yaml': { icon: SettingsIcon, color: '#cb171e', category: 'config' },
	'yml': { icon: SettingsIcon, color: '#cb171e', category: 'config' },
	'toml': { icon: SettingsIcon, color: '#9c4221', category: 'config' },
	'ini': { icon: SettingsIcon, color: '#6d8086', category: 'config' },
	'conf': { icon: SettingsIcon, color: '#6d8086', category: 'config' },
	'config': { icon: SettingsIcon, color: '#6d8086', category: 'config' },

	// Markup and documentation
	'md': { icon: BookIcon, color: '#083fa1', category: 'documentation' },
	'mdx': { icon: BookIcon, color: '#1890ff', category: 'documentation' },
	'markdown': { icon: BookIcon, color: '#083fa1', category: 'documentation' },
	'txt': { icon: FileTextIcon, color: '#6d8086', category: 'text' },
	'rtf': { icon: FileTextIcon, color: '#6d8086', category: 'text' },

	// Data formats
	'xml': { icon: CodeIcon, color: '#e37933', category: 'data' },
	'csv': { icon: FileSpreadsheetIcon, color: '#207245', category: 'data' },
	'xlsx': { icon: FileSpreadsheetIcon, color: '#207245', category: 'data' },
	'xls': { icon: FileSpreadsheetIcon, color: '#207245', category: 'data' },
	'sql': { icon: DatabaseIcon, color: '#336791', category: 'database' },
	'db': { icon: DatabaseIcon, color: '#336791', category: 'database' },
	'sqlite': { icon: DatabaseIcon, color: '#003b57', category: 'database' },

	// Programming languages
	'py': { icon: CodeIcon, color: '#3776ab', category: 'python' },
	'pyx': { icon: CodeIcon, color: '#3776ab', category: 'python' },
	'pyw': { icon: CodeIcon, color: '#3776ab', category: 'python' },
	'rs': { icon: CodeIcon, color: '#dea584', category: 'rust' },
	'go': { icon: CodeIcon, color: '#00add8', category: 'go' },
	'java': { icon: CodeIcon, color: '#ed8b00', category: 'java' },
	'c': { icon: CodeIcon, color: '#555555', category: 'c' },
	'cpp': { icon: CodeIcon, color: '#00599c', category: 'cpp' },
	'cc': { icon: CodeIcon, color: '#00599c', category: 'cpp' },
	'cxx': { icon: CodeIcon, color: '#00599c', category: 'cpp' },
	'h': { icon: CodeIcon, color: '#a8b9cc', category: 'header' },
	'hpp': { icon: CodeIcon, color: '#a8b9cc', category: 'header' },
	'cs': { icon: CodeIcon, color: '#239120', category: 'csharp' },
	'php': { icon: CodeIcon, color: '#777bb4', category: 'php' },
	'rb': { icon: CodeIcon, color: '#cc342d', category: 'ruby' },
	'swift': { icon: CodeIcon, color: '#fa7343', category: 'swift' },
	'kt': { icon: CodeIcon, color: '#7f52ff', category: 'kotlin' },
	'scala': { icon: CodeIcon, color: '#dc322f', category: 'scala' },
	'r': { icon: CodeIcon, color: '#276dc3', category: 'r' },
	'dart': { icon: CodeIcon, color: '#0175c2', category: 'dart' },

	// Shell and scripting
	'sh': { icon: TerminalIcon, color: '#4eaa25', category: 'shell' },
	'bash': { icon: TerminalIcon, color: '#4eaa25', category: 'shell' },
	'zsh': { icon: TerminalIcon, color: '#4eaa25', category: 'shell' },
	'fish': { icon: TerminalIcon, color: '#4eaa25', category: 'shell' },
	'ps1': { icon: TerminalIcon, color: '#012456', category: 'powershell' },
	'bat': { icon: TerminalIcon, color: '#c1f12e', category: 'batch' },
	'cmd': { icon: TerminalIcon, color: '#c1f12e', category: 'batch' },

	// Images
	'jpg': { icon: ImageIcon, color: '#ff6b35', category: 'image' },
	'jpeg': { icon: ImageIcon, color: '#ff6b35', category: 'image' },
	'png': { icon: ImageIcon, color: '#ff6b35', category: 'image' },
	'gif': { icon: ImageIcon, color: '#ff6b35', category: 'image' },
	'svg': { icon: ImageIcon, color: '#ffb13b', category: 'image' },
	'webp': { icon: ImageIcon, color: '#ff6b35', category: 'image' },
	'bmp': { icon: ImageIcon, color: '#ff6b35', category: 'image' },
	'ico': { icon: ImageIcon, color: '#ff6b35', category: 'image' },

	// Media
	'mp4': { icon: FileVideoIcon, color: '#fd7e14', category: 'video' },
	'avi': { icon: FileVideoIcon, color: '#fd7e14', category: 'video' },
	'mov': { icon: FileVideoIcon, color: '#fd7e14', category: 'video' },
	'wmv': { icon: FileVideoIcon, color: '#fd7e14', category: 'video' },
	'flv': { icon: FileVideoIcon, color: '#fd7e14', category: 'video' },
	'webm': { icon: FileVideoIcon, color: '#fd7e14', category: 'video' },
	'mp3': { icon: FileAudioIcon, color: '#e83e8c', category: 'audio' },
	'wav': { icon: FileAudioIcon, color: '#e83e8c', category: 'audio' },
	'flac': { icon: FileAudioIcon, color: '#e83e8c', category: 'audio' },
	'ogg': { icon: FileAudioIcon, color: '#e83e8c', category: 'audio' },

	// Archives
	'zip': { icon: FileArchiveIcon, color: '#6f42c1', category: 'archive' },
	'rar': { icon: FileArchiveIcon, color: '#6f42c1', category: 'archive' },
	'7z': { icon: FileArchiveIcon, color: '#6f42c1', category: 'archive' },
	'tar': { icon: FileArchiveIcon, color: '#6f42c1', category: 'archive' },
	'gz': { icon: FileArchiveIcon, color: '#6f42c1', category: 'archive' },
	'bz2': { icon: FileArchiveIcon, color: '#6f42c1', category: 'archive' },

	// Package managers and lock files
	'lock': { icon: FileLockIcon, color: '#d63384', category: 'lockfile' },
	'package-lock.json': { icon: FileLockIcon, color: '#cb3837', category: 'lockfile' },
	'yarn.lock': { icon: FileLockIcon, color: '#2c8ebb', category: 'lockfile' },
	'pnpm-lock.yaml': { icon: FileLockIcon, color: '#f9ad00', category: 'lockfile' },
	'bun.lockb': { icon: FileLockIcon, color: '#fbf0df', category: 'lockfile' },
	'Cargo.lock': { icon: FileLockIcon, color: '#dea584', category: 'lockfile' },
	'Gemfile.lock': { icon: FileLockIcon, color: '#cc342d', category: 'lockfile' },

	// Special files
	'env': { icon: KeyIcon, color: '#ecd53f', category: 'env' },
	'env.local': { icon: KeyIcon, color: '#ecd53f', category: 'env' },
	'env.development': { icon: KeyIcon, color: '#ecd53f', category: 'env' },
	'env.production': { icon: KeyIcon, color: '#ecd53f', category: 'env' },
	'gitignore': { icon: GitBranchIcon, color: '#f05032', category: 'git' },
	'gitattributes': { icon: GitBranchIcon, color: '#f05032', category: 'git' },
	'dockerignore': { icon: BoxIcon, color: '#2496ed', category: 'docker' },
	'dockerfile': { icon: BoxIcon, color: '#2496ed', category: 'docker' },

	// Test files
	'test.js': { icon: TestTube2Icon, color: '#25c2a0', category: 'test' },
	'test.ts': { icon: TestTube2Icon, color: '#25c2a0', category: 'test' },
	'spec.js': { icon: TestTube2Icon, color: '#25c2a0', category: 'test' },
	'spec.ts': { icon: TestTube2Icon, color: '#25c2a0', category: 'test' },

	// Build and tooling
	'webpack.config.js': { icon: WrenchIcon, color: '#8ed6fb', category: 'build' },
	'vite.config.js': { icon: WrenchIcon, color: '#646cff', category: 'build' },
	'vite.config.ts': { icon: WrenchIcon, color: '#646cff', category: 'build' },
	'rollup.config.js': { icon: WrenchIcon, color: '#ec3a37', category: 'build' },
	'tsconfig.json': { icon: WrenchIcon, color: '#3178c6', category: 'build' },
	'eslint.config.js': { icon: WrenchIcon, color: '#4b32c3', category: 'build' },
	'prettier.config.js': { icon: WrenchIcon, color: '#f7b93e', category: 'build' },
	'tailwind.config.js': { icon: WrenchIcon, color: '#06b6d4', category: 'build' },
	'svelte.config.js': { icon: WrenchIcon, color: '#ff3e00', category: 'build' },
};

// Special filename patterns
const specialFiles: Record<string, { icon: IconComponent; color?: string; category: string }> = {
	'README': { icon: BookIcon, color: '#083fa1', category: 'documentation' },
	'README.md': { icon: BookIcon, color: '#083fa1', category: 'documentation' },
	'CHANGELOG': { icon: BookIcon, color: '#083fa1', category: 'documentation' },
	'CHANGELOG.md': { icon: BookIcon, color: '#083fa1', category: 'documentation' },
	'LICENSE': { icon: ShieldIcon, color: '#28a745', category: 'legal' },
	'LICENSE.md': { icon: ShieldIcon, color: '#28a745', category: 'legal' },
	'package.json': { icon: PackageIcon, color: '#cb3837', category: 'package' },
	'composer.json': { icon: PackageIcon, color: '#885630', category: 'package' },
	'Cargo.toml': { icon: PackageIcon, color: '#dea584', category: 'package' },
	'Gemfile': { icon: PackageIcon, color: '#cc342d', category: 'package' },
	'requirements.txt': { icon: PackageIcon, color: '#3776ab', category: 'package' },
	'Pipfile': { icon: PackageIcon, color: '#3776ab', category: 'package' },
	'pubspec.yaml': { icon: PackageIcon, color: '#0175c2', category: 'package' },
	'.gitignore': { icon: GitBranchIcon, color: '#f05032', category: 'git' },
	'.gitattributes': { icon: GitBranchIcon, color: '#f05032', category: 'git' },
	'.env': { icon: KeyIcon, color: '#ecd53f', category: 'env' },
	'.env.local': { icon: KeyIcon, color: '#ecd53f', category: 'env' },
	'.env.example': { icon: KeyIcon, color: '#ecd53f', category: 'env' },
	'Dockerfile': { icon: BoxIcon, color: '#2496ed', category: 'docker' },
	'.dockerignore': { icon: BoxIcon, color: '#2496ed', category: 'docker' },
	'docker-compose.yml': { icon: BoxIcon, color: '#2496ed', category: 'docker' },
	'docker-compose.yaml': { icon: BoxIcon, color: '#2496ed', category: 'docker' },
};

/**
 * Get the appropriate icon for a file based on its name or extension
 */
export function getFileIcon(fileName: string, isDirectory: boolean = false): IconComponent {
	if (isDirectory) {
		return FolderIcon;
	}

	// Check for exact filename matches first
	if (specialFiles[fileName]) {
		return specialFiles[fileName].icon;
	}

	// Check for extension matches
	const extension = getFileExtension(fileName);
	if (extension && fileTypeMappings[extension]) {
		return fileTypeMappings[extension].icon;
	}

	// Check for compound extensions (like .test.js, .config.js, etc.)
	const parts = fileName.split('.');
	if (parts.length >= 3) {
		const compoundExt = parts.slice(-2).join('.');
		if (fileTypeMappings[compoundExt]) {
			return fileTypeMappings[compoundExt].icon;
		}
	}

	// Default to generic file icon
	return FileIcon;
}

/**
 * Get the directory icon (open or closed)
 */
export function getDirectoryIcon(isExpanded: boolean = false): IconComponent {
	return isExpanded ? FolderOpenIcon : FolderIcon;
}

/**
 * Get the color associated with a file type
 */
export function getFileColor(fileName: string, isDirectory: boolean = false): string | undefined {
	if (isDirectory) {
		return '#3b82f6'; // Blue for directories
	}

	// Check special files first
	if (specialFiles[fileName]) {
		return specialFiles[fileName].color;
	}

	// Check extension
	const extension = getFileExtension(fileName);
	if (extension && fileTypeMappings[extension]) {
		return fileTypeMappings[extension].color;
	}

	return undefined;
}

/**
 * Get the category of a file type
 */
export function getFileCategory(fileName: string, isDirectory: boolean = false): string {
	if (isDirectory) {
		return 'directory';
	}

	// Check special files first
	if (specialFiles[fileName]) {
		return specialFiles[fileName].category;
	}

	// Check extension
	const extension = getFileExtension(fileName);
	if (extension && fileTypeMappings[extension]) {
		return fileTypeMappings[extension].category;
	}

	return 'unknown';
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
 * Get all available file categories
 */
export function getFileCategories(): string[] {
	const categories = new Set<string>();

	Object.values(fileTypeMappings).forEach(mapping => {
		categories.add(mapping.category);
	});

	Object.values(specialFiles).forEach(mapping => {
		categories.add(mapping.category);
	});

	return Array.from(categories).sort();
}

/**
 * Get files by category
 */
export function getFilesByCategory(files: string[]): Record<string, string[]> {
	const categorized: Record<string, string[]> = {};

	files.forEach(fileName => {
		const category = getFileCategory(fileName);
		if (!categorized[category]) {
			categorized[category] = [];
		}
		categorized[category].push(fileName);
	});

	return categorized;
}
