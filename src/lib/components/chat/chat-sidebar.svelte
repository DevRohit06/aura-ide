<script lang="ts">
	import ConfirmModal from '$lib/components/common/modals/confirm-modal.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu';
	import { sseService, type SSEEvent } from '$lib/services/sse.service';
	import {
		agentActions,
		agentStatusDisplay,
		isAgentAvailable,
		isAgentBusy,
		pendingToolsCount,
		queuedMessagesCount
	} from '$lib/stores/agent-state.store';
	import {
		chatThreadsActions,
		chatThreadsStore,
		type ChatMessage,
		type ChatThread
	} from '$lib/stores/chatThreads';
	import type { Project } from '$lib/types';
	import { chatFileContext } from '@/stores/editor';
	import { selectedModelStore } from '@/stores/model';
	import { currentSandboxId } from '@/stores/sandbox.store';
	import { AlertCircle, History, MessageSquare, MoreHorizontal, Plus } from 'lucide-svelte';
	import { createEventDispatcher, tick } from 'svelte';
	import ChatContainer from './chat-container.svelte';
	import ChatInput from './chat-input.svelte';

	// UI Message type for ChatContainer (match ChatContainer MessageType)
	interface UIMessage {
		id: string;
		content: string;
		role: 'user' | 'assistant';
		timestamp: Date;
		isLoading?: boolean;
		fileContext?: {
			fileName?: string;
			filePath?: string;
			language?: string;
		};
		metadata?: any;
		agentInterrupt?: {
			toolCalls: Array<{
				name: string;
				args: Record<string, any>;
				id?: string;
			}>;
			stateSnapshot?: {
				currentFile?: string | null;
				sandboxId?: string | null;
				fileContent?: string | null;
			};
			reason?: string;
		};
	}

	interface Props {
		project?: Project;
	}

	let { project = undefined }: Props = $props();

	const dispatch = createEventDispatcher<{
		close: void;
	}>();

	// Reactive state
	let projectId = $state(project?.id ?? 'default');
	let threads = $state<ChatThread[]>([]);
	let selectedThread = $state<ChatThread | null>(null);
	let threadMessages = $state<UIMessage[]>([]);
	let isLoadingMessages = $state(false);
	let showThreadHistory = $state(false);
	let isCreatingThread = $state(false);
	let editingThreadId = $state<string | null>(null);
	let editingThreadName = $state('');
	let errorMessage = $state<string | null>(null);

	let confirmOpen = $state(false);
	let confirmTitle = $state('Confirm');
	let confirmBody = $state('Are you sure?');
	let confirmResolve: ((value: boolean) => void) | null = null;

	let selectedModel = $state($selectedModelStore);
	let currentSandboxIdValue = $state($currentSandboxId);
	let hasLoadedInitially = $state(false);
	let previousSelectedThreadId = $state<string | null>(null);
	let loadedThreadIds = $state<Set<string>>(new Set());

	// Reactive: Load threads on mount and when project changes
	$effect(() => {
		const newProjectId = project?.id ?? 'default';

		// Update projectId if changed
		if (projectId !== newProjectId) {
			projectId = newProjectId;
			hasLoadedInitially = false; // Reset for new project
			loadedThreadIds.clear(); // Clear loaded threads for new project
			previousSelectedThreadId = null; // Reset selected thread tracking
		}

		// Load threads on initial mount or when project changes
		if (!hasLoadedInitially) {
			hasLoadedInitially = true;
			loadThreadsFromDB().then(() => {
				// Auto-select the most recent thread if none selected
				if (!selectedThread && threads.length > 0) {
					chatThreadsActions.selectThread(projectId, threads[0].id);
				}
			});
		}
	});

	// Reactive: Subscribe to store changes
	$effect(() => {
		const unsubscribe = chatThreadsStore.subscribe((store) => {
			const projectThreads = store[projectId] ?? [];
			threads = projectThreads;

			// Update selected thread
			const newSelected = projectThreads.find((t) => t.selected) ?? null;
			const newSelectedId = newSelected?.id || null;

			if (newSelectedId !== previousSelectedThreadId) {
				selectedThread = newSelected;
				previousSelectedThreadId = newSelectedId;

				// Load messages for newly selected thread if needed and not already loaded
				if (
					newSelected &&
					newSelected.messages.length === 0 &&
					!isLoadingMessages &&
					!loadedThreadIds.has(newSelected.id)
				) {
					loadThreadMessages(newSelected.id);
				}
			} else {
				selectedThread = newSelected;
			}
		});

		return () => unsubscribe();
	});

	// Reactive: Map messages when selectedThread changes
	$effect(() => {
		if (selectedThread?.messages) {
			try {
				const msgs = selectedThread.messages.map((m: ChatMessage) => {
					const msg = {
						id: m.id,
						content: m.content,
						role: (m.role === 'system' ? 'assistant' : m.role) as 'user' | 'assistant',
						timestamp: new Date(m.timestamp),
						isLoading: false,
						metadata: m.metadata,
						agentInterrupt: undefined as any
					};

					// Transform agentInterrupt if it exists - convert parameters to args
					if (m.metadata?.agentInterrupt) {
						msg.agentInterrupt = {
							...m.metadata.agentInterrupt,
							toolCalls:
								m.metadata.agentInterrupt.toolCalls?.map((tool: any) => ({
									name: tool.name,
									args: tool.parameters || tool.args || {},
									id: tool.id
								})) || []
						};
					}

					return msg;
				});
				threadMessages = msgs;
			} catch (err) {
				console.error('ThreadMessagesMappingError', err);
				threadMessages = [];
			}
		} else {
			threadMessages = [];
		}
	});

	// Load threads from MongoDB
	async function loadThreadsFromDB() {
		try {
			errorMessage = null;
			const response = await fetch(`/api/chat/threads?projectId=${projectId}`);
			if (response.ok) {
				const data = await response.json();
				if (data.threads && Array.isArray(data.threads)) {
					// Sort by updatedAt descending (most recent first)
					const sortedThreads = data.threads.sort(
						(a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
					);

					const convertedThreads = sortedThreads.map((t: any) => ({
						id: t.id,
						title: t.title,
						projectId: t.projectId,
						messages: [],
						createdAt: t.createdAt,
						updatedAt: t.updatedAt,
						selected: false
					}));
					chatThreadsStore.update((store) => {
						store[projectId] = convertedThreads;
						return { ...store };
					});
				}
			} else {
				errorMessage = 'Failed to load chat threads';
			}
		} catch (err) {
			console.error('Failed to load threads from DB:', err);
			errorMessage = 'Failed to load chat threads';
		}
	}

	// Load messages for a thread from MongoDB
	async function loadThreadMessages(threadId: string, force = false) {
		// Don't block if force is true (for refreshing after send)
		if (!force && isLoadingMessages) {
			console.log('⏸️ Skipping loadThreadMessages - already loading');
			return;
		}

		console.log(`📥 Loading messages for thread ${threadId} (force: ${force})`);
		try {
			const response = await fetch(`/api/chat/threads/${threadId}/messages`);
			if (response.ok) {
				const data = await response.json();
				console.log(`✅ Loaded ${data.messages?.length || 0} messages from DB`);
				if (data.messages && Array.isArray(data.messages)) {
					chatThreadsStore.update((store) => {
						const list = store[projectId] ?? [];
						const threadIndex = list.findIndex((t) => t.id === threadId);
						if (threadIndex > -1) {
							list[threadIndex].messages = data.messages.map((m: any) => ({
								id: m.id,
								role: m.role,
								content: m.content,
								timestamp: m.timestamp,
								metadata: m.metadata
							}));
							// Update the thread's updatedAt to reflect latest activity
							list[threadIndex].updatedAt = new Date().toISOString();
							console.log(
								`📝 Updated thread ${threadId} with ${list[threadIndex].messages.length} messages`
							);
						} else {
							console.warn(`⚠️ Thread ${threadId} not found in store`);
						}
						store[projectId] = list;
						return { ...store };
					});
				}
				// Mark as loaded regardless of message count
				loadedThreadIds.add(threadId);
			} else {
				console.error(`❌ Failed to load messages: ${response.status}`);
			}
		} catch (err) {
			console.error('Failed to load thread messages from DB:', err);
		}
	}

	async function handleSend(
		event: CustomEvent<{ content: string; includeCodeContext?: boolean; codeQuery?: string }>
	) {
		const payload = event.detail;
		let threadId: string;

		// Check if agent is available
		if (!$isAgentAvailable && $isAgentBusy) {
			// Queue the message if agent is busy
			const messageId = agentActions.queueMessage(payload.content, selectedThread?.id || '');
			errorMessage = null;
			return;
		}

		if (!selectedThread) {
			// Create new thread for first message (will be created by API)
			threadId = '';
		} else {
			// Use existing thread
			threadId = selectedThread.id;
			agentActions.setActiveThread(threadId);
		}

		// Add user message immediately to UI
		if (threadId) {
			chatThreadsActions.addMessage(projectId, threadId, 'user', payload.content);
		}

		// Set agent status to thinking
		agentActions.setStatus('thinking', 'Processing your message...');
		isLoadingMessages = true;
		errorMessage = null;

		const startTime = Date.now();
		let assistantContent = '';
		let streamingMessageId: string | null = null;

		try {
			// Set up SSE event handlers
			const unsubscribeSSE = sseService.subscribeAll((event: SSEEvent) => {
				switch (event.type) {
					case 'start':
						agentActions.setStatus('thinking', 'Agent started processing...');
						break;

					case 'thinking':
						agentActions.setStatus('thinking', event.data.message || 'Agent is thinking...');
						break;

					case 'tool_call':
						agentActions.setStatus('executing', 'Executing tools...');
						agentActions.addExecutingTool('tool', event.data.toolCalls?.[0]?.name || 'tool');
						break;

					case 'content':
						if (!streamingMessageId && event.data.chunk) {
							// Create streaming assistant message
							streamingMessageId = `stream-${Date.now()}`;
							assistantContent = event.data.chunk;
							if (threadId) {
								chatThreadsActions.addMessage(projectId, threadId, 'assistant', assistantContent, {
									messageId: streamingMessageId,
									isStreaming: true
								});
							}
						} else if (streamingMessageId && event.data.chunk) {
							// Update streaming content
							assistantContent += event.data.chunk;
							if (threadId) {
								chatThreadsActions.updateMessage(
									projectId,
									threadId,
									streamingMessageId,
									assistantContent
								);
							}
						}
						break;

					case 'complete':
						const responseTime = Date.now() - startTime;
						agentActions.recordResponseTime(responseTime);
						agentActions.setStatus('idle');

						// Update threadId if new thread was created
						if (event.data.threadId && !threadId) {
							threadId = event.data.threadId;
							agentActions.setActiveThread(threadId);
							loadThreadsFromDB().then(() => {
								chatThreadsActions.selectThread(projectId, threadId);
								loadThreadMessages(threadId, true);
							});
						} else if (threadId) {
							// Reload messages to get final version from DB
							loadThreadMessages(threadId, true);
						}

						// Mark streaming as complete
						if (streamingMessageId && threadId) {
							chatThreadsActions.updateMessage(
								projectId,
								threadId,
								streamingMessageId,
								assistantContent,
								{
									isStreaming: false
								}
							);
						}

						isLoadingMessages = false;
						unsubscribeSSE();
						break;

					case 'error':
						agentActions.setError(`Agent error: ${event.data.error}`);
						if (threadId && event.data.error) {
							chatThreadsActions.addMessage(
								projectId,
								threadId,
								'assistant',
								`Error: ${event.data.error}`
							);
						}
						isLoadingMessages = false;
						unsubscribeSSE();
						break;
				}
			});

			// Send message via SSE stream
			await sseService.streamMessage({
				message: payload.content,
				threadId: threadId || undefined,
				projectId,
				sandboxId: project?.sandboxId || currentSandboxIdValue,
				sandboxType: project?.sandboxProvider,
				modelName: selectedModel,
				includeCodeContext: payload.includeCodeContext,
				codeQuery: payload.codeQuery,
				currentFile: $chatFileContext.isActive ? $chatFileContext.filePath : null
			});
		} catch (err) {
			console.error('Failed to send message via SSE:', err);
			agentActions.setError(
				`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`
			);
			if (threadId) {
				chatThreadsActions.addMessage(
					projectId,
					threadId,
					'assistant',
					`Error: ${err instanceof Error ? err.message : 'Network error'}`
				);
			}
			isLoadingMessages = false;
		}
	}

	// Create new thread
	async function createNewThread() {
		if (isCreatingThread) return;
		isCreatingThread = true;
		try {
			const threadId = chatThreadsActions.createThread(projectId, 'New Thread');
			chatThreadsActions.selectThread(projectId, threadId);
		} catch (err) {
			console.error('Failed to create thread:', err);
			errorMessage = 'Failed to create new thread';
		} finally {
			isCreatingThread = false;
		}
	}

	function selectThread(threadId: string) {
		chatThreadsActions.selectThread(projectId, threadId);
	}

	function handleVoice() {
		console.log('Voice input - TODO: Implement voice recording');
	}

	function formatUpdatedAt(dateString: string): string {
		try {
			const date = new Date(dateString);
			const now = new Date();
			const diffMs = now.getTime() - date.getTime();
			const diffMins = Math.floor(diffMs / (1000 * 60));
			const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
			const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

			if (diffMins < 1) return 'Just now';
			if (diffMins < 60) return `${diffMins}m ago`;
			if (diffHours < 24) return `${diffHours}h ago`;
			if (diffDays < 7) return `${diffDays}d ago`;
			return date.toLocaleDateString();
		} catch {
			return '—';
		}
	}

	async function handleInterruptDecision(event: CustomEvent) {
		const eventType = event.type;
		let action: string;
		let payload: any = {};

		switch (eventType) {
			case 'approveInterrupt':
				action = 'approve';
				payload.toolCalls = event.detail.toolCalls;
				break;
			case 'rejectInterrupt':
				action = 'reject';
				break;
			case 'modifyInterrupt':
				action = 'modify';
				payload.edits = event.detail.edits;
				break;
			default:
				return;
		}

		if (!selectedThread) return;

		try {
			const res = await fetch('/api/agent', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					threadId: selectedThread.id,
					projectId,
					action,
					...payload,
					newModelName: selectedModel
				})
			});

			const json = await res.json();

			if (json.response) {
				chatThreadsActions.addMessage(projectId, selectedThread.id, 'assistant', json.response);
			}

			if (json.success && json.applied && json.applied.length > 0) {
				const appliedSummary = json.applied
					.map((edit: any) => `${edit.success ? '✓' : '✗'} ${edit.filePath}`)
					.join('\n');
				chatThreadsActions.addMessage(
					projectId,
					selectedThread.id,
					'system',
					`Applied changes:\n${appliedSummary}`
				);
			}
		} catch (err) {
			console.error('Failed to process interrupt decision:', err);
			chatThreadsActions.addMessage(
				projectId,
				selectedThread.id,
				'assistant',
				'Failed to process interrupt decision'
			);
		}
	}

	function startEditingThread(threadId: string, currentName: string, event?: Event) {
		if (event) event.stopPropagation();
		editingThreadId = threadId;
		editingThreadName = currentName;
		tick().then(() => {
			const input = document.querySelector(`[data-thread-input="${threadId}"]`) as HTMLInputElement;
			if (input) {
				input.focus();
				input.select();
			}
		});
	}

	function cancelEditingThread() {
		editingThreadId = null;
		editingThreadName = '';
	}

	function saveThreadName(threadId: string) {
		if (!threadId) return;
		chatThreadsActions.renameThread(projectId, threadId, editingThreadName || 'Untitled');
		cancelEditingThread();
	}

	function showConfirm(title: string, body: string) {
		confirmTitle = title;
		confirmBody = body;
		confirmOpen = true;
		return new Promise<boolean>((resolve) => {
			confirmResolve = resolve;
		});
	}

	function handleModalConfirm() {
		confirmOpen = false;
		if (confirmResolve) confirmResolve(true);
		confirmResolve = null;
	}

	function handleModalCancel() {
		confirmOpen = false;
		if (confirmResolve) confirmResolve(false);
		confirmResolve = null;
	}

	async function deleteThread(threadId: string) {
		const ok = await showConfirm('Delete Thread', 'Are you sure you want to delete this thread?');
		if (!ok) return;
		chatThreadsActions.deleteThread(projectId, threadId);
	}
