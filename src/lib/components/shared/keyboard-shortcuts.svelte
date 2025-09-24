<script lang="ts">
	import { fileStateActions, tabActions, tabsStore } from '$lib/stores/editor.js';
	import { layoutActions } from '$lib/stores/layout.store.js';

	// Props for controlling various dialogs/panels
	let {
		commandPaletteOpen = $bindable(false),
		fileSearchOpen = $bindable(false),
		globalSearchOpen = $bindable(false),
		goToLineOpen = $bindable(false),
		findOpen = $bindable(false),
		onNewFile = () => {},
		onSaveAll = () => {},
		onCloseTab = () => {},
		onNextTab = () => {},
		onPrevTab = () => {},
		onToggleComment = () => {},
		onFormat = () => {},
		onUndo = () => {},
		onRedo = () => {},
		onCopy = () => {},
		onCut = () => {},
		onPaste = () => {},
		onSelectAll = () => {},
		onDuplicate = () => {},
		onDeleteLine = () => {}
	} = $props();

	function handleKeyDown(event: KeyboardEvent) {
		const { key, ctrlKey, metaKey, shiftKey, altKey } = event;
		const cmdKey = ctrlKey || metaKey; // Support both Ctrl and Cmd

		// Don't trigger shortcuts when typing in inputs, textareas, or contenteditable elements
		const target = event.target as HTMLElement;
		if (
			target.tagName === 'INPUT' ||
			target.tagName === 'TEXTAREA' ||
			target.isContentEditable ||
			target.closest('.cm-editor') // CodeMirror editor
		) {
			// Allow some shortcuts even in inputs
			if (cmdKey && key === 'a') return; // Select all
			if (cmdKey && key === 'c') return; // Copy
			if (cmdKey && key === 'v') return; // Paste
			if (cmdKey && key === 'x') return; // Cut
			if (cmdKey && key === 'z') return; // Undo
			if (cmdKey && key === 'y') return; // Redo
			if (cmdKey && shiftKey && key === 'Z') return; // Redo
			if (key === 'Escape') {
				// Allow escape to close dialogs even from inputs
				target.blur();
			} else {
				return;
			}
		}

		// Prevent default for handled shortcuts
		let preventDefault = false;

		// Command Palette and Search
		if ((cmdKey && shiftKey && key === 'P') || key === 'F1') {
			commandPaletteOpen = true;
			preventDefault = true;
		} else if (cmdKey && key === 'p') {
			fileSearchOpen = true;
			preventDefault = true;
		} else if (cmdKey && key === 'k') {
			commandPaletteOpen = true;
			preventDefault = true;
		}

		// File Operations
		else if (cmdKey && key === 'n') {
			onNewFile();
			preventDefault = true;
		} else if (cmdKey && key === 's') {
			if (shiftKey) {
				// Save All
				fileStateActions.saveAllFiles();
			} else {
				// Save current file
				if ($tabsStore.activeFileId) {
					fileStateActions.saveFile($tabsStore.activeFileId);
				}
			}
			preventDefault = true;
		}

		// Tab Management
		else if (cmdKey && key === 'w') {
			onCloseTab();
			preventDefault = true;
		} else if (cmdKey && altKey && key === 'ArrowRight') {
			onNextTab();
			preventDefault = true;
		} else if (cmdKey && altKey && key === 'ArrowLeft') {
			onPrevTab();
			preventDefault = true;
		} else if (cmdKey && key === 'Tab') {
			if (shiftKey) {
				onPrevTab();
			} else {
				onNextTab();
			}
			preventDefault = true;
		}

		// Layout Controls
		else if (cmdKey && key === 'b') {
			layoutActions.toggleSidebar();
			preventDefault = true;
		} else if (cmdKey && key === 'j') {
			layoutActions.toggleTerminal();
			preventDefault = true;
		} else if (cmdKey && key === '\\') {
			layoutActions.toggleAIPanel();
			preventDefault = true;
		}

		// Search and Navigation
		else if (cmdKey && key === 'f') {
			if (shiftKey) {
				globalSearchOpen = true;
			} else {
				findOpen = true;
			}
			preventDefault = true;
		} else if (cmdKey && key === 'g') {
			goToLineOpen = true;
			preventDefault = true;
		}

		// Editor Operations
		else if (cmdKey && key === '/') {
			onToggleComment();
			preventDefault = true;
		} else if (cmdKey && shiftKey && key === 'F') {
			onFormat();
			preventDefault = true;
		} else if (altKey && shiftKey && key === 'F') {
			onFormat();
			preventDefault = true;
		}

		// Text Operations
		else if (cmdKey && key === 'z') {
			if (shiftKey) {
				onRedo();
			} else {
				onUndo();
			}
			preventDefault = true;
		} else if (cmdKey && key === 'y') {
			onRedo();
			preventDefault = true;
		} else if (cmdKey && key === 'c') {
			onCopy();
			preventDefault = true;
		} else if (cmdKey && key === 'x') {
			onCut();
			preventDefault = true;
		} else if (cmdKey && key === 'v') {
			onPaste();
			preventDefault = true;
		} else if (cmdKey && key === 'a') {
			onSelectAll();
			preventDefault = true;
		} else if (cmdKey && key === 'd') {
			onDuplicate();
			preventDefault = true;
		} else if (cmdKey && shiftKey && key === 'K') {
			onDeleteLine();
			preventDefault = true;
		}

		// Line Operations
		else if (altKey && key === 'ArrowUp') {
			// Move line up
			preventDefault = true;
		} else if (altKey && key === 'ArrowDown') {
			// Move line down
			preventDefault = true;
		} else if (altKey && shiftKey && key === 'ArrowUp') {
			// Copy line up
			preventDefault = true;
		} else if (altKey && shiftKey && key === 'ArrowDown') {
			// Copy line down
			preventDefault = true;
		}

		// Multi-cursor operations
		else if (cmdKey && key === 'ArrowDown') {
			// Add cursor below
			preventDefault = true;
		} else if (cmdKey && key === 'ArrowUp') {
			// Add cursor above
			preventDefault = true;
		} else if (cmdKey && altKey && key === 'ArrowDown') {
			// Add cursor at end of each selected line
			preventDefault = true;
		}

		// Panel toggles with function keys
		else if (key === 'F4') {
			// Toggle problems panel
			preventDefault = true;
		} else if (key === 'F5') {
			// Start debugging / Run
			preventDefault = true;
		} else if (shiftKey && key === 'F5') {
			// Restart debugging
			preventDefault = true;
		} else if (key === 'F9') {
			// Toggle breakpoint
			preventDefault = true;
		} else if (key === 'F10') {
			// Step over
			preventDefault = true;
		} else if (key === 'F11') {
			// Step into
			preventDefault = true;
		} else if (shiftKey && key === 'F11') {
			// Step out
			preventDefault = true;
		}

		// Zoom controls
		else if (cmdKey && key === '=') {
			// Zoom in
			preventDefault = true;
		} else if (cmdKey && key === '-') {
			// Zoom out
			preventDefault = true;
		} else if (cmdKey && key === '0') {
			// Reset zoom
			preventDefault = true;
		}

		// Escape key handling
		else if (key === 'Escape') {
			// Close any open dialogs
			commandPaletteOpen = false;
			fileSearchOpen = false;
			globalSearchOpen = false;
			goToLineOpen = false;
			findOpen = false;
		}

		// Quick navigation numbers (Ctrl+1, Ctrl+2, etc.)
		else if (cmdKey && key >= '1' && key <= '9') {
			const tabIndex = parseInt(key) - 1;
			const tabs = $tabsStore.openFiles;
			if (tabs[tabIndex]) {
				tabActions.openFile(tabs[tabIndex]);
			}
			preventDefault = true;
		}

		// Developer tools
		else if (key === 'F12' || (cmdKey && shiftKey && key === 'I')) {
			// Toggle developer tools (browser will handle this)
			return;
		}

		if (preventDefault) {
			event.preventDefault();
			event.stopPropagation();
		}
	}

	// Handle mouse back/forward buttons for tab navigation
	function handleMouseDown(event: MouseEvent) {
		if (event.button === 3) {
			// Back button
			onPrevTab();
			event.preventDefault();
		} else if (event.button === 4) {
			// Forward button
			onNextTab();
			event.preventDefault();
		}
	}
</script>

<svelte:window on:keydown={handleKeyDown} on:mousedown={handleMouseDown} />

<!-- This component is invisible - it only handles keyboard shortcuts -->
