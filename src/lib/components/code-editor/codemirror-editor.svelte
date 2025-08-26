<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { EditorView, basicSetup } from 'codemirror';
	import { EditorState, type Extension } from '@codemirror/state';
	import { javascript } from '@codemirror/lang-javascript';
	import { python } from '@codemirror/lang-python';
	import { html } from '@codemirror/lang-html';
	import { css } from '@codemirror/lang-css';
	import { json } from '@codemirror/lang-json';
	import { markdown } from '@codemirror/lang-markdown';
	import { oneDark } from '@codemirror/theme-one-dark';
	import { keymap } from '@codemirror/view';
	import { indentWithTab } from '@codemirror/commands';
	import { search, searchKeymap, highlightSelectionMatches } from '@codemirror/search';
	import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
	import { svelte } from '@replit/codemirror-lang-svelte';

	import {
		tabsStore,
		filesStore,
		fileStateActions,
		fileActions,
		settingsStore
	} from '$lib/stores/editor.js';
	import { mode } from 'mode-watcher';

	// State
	let editorContainer = $state<HTMLDivElement>();
	let editorView = $state<EditorView | null>(null);
	let mounted = $state(false);
	let currentFileId = $state<string | null>(null);

	// Language extensions
	const languageExtensions: Record<string, () => Extension> = {
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
	function getLanguageFromFilename(filename: string): string {
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

	// Create theme
	function createTheme(isDark: boolean) {
		const fontSize = $settingsStore.fontSize || 14;
		const fontFamily = $settingsStore.fontFamily || 'JetBrains Mono, monospace';

		return EditorView.theme(
			{
				'&': {
					fontSize: `${fontSize}px`,
					fontFamily: fontFamily,
					height: '100%'
				},
				'.cm-content': {
					padding: '16px',
					lineHeight: '1.6'
				},
				'.cm-focused': {
					outline: 'none'
				},
				'.cm-editor': {
					height: '100%'
				},
				'.cm-search': {
					fontFamily: fontFamily,
					fontSize: '13px'
				}
			},
			{ dark: isDark }
		);
	}

	// Get extensions
	function getExtensions(filename?: string): Extension[] {
		const extensions: Extension[] = [
			basicSetup,
			keymap.of([
				...completionKeymap, // Add completion keybindings
				...searchKeymap, // Add search keybindings (Ctrl+F, F3, etc.)
				indentWithTab,
				{ key: 'Ctrl-s', run: () => handleSave() },
				{ key: 'Cmd-s', run: () => handleSave() },
				// Enhanced search shortcuts
				{
					key: 'Ctrl-h',
					run: () => {
						/* Replace shortcut - handled by search panel */ return false;
					}
				},
				{
					key: 'Cmd-h',
					run: () => {
						/* Replace shortcut - handled by search panel */ return false;
					}
				},
				{
					key: 'Escape',
					run: (view) => {
						// Close search panel on escape if it's open
						const searchPanel = view.dom.querySelector('.cm-search');
						if (searchPanel) {
							const closeButton = searchPanel.querySelector(
								'button[name="close"]'
							) as HTMLButtonElement;
							if (closeButton) {
								closeButton.click();
								return true;
							}
						}
						return false;
					}
				}
			]),
			search({
				top: true,
				caseSensitive: false,
				literal: false,
				wholeWord: false,
				createPanel(view) {
					return {
						dom: view.dom.ownerDocument.createElement('div'),
						mount() {},
						destroy() {}
					};
				}
			}), // Enhanced search with more options
			highlightSelectionMatches(), // Highlight other instances of selected text
			autocompletion({
				activateOnTyping: true, // Show completions as you type
				maxRenderedOptions: 10, // Limit dropdown size
				defaultKeymap: true
			}),
			EditorView.lineWrapping
		];

		// Add language support
		if (filename) {
			const language = getLanguageFromFilename(filename);
			const langExt = languageExtensions[language];
			if (langExt) {
				extensions.push(langExt());
			}
		}

		// Add theme
		const isDark = $settingsStore.theme === 'dark' && mode.current === 'dark';
		extensions.push(createTheme(isDark));
		if (isDark) {
			extensions.push(oneDark);
		}

		// Update listener for content changes
		extensions.push(
			EditorView.updateListener.of((update) => {
				if (update.docChanged && currentFileId) {
					const newContent = update.state.doc.toString();
					fileActions.updateFileContent(currentFileId, newContent);
					fileStateActions.setFileDirty(currentFileId, true);

					// Save cursor position
					const cursor = update.state.selection.main.head;
					fileStateActions.updateFileState(currentFileId, {
						cursorPosition: cursor
					});
				}
			})
		);

		return extensions;
	}

	// Handle save
	function handleSave() {
		if (currentFileId && fileStateActions.isFileDirty(currentFileId)) {
			fileStateActions.setFileDirty(currentFileId, false);
			return true;
		}
		return false;
	}

	// Create editor state
	function createEditorState(content: string, filename?: string): EditorState {
		return EditorState.create({
			doc: content,
			extensions: getExtensions(filename)
		});
	}

	// Initialize editor
	function initializeEditor() {
		if (!editorContainer || !mounted) return;

		const activeFileId = $tabsStore.activeFileId;
		if (!activeFileId) return;

		const file = $filesStore.get(activeFileId);
		if (!file) return;

		// Clean up existing editor
		if (editorView) {
			editorView.destroy();
			editorView = null;
		}

		currentFileId = activeFileId;
		const content = file.content || '';
		const filename = file.name;

		// Create new editor
		const state = createEditorState(content, filename);
		editorView = new EditorView({
			state,
			parent: editorContainer
		});

		// Restore cursor position
		const fileState = fileStateActions.getFileState(activeFileId);
		if (fileState?.cursorPosition && typeof fileState.cursorPosition === 'number') {
			requestAnimationFrame(() => {
				if (editorView && currentFileId === activeFileId) {
					editorView.dispatch({
						selection: { anchor: fileState.cursorPosition as number }
					});
				}
			});
		}
	}

	// Cleanup
	function cleanup() {
		if (editorView) {
			editorView.destroy();
			editorView = null;
		}
		currentFileId = null;
	}

	// Lifecycle
	onMount(() => {
		mounted = true;
		initializeEditor();
	});

	onDestroy(() => {
		cleanup();
	});

	// React to file changes
	$effect(() => {
		const activeFileId = $tabsStore.activeFileId;

		if (!mounted || !activeFileId) {
			cleanup();
			return;
		}

		if (currentFileId !== activeFileId) {
			initializeEditor();
		}
	});

	// React to theme changes
	$effect(() => {
		const theme = $settingsStore.theme;
		const fontSize = $settingsStore.fontSize;
		const fontFamily = $settingsStore.fontFamily;

		if (mounted && editorView && currentFileId) {
			const filename = $filesStore.get(currentFileId)?.name;
			const extensions = getExtensions(filename);
			// editorView.dispatch({
			// 	effects: EditorState.reconfigure.of(extensions)
			// });
		}
	});
</script>

<div class="editor-wrapper" bind:this={editorContainer}></div>

<style>
	.editor-wrapper {
		width: 100%;
		height: 100%;
		overflow: hidden;
		position: relative;
	}

	/* CodeMirror styles - simplified and fixed for scrolling */
	:global(.cm-editor) {
		height: 100%;
	}

	:global(.cm-scroller) {
		overflow: auto;
		height: 100%;
	}

	:global(.cm-content) {
		padding: 16px;
		min-height: 100%;
	}

	/* Search panel styling - Modern and accessible */
	:global(.cm-search) {
		background: rgba(255, 255, 255, 0.98);
		border: 1px solid rgba(0, 0, 0, 0.1);
		border-radius: 8px;
		padding: 12px 16px;
		box-shadow:
			0 4px 12px rgba(0, 0, 0, 0.1),
			0 2px 4px rgba(0, 0, 0, 0.06);
		backdrop-filter: blur(8px);
		font-family: inherit;
		font-size: 13px;
		min-width: 320px;
		max-width: 400px;
		margin: 8px;
		animation: searchPanelSlideIn 0.15s ease-out;
		position: relative;
		z-index: 100;
	}

	@keyframes searchPanelSlideIn {
		from {
			opacity: 0;
			transform: translateY(-8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	:global(.cm-theme-dark .cm-search) {
		background: rgba(32, 36, 44, 0.98);
		border-color: rgba(255, 255, 255, 0.15);
		color: #abb2bf;
		box-shadow:
			0 4px 12px rgba(0, 0, 0, 0.3),
			0 2px 4px rgba(0, 0, 0, 0.2);
	}

	/* Search input styling */
	:global(.cm-search input[type='text']) {
		background: rgba(0, 0, 0, 0.04);
		border: 1px solid rgba(0, 0, 0, 0.12);
		border-radius: 6px;
		padding: 8px 12px;
		font-family: inherit;
		font-size: 13px;
		line-height: 1.4;
		outline: none;
		transition: all 0.15s ease;
		min-width: 200px;
		margin-right: 8px;
	}

	:global(.cm-search input[type='text']:focus) {
		background: rgba(255, 255, 255, 0.8);
		border-color: #0066cc;
		box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
	}

	:global(.cm-theme-dark .cm-search input[type='text']) {
		background: rgba(255, 255, 255, 0.08);
		border-color: rgba(255, 255, 255, 0.2);
		color: #abb2bf;
	}

	:global(.cm-theme-dark .cm-search input[type='text']:focus) {
		background: rgba(255, 255, 255, 0.12);
		border-color: #61afef;
		box-shadow: 0 0 0 2px rgba(97, 175, 239, 0.15);
	}

	:global(.cm-search input[type='text']::placeholder) {
		color: rgba(0, 0, 0, 0.5);
		font-style: italic;
	}

	:global(.cm-theme-dark .cm-search input[type='text']::placeholder) {
		color: rgba(255, 255, 255, 0.4);
	}

	/* Search buttons styling */
	:global(.cm-search button) {
		background: rgba(0, 0, 0, 0.06);
		border: 1px solid rgba(0, 0, 0, 0.12);
		border-radius: 6px;
		padding: 6px 10px;
		margin: 0 2px;
		font-family: inherit;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
		outline: none;
		color: inherit;
		min-width: 32px;
		height: 32px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	:global(.cm-search button:hover) {
		background: rgba(0, 102, 204, 0.1);
		border-color: rgba(0, 102, 204, 0.3);
		transform: translateY(-1px);
	}

	:global(.cm-search button:active) {
		transform: translateY(0);
		background: rgba(0, 102, 204, 0.15);
	}

	:global(.cm-theme-dark .cm-search button) {
		background: rgba(255, 255, 255, 0.08);
		border-color: rgba(255, 255, 255, 0.15);
		color: #abb2bf;
	}

	:global(.cm-theme-dark .cm-search button:hover) {
		background: rgba(97, 175, 239, 0.15);
		border-color: rgba(97, 175, 239, 0.4);
	}

	:global(.cm-theme-dark .cm-search button:active) {
		background: rgba(97, 175, 239, 0.2);
	}

	/* Close button special styling */
	:global(.cm-search button[name='close']) {
		background: rgba(239, 68, 68, 0.1);
		border-color: rgba(239, 68, 68, 0.3);
		color: #dc2626;
		margin-left: 8px;
	}

	:global(.cm-search button[name='close']:hover) {
		background: rgba(239, 68, 68, 0.15);
		border-color: rgba(239, 68, 68, 0.5);
	}

	:global(.cm-theme-dark .cm-search button[name='close']) {
		background: rgba(224, 108, 117, 0.15);
		border-color: rgba(224, 108, 117, 0.3);
		color: #e06c75;
	}

	/* Search result count styling */
	:global(.cm-search .cm-search-results) {
		font-size: 12px;
		color: rgba(0, 0, 0, 0.6);
		margin: 0 8px;
		font-weight: 500;
		white-space: nowrap;
	}

	:global(.cm-theme-dark .cm-search .cm-search-results) {
		color: rgba(255, 255, 255, 0.6);
	}

	/* Search match highlighting */
	:global(.cm-searchMatch) {
		background: rgba(255, 235, 59, 0.4);
		border: 1px solid rgba(255, 193, 7, 0.6);
		border-radius: 2px;
		box-decoration-break: clone;
		animation: searchMatchPulse 0.3s ease-out;
	}

	:global(.cm-searchMatch.cm-searchMatch-selected) {
		background: rgba(255, 152, 0, 0.5);
		border-color: rgba(255, 152, 0, 0.8);
	}

	:global(.cm-theme-dark .cm-searchMatch) {
		background: rgba(229, 192, 123, 0.3);
		border-color: rgba(229, 192, 123, 0.6);
	}

	:global(.cm-theme-dark .cm-searchMatch.cm-searchMatch-selected) {
		background: rgba(209, 154, 102, 0.4);
		border-color: rgba(209, 154, 102, 0.8);
	}

	@keyframes searchMatchPulse {
		0% {
			transform: scale(1);
			background: rgba(255, 235, 59, 0.6);
		}
		50% {
			transform: scale(1.02);
			background: rgba(255, 235, 59, 0.8);
		}
		100% {
			transform: scale(1);
			background: rgba(255, 235, 59, 0.4);
		}
	}

	/* Selection match highlighting (from highlightSelectionMatches) */
	:global(.cm-selectionMatch) {
		background: rgba(0, 102, 204, 0.15);
		border: 1px solid rgba(0, 102, 204, 0.3);
		border-radius: 2px;
	}

	:global(.cm-theme-dark .cm-selectionMatch) {
		background: rgba(97, 175, 239, 0.2);
		border-color: rgba(97, 175, 239, 0.4);
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		:global(.cm-search) {
			min-width: 280px;
			max-width: calc(100vw - 32px);
			font-size: 12px;
			padding: 10px 12px;
		}

		:global(.cm-search input[type='text']) {
			min-width: 150px;
			font-size: 12px;
			padding: 6px 10px;
		}

		:global(.cm-search button) {
			padding: 5px 8px;
			font-size: 11px;
			min-width: 28px;
			height: 28px;
		}
	}

	/* Autocompletion styling */
	:global(.cm-tooltip-autocomplete) {
		background: white;
		border: 1px solid #ddd;
		border-radius: 6px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		max-height: 200px;
	}

	:global(.cm-theme-dark .cm-tooltip-autocomplete) {
		background: #2c313c;
		border-color: #555;
		color: #abb2bf;
	}

	:global(.cm-completionIcon) {
		width: 16px;
		height: 16px;
		margin-right: 6px;
		opacity: 0.7;
	}
</style>
