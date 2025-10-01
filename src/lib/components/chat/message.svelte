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
	}

	let { message, isLast = false }: Props = $props();

	let showPlan = $state(false);
	let showInterrupt = $state(true); // Show interrupts by default
	let userEdits = $state<Array<{ filePath: string; content: string }>>([]);
	let isProcessingDecision = $state(false);

	// Dispatch events for interrupt decisions
	const dispatch = createEventDispatcher<{
		approveInterrupt: { toolCalls: any[] };
		rejectInterrupt: void;
		modifyInterrupt: { edits: Array<{ filePath: string; content: string }> };
	}>();

	function togglePlan() {
		showPlan = !showPlan;
	}

	function toggleInterrupt() {
		showInterrupt = !showInterrupt;
	}

	// Interrupt handling functions
	function getToolDescription(toolCall: any): string {
		switch (toolCall.name) {
			case 'write_file':
			case 'edit_file':
				return `Write to file: ${toolCall.args?.filePath || toolCall.args?.path || 'unknown'}`;
			case 'execute_code':
			case 'run_terminal_command':
				return `Execute code: ${toolCall.args?.command?.slice(0, 50) || 'unknown'}...`;
			case 'read_file':
				return `Read file: ${toolCall.args?.filePath || toolCall.args?.path || 'unknown'}`;
			default:
				return `${toolCall.name}: ${JSON.stringify(toolCall.args || {}).slice(0, 100)}...`;
		}
	}

	function getToolSeverity(toolCall: any): 'high' | 'medium' | 'low' {
		if (
			['write_file', 'edit_file', 'execute_code', 'run_terminal_command'].includes(toolCall.name)
		) {
			return 'high';
		}
		if (['read_file', 'search_codebase'].includes(toolCall.name)) {
			return 'low';
		}
		return 'medium';
	}

	function handleApprove() {
		isProcessingDecision = true;
		dispatch('approveInterrupt', { toolCalls: message.agentInterrupt?.toolCalls || [] });
	}

	function handleReject() {
		isProcessingDecision = true;
		dispatch('rejectInterrupt');
	}

	function handleModify() {
		if (userEdits.length === 0) {
			// Auto-populate with current write calls
			const writeCalls =
				message.agentInterrupt?.toolCalls?.filter((tc) =>
					['write_file', 'edit_file'].includes(tc.name)
				) || [];
			userEdits = writeCalls.map((tc) => ({
				filePath: tc.args?.filePath || tc.args?.path || '',
				content: tc.args?.content || ''
			}));
		}
		isProcessingDecision = true;
		dispatch('modifyInterrupt', { edits: userEdits });
	}

	function addEdit() {
		userEdits.push({ filePath: '', content: '' });
		userEdits = userEdits; // Trigger reactivity
	}

	function removeEdit(index: number) {
		userEdits.splice(index, 1);
		userEdits = userEdits;
	}

	import { Avatar, AvatarFallback } from '$lib/components/ui/avatar';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Textarea } from '$lib/components/ui/textarea';
	import modelCatalog from '$lib/data/models.json';
	import { AlertTriangle, CheckCircle, Edit, Play, XCircle } from 'lucide-svelte';
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
				<AvatarFallback class="text-xs">
					{message.role === 'user' ? 'U' : 'AI'}
				</AvatarFallback>
			</Avatar>
			<Badge variant={message.role === 'user' ? 'default' : 'secondary'} class="text-xs">
				{message.role === 'user' ? 'You' : 'Assistant'}
			</Badge>

			{#if message.role === 'assistant' && message.metadata?.agentModel}
				<Badge variant="outline" class="ml-2 text-xs">
					{getModelDisplay(message.metadata.agentModel)}
				</Badge>
			{/if}

			<span class="text-xs text-muted-foreground">
				{formatTime(message.timestamp)}
			</span>
		</div>
	</div>
	<div class="">
		{#if message.isLoading}
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
				<Markdown content={message.content} messageId={message.id} data={{}} id={message.id} />

				<!-- Agent Interrupt Review -->
				{#if message.agentInterrupt}
					{@const writeCalls =
						message.agentInterrupt.toolCalls?.filter((tc) =>
							['write_file', 'edit_file'].includes(tc.name)
						) || []}
					{@const executeCalls =
						message.agentInterrupt.toolCalls?.filter((tc) =>
							['execute_code', 'run_terminal_command'].includes(tc.name)
						) || []}
					{@const otherCalls =
						message.agentInterrupt.toolCalls?.filter(
							(tc) =>
								!['write_file', 'edit_file', 'execute_code', 'run_terminal_command'].includes(
									tc.name
								)
						) || []}
					<div class="mt-4 border-t pt-4">
						<div class="mb-3 flex items-center gap-2">
							<AlertTriangle class="h-4 w-4 text-orange-500" />
							<h4 class="text-sm font-medium text-orange-800">Agent Action Review Required</h4>
							<button class="ml-auto text-xs text-primary underline" onclick={toggleInterrupt}>
								{showInterrupt ? 'Hide' : 'Show'} Details
							</button>
						</div>

						{#if showInterrupt}
							<div class="space-y-4">
								<!-- Current Context -->
								{#if message.agentInterrupt.stateSnapshot}
									<Card class="border-orange-200 bg-orange-50">
										<CardHeader class="pb-2">
											<CardTitle class="text-xs text-orange-800">Current Context</CardTitle>
										</CardHeader>
										<CardContent class="pt-0">
											<div class="space-y-1 text-xs">
												{#if message.agentInterrupt.stateSnapshot.currentFile}
													<div>
														<strong>File:</strong>
														{message.agentInterrupt.stateSnapshot.currentFile}
													</div>
												{/if}
												{#if message.agentInterrupt.stateSnapshot.sandboxId}
													<div>
														<strong>Sandbox:</strong>
														{message.agentInterrupt.stateSnapshot.sandboxId}
													</div>
												{/if}
											</div>
										</CardContent>
									</Card>
								{/if}

								<!-- Tool Calls Review -->
								<div class="space-y-3">
									<h5 class="text-sm font-medium">Proposed Actions</h5>

									<!-- Write/Edit Operations (High Risk) -->
									{#if writeCalls.length > 0}
										<Card class="border-orange-200 bg-orange-50">
											<CardHeader class="pb-2">
												<CardTitle class="flex items-center gap-2 text-xs text-orange-800">
													<Edit class="h-3 w-3" />
													File Modifications ({writeCalls.length})
												</CardTitle>
											</CardHeader>
											<CardContent class="pt-0">
												<div class="space-y-2">
													{#each writeCalls as toolCall}
														<div class="flex items-start gap-2 rounded border bg-white p-2 text-xs">
															<Badge variant="destructive" class="text-xs">MODIFY</Badge>
															<div class="flex-1">
																<div class="font-medium">{getToolDescription(toolCall)}</div>
																{#if toolCall.args && toolCall.args.content}
																	<pre
																		class="mt-1 max-h-20 overflow-x-auto overflow-y-auto rounded bg-gray-100 p-1 text-xs">{toolCall.args
																			.content}</pre>
																{/if}
															</div>
														</div>
													{/each}
												</div>
											</CardContent>
										</Card>
									{/if}

									<!-- Execute Operations (High Risk) -->

									{#if executeCalls.length > 0}
										<Card class="border-red-200 bg-red-50">
											<CardHeader class="pb-2">
												<CardTitle class="flex items-center gap-2 text-xs text-red-800">
													<Play class="h-3 w-3" />
													Code Execution ({executeCalls.length})
												</CardTitle>
											</CardHeader>
											<CardContent class="pt-0">
												<div class="space-y-2">
													{#each executeCalls as toolCall}
														<div class="flex items-start gap-2 rounded border bg-white p-2 text-xs">
															<Badge variant="destructive" class="text-xs">EXECUTE</Badge>
															<div class="flex-1">
																<div class="font-medium">{getToolDescription(toolCall)}</div>
																{#if toolCall.args && toolCall.args.cwd}
																	<div class="text-gray-600">CWD: {toolCall.args.cwd}</div>
																{/if}
															</div>
														</div>
													{/each}
												</div>
											</CardContent>
										</Card>
									{/if}

									<!-- Other Operations (Low Risk) -->

									{#if otherCalls.length > 0}
										<Card>
											<CardHeader class="pb-2">
												<CardTitle class="text-xs">Other Operations ({otherCalls.length})</CardTitle
												>
											</CardHeader>
											<CardContent class="pt-0">
												<div class="space-y-2">
													{#each otherCalls as toolCall}
														<div
															class="flex items-start gap-2 rounded border bg-gray-50 p-2 text-xs"
														>
															<Badge variant="secondary" class="text-xs"
																>{toolCall.name.toUpperCase()}</Badge
															>
															<div class="flex-1">
																<div class="font-medium">{getToolDescription(toolCall)}</div>
															</div>
														</div>
													{/each}
												</div>
											</CardContent>
										</Card>
									{/if}
								</div>

								<!-- Modification Interface -->
								{#if writeCalls.length > 0}
									<Card>
										<CardHeader class="pb-2">
											<CardTitle class="text-xs">Modify Changes (Optional)</CardTitle>
										</CardHeader>
										<CardContent class="pt-0">
											<div class="space-y-3">
												{#each userEdits as edit, index}
													<div class="space-y-2 rounded border p-2 text-xs">
														<div class="flex items-center gap-2">
															<input
																type="text"
																placeholder="File path"
																bind:value={edit.filePath}
																class="flex-1 rounded border px-1 py-0.5 text-xs"
															/>
															<Button
																variant="outline"
																size="sm"
																onclick={() => removeEdit(index)}
																disabled={userEdits.length <= 1}
																class="h-6 text-xs"
															>
																Remove
															</Button>
														</div>
														<Textarea
															placeholder="File content"
															bind:value={edit.content}
															class="min-h-16 font-mono text-xs"
														/>
													</div>
												{/each}
												<Button variant="outline" size="sm" onclick={addEdit} class="h-6 text-xs">
													Add Another File
												</Button>
											</div>
										</CardContent>
									</Card>
								{/if}

								<!-- Action Buttons -->
								<div class="flex gap-2 pt-2">
									<Button
										variant="outline"
										size="sm"
										onclick={handleReject}
										disabled={isProcessingDecision}
										class="h-7 text-xs"
									>
										<XCircle class="mr-1 h-3 w-3" />
										Reject All
									</Button>

									{#if writeCalls.length > 0}
										<Button
											variant="secondary"
											size="sm"
											onclick={handleModify}
											disabled={isProcessingDecision}
											class="h-7 text-xs"
										>
											<Edit class="mr-1 h-3 w-3" />
											Approve Modified
										</Button>
									{/if}

									<Button
										size="sm"
										onclick={handleApprove}
										disabled={isProcessingDecision}
										class="h-7 text-xs"
									>
										<CheckCircle class="mr-1 h-3 w-3" />
										Approve All
									</Button>
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
