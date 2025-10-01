<script lang="ts">
	import ConfirmModal from '$lib/components/common/modals/confirm-modal.svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu';
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
	import { History, MessageSquare, MoreHorizontal, Plus } from 'lucide-svelte';
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
				parameters: Record<string, any>;
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
				const msgs = selectedThread.messages.map((m: ChatMessage) => ({
					id: m.id,
					content: m.content,
					role: (m.role === 'system' ? 'assistant' : m.role) as 'user' | 'assistant',
					timestamp: new Date(m.timestamp),
					isLoading: false,
					metadata: m.metadata,
					agentInterrupt: m.metadata?.agentInterrupt
				}));
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
				errorMessage = 'Failed to load messages';
			}
		} catch (err) {
			console.error('Failed to load thread messages:', err);
			errorMessage = 'Failed to load messages';
		}
	}

	// Helper to safely format updatedAt timestamps
	function formatUpdatedAt(ts?: string) {
		if (!ts) return '';
		try {
			const d = new Date(ts);
			if (isNaN(d.getTime())) return '';
			return d.toLocaleString();
		} catch (err) {
			return '';
		}
	}

	async function createNewThread() {
		if (!projectId || isCreatingThread) return;
		isCreatingThread = true;
		try {
			const response = await fetch('/api/chat/threads', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: `Thread ${new Date().toLocaleString()}`,
					projectId
				})
			});

			if (response.ok) {
				const data = await response.json();
				await loadThreadsFromDB();
				chatThreadsActions.selectThread(projectId, data.thread.id);
			} else {
				errorMessage = 'Failed to create thread';
			}
		} catch (err) {
			console.error('Failed to create thread:', err);
			errorMessage = 'Failed to create thread';
		} finally {
			isCreatingThread = false;
		}
	}

	function selectThread(threadId: string) {
		chatThreadsActions.selectThread(projectId, threadId);
	}

	async function handleSend(
		event: CustomEvent<{ content: string; includeCodeContext?: boolean; codeQuery?: string }>
	) {
		const payload = event.detail;
		let threadId: string;

		if (!selectedThread) {
			// Create new thread for first message (will be created by API)
			threadId = '';
		} else {
			// Use existing thread
			threadId = selectedThread.id;
		}

		// Add user message immediately to UI
		if (threadId) {
			chatThreadsActions.addMessage(projectId, threadId, 'user', payload.content);
		}

		isLoadingMessages = true;
		errorMessage = null;

		try {
			const res = await fetch('/api/agent', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					message: payload.content,
					threadId: threadId || undefined,
					projectId,
					sandboxId: project?.sandboxId || currentSandboxIdValue,
					sandboxType: project?.sandboxProvider,
					modelName: selectedModel,
					includeCodeContext: payload.includeCodeContext,
					codeQuery: payload.codeQuery,
					currentFile: $chatFileContext.isActive ? $chatFileContext.filePath : null
				})
			});
			const json = await res.json();

			// Update threadId if new thread was created
			if (json.threadId && !threadId) {
				threadId = json.threadId;
				await loadThreadsFromDB();
				chatThreadsActions.selectThread(projectId, threadId);
				// Load messages from DB to get both user and assistant messages
				await loadThreadMessages(threadId, true);
			} else if (json.threadId) {
				// Existing thread - reload messages from DB to get the assistant response
				await loadThreadMessages(json.threadId, true);
			}

			// Handle interrupts
			if (json.interrupt && threadId) {
				const interruptMessage = {
					id: `interrupt-${Date.now()}`,
					content: 'Agent requested human review for the following actions:',
					role: 'assistant' as const,
					timestamp: new Date(),
					isLoading: false,
					agentInterrupt: {
						toolCalls: Array.isArray(json.data?.toolCalls) ? json.data.toolCalls : [],
						stateSnapshot: json.data?.stateSnapshot || {},
						reason:
							json.data?.reason || 'Agent requires approval for potentially destructive actions'
					}
				};
				chatThreadsActions.addMessage(projectId, threadId, 'assistant', interruptMessage.content, {
					agentInterrupt: interruptMessage.agentInterrupt
				});
			} else if (!json.success && json.error && threadId) {
				chatThreadsActions.addMessage(projectId, threadId, 'assistant', `Error: ${json.error}`);
			}
		} catch (err) {
			console.error('Failed to send message:', err);
			errorMessage = 'Failed to send message';
			if (threadId) {
				chatThreadsActions.addMessage(projectId, threadId, 'assistant', 'Failed to get response');
			}
		} finally {
			isLoadingMessages = false;
		}
	}

	function handleVoice() {
		console.log('Voice input - TODO: Implement voice recording');
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
		const ok = await showConfirm('Delete thread', 'Are you sure you want to delete this thread?');
		if (!ok) return;
		chatThreadsActions.deleteThread(projectId, threadId);
	}
