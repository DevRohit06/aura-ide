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
	import { chatService } from '$lib/services/chat.service';
	import type { Project } from '$lib/types';
	import { chatFileContext } from '@/stores/editor';
	import { currentSandboxId } from '@/stores/sandbox.store';
	import Icon from '@iconify/svelte';
	import { History, MessageSquare, MoreHorizontal, Plus } from 'lucide-svelte';
	import { createEventDispatcher, onMount, tick } from 'svelte';
	import { getFileIcon } from '../editor';
	import ChatContainer from './chat-container.svelte';
	import ChatInput from './chat-input.svelte';

	interface Props {
		project?: Project;
	}

	let { project = undefined }: Props = $props();

	const dispatch = createEventDispatcher<{
		close: void;
	}>();

	let projectId = $state(project?.id ?? 'default');
	let showThreadHistory = $state(false);
	let isCreatingThread = $state(false);
	let editingThreadId = $state<string | null>(null);
	let editingThreadName = $state('');
	let confirmOpen = $state(false);
	let confirmTitle = $state('Confirm');
	let confirmBody = $state('Are you sure?');
	let confirmResolve: ((value: boolean) => void) | null = null;
	let currentSandboxIdValue = $state($currentSandboxId);

	const threads = chatService.threads;
	const selectedThread = chatService.selectedThread;
	const messages = chatService.messages;
	const isLoading = chatService.isLoading;
	const error = chatService.error;

	onMount(() => {
		chatService.setProject(projectId);
		chatService.loadThreads(projectId).then(() => {
			const currentThreads = $threads;
			if (!$selectedThread && currentThreads.length > 0) {
				chatService.selectThread(projectId, currentThreads[0].id);
			}
		});
		return () => chatService.reset();
	});

	async function handleSend(
		event: CustomEvent<{ content: string; includeCodeContext?: boolean; codeQuery?: string }>
	) {
		await chatService.sendMessage({
			content: event.detail.content,
			includeCodeContext: event.detail.includeCodeContext,
			codeQuery: event.detail.codeQuery,
			projectId,
			sandboxId: project?.sandboxId || currentSandboxIdValue || undefined,
			sandboxType: project?.sandboxProvider,
			currentFile: $chatFileContext.isActive ? $chatFileContext.filePath : null
		});
	}
	async function createNewThread() {
		if (isCreatingThread) return;
		isCreatingThread = true;
		try {
			chatService.createThread(projectId, 'New Thread');
		} finally {
			isCreatingThread = false;
		}
	}

	function selectThread(threadId: string) {
		chatService.selectThread(projectId, threadId);
	}

	function handleVoice() {
		console.log('Voice input - TODO');
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
		const thread = $selectedThread;
		if (!thread) return;

		console.log('[ChatSidebar] Handling interrupt decision:', { action, eventType });

		try {
			const response = await fetch('/api/agent', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ threadId: thread.id, projectId, action, ...payload })
			});

			const result = await response.json();

			console.log('[ChatSidebar] Approval response:', result);

			// Check if there's another interrupt after approval
			if (result.success && result.interrupt) {
				console.log('[ChatSidebar] Another interrupt detected after approval:', result.interrupt);

				// Create a new interrupt message in the UI
				const interruptMessageId = `interrupt-${Date.now()}`;
				const interruptContent =
					result.interrupt.reason || 'Agent is requesting approval for the following actions:';

				const normalizedToolCalls = (result.interrupt.toolCalls || []).map((tc: any) => ({
					name: tc.name,
					args: tc.args || tc.parameters || {},
					id: tc.id
				}));

				// Use chatService to add the interrupt message
				const interruptMetadata = {
					messageId: interruptMessageId,
					isStreaming: false,
					agentInterrupt: {
						toolCalls: normalizedToolCalls,
						stateSnapshot: result.interrupt.stateSnapshot || {},
						reason: result.interrupt.reason || 'Human approval required'
					}
				};

				// Add to UI using chatThreadsActions directly
				const { chatThreadsActions } = await import('@/stores/chatThreads');
				chatThreadsActions.addMessage(
					projectId,
					thread.id,
					'assistant',
					interruptContent,
					interruptMetadata
				);

				// Persist interrupt message to database
				try {
					await fetch(`/api/chat/threads/${thread.id}/messages`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							content: interruptContent,
							role: 'assistant',
							projectId,
							metadata: interruptMetadata
						})
					});
					console.log('[ChatSidebar] Persisted subsequent interrupt message');
				} catch (persistErr) {
					console.error('[ChatSidebar] Failed to persist interrupt message:', persistErr);
				}

				// Don't clear the interrupt flag - still waiting for approval
			} else {
				// No more interrupts, clear the flag
				chatService.clearInterruptFlag();

				// Reload messages to get the final response
				if (result.success && result.response) {
					await chatService.loadThreadMessages(thread.id, true);
				}
			}
		} catch (err) {
			console.error('Failed to process interrupt:', err);
			chatService.clearInterruptFlag();
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
		chatService.renameThread(projectId, threadId, editingThreadName || 'Untitled');
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
		const ok = await showConfirm('Delete Thread', 'Are you sure?');
		if (!ok) return;
		chatService.deleteThread(projectId, threadId);
	}
