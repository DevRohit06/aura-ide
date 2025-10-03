<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { mode } from 'mode-watcher';
	import { onDestroy, onMount, tick } from 'svelte';
	// Icons
	import MaximizeIcon from '@lucide/svelte/icons/maximize';
	import MinimizeIcon from '@lucide/svelte/icons/minimize';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Settings2Icon from '@lucide/svelte/icons/settings-2';
	import TerminalIcon from '@lucide/svelte/icons/terminal';
	import XIcon from '@lucide/svelte/icons/x';
	// Types
	import type { Project } from '$lib/types';

	// Props
	interface Props {
		class?: string;
		maxTabs?: number;
		allowNewTabs?: boolean;
		showHeader?: boolean;
		project?: Project;
	}

	let {
		class: className = '',
		maxTabs = 5,
		allowNewTabs = true,
		showHeader = true,
		project = undefined
	}: Props = $props();

	// Terminal session interface
	interface TerminalSession {
		id: string;
		title: string;
		created: Date;
		terminal?: any; // xterm Terminal instance
		element?: HTMLElement;
		currentLine: string;
		commandHistory: string[];
		error?: string;
		sandboxSessionId?: string; // Sandbox session ID for this terminal
		isConnected: boolean;
	}

	let sessions = $state<TerminalSession[]>([]);
	let activeTabId = $state<string | null>(null);
	let isMaximized = $state(false);
	let nextSessionNumber = $state(1);

	// Store terminal elements by session ID
	let terminalElements: Record<string, HTMLElement> = $state({});

	// Reactive theme updates for all terminals
	$effect(() => {
		const currentTheme = mode.current === 'dark' ? terminalThemes.dark : terminalThemes.light;
		sessions.forEach((session) => {
			if (session.terminal) {
				session.terminal.options.theme = currentTheme;
			}
		});
	});

	// Initialize with project's sandbox session if available
	onMount(() => {
		if (project?.sandboxId) {
			// Create initial terminal connected to project's sandbox session
			createNewSession();
		}
	});

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

	// Initialize xterm for a specific session
	async function initializeTerminal(sessionId: string) {
		const session = sessions.find((s) => s.id === sessionId);
		const element = terminalElements[sessionId];

		if (!session || !element) {
			console.error('Session or element not found for', sessionId);
			return;
		}

		try {
			console.log('Initializing terminal for session', sessionId);

			// Import xterm CSS and library
			await import('@xterm/xterm/css/xterm.css');
			const { Terminal } = await import('@xterm/xterm');

			// Create terminal instance with theme support
			const currentTheme = mode.current === 'dark' ? terminalThemes.dark : terminalThemes.light;
			const terminal = new Terminal({
				theme: currentTheme,
				fontSize: 14,
				fontFamily: '"Fira Code", "JetBrains Mono", "Cascadia Code", Consolas, monospace',
				cursorBlink: true,
				cursorStyle: 'block',
				scrollback: 1000,
				tabStopWidth: 4,
				allowTransparency: false,
				convertEol: true,
				rightClickSelectsWord: true,
				macOptionIsMeta: true,
				scrollOnUserInput: true,
				altClickMovesCursor: true
			});

			// Open terminal in DOM
			terminal.open(element);

			// Set up input handling
			terminal.onData((data: string) => {
				handleTerminalInput(sessionId, data);
			});

			// Write welcome message
			if (session.sandboxSessionId) {
				terminal.writeln('\x1b[1;32m✓\x1b[0m Sandbox Terminal Connected!');
				terminal.writeln(`Project: ${project?.name || 'Unknown'}`);
				terminal.writeln(`Session: ${session.sandboxSessionId}`);
			} else {
				terminal.writeln('\x1b[1;33m⚠\x1b[0m Local Terminal (Sandbox not connected)');
			}
			terminal.writeln(`Session: ${session.title}`);
			terminal.writeln('Type "help" for commands');
			terminal.write('\r\n');

			// Update session with terminal instance
			session.terminal = terminal;
			session.currentLine = '';
			session.commandHistory = [];

			// Write initial prompt
			await writePrompt(session);

			console.log('Terminal initialized successfully for', sessionId);
		} catch (err) {
			console.error('Failed to initialize terminal:', err);
			if (session) {
				session.error = err instanceof Error ? err.message : 'Unknown error';
			}
		}
	}

	// Handle terminal input
	async function handleTerminalInput(sessionId: string, data: string) {
		const session = sessions.find((s) => s.id === sessionId);
		if (!session || !session.terminal) return;

		const terminal = session.terminal;
		const code = data.charCodeAt(0);

		switch (code) {
			case 13: // Enter
				terminal.write('\r\n');
				if (session.currentLine.trim()) {
					executeCommand(sessionId, session.currentLine.trim());
					if (session.commandHistory[session.commandHistory.length - 1] !== session.currentLine) {
						session.commandHistory.push(session.currentLine);
					}
				}
				session.currentLine = '';
				await writePrompt(session);
				break;

			case 127: // Backspace
				if (session.currentLine.length > 0) {
					session.currentLine = session.currentLine.slice(0, -1);
					terminal.write('\b \b');
				}
				break;

			case 3: // Ctrl+C
				terminal.write('^C\r\n');
				session.currentLine = '';
				await writePrompt(session);
				break;

			default:
				if (code >= 32) {
					// Printable characters
					session.currentLine += data;
					terminal.write(data);
				}
		}
	}

	// Get formatted prompt with current working directory
	async function getPrompt(session: TerminalSession): Promise<string> {
		if (session.isConnected && session.sandboxSessionId) {
			try {
				// TODO: Implement sandbox working directory retrieval
				const workingDir = session.currentDirectory || '/home/user';
				// Show just the directory name if it's a project directory
				const dirName = workingDir.split('/').pop() || workingDir;
				return `\x1b[1;34m${dirName}\x1b[0m$ `;
			} catch (error) {
				console.warn('Failed to get working directory:', error);
			}
		}
		return '$ ';
	}

	// Write prompt to terminal
	async function writePrompt(session: TerminalSession) {
		if (!session.terminal) return;
		const prompt = await getPrompt(session);
		session.terminal.write(prompt);
	}

	// Execute command in terminal
	async function executeCommand(sessionId: string, cmd: string) {
		const session = sessions.find((s) => s.id === sessionId);
		if (!session || !session.terminal) return;

		const terminal = session.terminal;
		const trimmed = cmd.trim();

		// Add command to history
		session.commandHistory.push(trimmed);

		// Handle special local commands
		if (trimmed === 'clear') {
			terminal.clear();
			await writePrompt(session);
			return;
		}

		if (trimmed === 'help') {
			const helpText = [
				'Available commands:',
				'  ls                List files',
				'  cd <dir>          Change directory',
				'  pwd               Print working directory',
				'  cat <file>        Display file contents',
				'  echo <text>       Display text',
				'  mkdir <dir>       Create directory',
				'  touch <file>      Create file',
				'  rm <file>         Remove file',
				'  clear             Clear terminal',
				'  help              Show this help',
				'  history           Show command history',
				'  whoami            Show session info',
				''
			];
			helpText.forEach((line) => terminal.writeln(line));
			await writePrompt(session);
			return;
		}

		if (trimmed === 'history') {
			session.commandHistory.forEach((hist, i) => {
				terminal.writeln(`  ${i + 1}  ${hist}`);
			});
			await writePrompt(session);
			return;
		}

		if (trimmed === 'whoami') {
			terminal.writeln(`Session: ${session.title} (${session.id})`);
			terminal.writeln(`Created: ${session.created.toLocaleString()}`);
			if (session.sandboxSessionId) {
				terminal.writeln(`Sandbox Session: ${session.sandboxSessionId}`);
				terminal.writeln(`Status: ${session.isConnected ? 'Connected' : 'Disconnected'}`);
			}
			await writePrompt(session);
			return;
		}

		try {
			// If sandbox session is available, execute real commands
			if (session.sandboxSessionId && project?.id) {
				// TODO: Implement sandbox command execution
				terminal.writeln(`\x1b[33mSandbox execution not yet implemented\x1b[0m`);
				await writePrompt(session);
				return;
			}

			// Fallback to local simulation for commands
			const parts = trimmed.split(' ');
			const command = parts[0];
			const args = parts.slice(1);

			switch (command) {
				case 'echo':
					terminal.writeln(args.join(' '));
					break;
				case 'date':
					terminal.writeln(new Date().toString());
					break;
				default:
					if (session.sandboxSessionId) {
						terminal.writeln(`\x1b[31mSandbox session not available\x1b[0m`);
					} else {
						terminal.writeln(`\x1b[33mLocal simulation: ${command} not implemented\x1b[0m`);
						terminal.writeln('Commands available: echo, date, help, clear, history, whoami');
					}
			}
		} catch (error) {
			console.error('Command execution error:', error);
			terminal.writeln(
				`\x1b[31mError: ${error instanceof Error ? error.message : 'Unknown error'}\x1b[0m`
			);
		}

		await writePrompt(session);
	}

	// Initialize sandbox session for terminal
	async function initializeSandboxSession(session: TerminalSession): Promise<void> {
		if (!project?.id) return;

		try {
			// TODO: Implement sandbox session initialization
			console.log('Sandbox session initialization not yet implemented');
			session.isConnected = false;
			if (session.terminal) {
				session.terminal.writeln(
					'\x1b[1;33m⚠\x1b[0m Sandbox not configured - using local terminal simulation'
				);
			}
		} catch (error) {
			console.error('Failed to initialize sandbox session:', error);
			session.isConnected = false;
			if (session.terminal) {
				session.terminal.writeln(
					'\x1b[1;33m⚠\x1b[0m Sandbox connection failed - using local terminal'
				);
			}
		}
	}

	// Create new terminal session
	async function createNewSession() {
		if (sessions.length >= maxTabs) {
			console.warn(`Maximum terminals reached: ${maxTabs}`);
			return;
		}

		const sessionId = `terminal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
		const newSession: TerminalSession = {
			id: sessionId,
			title: `Terminal ${nextSessionNumber}`,
			created: new Date(),
			currentLine: '',
			commandHistory: [],
			currentDirectory: '/home/user',
			sandboxSessionId: undefined,
			isConnected: false
		};

		sessions = [...sessions, newSession];
		activeTabId = sessionId;
		nextSessionNumber++;

		// Wait for DOM to update
		await tick();

		// Initialize terminal after DOM is ready
		setTimeout(async () => {
			initializeTerminal(sessionId);

			// Initialize sandbox session if project is available
			if (project) {
				const session = sessions.find((s) => s.id === sessionId);
				if (session) {
					await initializeSandboxSession(session);
				}
			}
		}, 100);

		console.log(`Created new terminal session: ${sessionId}`);
	}

	// Close terminal session
	async function closeSession(sessionId: string, event?: Event) {
		event?.stopPropagation();

		const sessionIndex = sessions.findIndex((s) => s.id === sessionId);
		if (sessionIndex === -1) return;

		const session = sessions[sessionIndex];

		// Clean up terminal instance
		if (session.terminal) {
			session.terminal.dispose();
		}

		// Remove from DOM elements
		delete terminalElements[sessionId];

		if (sessions.length <= 1) {
			sessions = [];
			activeTabId = null;
			nextSessionNumber = 1;
			return;
		}

		sessions = sessions.filter((s) => s.id !== sessionId);

		if (activeTabId === sessionId) {
			activeTabId = sessions.length > 0 ? sessions[0].id : null;
		}

		console.log(`Closed terminal session: ${sessionId}`);
		await tick();
	}

	// Switch to session
	async function switchToSession(sessionId: string) {
		activeTabId = sessionId;
		await tick();
	}

	// Toggle maximize
	function toggleMaximize() {
		isMaximized = !isMaximized;
	}

	// Get session display info
	function getSessionInfo(session: TerminalSession) {
		const index = sessions.findIndex((s) => s.id === session.id) + 1;
		const title = session.title;
		const isActive = session.id === activeTabId;
		return { title, index, isActive };
	}

	// Clean up on component destroy
	onDestroy(() => {
		sessions.forEach((session) => {
			if (session.terminal) {
				session.terminal.dispose();
			}
		});
	});

	onMount(async () => {
		if (sessions.length === 0 && allowNewTabs) {
			await createNewSession();
		}
	});
</script>

<div class="terminal-manager flex h-full flex-col {className}">
	{#if showHeader}
		<div
			class="terminal-header flex items-center justify-between border-b border-border bg-background p-2"
		>
			<div class="flex items-center gap-2">
				<TerminalIcon size={16} class="text-muted-foreground" />
				<span class="text-sm font-medium">Terminal</span>
				{#if sessions.length > 0}
					<Badge variant="secondary" class="text-xs">
						{sessions.length} session{sessions.length !== 1 ? 's' : ''}
					</Badge>
				{/if}
			</div>

			<div class="flex items-center gap-1">
				<Tooltip.Provider>
					<Tooltip.Root>
						<Tooltip.Trigger>
							<Button variant="ghost" size="sm" class="h-6 w-6 p-0">
								<Settings2Icon size={12} />
							</Button>
						</Tooltip.Trigger>
						<Tooltip.Content>Terminal Settings</Tooltip.Content>
					</Tooltip.Root>
				</Tooltip.Provider>

				<Tooltip.Provider>
					<Tooltip.Root>
						<Tooltip.Trigger>
							<Button variant="ghost" size="sm" class="h-6 w-6 p-0" onclick={toggleMaximize}>
								{#if isMaximized}
									<MinimizeIcon size={12} />
								{:else}
									<MaximizeIcon size={12} />
								{/if}
							</Button>
						</Tooltip.Trigger>
						<Tooltip.Content>
							{isMaximized ? 'Minimize' : 'Maximize'} Terminal
						</Tooltip.Content>
					</Tooltip.Root>
				</Tooltip.Provider>
			</div>
		</div>
	{/if}

	<div class="flex min-h-0 flex-1 flex-col">
		{#if sessions.length > 0}
			<Tabs.Root value={activeTabId || ''} class="flex h-full flex-col">
				{#if sessions.length > 1 || allowNewTabs}
					<div class="flex items-center border-b border-border bg-muted/30">
						<Tabs.List class="h-auto bg-transparent p-0">
							{#each sessions as session (session.id)}
								{@const info = getSessionInfo(session)}
								<Tabs.Trigger
									value={session.id}
									class="relative h-8 rounded-none border-r border-border px-3 last:border-r-0 data-[state=active]:bg-background data-[state=active]:shadow-none"
									onclick={() => switchToSession(session.id)}
								>
									<div class="flex items-center gap-2 text-xs">
										<span class="max-w-24 truncate">{info.title}</span>
										{#if sessions.length > 1}
											<button
												class="rounded-sm p-0.5 opacity-60 hover:bg-muted hover:opacity-100"
												onclick={(e) => closeSession(session.id, e)}
											>
												<XIcon size={10} />
											</button>
										{/if}
									</div>

									{#if info.isActive}
										<div class="absolute right-0 bottom-0 left-0 h-0.5 bg-primary"></div>
									{/if}
								</Tabs.Trigger>
							{/each}
						</Tabs.List>

						{#if allowNewTabs && sessions.length < maxTabs}
							<Button
								variant="ghost"
								size="sm"
								class="ml-1 h-8 w-8 rounded-none p-0"
								onclick={createNewSession}
							>
								<PlusIcon size={12} />
							</Button>
						{/if}
					</div>
				{/if}

				<div class="min-h-0 flex-1">
					{#each sessions as session (session.id)}
						<Tabs.Content value={session.id} class="m-0 h-full p-0 data-[state=inactive]:hidden">
							{#if session.error}
								<div class="flex h-full items-center justify-center">
									<div class="text-center">
										<div class="mb-2 text-sm text-destructive">Terminal Error</div>
										<div class="text-xs text-muted-foreground">{session.error}</div>
									</div>
								</div>
							{:else}
								<div
									bind:this={terminalElements[session.id]}
									class="terminal-container h-full w-full"
								></div>
							{/if}
						</Tabs.Content>
					{/each}
				</div>
			</Tabs.Root>
		{:else}
			<div class="flex flex-1 items-center justify-center">
				<div class="space-y-4 text-center">
					<TerminalIcon size={48} class="mx-auto text-muted-foreground" />
					<div>
						<h3 class="text-lg font-medium">No Terminal Sessions</h3>
						<p class="mt-1 text-sm text-muted-foreground">
							Create a new terminal session to get started
						</p>
					</div>
					{#if allowNewTabs}
						<Button onclick={createNewSession} class="mt-4">
							<PlusIcon size={16} class="mr-2" />
							New Terminal
						</Button>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.terminal-manager {
		--terminal-bg: hsl(var(--background));
		--terminal-border: hsl(var(--border));
	}

	:global(.terminal-manager .terminal-container) {
		background: var(--terminal-bg);
		border: none;
	}

	:global(.terminal-manager .xterm) {
		height: 100% !important;
		width: 100% !important;
	}

	:global(.terminal-manager .xterm-viewport) {
		overflow-y: auto;
		scrollbar-width: thin;
	}

	:global(.terminal-manager .xterm-viewport::-webkit-scrollbar) {
		width: 8px;
	}

	:global(.terminal-manager .xterm-viewport::-webkit-scrollbar-thumb) {
		background-color: #444;
		border-radius: 4px;
	}
</style>
