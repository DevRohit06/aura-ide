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

	// Terminal session interface (output-only)
	interface TerminalSession {
		id: string;
		title: string;
		created: Date;
		terminal?: any; // xterm Terminal instance
		element?: HTMLElement;
		error?: string;
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
		// Always create initial terminal session
		console.log('🖥️ Terminal Manager mounted, creating initial session');
		createNewSession();
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
		console.log('🔧 initializeTerminal called for:', sessionId);
		const session = sessions.find((s) => s.id === sessionId);
		const element = terminalElements[sessionId];

		console.log('🔍 Element lookup:', {
			sessionId,
			hasSession: !!session,
			hasElement: !!element,
			elementKeys: Object.keys(terminalElements)
		});

		if (!session || !element) {
			console.error('❌ Session or element not found for', sessionId, {
				session: !!session,
				element: !!element,
				availableElements: Object.keys(terminalElements)
			});
			return;
		}

		try {
			console.log('✅ Initializing terminal for session', sessionId);

			// Import xterm CSS and library
			await import('@xterm/xterm/css/xterm.css');
			const { Terminal } = await import('@xterm/xterm');
			const { FitAddon } = await import('@xterm/addon-fit');
			const { WebLinksAddon } = await import('@xterm/addon-web-links');

			// Create terminal instance with theme support (read-only output)
			const currentTheme = mode.current === 'dark' ? terminalThemes.dark : terminalThemes.light;
			const terminal = new Terminal({
				theme: currentTheme,
				fontSize: 14,
				fontFamily: '"Fira Code", "JetBrains Mono", "Cascadia Code", Consolas, monospace',
				cursorBlink: false, // Disable cursor since it's read-only
				cursorStyle: 'underline',
				scrollback: 10000,
				tabStopWidth: 4,
				allowTransparency: false,
				convertEol: true,
				rightClickSelectsWord: true,
				macOptionIsMeta: true,
				scrollOnUserInput: true,
				altClickMovesCursor: true,
				disableStdin: true // Make terminal read-only (no user input)
			});

			// Load addons
			const fitAddon = new FitAddon();
			terminal.loadAddon(fitAddon);
			terminal.loadAddon(new WebLinksAddon());

			// Open terminal in DOM
			terminal.open(element);

			// Fit terminal to container
			setTimeout(() => {
				fitAddon.fit();
			}, 0);

			// Update session with terminal instance
			session.terminal = terminal;
			console.log('💾 Terminal instance saved to session:', sessionId);

			// Write initial message
			console.log('✍️ Writing initial welcome message...');
			terminal.writeln('\x1b[1;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
			terminal.writeln('\x1b[1;36m  Output Terminal\x1b[0m');
			terminal.writeln('\x1b[90m  Read-only terminal for AI responses and command outputs\x1b[0m');
			terminal.writeln('\x1b[1;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
			terminal.writeln('');
			console.log('✅ Initial message written');

			// Handle window resize
			const resizeObserver = new ResizeObserver(() => {
				if (session.terminal && fitAddon) {
					try {
						fitAddon.fit();
					} catch (err) {
						console.warn('Error resizing terminal:', err);
					}
				}
			});
			resizeObserver.observe(element);

			console.log('Terminal initialized successfully for', sessionId);
		} catch (err) {
			console.error('Failed to initialize terminal:', err);
			if (session) {
				session.error = err instanceof Error ? err.message : 'Unknown error';
			}
		}
	}

	// Write output to terminal (public method for external use)
	/**
	 * Write output to terminal (public method for external use)
	 */
	function writeOutput(sessionId: string, data: string) {
		console.log('✍️ [TerminalManager] writeOutput called:', {
			sessionId,
			dataLength: data?.length,
			dataPreview: data?.substring(0, 100),
			hasSessions: sessions.length,
			activeTabId
		});
		const session = sessions.find((s) => s.id === sessionId);
		console.log('📋 [TerminalManager] Session lookup:', {
			found: !!session,
			hasTerminal: !!session?.terminal,
			sessionId,
			availableSessions: sessions.map((s) => ({ id: s.id, hasTerminal: !!s.terminal }))
		});
		if (session?.terminal) {
			console.log('✅ [TerminalManager] Writing to xterm terminal:', data.substring(0, 100));
			try {
				session.terminal.write(data);
				console.log('✅ [TerminalManager] Write successful');
			} catch (error) {
				console.error('❌ [TerminalManager] Write failed:', error);
			}
		} else {
			console.warn('⚠️ [TerminalManager] Cannot write to terminal: session or terminal not found', {
				sessionId,
				availableSessions: sessions.map((s) => s.id),
				sessionHasTerminal: session ? !!session.terminal : 'no session'
			});
		}
	} // Write line to terminal (public method for external use)
	function writeLine(sessionId: string, line: string) {
		const session = sessions.find((s) => s.id === sessionId);
		if (session?.terminal) {
			session.terminal.writeln(line);
		}
	}

	// Clear terminal (public method for external use)
	function clearTerminal(sessionId: string) {
		const session = sessions.find((s) => s.id === sessionId);
		if (session?.terminal) {
			session.terminal.clear();
		}
	}

	// Get active session ID (for external access)
	function getActiveSessionId(): string | null {
		return activeTabId;
	}

	// Check if terminal manager is ready
	function isReady(): boolean {
		return sessions.length > 0 && activeTabId !== null;
	}

	// Export functions for parent component to use
	export { writeOutput, writeLine, clearTerminal, getActiveSessionId, isReady };

	// Create new terminal session
	async function createNewSession() {
		if (sessions.length >= maxTabs) {
			console.warn(`Maximum terminals reached: ${maxTabs}`);
			return;
		}

		const sessionId = `terminal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
		console.log(`🆕 Creating new terminal session: ${sessionId}`);

		const newSession: TerminalSession = {
			id: sessionId,
			title: `Terminal ${nextSessionNumber}`,
			created: new Date()
		};

		sessions = [...sessions, newSession];
		activeTabId = sessionId;
		nextSessionNumber++;

		console.log(`📊 Sessions after creation:`, sessions.length, 'Active:', activeTabId);

		// Wait for DOM to update
		await tick();
		console.log('⏰ DOM updated, waiting 100ms before terminal init');

		// Initialize terminal after DOM is ready
		setTimeout(() => {
			console.log('🚀 Initializing terminal for session:', sessionId);
			initializeTerminal(sessionId);
		}, 100);

		console.log(`✅ Terminal session created: ${sessionId}`);
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
