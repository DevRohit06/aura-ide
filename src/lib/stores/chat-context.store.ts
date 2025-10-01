import { derived } from 'svelte/store';
import { activeFile } from './tabs.store.js';

// Chat context interface
export interface ChatFileContext {
	fileName?: string;
	filePath?: string;
	language?: string;
	content?: string;
	isActive: boolean;
}

// Derived store for current file context in chat
export const chatFileContext = derived(activeFile, ($activeFile): ChatFileContext => {
	if (!$activeFile) {
		return {
			isActive: false
		};
	}

	// Extract file extension for language detection
	const filePath = $activeFile.path;
	const fileName = $activeFile.name;
	const extension = fileName.split('.').pop()?.toLowerCase();

	// Map common extensions to languages
	const languageMap: Record<string, string> = {
		ts: 'typescript',
		js: 'javascript',
		py: 'python',
		rs: 'rust',
		go: 'go',
		java: 'java',
		c: 'c',
		cpp: 'cpp',
		h: 'c',
		hpp: 'cpp',
		cs: 'csharp',
		php: 'php',
		rb: 'ruby',
		swift: 'swift',
		kt: 'kotlin',
		scala: 'scala',
		clj: 'clojure',
		html: 'html',
		css: 'css',
		scss: 'scss',
		sass: 'sass',
		less: 'less',
		json: 'json',
		xml: 'xml',
		yaml: 'yaml',
		yml: 'yaml',
		md: 'markdown',
		sql: 'sql',
		sh: 'bash',
		bash: 'bash',
		zsh: 'zsh',
		ps1: 'powershell',
		dockerfile: 'dockerfile'
	};

	const language = extension ? languageMap[extension] || extension : 'plaintext';

	return {
		fileName,
		filePath,
		language,
		content: $activeFile.content,
		isActive: true
	};
});

// Chat context actions
export const chatContextActions = {
	// Get current context for API calls
	getCurrentContext(): ChatFileContext | null {
		let context: ChatFileContext | null = null;
		const unsubscribe = chatFileContext.subscribe((c) => {
			context = c.isActive ? c : null;
		});
		unsubscribe();
		return context;
	},

	// Check if there's an active file context
	hasActiveContext(): boolean {
		let hasContext = false;
		const unsubscribe = chatFileContext.subscribe((c) => {
			hasContext = c.isActive;
		});
		unsubscribe();
		return hasContext;
	}
};
