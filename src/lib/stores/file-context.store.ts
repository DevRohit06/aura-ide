// File context service for chat integration
import type { File } from '$lib/types/files';
import type { ContextVariables } from '$lib/types/llm.types';
import { derived, writable, type Readable, type Writable } from 'svelte/store';
import { activeFile } from './tabs.store.js';

export interface FileContextInfo {
	file: File | null;
	isAttached: boolean;
	context: ContextVariables;
}

/**
 * Store that tracks the current file context for chat integration
 */
class FileContextStore {
	private _isEnabled: Writable<boolean> = writable(true);
	private _forceAttached: Writable<string | null> = writable(null);

	/**
	 * Whether file context is enabled for chat
	 */
	get isEnabled(): boolean {
		let value = false;
		this._isEnabled.subscribe((v) => (value = v))();
		return value;
	}

	set isEnabled(value: boolean) {
		this._isEnabled.set(value);
	}

	/**
	 * Force attach a specific file (overrides automatic detection)
	 */
	get forceAttached(): string | null {
		let value = null;
		this._forceAttached.subscribe((v) => (value = v))();
		return value;
	}

	set forceAttached(fileId: string | null) {
		this._forceAttached.set(fileId);
	}

	/**
	 * Enable file context for chat
	 */
	enable(): void {
		this._isEnabled.set(true);
	}

	/**
	 * Disable file context for chat
	 */
	disable(): void {
		this._isEnabled.set(false);
	}

	/**
	 * Toggle file context
	 */
	toggle(): void {
		this._isEnabled.update((enabled) => !enabled);
	}

	/**
	 * Manually attach a file to chat context
	 */
	attachFile(fileId: string): void {
		this._forceAttached.set(fileId);
		this._isEnabled.set(true);
	}

	/**
	 * Remove manually attached file
	 */
	detachFile(): void {
		this._forceAttached.set(null);
	}

	/**
	 * Reset to automatic file detection
	 */
	reset(): void {
		this._forceAttached.set(null);
		this._isEnabled.set(true);
	}

	/**
	 * Get store references for reactive updates
	 */
	get stores() {
		return {
			isEnabled: this._isEnabled,
			forceAttached: this._forceAttached
		};
	}
}

// Create singleton instance
export const fileContextStore = new FileContextStore();

/**
 * Derived store that provides current file context information
 */
export const fileContext: Readable<FileContextInfo> = derived(
	[activeFile, fileContextStore.stores.isEnabled, fileContextStore.stores.forceAttached],
	([$activeFile, $isEnabled, $forceAttached]) => {
		const file = $activeFile;
		const isAttached = $isEnabled && file !== null;

		// Extract context variables from the active file
		const context: ContextVariables = {};

		if (file && isAttached) {
			context.fileName = file.name;
			context.filePath = file.path;
			context.language = file.language;
			context.projectName = extractProjectName(file.path);

			// Add file-specific context
			if (file.content) {
				context.selectedCode = getSelectedCode(file);
			}

			// Add metadata context
			if (file.metadata) {
				context.cursorPosition = file.metadata.lastCursor || undefined;
			}

			// Add AI context if available
			if (file.aiContext) {
				context.framework = detectFramework(file.aiContext.dependencies);
			}
		}

		return {
			file,
			isAttached,
			context
		};
	}
);

/**
 * Extract project name from file path
 */
function extractProjectName(filePath: string): string {
	const segments = filePath.split('/');
	// Try to find a meaningful project name from the path
	// Look for common project indicators
	const projectIndicators = ['src', 'lib', 'app', 'components'];

	for (let i = 0; i < segments.length; i++) {
		if (projectIndicators.includes(segments[i]) && i > 0) {
			return segments[i - 1];
		}
	}

	// Fallback to first non-empty segment
	return segments.find((segment) => segment.length > 0) || 'Project';
}

/**
 * Get selected code from file (for now, return a snippet)
 */
function getSelectedCode(file: File): string {
	if (!file.content) return '';

	// For now, return first few lines as context
	// In a real implementation, this would get actual selected text from editor
	const lines = file.content.split('\n');
	const maxLines = 20;

	if (lines.length <= maxLines) {
		return file.content;
	}

	return lines.slice(0, maxLines).join('\n') + '\n// ... (truncated)';
}

/**
 * Detect framework from dependencies
 */
function detectFramework(dependencies: string[]): string | undefined {
	const frameworks = [
		{ name: 'React', patterns: ['react', '@react'] },
		{ name: 'Vue', patterns: ['vue', '@vue'] },
		{ name: 'Svelte', patterns: ['svelte', '@svelte'] },
		{ name: 'Angular', patterns: ['@angular', 'angular'] },
		{ name: 'Next.js', patterns: ['next'] },
		{ name: 'Nuxt', patterns: ['nuxt'] },
		{ name: 'SvelteKit', patterns: ['@sveltejs/kit'] },
		{ name: 'Express', patterns: ['express'] },
		{ name: 'Fastify', patterns: ['fastify'] },
		{ name: 'NestJS', patterns: ['@nestjs'] }
	];

	for (const framework of frameworks) {
		for (const pattern of framework.patterns) {
			if (dependencies.some((dep) => dep.includes(pattern))) {
				return framework.name;
			}
		}
	}

	return undefined;
}

/**
 * Utility function to create chat context from current file
 */
export function createChatContext(): ContextVariables {
	let currentContext: ContextVariables = {};

	// Subscribe to fileContext to get current value
	const unsubscribe = fileContext.subscribe(($fileContext) => {
		currentContext = $fileContext.context;
	});

	// Cleanup subscription immediately after getting value
	unsubscribe();

	return currentContext;
}

/**
 * Check if any file is currently attached to chat
 */
export function hasFileAttached(): boolean {
	let isAttached = false;

	const unsubscribe = fileContext.subscribe(($fileContext) => {
		isAttached = $fileContext.isAttached;
	});

	unsubscribe();

	return isAttached;
}

/**
 * Get the currently attached file
 */
export function getAttachedFile(): File | null {
	let attachedFile: File | null = null;

	const unsubscribe = fileContext.subscribe(($fileContext) => {
		attachedFile = $fileContext.isAttached ? $fileContext.file : null;
	});

	unsubscribe();

	return attachedFile;
}

/**
 * Get file extension icon
 */
export function getFileIcon(file: File): string {
	const iconMap: Record<string, string> = {
		ts: '🔷',
		js: '🟨',
		tsx: '⚛️',
		jsx: '⚛️',
		vue: '💚',
		svelte: '🧡',
		html: '🌐',
		css: '🎨',
		scss: '🎨',
		json: '📄',
		md: '📝',
		py: '🐍',
		java: '☕',
		php: '🐘',
		go: '🐹',
		rs: '🦀',
		cpp: '⚡',
		c: '⚡',
		yml: '⚙️',
		yaml: '⚙️',
		xml: '📄',
		sql: '🗃️'
	};

	const extension =
		file.metadata?.extension?.toLowerCase() || file.name.split('.').pop()?.toLowerCase() || '';

	return iconMap[extension] || '📄';
}

/**
 * Get file size in human readable format
 */
export function getHumanFileSize(bytes: number): string {
	const sizes = ['B', 'KB', 'MB', 'GB'];
	if (bytes === 0) return '0 B';

	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	const size = bytes / Math.pow(1024, i);

	return `${size.toFixed(1)} ${sizes[i]}`;
}

// Export for use in components
export { FileContextStore };
