<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	interface MessageType {
		id: string;
		content: string;
		role: 'user' | 'assistant' | 'system';
		timestamp: Date;
		isLoading?: boolean;
		fileContext?: {
			fileName?: string;
			filePath?: string;
			language?: string;
		};
		metadata?: any; // allow structured metadata like agentPlan / agentExecuted
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
		message: MessageType;
		isLast?: boolean;
		user?: {
			id: string;
			email: string;
			username?: string;
			name?: string;
			image?: string | null;
		};
	}

	let { message, isLast = false, user = undefined }: Props = $props();

	let showPlan = $state(false);
	let isProcessingDecision = $state(false);

	// Debug log for interrupt messages
	$effect(() => {
		if (message.agentInterrupt) {
			console.log('[Message] Received message with agentInterrupt:', {
				messageId: message.id,
				toolCallsCount: message.agentInterrupt.toolCalls?.length,
				toolCalls: message.agentInterrupt.toolCalls
			});
		}
	});

	// Dispatch events for interrupt decisions
	const dispatch = createEventDispatcher<{
		approveInterrupt: { toolCalls: any[] };
		rejectInterrupt: void;
		modifyInterrupt: { edits: Array<{ filePath: string; content: string }> };
	}>();

	function togglePlan() {
		showPlan = !showPlan;
	}

	import { Avatar } from '$lib/components/ui/avatar';
	import { Badge } from '$lib/components/ui/badge';
	import modelCatalog from '$lib/data/models.json';
	import { getModelImageUrl, getModelInitials } from '$lib/utils/model-image';
	import { selectedModelStore } from '@/stores/model';
	import ProfilePicture from '../shared/profile-picture.svelte';
	import HumanInTheLoop from './human-in-the-loop.svelte';
	import Markdown from './markdown.svelte';

	function getModelDisplay(modelId: string | undefined | null) {
		if (!modelId) return null;
		try {
			const catalogModels = (modelCatalog as any)?.data?.models || [];
			// Search models and their endpoints for a matching providerModelId
			for (const m of catalogModels) {
				// Match by top-level model id or friendly name first
				if (m.id === modelId || m.name === modelId) return m.name || m.id || modelId;

				const endpoints = m.endpoints || [];
				for (const ep of endpoints) {
					const epProviderModelId =
						ep?.endpoint?.modelConfig?.providerModelId || ep?.endpoint?.providerModelId;
					if (epProviderModelId === modelId) {
						// Prefer the friendly model name, fall back to the matched providerModelId or model id
						return m.name || epProviderModelId || m.id || modelId;
					}
				}
			}
		} catch (e) {
			// ignore catalog lookup errors and just return the id
		}
		return modelId;
	}

	// New local state for per-step UI
	let stepRunState = $state<
		Record<number, { running: boolean; result?: any; confirming?: boolean }>
	>({});
	let viewDiffContent = $state<
		Record<
			number,
			{
				before?: string | null;
				after?: string | null;
				open: boolean;
				patchLines?: Array<{ text: string; type: 'add' | 'remove' | 'hunk' | 'context' }>;
			}
		>
	>({});

	function computeSimplePatch(before: string, after: string) {
		const beforeLines = (before || '').split('\n');
		const afterLines = (after || '').split('\n');
		const max = Math.max(beforeLines.length, afterLines.length);
		const lines: Array<{ text: string; type: 'add' | 'remove' | 'hunk' | 'context' }> = [];
		for (let i = 0; i < max; i++) {
			const b = beforeLines[i];
			const a = afterLines[i];
			if (b === a) {
				lines.push({ text: b ?? '', type: 'context' });
			} else {
				if (b !== undefined) lines.push({ text: `-${b}`, type: 'remove' });
				if (a !== undefined) lines.push({ text: `+${a}`, type: 'add' });
			}
		}
		return lines;
	}

	async function fetchFileContent(projectId: string | undefined, path: string) {
		try {
			const res = await fetch('/api/files', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ operation: 'read', projectId, path })
			});
			if (!res.ok) return null;
			const j = await res.json();
			return j?.data?.content || j?.content || null;
		} catch (err) {
			console.warn('Failed to fetch file content for diff:', err);
			return null;
		}
	}

	async function toggleViewDiff(idx: number, exec: any) {
		const state = viewDiffContent[idx] || { open: false };
		if (state.open) {
			viewDiffContent = { ...viewDiffContent, [idx]: { ...state, open: false } };
			return;
		}

		// Open: fetch after content from server and attempt to read 'before' from exec.result.data.previousContent or exec.result.before
		const after =
			exec.result?.data?.content ||
			(await fetchFileContent(exec.step?.args?.projectId, exec.step?.args?.filePath)) ||
			'';
		const before = exec.result?.data?.previousContent || exec.result?.before || '';

		// Compute simple unified-like diff
		const patchLines = computeSimplePatch(before, after);

		viewDiffContent = { ...viewDiffContent, [idx]: { before, after, open: true, patchLines } };
	}

	async function confirmAndReRun(idx: number, exec: any) {
		// Toggle confirmation inline
		stepRunState = { ...stepRunState, [idx]: { ...(stepRunState[idx] || {}), confirming: true } };
	}

	async function cancelConfirm(idx: number) {
		stepRunState = { ...stepRunState, [idx]: { ...(stepRunState[idx] || {}), confirming: false } };
	}

	async function runStep(idx: number, exec: any) {
		stepRunState = { ...stepRunState, [idx]: { ...(stepRunState[idx] || {}), running: true } };
		try {
			const payload = {
				toolCall: massageStepToToolCall(exec.step),
				projectId: exec.step?.args?.projectId,
				sandboxId: exec.step?.args?.sandboxId
			};
			// If confirming a destructive operation, include confirm flag
			if (stepRunState[idx]?.confirming) (payload as any).confirm = true;
			const res = await fetch('/api/agent/re-run-step', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const j = await res.json();
			stepRunState = {
				...stepRunState,
				[idx]: { ...(stepRunState[idx] || {}), running: false, result: j }
			};
		} catch (err) {
			stepRunState = {
				...stepRunState,
				[idx]: {
					...(stepRunState[idx] || {}),
					running: false,
					result: { success: false, error: err instanceof Error ? err.message : String(err) }
				}
			};
		}
	}

	function massageStepToToolCall(step: any) {
		// Convert the saved step action/args into a toolCall shape expected by the server
		if (!step) return null;
		if (step.action === 'write-file' || step.action === 'edit_file') {
			return {
				name: 'edit_file',
				parameters: {
					operation: step.args?.operation || 'update',
					filePath: step.args?.filePath || step.args?.path || step.args?.filePath,
					content: step.args?.content || '',
					projectId: step.args?.projectId
				}
			};
		}
		if (step.action === 'read-file' || step.action === 'read_file') {
			return {
				name: 'read_file',
				parameters: {
					filePath: step.args?.filePath || step.args?.path,
					projectId: step.args?.projectId
				}
			};
		}
		if (step.action === 'exec' || step.action === 'exec_in_sandbox') {
			return {
				name: 'exec_in_sandbox',
				parameters: {
					sandboxId: step.args?.sandboxId,
					command: step.args?.command,
					projectId: step.args?.projectId
				}
			};
		}
		if (step.action === 'delete-file') {
			return {
				name: 'edit_file',
				parameters: {
					operation: 'delete',
					filePath: step.args?.filePath || step.args?.path,
					projectId: step.args?.projectId
				}
			};
		}

		// Fallback: if the step already looks like a toolCall, return as-is
		if (step.name && step.parameters) return { name: step.name, parameters: step.parameters };
		return null;
	}

	function formatTime(date: Date): string {
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	// Parse markdown content using marked lexer tokens
</script>

<div
	class="flex flex-col gap-3 p-4 {message.role === 'user' ? 'bg-muted/20' : ''} {isLast
		? 'mb-4'
		: ''}"
>
	<div class="flex-1 space-y-2">
		<div class="flex items-center gap-2">
			<Avatar class="h-8 w-8 shrink-0">
				{#if message.role === 'user'}
					<ProfilePicture name={user?.name || user?.username || 'User'} src={user?.image || ''} />
				{:else}
					<!-- Assistant/AI Avatar -->
					{@const modelImageUrl = getModelImageUrl(
						message.metadata?.agentModel || $selectedModelStore
					)}
					<ProfilePicture
						name={getModelInitials(getModelDisplay(message.metadata?.agentModel) || 'AI')}
						src={modelImageUrl}
					/>
				{/if}
			</Avatar>
			<Badge variant={message.role === 'user' ? 'default' : 'secondary'} class="text-xs">
				{message.role === 'user'
					? 'You'
					: getModelDisplay(message.metadata.agentModel) || 'Assistant'}
			</Badge>

			{#if message.metadata?.hasToolCalls && message.metadata?.toolCallCount}
				<Badge variant="secondary" class="ml-2 text-xs">
					🔧 {message.metadata.toolCallCount} tool{message.metadata.toolCallCount > 1 ? 's' : ''}
				</Badge>
			{/if}

			{#if message.metadata?.isStreaming}
				<Badge variant="outline" class="ml-2 animate-pulse text-xs">
					<div class="mr-1 flex space-x-0.5">
						<div
							class="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:-0.3s]"
						></div>
						<div
							class="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:-0.15s]"
						></div>
						<div class="h-1 w-1 animate-bounce rounded-full bg-current"></div>
					</div>
				</Badge>
			{/if}

			<span class="text-xs text-muted-foreground">
				{formatTime(message.timestamp)}
			</span>
		</div>
	</div>
	<div class="">
		{#if message.content === '' && message.content.length === 0}
			<div class="flex items-center gap-2">
				<div class="flex space-x-1">
					<div class="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.3s]"></div>
					<div
						class="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.15s]"
					></div>
					<div class="h-2 w-2 animate-bounce rounded-full bg-current"></div>
				</div>
				<span class="text-xs text-muted-foreground">Thinking...</span>
			</div>
		{:else}
			<div class="space-y-4 text-sm leading-relaxed">
				<Markdown
					content={message.content}
					messageId={message.id}
					data={{}}
					id={message.id}
					streaming={message.metadata?.isStreaming}
				/>

				<!-- Tool Calls Display -->
				{#if message.metadata?.toolCalls && message.metadata.toolCalls.length > 0}
					<div class="mt-3 border-t pt-3">
						<div class="mb-2 flex items-center gap-2">
							<span class="text-xs font-medium text-muted-foreground">Tool Calls</span>
							<Badge variant="secondary" class="text-xs">
								{message.metadata.toolCalls.length}
							</Badge>
						</div>
						<div class="space-y-2">
							{#each message.metadata.toolCalls as toolCall}
								<div class="rounded border bg-muted/50 p-2 text-xs">
									<div class="mb-1 flex items-center gap-2">
										<span class="font-medium">{toolCall.name}</span>
										{#if toolCall.id}
											<span class="font-mono text-muted-foreground">{toolCall.id}</span>
										{/if}
									</div>
									{#if Object.keys(toolCall.arguments || {}).length > 0}
										<details class="mt-1">
											<summary class="cursor-pointer text-muted-foreground hover:text-foreground">
												Parameters
											</summary>
											<pre
												class="mt-1 overflow-x-auto rounded bg-background p-1 text-xs">{JSON.stringify(
													toolCall.arguments,
													null,
													2
												)}</pre>
										</details>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Tool Results Display -->
				{#if message.metadata?.toolResults && message.metadata.toolResults.length > 0}
					<div class="mt-3 border-t pt-3">
						<div class="mb-2 flex items-center gap-2">
							<span class="text-xs font-medium text-muted-foreground">Tool Results</span>
							<Badge variant="secondary" class="text-xs">
								{message.metadata.toolResults.length}
							</Badge>
						</div>
						<div class="space-y-2">
							{#each message.metadata.toolResults as result}
								<div
									class="rounded border p-2 text-xs {result.success
										? 'border-green-200 bg-green-50'
										: 'border-red-200 bg-red-50'}"
								>
									<div class="mb-1 flex items-center gap-2">
										<span class={result.success ? 'text-green-700' : 'text-red-700'}>
											{result.success ? '✅' : '❌'}
										</span>
										{#if result.tool_name}
											<span class="font-medium">{result.tool_name}</span>
										{:else if result.tool_call_id}
											<span class="font-mono text-muted-foreground">{result.tool_call_id}</span>
										{/if}
									</div>
									<div class={result.success ? 'text-green-800' : 'text-red-800'}>
										{result.message}
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Agent Interrupt Review -->
				{#if message.agentInterrupt}
					<div class="mt-4 border-t pt-4">
						<HumanInTheLoop
							toolCalls={message.agentInterrupt.toolCalls || []}
							stateSnapshot={message.agentInterrupt.stateSnapshot}
							reason={message.agentInterrupt.reason}
							isProcessing={isProcessingDecision}
							on:approve={(e) => {
								isProcessingDecision = true;
								dispatch('approveInterrupt', e.detail);
							}}
							on:reject={() => {
								isProcessingDecision = true;
								dispatch('rejectInterrupt');
							}}
							on:modify={(e) => {
								isProcessingDecision = true;
								dispatch('modifyInterrupt', e.detail);
							}}
						/>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
