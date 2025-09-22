import { type Extension } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { svelte } from '@replit/codemirror-lang-svelte';

// Language extensions
export const languageExtensions: Record<string, () => Extension> = {
	javascript: () => javascript({ jsx: true }),
	typescript: () => javascript({ typescript: true, jsx: true }),
	python: () => python(),
	html: () => html(),
	css: () => css(),
	json: () => json(),
	svelte: () => svelte(),
	markdown: () => markdown()
};

// Get language from filename
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
