import { autocompletion, closeBrackets, completionKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, foldGutter, foldKeymap, indentUnit } from '@codemirror/language';
import { highlightSelectionMatches, search } from '@codemirror/search';
import { type Extension, Compartment } from '@codemirror/state';
import {
	crosshairCursor,
	drawSelection,
	dropCursor,
	EditorView,
	gutter,
	GutterMarker,
	highlightActiveLineGutter,
	keymap,
	lineNumbers,
	rectangularSelection,
	scrollPastEnd
} from '@codemirror/view';

// Compartments for dynamic reconfiguration
export const themeCompartment = new Compartment();
export const languageCompartment = new Compartment();
export const lineNumbersCompartment = new Compartment();
export const wordWrapCompartment = new Compartment();
export const foldingCompartment = new Compartment();
export const bracketMatchingCompartment = new Compartment();
export const multiCursorCompartment = new Compartment();
export const indentationCompartment = new Compartment();
export const autocompletionCompartment = new Compartment();
export const searchCompartment = new Compartment();
export const keymapCompartment = new Compartment();
export const scrollCompartment = new Compartment();

// Helper functions for extensions
export function getLineNumbersExtension(editorSettings: any): Extension[] {
	const extensions = [];

	if (editorSettings.lineNumbers) {
		if (editorSettings.lineNumbersRelative) {
			// Custom relative line numbers
			class RelativeLineNumberMarker extends GutterMarker {
				lineNumber: number;
				currentLine: number;

				constructor(lineNumber: number, currentLine: number) {
					super();
					this.lineNumber = lineNumber;
					this.currentLine = currentLine;
				}

				toDOM() {
					const element = document.createElement('div');
					element.className = 'cm-gutterElement';
					element.textContent =
						this.lineNumber === this.currentLine
							? this.lineNumber.toString()
							: Math.abs(this.lineNumber - this.currentLine).toString();
					return element;
				}
			}

			const relativeLineNumbers = gutter({
				lineMarker: (view, line) => {
					const currentLine = view.state.doc.lineAt(view.state.selection.main.head).number;
					const lineNumber = view.state.doc.lineAt(line.from).number;
					return new RelativeLineNumberMarker(lineNumber, currentLine);
				},
				initialSpacer: () => new RelativeLineNumberMarker(0, 0)
			});

			extensions.push(relativeLineNumbers);
		} else {
			extensions.push(lineNumbers());
		}
		extensions.push(highlightActiveLineGutter());
	}

	return extensions;
}

export function getWordWrapExtension(editorSettings: any): Extension[] {
	return editorSettings.wordWrap ? [EditorView.lineWrapping] : [];
}

export function getFoldingExtension(editorSettings: any): Extension[] {
	return editorSettings.folding ? [foldGutter()] : [];
}

export function getBracketMatchingExtension(settings: any): Extension[] {
	const extensions = [];

	if (settings.editor.enableBracketMatching || settings.keyboard.enableBracketMatching) {
		extensions.push(bracketMatching());
	}

	if (settings.keyboard.enableAutoClosingBrackets) {
		extensions.push(closeBrackets());
	}

	if (settings.keyboard.enableAutoClosingQuotes) {
		// Auto-closing quotes is handled by closeBrackets extension
		if (!settings.keyboard.enableAutoClosingBrackets) {
			extensions.push(closeBrackets());
		}
	}

	return extensions;
}

export function getMultiCursorExtension(settings: any): Extension[] {
	return settings.keyboard.enableMultiCursor
		? [drawSelection(), dropCursor(), rectangularSelection(), crosshairCursor()]
		: [];
}

export function getIndentationExtension(editorSettings: any): Extension[] {
	return [indentUnit.of(' '.repeat(editorSettings.tabSize))];
}

export function getAutocompletionExtension(editorSettings: any): Extension[] {
	if (!editorSettings.codeCompletion) return [];

	return [
		keymap.of(completionKeymap),
		autocompletion({
			activateOnTyping: editorSettings.quickSuggestions,
			maxRenderedOptions: 10,
			defaultKeymap: true
		})
	];
}

export function getSearchExtension(editorSettings: any): Extension[] {
	const extensions = [
		search({
			createPanel: () => ({ dom: document.createElement('div'), mount() {}, destroy() {} })
		})
	];

	if (editorSettings.selectionHighlight) {
		extensions.push(highlightSelectionMatches());
	}

	return extensions;
}

export function getKeymapExtension(
	settings: any,
	handlers?: {
		handleSave?: () => boolean;
		toggleSearchPanel?: () => void;
	}
): Extension[] {
	const editorSettings = settings.editor;
	const keymapExtensions = [];

	// Custom keybindings first (higher priority) - these override browser defaults
	if (handlers?.handleSave) {
		keymapExtensions.push({
			key: 'Ctrl-s',
			preventDefault: true,
			run: (view: EditorView) => {
				handlers.handleSave?.();
				return true; // Always return true to prevent default browser behavior
			}
		});
		keymapExtensions.push({
			key: 'Cmd-s',
			preventDefault: true,
			run: (view: EditorView) => {
				handlers.handleSave?.();
				return true; // Always return true to prevent default browser behavior
			}
		});
	}

	// Search shortcuts
	if (handlers?.toggleSearchPanel) {
		keymapExtensions.push({
			key: 'Ctrl-f',
			preventDefault: true,
			run: (view: EditorView) => {
				handlers.toggleSearchPanel?.();
				return true;
			}
		});
		keymapExtensions.push({
			key: 'Cmd-f',
			preventDefault: true,
			run: (view: EditorView) => {
				handlers.toggleSearchPanel?.();
				return true;
			}
		});

		keymapExtensions.push({
			key: 'Ctrl-h',
			preventDefault: true,
			run: (view: EditorView) => {
				handlers.toggleSearchPanel?.();
				return true;
			}
		});
		keymapExtensions.push({
			key: 'Cmd-h',
			preventDefault: true,
			run: (view: EditorView) => {
				handlers.toggleSearchPanel?.();
				return true;
			}
		});
	}

	// Add default keybindings based on keymap setting
	if (settings.keyboard.keyMap === 'vim') {
		keymapExtensions.push(...defaultKeymap);
	} else if (settings.keyboard.keyMap === 'emacs') {
		keymapExtensions.push(...defaultKeymap);
	} else {
		keymapExtensions.push(...defaultKeymap);
	}

	keymapExtensions.push(...historyKeymap);

	if (editorSettings.folding) {
		keymapExtensions.push(...foldKeymap);
	}

	// Tab behavior based on settings
	if (editorSettings.insertSpaces) {
		keymapExtensions.push(indentWithTab);
	}

	return [keymap.of(keymapExtensions)];
}

export function getScrollExtension(editorSettings: any): Extension[] {
	const extensions = [];

	if (editorSettings.scrollBeyondLastLine) {
		extensions.push(scrollPastEnd());
	}

	if (editorSettings.smoothScrolling) {
		extensions.push(
			EditorView.theme({
				'.cm-scroller': {
					scrollBehavior: 'smooth'
				}
			})
		);
	}

	return extensions;
}
