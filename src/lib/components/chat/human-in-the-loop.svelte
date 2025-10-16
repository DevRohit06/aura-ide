<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import CodeBlockDisplay from '$lib/components/ui/code-block-display.svelte';
	import { Textarea } from '$lib/components/ui/textarea';
	import {
		CheckCircle,
		ChevronDown,
		ChevronUp,
		FileEdit,
		Play,
		Trash2,
		XCircle
	} from 'lucide-svelte';
	import { createEventDispatcher } from 'svelte';

	interface ToolCall {
		name: string;
		args: Record<string, any>;
		id?: string;
	}

	interface StateSnapshot {
		currentFile?: string | null;
		sandboxId?: string | null;
		fileContent?: string | null;
	}

	interface Props {
		toolCalls: ToolCall[];
		stateSnapshot?: StateSnapshot;
		reason?: string;
		isProcessing?: boolean;
	}

	let { toolCalls, stateSnapshot, reason, isProcessing = false }: Props = $props();

	const dispatch = createEventDispatcher<{
		approve: { toolCalls: ToolCall[] };
		reject: void;
		modify: { edits: Array<{ filePath: string; content: string }> };
	}>();

	let userEdits = $state<Array<{ filePath: string; content: string }>>([]);
	let expandedToolCalls = $state<Set<number>>(new Set());

	// Categorize tool calls
	const fileOperations = $derived(
		toolCalls.filter((tc) => ['write_file', 'edit_file', 'create_file'].includes(tc.name))
	);

	const deleteOperations = $derived(
		toolCalls.filter((tc) => tc.name === 'delete_file' || tc.args?.operation === 'delete')
	);

	const executeOperations = $derived(
		toolCalls.filter((tc) =>
			['execute_code', 'run_terminal_command', 'exec_in_sandbox'].includes(tc.name)
		)
	);

	const readOperations = $derived(
		toolCalls.filter((tc) => ['read_file', 'list_files', 'search_codebase'].includes(tc.name))
	);

	const otherOperations = $derived(
		toolCalls.filter(
			(tc) =>
				![
					'write_file',
					'edit_file',
					'create_file',
					'delete_file',
					'execute_code',
					'run_terminal_command',
					'exec_in_sandbox',
					'read_file',
					'list_files',
					'search_codebase'
				].includes(tc.name) && tc.args?.operation !== 'delete'
		)
	);

	function toggleToolCall(index: number) {
		if (expandedToolCalls.has(index)) {
			expandedToolCalls.delete(index);
		} else {
			expandedToolCalls.add(index);
		}
		expandedToolCalls = new Set(expandedToolCalls);
	}

	function getFileLanguage(filePath: string): string {
		const ext = filePath.split('.').pop()?.toLowerCase();
		const languageMap: Record<string, string> = {
			js: 'javascript',
			ts: 'typescript',
			jsx: 'javascript',
			tsx: 'typescript',
			py: 'python',
			html: 'html',
			css: 'css',
			json: 'json',
			md: 'markdown',
			yaml: 'yaml',
			yml: 'yaml',
			sh: 'shell',
			bash: 'shell',
			xml: 'xml',
			sql: 'sql',
			go: 'go',
			rs: 'rust',
			java: 'java',
			c: 'c',
			cpp: 'cpp',
			svelte: 'javascript'
		};
		return languageMap[ext || ''] || 'text';
	}

	function handleApprove() {
		dispatch('approve', { toolCalls });
	}

	function handleReject() {
		dispatch('reject');
	}

	function handleModify() {
		if (userEdits.length === 0) {
			// Auto-populate with current file operations
			userEdits = fileOperations.map((tc) => ({
				filePath: tc.args?.filePath || tc.args?.path || '',
				content: tc.args?.content || ''
			}));
		}
		dispatch('modify', { edits: userEdits });
	}

	function addEdit() {
		userEdits = [...userEdits, { filePath: '', content: '' }];
	}

	function removeEdit(index: number) {
		userEdits = userEdits.filter((_, i) => i !== index);
	}

	function updateEditPath(index: number, value: string) {
		userEdits[index].filePath = value;
		userEdits = userEdits;
	}

	function updateEditContent(index: number, value: string) {
		userEdits[index].content = value;
		userEdits = userEdits;
	}
</script>

