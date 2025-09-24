<script lang="ts">
	import { history } from '@codemirror/commands';
	import { indentOnInput } from '@codemirror/language';
	import { EditorState, type Extension } from '@codemirror/state';
	import { oneDark } from '@codemirror/theme-one-dark';
	import { highlightActiveLine } from '@codemirror/view';
	import { EditorView } from 'codemirror';
	import { onDestroy, onMount } from 'svelte';
	import { dracula, tomorrow, barf } from 'thememirror';
	import ContextMenu from './context-menu.svelte';
	import SearchPanel from './search-panel.svelte';
	// Extracted utilities
	import {
		autocompletionCompartment,
		bracketMatchingCompartment,
		foldingCompartment,
		getAutocompletionExtension,
		getBracketMatchingExtension,
		getFoldingExtension,
		getIndentationExtension,
		getKeymapExtension,
		getLineNumbersExtension,
		getMultiCursorExtension,
		getScrollExtension,
		getSearchExtension,
		getWordWrapExtension,
		indentationCompartment,
		keymapCompartment,
		languageCompartment,
		lineNumbersCompartment,
		multiCursorCompartment,
		scrollCompartment,
		searchCompartment,
		themeCompartment,
		wordWrapCompartment
	} from './codemirror-extensions.ts';
	import { getLanguageFromFilename, languageExtensions } from './codemirror-languages.ts';
	import { createTheme } from './codemirror-theme.ts';

	import {
		comprehensiveSettingsStore,
		currentTheme
	} from '$lib/stores/comprehensive-settings.store.js';
	import { fileActions, filesStore, fileStateActions, tabsStore } from '$lib/stores/editor.js';
	import type { Project } from '$lib/types';
	import { mode } from 'mode-watcher';

	// Props
	interface Props {
		project?: Project;
	}

	let { project = undefined }: Props = $props();

	// State
	let editorContainer = $state<HTMLDivElement>();
	let editorView = $state<EditorView | null>(null);
	let mounted = $state(false);
	let currentFileId = $state<string | null>(null);
	let showSearchPanel = $state(false);
	let searchPanel: SearchPanel | null = $state(null); // Debug effect for search panel state
	$effect(() => {
		console.log('Search panel state changed:', showSearchPanel);
	});

	// Get extensions
	function getExtensions(filename?: string): Extension[] {
		const settings = $comprehensiveSettingsStore;
		const editorSettings = settings.editor;

		const extensions: Extension[] = [];

		// Basic extensions that don't change
		extensions.push(history());
		extensions.push(highlightActiveLine());
		extensions.push(indentOnInput());
		// extensions.push(syntaxHighlighting(defaultHighlightStyle));

		// Conditional extensions with compartments
		extensions.push(lineNumbersCompartment.of(getLineNumbersExtension(editorSettings)));
		extensions.push(wordWrapCompartment.of(getWordWrapExtension(editorSettings)));
		extensions.push(foldingCompartment.of(getFoldingExtension(editorSettings)));
		extensions.push(bracketMatchingCompartment.of(getBracketMatchingExtension(settings)));
		extensions.push(multiCursorCompartment.of(getMultiCursorExtension(settings)));
		extensions.push(indentationCompartment.of(getIndentationExtension(editorSettings)));
		extensions.push(autocompletionCompartment.of(getAutocompletionExtension(editorSettings)));
		extensions.push(searchCompartment.of(getSearchExtension(editorSettings)));
		extensions.push(keymapCompartment.of(getKeymapExtension(settings)));
		extensions.push(scrollCompartment.of(getScrollExtension(editorSettings)));

		// Add language support with compartment
		let languageExt = null;
		if (filename) {
			const language = getLanguageFromFilename(filename);
			const langExt = languageExtensions[language];
			if (langExt) {
				languageExt = langExt();
			}
		}
		extensions.push(languageCompartment.of(languageExt || []));

		// Add theme with compartment
		const isDark =
			settings.appearance.theme === 'dark' ||
			(settings.appearance.theme === 'system' && mode.current === 'dark');
		const themeExts = [createTheme(isDark, settings)];

		// Apply color scheme based on settings
		if (isDark) {
			if (settings.appearance.colorScheme === 'onedark') {
				themeExts.push(oneDark);
			} else if (settings.appearance.colorScheme === 'barf') {
				themeExts.push(barf);
			} else if (settings.appearance.colorScheme === 'dracula') {
				themeExts.push(dracula);
			} else if (settings.appearance.colorScheme === 'tomorrow') {
				themeExts.push(tomorrow);
			} else {
				themeExts.push(dracula);
			}
		} else {
			themeExts.push(tomorrow);
		}

		extensions.push(themeCompartment.of(themeExts));

		// Update listener for content changes
		extensions.push(
			EditorView.updateListener.of((update) => {
				if (update.docChanged && currentFileId) {
					const newContent = update.state.doc.toString();
					fileActions.updateFileContent(currentFileId, newContent);
					fileStateActions.setFileDirty(currentFileId, true);

					// Auto-save if enabled
					if (editorSettings.autoSave && editorSettings.autoSaveDelay > 0) {
						setTimeout(() => {
							if (currentFileId && fileStateActions.isFileDirty(currentFileId)) {
								fileStateActions.setFileDirty(currentFileId, false);
							}
						}, editorSettings.autoSaveDelay);
					}

					// Format on save if enabled
					if (editorSettings.formatOnSave && update.docChanged) {
						// TODO: Implement formatting
						console.log('Format on save triggered');
					}

					// Trim trailing whitespace if enabled
					if (editorSettings.trimTrailingWhitespace && update.docChanged) {
						// Get the current document
						const doc = update.state.doc;
						let newText = '';
						let hasChanges = false;

						// Process each line
						const lines = doc.toString().split('\n');
						for (let i = 0; i < lines.length; i++) {
							const trimmed = lines[i].trimEnd();
							if (trimmed !== lines[i]) {
								hasChanges = true;
							}
							newText += trimmed;
							if (i < lines.length - 1) {
								newText += '\n';
							}
						}

						// Apply changes if whitespace was trimmed
						if (hasChanges) {
							const transaction = update.state.update({
								changes: {
									from: 0,
									to: doc.length,
									insert: newText
								}
							});
							editorView?.dispatch(transaction);
						}
					}

					// Format on paste if enabled
					if (
						editorSettings.formatOnPaste &&
						update.transactions.some((tr) => tr.isUserEvent('input.paste'))
					) {
						// TODO: Implement paste formatting
						console.log('Format on paste triggered');
					}

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

	// React to comprehensive settings changes
	$effect(() => {
		const settings = $comprehensiveSettingsStore;
		const themeMode = $currentTheme;

		if (mounted && editorView && currentFileId) {
			const filename = $filesStore.get(currentFileId)?.name;
			const editorSettings = settings.editor;

			// Get language extension
			let languageExt = null;
			if (filename) {
				const language = getLanguageFromFilename(filename);
				const langExt = languageExtensions[language];
				if (langExt) {
					languageExt = langExt();
				}
			}

			// Get theme extensions
			const isDark =
				settings.appearance.theme === 'dark' ||
				(settings.appearance.theme === 'system' && mode.current === 'dark');
			const themeExts = [createTheme(isDark, settings)];

			// Apply color scheme based on settings
			if (isDark) {
				if (settings.appearance.colorScheme === 'onedark') {
					themeExts.push(oneDark);
				} else if (settings.appearance.colorScheme === 'barf') {
					themeExts.push(barf);
				} else if (settings.appearance.colorScheme === 'tomorrow') {
					themeExts.push(tomorrow);
				} else {
					themeExts.push(dracula);
				}
			} else {
				themeExts.push(tomorrow);
			}

			// Update all compartments
			const effects = [
				themeCompartment.reconfigure(themeExts),
				languageCompartment.reconfigure(languageExt || []),
				lineNumbersCompartment.reconfigure(getLineNumbersExtension(editorSettings)),
				wordWrapCompartment.reconfigure(getWordWrapExtension(editorSettings)),
				foldingCompartment.reconfigure(getFoldingExtension(editorSettings)),
				bracketMatchingCompartment.reconfigure(getBracketMatchingExtension(settings)),
				multiCursorCompartment.reconfigure(getMultiCursorExtension(settings)),
				indentationCompartment.reconfigure(getIndentationExtension(editorSettings)),
				autocompletionCompartment.reconfigure(getAutocompletionExtension(editorSettings)),
				searchCompartment.reconfigure(getSearchExtension(editorSettings)),
				keymapCompartment.reconfigure(getKeymapExtension(settings)),
				scrollCompartment.reconfigure(getScrollExtension(editorSettings))
			];

			editorView.dispatch({
				effects: effects
			});
		}
	});
</script>

<div class="editor-wrapper">
	<!-- Custom Search Panel -->
	<SearchPanel
		{editorView}
		visible={showSearchPanel}
		onClose={() => {
			console.log('Search panel close requested');
			showSearchPanel = false;
		}}
	/>

	<!-- Context Menu wrapping the editor -->
	<ContextMenu
		{editorView}
		onSearch={() => {
			showSearchPanel = true;
		}}
	>
		<div bind:this={editorContainer} class="editor-container"></div>
	</ContextMenu>
</div>

<style>
	.editor-wrapper {
		width: 100%;
		height: 100%;
		overflow: hidden;
		position: relative;
	}

	.editor-container {
		width: 100%;
		height: 100%;
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
</style>