</script>

<div class="flex h-full flex-col">
	<div class="flex items-center justify-between border-b p-4">
		<div class="flex items-center gap-3">
			<div class="flex min-w-0 flex-1 flex-col gap-1">
				<div
					class="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800"
				>
					{#if $agentStatusDisplay.icon === 'thinking' || $agentStatusDisplay.icon === 'executing'}
						<div class="h-2 w-2 animate-pulse rounded-full bg-blue-500"></div>
					{:else if $agentStatusDisplay.icon === 'ready'}
						<div class="h-2 w-2 rounded-full bg-green-500"></div>
					{:else if $agentStatusDisplay.icon === 'error'}
						<AlertCircle size={8} class="text-red-500" />
					{:else if $agentStatusDisplay.icon === 'connecting'}
						<div
							class="h-2 w-2 animate-spin rounded-full border border-yellow-500 border-t-transparent"
						></div>
					{:else}
						<div class="h-2 w-2 rounded-full bg-gray-400"></div>
					{/if}
					<span class="{$agentStatusDisplay.color} font-medium">{$agentStatusDisplay.text}</span>
				</div>
			</div>
			{#if selectedThread}
				<p class="max-w-32 truncate text-xs text-muted-foreground" title={selectedThread.title}>
					{selectedThread.title}
				</p>
			{/if}
			<!-- Active Tools Indicator -->
			{#if $pendingToolsCount > 0}
				<div class="flex items-center gap-1 text-xs text-purple-600">
					<div class="h-2 w-2 animate-pulse rounded-full bg-purple-500"></div>
					<span>{$pendingToolsCount} tool{$pendingToolsCount !== 1 ? 's' : ''} running</span>
				</div>
			{/if}
			<!-- Queued Messages Indicator -->
			{#if $queuedMessagesCount > 0}
				<div class="flex items-center gap-1 text-xs text-orange-600">
					<span>{$queuedMessagesCount} message{$queuedMessagesCount !== 1 ? 's' : ''} queued</span>
				</div>
			{/if}
		</div>

		<div class="flex items-center gap-2">
			<!-- New thread button -->
			<Button
				variant="ghost"
				size="sm"
				class="h-7 w-7"
				disabled={isCreatingThread}
				title="New chat"
				onclick={createNewThread}
			>
				{#if isCreatingThread}
					<div
						class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
					></div>
				{:else}
					<Plus class="h-4 w-4" />
				{/if}
			</Button>

			<!-- Thread history dropdown -->
			<DropdownMenu bind:open={showThreadHistory}>
				<DropdownMenuTrigger>
					<Button variant="ghost" size="sm" class="h-7 w-7" title="Thread history">
						<History class="h-4 w-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" class="max-h-96 w-80 overflow-y-auto">
					{#each threads as t}
						<DropdownMenuItem onclick={() => selectThread(t.id)}>
							<div class="flex w-full items-center justify-between">
								<span class="truncate">{t.title}</span>
								<small class="text-xs text-muted-foreground"
									>{formatUpdatedAt(t.updatedAt) || '—'}</small
								>
							</div>
						</DropdownMenuItem>
					{:else}
						<DropdownMenuItem disabled>
							<span class="text-xs text-muted-foreground">No threads yet</span>
						</DropdownMenuItem>
					{/each}
				</DropdownMenuContent>
			</DropdownMenu>

			<!-- More options -->
			<DropdownMenu>
				<DropdownMenuTrigger>
					<Button variant="ghost" size="sm" class="h-7 w-7">
						<MoreHorizontal class="h-4 w-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onclick={() => dispatch('close')}>
						<div class="flex items-center gap-2">
							<MessageSquare class="h-4 w-4" />
							Close Chat
						</div>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	</div>

	<!-- Error message -->
	{#if errorMessage}
		<div class="border-b border-red-200 bg-red-50 px-3 py-2">
			<p class="text-xs text-red-600">{errorMessage}</p>
		</div>
	{/if}

	<!-- Chat content -->
	<div class="flex-1 overflow-hidden">
		{#if selectedThread}
			<ChatContainer
				messages={threadMessages}
				isLoading={isLoadingMessages || threadMessages.some((m: any) => m.isLoading)}
				on:approveInterrupt={handleInterruptDecision}
				on:rejectInterrupt={handleInterruptDecision}
				on:modifyInterrupt={handleInterruptDecision}
			/>
		{:else}
			<div class="flex h-full items-center justify-center p-8 text-center">
				<div class="max-w-sm">
					<MessageSquare class="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
					<h3 class="mb-2 text-lg font-medium">Start a conversation</h3>
					<p class="text-sm text-muted-foreground">
						Send a message to begin chatting with the AI assistant.
					</p>
				</div>
			</div>
		{/if}
	</div>

	<!-- Chat input -->
	{#if $chatFileContext.isActive}
		<div class="border-t px-4 py-2">
			<div class="flex items-center gap-2">
				<!-- <span class="text-xs text-muted-foreground">Current file:</span> -->
				<Badge variant="secondary" class="flex items-center gap-1 text-xs">
					<span class="text-blue-600">📄</span>
					<span class="max-w-32 truncate" title={$chatFileContext.filePath}>
						{$chatFileContext.fileName}
					</span>
				</Badge>
			</div>
		</div>
	{/if}
	<ChatInput on:send={handleSend} on:voice={handleVoice} />
</div>

<!-- Confirm Modal -->
<ConfirmModal
	bind:open={confirmOpen}
	title={confirmTitle}
	description={confirmBody}
	on:confirm={handleModalConfirm}
	on:cancel={handleModalCancel}
/>
