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
		// New props for provider-backed terminal
		connection?: {
			wsUrl?: string;
			ssh?: { host: string; port?: number; user?: string; instructions?: string };
			publicUrl?: string;
			terminalSessionId?: string;
			providerSessionId?: string;
		};
		incomingSessionId?: string | null;
		sandboxId?: string | null;
	}

	let {
		class: className = '',
		autoFocus = true,
		readonly = false,
		fontSize = 14,
		fontFamily = '"Fira Code", "JetBrains Mono", "Cascadia Code", Consolas, monospace',
		shellPath,
		workingDirectory,
		showWelcome = true,
		connection = undefined,
		incomingSessionId = null,
		sandboxId = null
	}: Props = $props();

	// Terminal state
	let terminal = $state<Terminal | undefined>();
	let sessionId: string | null = $state(incomingSessionId || null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let fitAddon: any = $state();
	let searchAddon: any = $state();
	let webLinksAddon: any = $state();

	// WebSocket for provider terminal
	let socket = $state<WebSocket | null>(null);
	let socketOpen = $derived(() => !!socket && socket?.readyState === WebSocket.OPEN);

	// Control WebSocket to server (for proxying to provider)
	let controlSocket = $state<WebSocket | null>(null);
	let proxySessionId: string | null = $state(null);

	// Input handling state
	let currentLine = $state('');
	let cursorPosition = $state(0);

	// Terminal themes with comprehensive color schemes
	const terminalThemes = {
		dark: {
			// Modern dark theme with high contrast and readability
			background: '#0d1117',
			foreground: '#f0f6fc',
			cursor: '#58a6ff',
			cursorAccent: '#0d1117',
			selection: 'rgba(88, 166, 255, 0.3)',
			selectionForeground: '#f0f6fc',
			// Standard colors
			black: '#484f58',
			red: '#ff7b72',
			green: '#3fb950',
			yellow: '#d29922',
			blue: '#58a6ff',
			magenta: '#bc8cff',
			cyan: '#39c5cf',
			white: '#b1bac4',
			// Bright colors
			brightBlack: '#6e7681',
			brightRed: '#ffa198',
			brightGreen: '#56d364',
			brightYellow: '#e3b341',
			brightBlue: '#79c0ff',
			brightMagenta: '#d2a8ff',
			brightCyan: '#56d4dd',
			brightWhite: '#f0f6fc'
		},
		light: {
			// Clean light theme with proper contrast
			background: '#ffffff',
			foreground: '#24292f',
			cursor: '#0969da',
			cursorAccent: '#ffffff',
			selection: 'rgba(9, 105, 218, 0.2)',
			selectionForeground: '#24292f',
			// Standard colors
			black: '#24292f',
			red: '#cf222e',
			green: '#116329',
			yellow: '#4d2d00',
			blue: '#0969da',
			magenta: '#8250df',
			cyan: '#1b7c83',
			white: '#6e7781',
			// Bright colors
			brightBlack: '#656d76',
			brightRed: '#a40e26',
			brightGreen: '#1a7f37',
			brightYellow: '#633c01',
			brightBlue: '#218bff',
			brightMagenta: '#a475f9',
			brightCyan: '#3192aa',
			brightWhite: '#8c959f'
		}
	};

	// Terminal options with enhanced theme support
	let options: ITerminalOptions & ITerminalInitOnlyOptions = $derived({
		fontSize,
		fontFamily,
		theme: mode.current === 'dark' ? terminalThemes.dark : terminalThemes.light,
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

	// Reactive theme updates
	$effect(() => {
		if (terminal) {
			const currentTheme = mode.current === 'dark' ? terminalThemes.dark : terminalThemes.light;
			terminal.options.theme = currentTheme;
		}
	});
	async function onLoad() {
		try {
			isLoading = true;
			error = null;

			if (!terminal) {
				throw new Error('Terminal not initialized');
			}

			// Load addons
			await loadAddons();

			// If consumer passed in a session id, keep it, otherwise generate one on demand
			if (!sessionId) {
				sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
			}

			// If provider supplied a WebSocket URL, connect now and pipe messages to xterm
			if (connection?.wsUrl) {
				if (shouldUseProxy(connection.wsUrl)) {
					await startProxySession();
				} else {
					connectToProvider(connection.wsUrl);
				}
			} else {
				await startProxySession();
			}

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

	// New helper: determine if we should proxy
	function shouldUseProxy(wsUrl?: string) {
		if (!wsUrl) return true; // no provider wsUrl -> use server proxy
		if (wsUrl.startsWith('/')) return true; // relative path -> same-origin proxy at server
		try {
			const u = new URL(wsUrl);
			// If different host/origin than current page, prefer server proxy for security
			return u.origin !== window.location.origin;
		} catch (err) {
			return true;
		}
	}

	async function startProxySession() {
		if (!sandboxId) {
			console.warn('Cannot start proxy session without sandboxId');
			return;
		}

		// Establish control socket to our central /api/ws endpoint
		if (!controlSocket || controlSocket.readyState !== WebSocket.OPEN) {
			const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
			const url = `${proto}://${window.location.host}/api/ws`;
			controlSocket = new WebSocket(url);

			controlSocket.onopen = () => {
				console.debug('Control websocket opened for terminal proxy');

				const payload = {
					type: 'terminal_proxy_start',
					data: {
						sandboxId,
						providerSessionId: connection?.providerSessionId,
						preferredWsUrl: connection?.wsUrl,
						shell: shellPath || '/bin/bash',
						dimensions: { cols: 80, rows: 24 },
						clientSessionId: incomingSessionId || proxySessionId
					}
				};

				controlSocket?.send(JSON.stringify(payload));
			};

			controlSocket.onmessage = (evt) => {
				try {
					const msg = JSON.parse(evt.data as string);
					switch (msg.type) {
						case 'terminal_proxy_ready':
							proxySessionId = msg.data.proxySessionId;
							// write an initial status to terminal
							terminal?.writeln('[connected to provider via proxy]');
							break;
						case 'terminal_proxy_data':
							if (msg.data && msg.data.content) {
								terminal?.write(msg.data.content);
							}
							break;
						case 'terminal_proxy_ssh':
							// provider requires SSH - surface instructions
							connection = connection || {};
							connection.ssh = msg.data.ssh;
							terminal?.writeln('[ssh only connection, copy instructions to connect]');
							break;
						case 'terminal_proxy_error':
							terminal?.writeln(`[proxy error] ${msg.data?.error || 'unknown'}`);
							break;
						case 'terminal_proxy_closed':
							terminal?.writeln('[provider connection closed]');
							proxySessionId = null;
							break;
						default:
							console.debug('Unhandled proxy message', msg.type);
					}
				} catch (err) {
					console.warn('Invalid proxy control message', err);
				}
			};

			controlSocket.onclose = () => {
				console.debug('Control websocket closed');
				controlSocket = null;
				proxySessionId = null;
			};
		}
	}

	function sendProxyInput(content: string) {
		if (controlSocket && controlSocket.readyState === WebSocket.OPEN && proxySessionId) {
			controlSocket.send(
				JSON.stringify({ type: 'terminal_proxy_input', data: { proxySessionId, content } })
			);
		}
	}

	// Update connectToProvider to prefer proxy when appropriate
	function connectToProvider(wsUrl?: string) {
		if (shouldUseProxy(wsUrl)) {
			startProxySession();
			return;
		}

		// existing same-origin direct path logic
		let resolved = wsUrl || '';
		if (wsUrl && wsUrl.startsWith('/')) {
			const origin = typeof window !== 'undefined' ? window.location.origin : '';
			resolved = origin.replace(/^http/, 'ws') + wsUrl;
		}

		// Close existing socket if present
		if (socket) {
			socket.close();
			socket = null;
		}

		socket = new WebSocket(resolved);
		socket.binaryType = 'arraybuffer';

		socket.onopen = () => {
			console.debug('Provider terminal websocket open', resolved);
			socket?.send(JSON.stringify({ type: 'init', sessionId }));
		};

		socket.onmessage = (evt) => {
			try {
				if (!terminal) return;
				if (typeof evt.data === 'string') {
					terminal.write(evt.data);
				} else if (evt.data instanceof ArrayBuffer) {
					const text = new TextDecoder('utf-8').decode(evt.data);
					terminal.write(text);
				} else if (evt.data instanceof Blob) {
					evt.data.text().then((t) => safeWrite(t));
				} else {
					safeWrite(String(evt.data));
				}
			} catch (err) {
				console.warn('Failed to write provider message to terminal', err);
			}
		};

		socket.onerror = (err) => {
			console.warn('Provider terminal websocket error', err);
		};

		socket.onclose = (ev) => {
			console.debug('Provider terminal websocket closed', ev);
			socket = null;
		};
	}

	// Load addons for xterm (Fit, Search, WebLinks) - restored implementation
	async function loadAddons() {
		try {
			const FitAddon = (await XtermAddon.FitAddon()).FitAddon;
			const SearchAddon = (await XtermAddon.SearchAddon()).SearchAddon;
			const WebLinksAddon = (await XtermAddon.WebLinksAddon()).WebLinksAddon;

			fitAddon = new FitAddon();
			searchAddon = new SearchAddon();
			webLinksAddon = new WebLinksAddon();

			terminal?.loadAddon(fitAddon);
			terminal?.loadAddon(searchAddon);
			terminal?.loadAddon(webLinksAddon);

			// Initial fit if available
			try {
				fitAddon?.fit();
			} catch (err) {
				// ignore
			}
		} catch (err) {
			console.warn('Some terminal addons failed to load:', err);
			// Try minimal fit addon fallback
			try {
				const FitAddon = (await XtermAddon.FitAddon()).FitAddon;
				fitAddon = new FitAddon();
				terminal?.loadAddon(fitAddon);
				fitAddon.fit();
			} catch (fitErr) {
				console.error('Critical: FitAddon failed to load:', fitErr);
			}
		}
	}

	// Defensive wrappers: ensure terminal exists before calling methods
	function safeWrite(data: string) {
		if (!terminal) return;
		terminal.write(data);
	}

	function safeWriteln(data: string) {
		if (!terminal) return;
		terminal.writeln(data);
	}

	function safeHasSelection(): boolean {
		try {
			return !!terminal && (terminal as any).hasSelection
				? (terminal as any).hasSelection()
				: false;
		} catch (err) {
			return false;
		}
	}

	function safeGetSelection(): string {
		try {
			return terminal && (terminal as any).getSelection ? (terminal as any).getSelection() : '';
		} catch (err) {
			return '';
		}
	}

	// Enhanced input handling with line editing
	function onData(data: string) {
		if (readonly || !sessionId) return;

		// If using proxy path (control socket), forward input via controlSocket
		if (controlSocket && controlSocket.readyState === WebSocket.OPEN && proxySessionId) {
			sendProxyInput(data);
			return;
		}

		// If socket is open, forward input bytes directly to provider
		if (socket && socket.readyState === WebSocket.OPEN) {
			try {
				socket.send(data);
				return;
			} catch (err) {
				console.warn('Failed to send data to provider websocket', err);
			}
		}

		const code = data.charCodeAt(0);

		switch (code) {
			case 13: // Enter
				safeWriteln('');
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
				handleCtrlC();
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
					safeWrite('\x1b[D'); // Move cursor left
				}
				break;

			case 'ArrowRight':
				domEvent.preventDefault();
				if (cursorPosition < currentLine.length) {
					cursorPosition++;
					safeWrite('\x1b[C'); // Move cursor right
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
					if (safeHasSelection()) {
						navigator.clipboard?.writeText(safeGetSelection());
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
			terminal?.writeln('');
			terminal?.writeln(matches.join('  '));
		}
	}

	// Helper functions
	function resetCurrentLine() {
		currentLine = '';
		cursorPosition = 0;
	}

	function redrawCurrentLine() {
		if (!terminal) return;
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
		return '~';
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

		// Teardown: close socket when component destroyed
		try {
			if (socket) {
				socket.close();
				socket = null;
			}
		} catch (err) {
			console.warn('Error closing provider websocket on destroy', err);
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
			// In executeCommand
			safeWriteln(command);
			handleCommand(command);
			resetCurrentLine();
		}
	}

	// Copy helper exposed for SSH instructions (re-used elsewhere)
	async function copyToClipboard(text: string) {
		try {
			if (!text) return;
			await navigator.clipboard.writeText(text);
		} catch (err) {
			console.warn('Failed to copy to clipboard', err);
		}
	}

	// Update occurrences to use safe wrappers where appropriate
	// e.g., in onKey: use safeHasSelection() and safeGetSelection()
	// Update onKey usage inline
	// (No code duplication here - just using helper functions above)

	// Replace deprecated on:click in template by updating attributes later via string replacement

	// Ensure other terminal calls guard for undefined terminal
	// e.g. in handleTabCompletion we already updated; ensure safe calls

	function handleCtrlC() {
		safeWriteln('\x1b[1;31m^C\x1b[0m');
		resetCurrentLine();
	}
</script>

<div
	bind:this={terminalElement}
	class="terminal-container relative h-full w-full {className}"
	role="application"
	aria-label="Enhanced Terminal"
>
	<!-- Connection metadata toolbar -->
	{#if connection}
		<div class="absolute top-2 right-2 z-10 flex items-center gap-2">
			{#if connection?.publicUrl}
				<a href={connection.publicUrl} target="_blank" class="rounded bg-muted px-2 py-1 text-xs"
					>Open Preview</a
				>
			{/if}
			{#if connection?.ssh}
				<div class="flex items-center gap-2 rounded bg-muted px-2 py-1 text-xs">
					<span class="font-mono"
						>{connection?.ssh?.user}@{connection?.ssh?.host}{connection?.ssh?.port
							? `:${connection?.ssh?.port}`
							: ''}</span
					>
					<button
						class="ml-1 text-xs"
						onclick={() =>
							copyToClipboard(
								connection?.ssh?.instructions || `${connection?.ssh?.user}@${connection?.ssh?.host}`
							)}>Copy</button
					>
				</div>
			{/if}
		</div>
	{/if}

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
					onclick={() => window.location.reload()}>Reload</button
				>
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
