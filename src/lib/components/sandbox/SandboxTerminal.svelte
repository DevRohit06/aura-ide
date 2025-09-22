<!--
  SandboxTerminal.svelte
  Interactive terminal component for sandbox environments
-->
<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger,
		SelectValue
	} from '$lib/components/ui/select';
	import { Plus, Terminal, Trash2, X } from 'lucide-svelte';
	import { onMount, tick } from 'svelte';

	interface Props {
		sandbox: {
			id: string;
			name: string;
			status: string;
		};
		open: boolean;
	}

	let { sandbox, open = $bindable() }: Props = $props();

	interface TerminalSession {
		id: string;
		name: string;
		shell: string;
		workingDir: string;
		created: Date;
		lastActivity: Date;
		isActive: boolean;
	}

	interface CommandExecution {
		id: string;
		command: string;
		output: string;
		error?: string;
		exitCode: number;
		executionTime: number;
		timestamp: Date;
		success: boolean;
	}

	// Component state
	let terminalSessions = $state<TerminalSession[]>([]);
	let activeSessionId = $state<string | null>(null);
	let commandHistory = $state<CommandExecution[]>([]);
	let currentCommand = $state('');
	let workingDirectory = $state('/');
	let loading = $state(false);
	let executing = $state(false);
	let error = $state<string | null>(null);

	// Terminal settings
	let selectedShell = $state('/bin/bash');
	let fontSize = $state(14);
	let theme = $state('dark');

	// Terminal container ref
	let terminalContainer: HTMLElement;
	let commandInput: HTMLInputElement;

	// Available shells
	const shells = [
		{ value: '/bin/bash', label: 'Bash' },
		{ value: '/bin/zsh', label: 'Zsh' },
		{ value: '/bin/sh', label: 'Shell' },
		{ value: '/usr/bin/fish', label: 'Fish' }
	];

	// Get active session
	let activeSession = $derived(() => {
		return terminalSessions.find((session) => session.id === activeSessionId);
	});

	// Create new terminal session
	async function createTerminalSession() {
		loading = true;
		error = null;

		try {
			const response = await fetch(`/api/sandbox/${sandbox.id}/terminal`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					shell: selectedShell,
					workingDir: workingDirectory,
					dimensions: { cols: 80, rows: 24 }
				})
			});

			if (!response.ok) {
				throw new Error('Failed to create terminal session');
			}

			const data = await response.json();

			// Add new session to list
			const newSession: TerminalSession = {
				id: data.terminal.terminalSessionId,
				name: `Terminal ${terminalSessions.length + 1}`,
				shell: selectedShell,
				workingDir: workingDirectory,
				created: new Date(),
				lastActivity: new Date(),
				isActive: true
			};

			terminalSessions.push(newSession);
			activeSessionId = newSession.id;

			// In a real implementation, you would establish WebSocket connection here
			// const ws = new WebSocket(data.terminal.websocketUrl);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create terminal session';
			console.error('Error creating terminal session:', err);
		} finally {
			loading = false;
		}
	}

	// Execute command
	async function executeCommand() {
		if (!currentCommand.trim() || executing) return;

		const command = currentCommand.trim();
		currentCommand = '';
		executing = true;
		error = null;

		const executionId = Date.now().toString();
		const startTime = Date.now();

		try {
			const response = await fetch(`/api/sandbox/${sandbox.id}/execute?type=command`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					command,
					workingDir: workingDirectory,
					timeout: 30000
				})
			});

			if (!response.ok) {
				throw new Error('Command execution failed');
			}

			const result = await response.json();
			const executionTime = Date.now() - startTime;

			// Add to command history
			const execution: CommandExecution = {
				id: executionId,
				command,
				output: result.stdout || '',
				error: result.stderr,
				exitCode: result.exit_code || 0,
				executionTime,
				timestamp: new Date(),
				success: result.success
			};

			commandHistory.push(execution);

			// Update working directory if command was successful cd
			if (command.startsWith('cd ') && result.success) {
				// Simple cd handling - in real implementation, you'd track this properly
				const newDir = command.substring(3).trim();
				if (newDir === '..') {
					const parts = workingDirectory.split('/').filter(Boolean);
					parts.pop();
					workingDirectory = '/' + parts.join('/');
				} else if (newDir.startsWith('/')) {
					workingDirectory = newDir;
				} else {
					workingDirectory =
						workingDirectory === '/' ? `/${newDir}` : `${workingDirectory}/${newDir}`;
				}
			}

			// Auto-scroll to bottom
			await tick();
			if (terminalContainer) {
				terminalContainer.scrollTop = terminalContainer.scrollHeight;
			}
		} catch (err) {
			const executionTime = Date.now() - startTime;
			const execution: CommandExecution = {
				id: executionId,
				command,
				output: '',
				error: err instanceof Error ? err.message : 'Unknown error',
				exitCode: 1,
				executionTime,
				timestamp: new Date(),
				success: false
			};

			commandHistory.push(execution);
			error = err instanceof Error ? err.message : 'Command execution failed';
		} finally {
			executing = false;
		}
	}

	// Handle keyboard events
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			executeCommand();
		} else if (event.key === 'ArrowUp') {
			// Navigate command history (simplified)
			event.preventDefault();
			const lastCommand = commandHistory[commandHistory.length - 1];
			if (lastCommand) {
				currentCommand = lastCommand.command;
			}
		}
	}

	// Clear terminal
	function clearTerminal() {
		commandHistory = [];
	}

	// Format timestamp
	function formatTimestamp(date: Date): string {
		return date.toLocaleTimeString();
	}

	// Format execution time
	function formatExecutionTime(ms: number): string {
		if (ms < 1000) {
			return `${ms}ms`;
		}
		return `${(ms / 1000).toFixed(2)}s`;
	}

	// Close terminal session
	function closeSession(sessionId: string) {
		terminalSessions = terminalSessions.filter((s) => s.id !== sessionId);
		if (activeSessionId === sessionId) {
			activeSessionId = terminalSessions[0]?.id || null;
		}
	}

	// Initialize when dialog opens
	$effect(() => {
		if (open && sandbox.status === 'running' && terminalSessions.length === 0) {
			createTerminalSession();
		}
	});

	// Focus command input when session becomes active
	$effect(() => {
		if (activeSessionId && commandInput) {
			commandInput.focus();
		}
	});

	onMount(() => {
		// Auto-focus command input
		if (commandInput) {
			commandInput.focus();
		}
	});
