// Main editor components
export { default as CodemirrorEditor } from '../code-editor/codemirror-editor.svelte';
export { default as FileTabs } from './file-tabs.svelte';

// Re-export editor stores for convenience
export {
	// Stores
	filesStore,
	tabsStore,
	activeFileId,
	openFiles,
	activeFile,
	layoutStore,
	panelsStore,
	settingsStore,
	fileStatesStore,
	activeFileState,
	// Actions
	fileActions,
	tabActions,
	layoutActions,
	panelActions,
	settingsActions,
	fileStateActions
} from '../../stores/editor.js';

// Utility functions
export function getLanguageFromFilename(filename: string): string {
	const ext = filename.split('.').pop()?.toLowerCase();
	switch (ext) {
		case 'js':
		case 'jsx':
			return 'javascript';
		case 'ts':
		case 'tsx':
			return 'typescript';
		case 'py':
			return 'python';
		case 'html':
			return 'html';
		case 'css':
		case 'scss':
		case 'sass':
			return 'css';
		case 'json':
			return 'json';
		case 'md':
		case 'markdown':
			return 'markdown';
		case 'svelte':
			return 'svelte';
		default:
			return 'javascript';
	}
}

// File icon utility
export function getFileIcon(filename: string): string {
	const ext = filename.split('.').pop()?.toLowerCase();
	switch (ext) {
		case 'md':
		case 'markdown':
			return 'material-icon-theme:markdown';
		case 'svelte':
			return 'material-icon-theme:svelte';
		case 'js':
		case 'jsx':
			return 'material-icon-theme:javascript';
		case 'ts':
		case 'tsx':
			return 'material-icon-theme:typescript';
		case 'json':
			return 'material-icon-theme:json';
		case 'css':
		case 'scss':
		case 'sass':
			return 'material-icon-theme:css';
		case 'html':
			return 'material-icon-theme:html';
		case 'py':
			return 'material-icon-theme:python';
		default:
			return 'fa-solid:file-alt';
	}
}

// Supported languages
export const SUPPORTED_LANGUAGES = [
	'javascript',
	'typescript',
	'svelte',
	'python',
	'html',
	'css',
	'json',
	'markdown'
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