</script>

<div class="flex h-full w-full flex-col border-l bg-background">
	<!-- Header -->
	<div class="flex items-center justify-between border-b px-3 py-2">
		<div class="flex items-center gap-2">
			<div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
				<MessageSquare size={16} class="text-primary" />
			</div>
			<div>
				<h3 class="text-sm font-semibold">Aura Chat</h3>
				{#if selectedThread}
					<p class="max-w-32 truncate text-xs text-muted-foreground" title={selectedThread.title}>
						{selectedThread.title}
					</p>
				{/if}
				{#if $chatFileContext.isActive}
					<p class="max-w-32 truncate text-xs text-blue-600" title={$chatFileContext.filePath}>
						📄 {$chatFileContext.fileName}
					</p>
				{/if}
			</div>
		</div>

		<div class="flex items-center gap-1">
			<!-- New thread button -->
			<Button
				variant="ghost"
				size="icon"
				class="h-7 w-7"
				disabled={isCreatingThread}
				title="New chat"
				onclick={createNewThread}
			>
				{#if isCreatingThread}
					<div
						class="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
					></div>
				{:else}
					<Plus size={14} />
				{/if}
			</Button>

			<!-- Thread history dropdown -->
			<DropdownMenu bind:open={showThreadHistory}>
				<DropdownMenuTrigger>
					<History size={14} />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" class="max-h-96 w-80 overflow-y-auto">
					{#each threads as t}
						<DropdownMenuItem onclick={() => selectThread(t.id)}>
							<div class="flex w-full items-center justify-between">
								<div class="truncate">{t.title}</div>
								<small class="text-xs text-muted-foreground"
									>{formatUpdatedAt(t.updatedAt) || '—'}</small
								>
							</div>
						</DropdownMenuItem>
					{/each}
				</DropdownMenuContent>
			</DropdownMenu>

			<!-- More options -->
			<DropdownMenu>
				<DropdownMenuTrigger>
					<MoreHorizontal size={14} />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onclick={() => dispatch('close')}>
						<div class="flex items-center gap-2">
							<span class="text-sm">Close chat</span>
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

	<!-- Threads list and messages -->
	<div class="flex flex-1 flex-col overflow-hidden">
		<!-- Chat messages -->
		<div class="flex-1 overflow-hidden">
			<ChatContainer
				messages={threadMessages}
				isLoading={isLoadingMessages || threadMessages.some((m) => m.isLoading)}
				on:approveInterrupt={handleInterruptDecision}
				on:rejectInterrupt={handleInterruptDecision}
				on:modifyInterrupt={handleInterruptDecision}
			/>
		</div>

		<!-- Chat input -->
		<ChatInput on:send={handleSend} on:voice={handleVoice} />
	</div>

	<!-- Confirm modal component -->
	<ConfirmModal
		bind:open={confirmOpen}
		title={confirmTitle}
		description={confirmBody}
		on:confirm={handleModalConfirm}
		on:cancel={handleModalCancel}
	/>
</div>
