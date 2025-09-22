<script lang="ts">
	import type {
		ITerminalInitOnlyOptions,
		ITerminalOptions,
		Terminal
	} from '@battlefieldduck/xterm-svelte';
	import { Xterm, XtermAddon } from '@battlefieldduck/xterm-svelte';
	import { mode } from 'mode-watcher';
	import { onDestroy, onMount } from 'svelte';

	// Props
	interface Props {
		class?: string;
		autoFocus?: boolean;
		readonly?: boolean;
		fontSize?: number;
		fontFamily?: string;
		shellPath?: string;
		workingDirectory?: string;
		showWelcome?: boolean;
	}

	let {
		class: className = '',
		autoFocus = true,
		readonly = false,
		fontSize = 14,
		fontFamily = '"Fira Code", "JetBrains Mono", "Cascadia Code", Consolas, monospace',
		shellPath,
		workingDirectory,
		showWelcome = true
	}: Props = $props();

	// Terminal state
	let terminal = $state<Terminal | undefined>();
	let sessionId: string | null = $state(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let fitAddon: any = $state();
	let searchAddon: any = $state();
	let webLinksAddon: any = $state();

	// Input handling state
	let currentLine = $state('');
	let cursorPosition = $state(0);

	// Terminal options with enhanced theme support
	let options: ITerminalOptions & ITerminalInitOnlyOptions = $derived({
		fontSize,
		fontFamily,
		theme:
			mode.current === 'dark'
				? {
						background: '#0a0a0a',
						foreground: '#fafafa',
						cursor: '#fafafa',
						cursorAccent: '#0a0a0a',
						selection: '#334155',
						black: '#262626',
						red: '#ef4444',
						green: '#22c55e',
						yellow: '#eab308',
						blue: '#3b82f6',
						magenta: '#a855f7',
						cyan: '#06b6d4',
						white: '#f5f5f5',
						brightBlack: '#525252',
						brightRed: '#f87171',
						brightGreen: '#4ade80',
						brightYellow: '#facc15',
						brightBlue: '#60a5fa',
						brightMagenta: '#c084fc',
						brightCyan: '#22d3ee',
						brightWhite: '#ffffff'
					}
				: {
						background: '#ffffff',
						foreground: '#0a0a0a',
						cursor: '#0a0a0a',
						cursorAccent: '#ffffff',
						selection: '#e2e8f0',
						black: '#0a0a0a',
						red: '#dc2626',
						green: '#16a34a',
						yellow: '#ca8a04',
						blue: '#2563eb',
						magenta: '#9333ea',
						cyan: '#0891b2',
						white: '#525252',
						brightBlack: '#262626',
						brightRed: '#ef4444',
						brightGreen: '#22c55e',
						brightYellow: '#eab308',
						brightBlue: '#3b82f6',
						brightMagenta: '#a855f7',
						brightCyan: '#06b6d4',
						brightWhite: '#f5f5f5'
					},
		cursorBlink: true,
		cursorStyle: 'block',
		scrollback: 1000,
		tabStopWidth: 4,
		allowTransparency: false,
		convertEol: true,
		disableStdin: readonly,
		rightClickSelectsWord: true,
		macOptionIsMeta: true,
		scrollOnUserInput: true,
		altClickMovesCursor: true,
		allowProposedApi: true
	});

	// Lifecycle management
	async function onLoad() {
		try {
			isLoading = true;
			error = null;

			if (!terminal) {
				throw new Error('Terminal not initialized');
			}

			// Load addons
			await loadAddons();

			// Create terminal session
			// sessionId = terminalService.createSession(terminal, {
			// 	title: 'Main Terminal',
			// 	cwd: workingDirectory,
			// 	shell: shellPath
			// });

			// Focus if needed
			if (autoFocus) {
				terminal.focus();
			}

			isLoading = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to initialize terminal';
			isLoading = false;
			console.error('Terminal initialization failed:', err);
		}
	}

	async function loadAddons() {
		try {
			// Load FitAddon
			const FitAddon = (await XtermAddon.FitAddon()).FitAddon;
			fitAddon = new FitAddon();
			terminal.loadAddon(fitAddon);

			// Load SearchAddon
			const SearchAddon = (await XtermAddon.SearchAddon()).SearchAddon;
			searchAddon = new SearchAddon();
			terminal.loadAddon(searchAddon);

			// Load WebLinksAddon
			const WebLinksAddon = (await XtermAddon.WebLinksAddon()).WebLinksAddon;
			webLinksAddon = new WebLinksAddon();
			terminal.loadAddon(webLinksAddon);

			// Initial fit
			fitAddon.fit();
		} catch (err) {
			console.warn('Some terminal addons failed to load:', err);
			// Try to load just the fit addon as fallback
			try {
				const FitAddon = (await XtermAddon.FitAddon()).FitAddon;
				fitAddon = new FitAddon();
				terminal.loadAddon(fitAddon);
				fitAddon.fit();
			} catch (fitErr) {
				console.error('Critical: FitAddon failed to load:', fitErr);
			}
		}
	}

	// Enhanced input handling with line editing
	function onData(data: string) {
		if (readonly || !sessionId) return;

		const code = data.charCodeAt(0);

		switch (code) {
			case 13: // Enter
				terminal.writeln('');
				handleCommand(currentLine);
				resetCurrentLine();
				break;

			case 127: // Backspace
				if (cursorPosition > 0) {
					currentLine =
						currentLine.slice(0, cursorPosition - 1) + currentLine.slice(cursorPosition);
					cursorPosition--;
					redrawCurrentLine();
				}
				break;

			case 3: // Ctrl+C
				terminal.writeln('\x1b[1;31m^C\x1b[0m');
				resetCurrentLine();
				// Get new prompt from service
				const session = terminalService.getSession(sessionId);
				if (session) {
					terminal.write(`\x1b[1;36m${getCurrentPrompt()}\x1b[0m $ `);
				}
				break;

			default:
				if (code >= 32 && code <= 126) {
					// Printable characters
					currentLine =
						currentLine.slice(0, cursorPosition) + data + currentLine.slice(cursorPosition);
					cursorPosition++;
					redrawCurrentLine();
				}
		}
	}

	// Enhanced keyboard event handling
	function onKey(data: { key: string; domEvent: KeyboardEvent }) {
		const { key, domEvent } = data;

		// Handle special keys
		switch (key) {
			case 'ArrowUp':
				domEvent.preventDefault();
				navigateHistory('up');
				break;

			case 'ArrowDown':
				domEvent.preventDefault();
				navigateHistory('down');
				break;

			case 'ArrowLeft':
				domEvent.preventDefault();
				if (cursorPosition > 0) {
					cursorPosition--;
					terminal.write('\x1b[D'); // Move cursor left
				}
				break;

			case 'ArrowRight':
				domEvent.preventDefault();
				if (cursorPosition < currentLine.length) {
					cursorPosition++;
					terminal.write('\x1b[C'); // Move cursor right
				}
				break;

			case 'Home':
				domEvent.preventDefault();
				cursorPosition = 0;
				redrawCurrentLine();
				break;

			case 'End':
				domEvent.preventDefault();
				cursorPosition = currentLine.length;
				redrawCurrentLine();
				break;

			case 'Delete':
				domEvent.preventDefault();
				if (cursorPosition < currentLine.length) {
					currentLine =
						currentLine.slice(0, cursorPosition) + currentLine.slice(cursorPosition + 1);
					redrawCurrentLine();
				}
				break;

			case 'Tab':
				domEvent.preventDefault();
				handleTabCompletion();
				break;
		}

		// Handle Ctrl/Cmd combinations
		if (domEvent.ctrlKey || domEvent.metaKey) {
			switch (key) {
				case 'c':
					if (terminal.hasSelection()) {
						navigator.clipboard?.writeText(terminal.getSelection());
						domEvent.preventDefault();
					}
					break;

				case 'v':
					domEvent.preventDefault();
					navigator.clipboard
						?.readText()
						.then((text) => {
							if (text && !readonly) {
								insertText(text);
							}
						})
						.catch((err) => {
							console.warn('Failed to read clipboard:', err);
						});
					break;

				case 'l':
					domEvent.preventDefault();
					clear();
					break;

				case 'a':
					domEvent.preventDefault();
					cursorPosition = 0;
					redrawCurrentLine();
					break;

				case 'e':
					domEvent.preventDefault();
					cursorPosition = currentLine.length;
					redrawCurrentLine();
					break;

				case 'u':
					domEvent.preventDefault();
					currentLine = currentLine.slice(cursorPosition);
					cursorPosition = 0;
					redrawCurrentLine();
					break;

				case 'k':
					domEvent.preventDefault();
					currentLine = currentLine.slice(0, cursorPosition);
					redrawCurrentLine();
					break;
			}
		}
	}

	// Command handling
	async function handleCommand(command: string) {
		if (!sessionId) return;
		// await terminalService.handleInput(sessionId, command);
	}

	// History navigation
	function navigateHistory(direction: 'up' | 'down') {
		if (!sessionId) return;

		// const historyCommand = terminalService.navigateHistory(sessionId, direction);
		// if (historyCommand !== null) {
		// 	currentLine = historyCommand;
		// 	cursorPosition = currentLine.length;
		// 	redrawCurrentLine();
		// } else if (direction === 'down') {
		// 	// Clear line when at end of history
		// 	currentLine = '';
		// 	cursorPosition = 0;
		// 	redrawCurrentLine();
		// }
	}

	// Tab completion (basic)
	function handleTabCompletion() {
		// Simple tab completion for common commands
		const commands = [
			'help',
			'clear',
			'history',
			'cd',
			'pwd',
			'echo',
			'ls',
			'cat',
			'date',
			'whoami',
			'uname',
			'exit'
		];
		const matches = commands.filter((cmd) => cmd.startsWith(currentLine));

		if (matches.length === 1) {
			currentLine = matches[0];
			cursorPosition = currentLine.length;
			redrawCurrentLine();
		} else if (matches.length > 1) {
			terminal.writeln('');
			terminal.writeln(matches.join('  '));
			// Redraw prompt and current line
			// const session = terminalService.getSession(sessionId!);
			// if (session) {
			// 	terminal.write(`\x1b[1;36m${getCurrentPrompt()}\x1b[0m $ `);
			// 	terminal.write(currentLine);
			// }
		}
	}

	// Helper functions
	function resetCurrentLine() {
		currentLine = '';
		cursorPosition = 0;
	}

	function redrawCurrentLine() {
		// Clear current line
		terminal.write('\x1b[2K\r'); // Clear line and return to start

		// Redraw prompt
		// const session = terminalService.getSession(sessionId!);
		// if (session) {
		// 	terminal.write(`\x1b[1;36m${getCurrentPrompt()}\x1b[0m $ `);
		// }

		// Write current input
		terminal.write(currentLine);

		// Position cursor
		const targetPosition = cursorPosition;
		const currentPosition = currentLine.length;
		const diff = currentPosition - targetPosition;

		if (diff > 0) {
			terminal.write(`\x1b[${diff}D`); // Move cursor left
		}
	}

	function insertText(text: string) {
		currentLine = currentLine.slice(0, cursorPosition) + text + currentLine.slice(cursorPosition);
		cursorPosition += text.length;
		redrawCurrentLine();
	}

	function getCurrentPrompt(): string {
		if (!sessionId) return '~';
		// const session = terminalService.getSession(sessionId);
		// return session ? session.cwd.replace(process.env.HOME || '', '~') : '~';
	}

	// Handle resize
	function handleResize() {
		if (fitAddon && terminal) {
			try {
				fitAddon.fit();
			} catch (err) {
				console.warn('Failed to resize terminal:', err);
			}
		}
	}

	// Setup resize observer
	let resizeObserver: ResizeObserver | null = $state(null);
	let terminalElement = $state<HTMLElement>();

	onMount(() => {
		// Setup resize observer
		if (typeof ResizeObserver !== 'undefined') {
			resizeObserver = new ResizeObserver(handleResize);
			if (terminalElement) {
				resizeObserver.observe(terminalElement);
			}
		}

		// Handle window resize
		window.addEventListener('resize', handleResize);
	});

	onDestroy(() => {
		// Cleanup resize observer
		if (resizeObserver) {
			resizeObserver.disconnect();
		}

		// Remove event listeners
		window.removeEventListener('resize', handleResize);

		// Close terminal session
		// if (sessionId) {
		// 	terminalService.closeSession(sessionId);
		// }

		// Dispose addons
		try {
			if (searchAddon) {
				searchAddon.dispose();
			}
			if (webLinksAddon) {
				webLinksAddon.dispose();
			}
			if (fitAddon) {
				fitAddon.dispose();
			}
		} catch (err) {
			console.warn('Error during terminal cleanup:', err);
		}
	});

	// Public methods
	export function focus() {
		terminal?.focus();
	}

	export function blur() {
		terminal?.blur();
	}

	export function clear() {
		terminal?.clear();
		resetCurrentLine();
		// Show prompt after clear
		if (sessionId) {
			// const session = terminalService.getSession(sessionId);
			// if (session) {
			// 	terminal.write(`\x1b[1;36m${getCurrentPrompt()}\x1b[0m $ `);
			// }
		}
	}

	export function write(data: string) {
		terminal?.write(data);
	}

	export function writeln(data: string) {
		terminal?.writeln(data);
	}

	export function fit() {
		handleResize();
	}

	export function search(term: string) {
		return searchAddon?.findNext(term);
	}

	export function getSelection() {
		return terminal?.getSelection() || '';
	}

	export function executeCommand(command: string) {
		if (sessionId) {
			currentLine = command;
			terminal.writeln(command);
			handleCommand(command);
			resetCurrentLine();
		}
	}
</script>

<div
	bind:this={terminalElement}
	class="terminal-container relative h-full w-full {className}"
	role="application"
	aria-label="Enhanced Terminal"
>
	{#if isLoading}
		<div class="flex h-full items-center justify-center">
			<div class="flex items-center gap-2 text-sm text-muted-foreground">
				<div
					class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
				></div>
				Initializing terminal session...
			</div>
		</div>
	{:else if error}
		<div class="flex h-full items-center justify-center">
			<div class="text-center">
				<div class="mb-2 text-sm text-destructive">Terminal Error</div>
				<div class="text-xs text-muted-foreground">{error}</div>
				<button
					class="mt-2 rounded-md bg-secondary px-3 py-1 text-xs transition-colors hover:bg-secondary/80"
					onclick={() => window.location.reload()}
				>
					Reload
				</button>
			</div>
		</div>
	{:else}
		<Xterm bind:terminal {options} {onLoad} {onData} {onKey} class="h-full w-full" />
	{/if}
</div>

<style>
	.terminal-container :global(.xterm-viewport) {
		overflow-y: auto;
		scrollbar-width: thin;
	}

	.terminal-container :global(.xterm-viewport::-webkit-scrollbar) {
		width: 8px;
	}

	.terminal-container :global(.xterm-viewport::-webkit-scrollbar-track) {
		background: transparent;
	}

	.terminal-container :global(.xterm-viewport::-webkit-scrollbar-thumb) {
		background-color: hsl(var(--border));
		border-radius: 4px;
	}

	.terminal-container :global(.xterm-viewport::-webkit-scrollbar-thumb:hover) {
		background-color: hsl(var(--border) / 0.8);
	}

	.terminal-container :global(.xterm-selection) {
		background-color: hsl(var(--accent)) !important;
	}

	.terminal-container :global(.xterm-screen) {
		padding: 12px;
	}

	.terminal-container :global(.xterm-cursor-layer .xterm-cursor) {
		background-color: hsl(var(--foreground)) !important;
	}

	.terminal-container :global(.xterm .xterm-rows) {
		font-feature-settings: 'liga' 0; /* Disable ligatures for better terminal rendering */
	}
</style>