<div class="space-y-3">
	<!-- Context Info (if available) -->
	{#if stateSnapshot?.currentFile || stateSnapshot?.sandboxId}
		<div class="flex flex-wrap gap-2 text-xs text-muted-foreground">
			{#if stateSnapshot.currentFile}
				<span class="flex items-center gap-1">
					<FileEdit class="h-3 w-3" />
					{stateSnapshot.currentFile}
				</span>
			{/if}
			{#if stateSnapshot.sandboxId}
				<span class="flex items-center gap-1">
					<Play class="h-3 w-3" />
					{stateSnapshot.sandboxId.slice(0, 8)}...
				</span>
			{/if}
		</div>
	{/if}

	<!-- Tool Call Operations -->
	<div class="space-y-2">
		<!-- File Operations -->
		{#each fileOperations as toolCall, index}
			{@const filePath = toolCall.args?.filePath || toolCall.args?.path || 'unknown'}
			{@const content = toolCall.args?.content || ''}
			{@const operation = toolCall.args?.operation || toolCall.name.replace('_file', '')}
			{@const isExpanded = expandedToolCalls.has(index)}

			<div class="rounded-lg border">
				<button
					class="flex w-full items-center gap-2 p-2 text-left hover:bg-muted/50"
					onclick={() => toggleToolCall(index)}
				>
					<Badge variant={operation === 'create' ? 'default' : 'secondary'} class="shrink-0">
						{operation.toUpperCase()}
					</Badge>
					<span class="flex-1 truncate font-mono text-sm">{filePath}</span>
					<span class="text-xs text-muted-foreground">
						{content.length} chars
					</span>
					{#if isExpanded}
						<ChevronUp class="h-4 w-4 shrink-0 text-muted-foreground" />
					{:else}
						<ChevronDown class="h-4 w-4 shrink-0 text-muted-foreground" />
					{/if}
				</button>

				{#if isExpanded}
					<div class="border-t">
						{#if content}
							<div class="max-h-[400px] overflow-auto">
								<CodeBlockDisplay code={content} language={getFileLanguage(filePath)} />
							</div>
						{:else}
							<div class="p-4 text-center text-sm text-muted-foreground">No content to preview</div>
						{/if}
					</div>
				{/if}
			</div>
		{/each}

		<!-- Delete Operations -->
		{#each deleteOperations as toolCall}
			{@const filePath = toolCall.args?.filePath || toolCall.args?.path || 'unknown'}
			<div class="flex items-center gap-2 rounded-lg border p-2">
				<Badge variant="destructive">DELETE</Badge>
				<span class="flex-1 truncate font-mono text-sm">{filePath}</span>
			</div>
		{/each}

		<!-- Execute Operations -->
		{#each executeOperations as toolCall, index}
			{@const command = toolCall.args?.command || 'unknown'}
			{@const cwd = toolCall.args?.cwd}
			{@const isExpanded = expandedToolCalls.has(1000 + index)}

			<div class="rounded-lg border">
				<button
					class="flex w-full items-center gap-2 p-2 text-left hover:bg-muted/50"
					onclick={() => toggleToolCall(1000 + index)}
				>
					<Badge variant="destructive" class="shrink-0">EXEC</Badge>
					<span class="flex-1 truncate font-mono text-sm"
						>{command.slice(0, 60)}{command.length > 60 ? '...' : ''}</span
					>
					{#if isExpanded}
						<ChevronUp class="h-4 w-4 shrink-0 text-muted-foreground" />
					{:else}
						<ChevronDown class="h-4 w-4 shrink-0 text-muted-foreground" />
					{/if}
				</button>

				{#if isExpanded}
					<div class="border-t p-2">
						<div class="space-y-2 text-sm">
							<div>
								<span class="text-muted-foreground">Command:</span>
								<pre
									class="mt-1 overflow-x-auto rounded border bg-muted p-2 font-mono text-sm">{command}</pre>
							</div>
							{#if cwd}
								<div>
									<span class="text-muted-foreground">Working Directory:</span>
									<pre
										class="mt-1 overflow-x-auto rounded border bg-muted p-2 font-mono text-sm">{cwd}</pre>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		{/each}

		<!-- Read Operations -->
		{#each readOperations as toolCall}
			{@const filePath =
				toolCall.args?.filePath || toolCall.args?.path || toolCall.args?.query || 'unknown'}
			<div class="flex items-center gap-2 rounded-lg border p-2">
				<Badge variant="outline">
					{toolCall.name.toUpperCase()}
				</Badge>
				<span class="flex-1 truncate font-mono text-sm">{filePath}</span>
			</div>
		{/each}

		<!-- Other Operations -->
		{#each otherOperations as toolCall}
			<div class="flex items-start gap-2 rounded-lg border p-2">
				<Badge variant="secondary" class="shrink-0">
					{toolCall.name.toUpperCase()}
				</Badge>
				<pre class="flex-1 overflow-x-auto text-sm">{JSON.stringify(toolCall.args, null, 2)}</pre>
			</div>
		{/each}
	</div>

	<!-- Modification Interface -->
	{#if fileOperations.length > 0 && userEdits.length > 0}
		<div class="space-y-2 rounded-lg border p-3">
			<div class="text-sm font-medium">Custom Edits</div>
			{#each userEdits as edit, index}
				<div class="space-y-2 rounded border p-2">
					<div class="flex items-center gap-2">
						<input
							type="text"
							placeholder="File path (e.g., src/lib/example.ts)"
							value={edit.filePath}
							oninput={(e) => updateEditPath(index, e.currentTarget.value)}
							class="flex-1 rounded border border-input bg-background px-2 py-1 text-sm ring-offset-background transition-all outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						/>
						<Button
							variant="ghost"
							size="icon"
							onclick={() => removeEdit(index)}
							disabled={userEdits.length <= 1}
							class="h-7 w-7"
						>
							<Trash2 class="h-3 w-3" />
						</Button>
					</div>
					<Textarea
						placeholder="File content..."
						value={edit.content}
						oninput={(e) => updateEditContent(index, e.currentTarget.value)}
						class="min-h-[100px] font-mono text-sm"
					/>
				</div>
			{/each}
			<Button variant="outline" size="sm" onclick={addEdit} class="w-full">
				<FileEdit class="mr-2 h-3 w-3" />
				Add File
			</Button>
		</div>
	{/if}

	<!-- Action Buttons -->
	<div class="flex gap-2">
		<Button variant="outline" size="sm" onclick={handleReject} disabled={isProcessing}>
			<XCircle class="mr-2 h-4 w-4" />
			Reject
		</Button>

		<!-- {#if fileOperations.length > 0}
			<Button
				variant="outline"
				size="sm"
				onclick={handleModify}
				disabled={isProcessing}
			>
				<Edit3 class="mr-2 h-4 w-4" />
				{userEdits.length > 0 ? 'Apply Edits' : 'Customize'}
			</Button>
		{/if} -->

		<Button size="sm" onclick={handleApprove} disabled={isProcessing} class="ml-auto">
			<CheckCircle class="mr-2 h-4 w-4" />
			Approve
		</Button>
	</div>
</div>