</script>

<Dialog bind:open class="max-w-6xl">
	<DialogContent class="flex max-h-[90vh] max-w-6xl flex-col overflow-hidden">
		<DialogHeader>
			<DialogTitle>Terminal - {sandbox.name}</DialogTitle>
			<DialogDescription>Interactive terminal access to your sandbox environment</DialogDescription>
		</DialogHeader>

		{#if sandbox.status !== 'running'}
			<Card class="border-yellow-200 bg-yellow-50">
				<CardContent class="pt-6">
					<p class="text-yellow-800">
						Sandbox must be running to access terminal. Current status: {sandbox.status}
					</p>
				</CardContent>
			</Card>
		{:else}
			<div class="flex flex-1 flex-col space-y-4 overflow-hidden">
				<!-- Terminal Tabs -->
				{#if terminalSessions.length > 0}
					<div class="flex items-center gap-2 border-b pb-2">
						{#each terminalSessions as session}
							<Button
								size="sm"
								variant={activeSessionId === session.id ? 'default' : 'outline'}
								onclick={() => (activeSessionId = session.id)}
								class="flex items-center gap-2"
							>
								<Terminal class="h-3 w-3" />
								{session.name}
								<button
									onclick={(e) => {
										e.stopPropagation();
										closeSession(session.id);
									}}
									class="ml-1 rounded p-0.5 hover:bg-muted"
								>
									<X class="h-3 w-3" />
								</button>
							</Button>
						{/each}

						<Button size="sm" variant="ghost" onclick={createTerminalSession} disabled={loading}>
							<Plus class="h-3 w-3" />
						</Button>
					</div>
				{/if}

				<!-- Terminal Settings -->
				<div class="flex items-center gap-4 text-sm">
					<div class="flex items-center gap-2">
						<Label class="text-xs">Shell:</Label>
						<Select bind:value={selectedShell}>
							<SelectTrigger class="h-7 w-32 text-xs">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{#each shells as shell}
									<SelectItem value={shell.value}>{shell.label}</SelectItem>
								{/each}
							</SelectContent>
						</Select>
					</div>

					<div class="flex items-center gap-2">
						<Label class="text-xs">Working Dir:</Label>
						<Badge variant="outline" class="text-xs">
							{workingDirectory}
						</Badge>
					</div>

					<div class="ml-auto flex gap-1">
						<Button size="sm" variant="ghost" onclick={clearTerminal}>
							<Trash2 class="h-3 w-3" />
						</Button>
					</div>
				</div>

				<!-- Terminal Output -->
				<Card class="flex-1 overflow-hidden bg-gray-900 font-mono text-sm text-green-400">
					<CardContent class="h-full p-0">
						<ScrollArea bind:element={terminalContainer} class="h-full">
							<div class="min-h-full space-y-2 p-4">
								{#if commandHistory.length === 0}
									<div class="text-gray-500">
										<p>Welcome to {sandbox.name} terminal</p>
										<p>Type commands below to interact with your sandbox</p>
										<p class="mt-2 text-xs">
											Shell: {selectedShell} | Working Directory: {workingDirectory}
										</p>
									</div>
								{/if}

								{#each commandHistory as execution}
									<div class="border-l-2 border-gray-700 py-1 pl-3">
										<!-- Command -->
										<div class="flex items-center gap-2 text-blue-400">
											<span class="text-xs text-gray-500">
												{formatTimestamp(execution.timestamp)}
											</span>
											<span class="text-green-400">$</span>
											<span>{execution.command}</span>
											<Badge
												variant={execution.success ? 'default' : 'destructive'}
												class="text-xs"
											>
												{execution.exitCode}
											</Badge>
											<span class="text-xs text-gray-500">
												{formatExecutionTime(execution.executionTime)}
											</span>
										</div>

										<!-- Output -->
										{#if execution.output}
											<pre
												class="mt-1 text-xs leading-relaxed whitespace-pre-wrap text-gray-300">{execution.output}</pre>
										{/if}

										<!-- Error -->
										{#if execution.error}
											<pre
												class="mt-1 text-xs leading-relaxed whitespace-pre-wrap text-red-400">{execution.error}</pre>
										{/if}
									</div>
								{/each}

								<!-- Current command line -->
								{#if activeSession}
									<div class="mt-4 flex items-center gap-2 text-green-400">
										<span class="text-green-400">$</span>
										<Input
											bind:element={commandInput}
											bind:value={currentCommand}
											onkeydown={handleKeyDown}
											disabled={executing}
											placeholder={executing ? 'Executing...' : 'Enter command...'}
											class="h-auto border-none bg-transparent p-0 font-mono text-sm text-green-400 focus-visible:ring-0"
										/>
										{#if executing}
											<div
												class="h-3 w-3 animate-spin rounded-full border-b border-green-400"
											></div>
										{/if}
									</div>
								{/if}
							</div>
						</ScrollArea>
					</CardContent>
				</Card>

				<!-- Quick Actions -->
				<div class="flex items-center gap-2 text-xs">
					<span class="text-muted-foreground">Quick commands:</span>
					<Button
						size="sm"
						variant="ghost"
						onclick={() => (currentCommand = 'ls -la')}
						class="h-6 px-2 text-xs"
					>
						ls -la
					</Button>
					<Button
						size="sm"
						variant="ghost"
						onclick={() => (currentCommand = 'pwd')}
						class="h-6 px-2 text-xs"
					>
						pwd
					</Button>
					<Button
						size="sm"
						variant="ghost"
						onclick={() => (currentCommand = 'ps aux')}
						class="h-6 px-2 text-xs"
					>
						ps aux
					</Button>
					<Button
						size="sm"
						variant="ghost"
						onclick={() => (currentCommand = 'df -h')}
						class="h-6 px-2 text-xs"
					>
						df -h
					</Button>
				</div>
			</div>
		{/if}

		<!-- Error Display -->
		{#if error}
			<div class="rounded-md border border-red-200 bg-red-50 p-3">
				<div class="flex items-start justify-between">
					<p class="text-sm text-red-800">{error}</p>
					<Button size="sm" variant="ghost" onclick={() => (error = null)}>
						<X class="h-3 w-3" />
					</Button>
				</div>
			</div>
		{/if}
	</DialogContent>
</Dialog>
