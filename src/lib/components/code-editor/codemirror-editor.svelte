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
	import { fileActions, filesStore, tabsStore } from '$lib/stores/editor.js';
	import { fileStateActions } from '$lib/stores/file-states.store.js';
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
		extensions.push(
			keymapCompartment.of(
				getKeymapExtension(settings, {
					handleSave,
					toggleSearchPanel: () => {
						showSearchPanel = !showSearchPanel;
					}
				})
			)
		);
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

					// Format on paste if enabled
					if (
						editorSettings.formatOnPaste &&
						update.transactions.some((tr) => tr.isUserEvent('input.paste'))
					) {
						// TODO: Implement paste formatting
						console.log('Format on paste triggered');
					}

					// Save cursor position (only when selection changes, not content)
					if (update.selectionChanged && !update.docChanged) {
						const cursor = update.state.selection.main.head;
						const line = update.state.doc.lineAt(cursor).number;
						const column = cursor - update.state.doc.lineAt(cursor).from + 1;
						fileStateActions.updateFileState(currentFileId, {
							cursorPosition: { line, column, timestamp: new Date() }
						});
					}
				}
			})
		);

		return extensions;
	}

	// Handle save - simplified and more reliable
	function handleSave(): boolean {
		// Call the async save function but don't await (for compatibility with keymap)
		(async () => {
			if (!currentFileId) {
				console.log('No file to save');
				return false;
			}

			if (!fileStateActions.isFileDirty(currentFileId)) {
				console.log('File is not dirty, no need to save');
				return true;
			}

			// Format on save if enabled (before saving)
			const settings = $comprehensiveSettingsStore;
			if (settings?.editor?.formatOnSave && editorView) {
				// Get current content and apply formatting
				const doc = editorView.state.doc;
				// For now, just trim whitespace - proper formatting would need language-specific logic
				const newContent = doc.toString().trim();

				if (newContent !== doc.toString()) {
					// Save cursor position
					const selection = editorView.state.selection.main;

					// Apply the trimmed content
					const transaction = editorView.state.update({
						changes: {
							from: 0,
							to: doc.length,
							insert: newContent
						},
						selection: { anchor: selection.anchor, head: selection.head }
					});
					editorView.dispatch(transaction);
				}
			}

			// Perform the save operation using the unified save function
			try {
				const success = await fileStateActions.saveFile(currentFileId);
				if (success) {
					console.log('File saved successfully');
				} else {
					console.error('Failed to save file');
				}
				return success;
			} catch (error) {
				console.error('Failed to save file:', error);
				return false;
			}
		})();

		return true; // Return true to prevent browser default save dialog
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
		const content = typeof file.content === 'string' ? file.content : '';
		const filename = file.name;

		// Create new editor
		const state = createEditorState(content, filename);
		editorView = new EditorView({
			state,
			parent: editorContainer
		});

		// Restore cursor position
		const fileState = fileStateActions.getFileState(activeFileId);
		if (fileState?.cursorPosition) {
			requestAnimationFrame(() => {
				if (editorView && currentFileId === activeFileId) {
					let cursorPos = 0;

					if (typeof fileState.cursorPosition === 'number') {
						// Legacy format: direct cursor position
						cursorPos = fileState.cursorPosition;
					} else if (
						typeof fileState.cursorPosition === 'object' &&
						'line' in fileState.cursorPosition
					) {
						// New format: line/column
						try {
							const line = Math.max(1, fileState.cursorPosition.line);
							const column = Math.max(1, fileState.cursorPosition.column);

							// Get the line at the specified line number
							const doc = editorView.state.doc;
							if (line <= doc.lines) {
								const lineObj = doc.line(line);
								cursorPos = lineObj.from + Math.min(column - 1, lineObj.length);
							}
						} catch (error) {
							console.warn('Failed to restore cursor position:', error);
							cursorPos = 0;
						}
					}

					editorView.dispatch({
						selection: { anchor: cursorPos, head: cursorPos }
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

		// Global keyboard shortcut handler as fallback
		const handleKeyDown = (event: KeyboardEvent) => {
			if ((event.ctrlKey || event.metaKey) && event.key === 's') {
				event.preventDefault();
				event.stopPropagation();
				handleSave();
			}
		};

		window.addEventListener('keydown', handleKeyDown, true);

		// Return cleanup function
		return () => {
			window.removeEventListener('keydown', handleKeyDown, true);
		};
	});

	onDestroy(() => {
		cleanup();
	});

	// React to file content changes
	$effect(() => {
		const activeFileId = $tabsStore.activeFileId;
		const file = activeFileId ? $filesStore.get(activeFileId) : null;

		if (mounted && editorView && currentFileId === activeFileId && file) {
			const currentContent = editorView.state.doc.toString();
			const newContent = typeof file.content === 'string' ? file.content : '';

			// Only update if content has actually changed and is not empty
			if (newContent && newContent !== currentContent) {
				console.log(`📝 Updating editor content for ${file.name}, length: ${newContent.length}`);
				const transaction = editorView.state.update({
					changes: {
						from: 0,
						to: currentContent.length,
						insert: newContent
					}
				});
				editorView.dispatch(transaction);
			}
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
				keymapCompartment.reconfigure(
					getKeymapExtension(settings, {
						handleSave,
						toggleSearchPanel: () => {
							showSearchPanel = !showSearchPanel;
						}
					})
				),
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