</script>

<div class="flex h-full flex-col">
	<div class="flex items-center justify-between border-b px-4 py-3">
		<div class="flex min-w-0 flex-1 items-center gap-2">
			{#if $selectedThread}
				<h2 class="truncate text-sm font-medium" title={$selectedThread.title}>
					{$selectedThread.title}
				</h2>
			{:else}
				<h2 class="text-sm font-medium text-muted-foreground">Chat</h2>
			{/if}
		</div>
		<div class="flex items-center gap-2">
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
			<DropdownMenu bind:open={showThreadHistory}>
				<DropdownMenuTrigger>
					<Button variant="ghost" size="sm" class="h-7 w-7" title="Thread history"
						><History class="h-4 w-4" /></Button
					>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" class="max-h-96 w-80 overflow-y-auto">
					{#each $threads as t}
						<DropdownMenuItem onclick={() => selectThread(t.id)}>
							<div class="flex w-full items-center justify-between">
								<span class="truncate">{t.title}</span>
								<small class="text-xs text-muted-foreground">{formatUpdatedAt(t.updatedAt)}</small>
							</div>
						</DropdownMenuItem>
					{:else}
						<DropdownMenuItem disabled
							><span class="text-xs text-muted-foreground">No threads yet</span></DropdownMenuItem
						>
					{/each}
				</DropdownMenuContent>
			</DropdownMenu>
			<DropdownMenu>
				<DropdownMenuTrigger>
					<Button variant="ghost" size="sm" class="h-7 w-7"
						><MoreHorizontal class="h-4 w-4" /></Button
					>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onclick={() => dispatch('close')}>
						<div class="flex items-center gap-2"><MessageSquare class="h-4 w-4" />Close Chat</div>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	</div>
	{#if $error}
		<div class="border-b border-red-200 bg-red-50 px-3 py-2">
			<p class="text-xs text-red-600">{$error}</p>
		</div>
	{/if}
	<div class="flex-1 overflow-hidden">
		<ChatContainer
			messages={$messages}
			isLoading={$isLoading}
			on:approveInterrupt={handleInterruptDecision}
			on:rejectInterrupt={handleInterruptDecision}
			on:modifyInterrupt={handleInterruptDecision}
		/>
	</div>
	{#if $chatFileContext.isActive}
		<div class="border-t px-4 py-2">
			<div class="flex items-center gap-2">
				<Badge variant="secondary" class="flex items-center gap-1 text-xs">
					<Icon icon={getFileIcon($chatFileContext?.fileName!)} class="size-8" />
					<span class="max-w-32 truncate" title={$chatFileContext.filePath}
						>{$chatFileContext.fileName}</span
					>
				</Badge>
			</div>
		</div>
	{/if}
	<ChatInput on:send={handleSend} on:voice={handleVoice} disabled={$isLoading} />
</div>

<ConfirmModal
	bind:open={confirmOpen}
	title={confirmTitle}
	description={confirmBody}
	on:confirm={handleModalConfirm}
	on:cancel={handleModalCancel}
/>
