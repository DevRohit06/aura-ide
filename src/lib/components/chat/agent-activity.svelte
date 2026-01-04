<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		Collapsible,
		CollapsibleContent,
		CollapsibleTrigger
	} from '$lib/components/ui/collapsible/index.js';
	import {
		CheckCircle2,
		ChevronDown,
		ChevronRight,
		Code2,
		FileEdit,
		FileSearch,
		FolderOpen,
		Globe,
		Loader2,
		Play,
		Search,
		Terminal,
		Trash2,
		XCircle
	} from 'lucide-svelte';
	import { slide } from 'svelte/transition';

	interface ToolCall {
		id?: string;
		name: string;
		arguments?: Record<string, any>;
	}

	interface ToolResult {
		tool_call_id?: string;
		tool_name?: string;
		success?: boolean;
		message?: string;
		output?: string;
	}

	interface Props {
		toolCalls?: ToolCall[];
		toolResults?: ToolResult[];
		isStreaming?: boolean;
		totalSteps?: number;
	}

	let { toolCalls = [], toolResults = [], isStreaming = false, totalSteps = 0 }: Props = $props();

	let expandedCalls = $state<Set<number>>(new Set());

	function toggleExpanded(idx: number) {
		if (expandedCalls.has(idx)) {
			expandedCalls.delete(idx);
		} else {
			expandedCalls.add(idx);
		}
		expandedCalls = new Set(expandedCalls);
	}

	function getToolIcon(toolName: string) {
		switch (toolName) {
			case 'read_file':
				return FileSearch;
			case 'write_file':
			case 'edit_file':
				return FileEdit;
			case 'list_files':
				return FolderOpen;
			case 'grep':
			case 'search_codebase':
				return Search;
			case 'execute_command':
				return Terminal;
			case 'delete_file':
				return Trash2;
			case 'web_search':
				return Globe;
			case 'create_directory':
				return FolderOpen;
			default:
				return Code2;
		}
	}

	function getToolLabel(toolName: string): string {
		const labels: Record<string, string> = {
			read_file: 'Read File',
			write_file: 'Write File',
			edit_file: 'Edit File',
			list_files: 'List Files',
			grep: 'Search Pattern',
			search_codebase: 'Search Code',
			execute_command: 'Run Command',
			delete_file: 'Delete File',
			web_search: 'Web Search',
			create_directory: 'Create Directory'
		};
		return labels[toolName] || toolName.replace(/_/g, ' ');
	}

	function getToolDescription(toolCall: ToolCall): string {
		const args = toolCall.arguments || {};
		switch (toolCall.name) {
			case 'read_file':
				return args.filePath || 'file';
			case 'write_file':
			case 'edit_file':
				return args.filePath || 'file';
			case 'list_files':
				return args.path || '/';
			case 'grep':
				return `"${args.pattern || ''}" in ${args.path || '/'}`;
			case 'search_codebase':
				return `"${args.query || ''}"`;
			case 'execute_command':
				return args.command?.substring(0, 50) || 'command';
			case 'delete_file':
				return args.path || 'file';
			case 'web_search':
				return `"${args.query?.substring(0, 40) || ''}"`;
			case 'create_directory':
				return args.path || 'directory';
			default:
				return '';
		}
	}

	function findResult(toolCallId?: string): ToolResult | undefined {
		if (!toolCallId) return undefined;
		return toolResults.find((r) => r.tool_call_id === toolCallId);
	}

	function formatArgValue(value: any): string {
		if (typeof value === 'string') {
			return value.length > 200 ? value.substring(0, 200) + '...' : value;
		}
		return JSON.stringify(value, null, 2);
	}
</script>

{#if toolCalls.length > 0}
	<div class="mt-3 space-y-2 border-t pt-3" transition:slide={{ duration: 200 }}>
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Play class="h-3.5 w-3.5 text-muted-foreground" />
				<span class="text-xs font-medium text-muted-foreground">Agent Actions</span>
				<Badge variant="secondary" class="text-xs">
					{toolCalls.length} tool{toolCalls.length > 1 ? 's' : ''}
				</Badge>
				{#if totalSteps > 0}
					<Badge variant="outline" class="text-xs">
						{totalSteps} step{totalSteps > 1 ? 's' : ''}
					</Badge>
				{/if}
			</div>
			{#if isStreaming}
				<Badge variant="outline" class="animate-pulse text-xs">
					<Loader2 class="mr-1 h-3 w-3 animate-spin" />
					Running...
				</Badge>
			{/if}
		</div>

		<div class="space-y-1.5">
			{#each toolCalls as toolCall, idx (toolCall.id || idx)}
				{@const IconComponent = getToolIcon(toolCall.name)}
				{@const result = findResult(toolCall.id)}
				{@const isSuccess = result?.success !== false}
				{@const isExpanded = expandedCalls.has(idx)}

				<div
					class="group rounded-md border bg-muted/30 transition-colors hover:bg-muted/50"
					transition:slide={{ duration: 150 }}
				>
					<Collapsible>
						<CollapsibleTrigger class="w-full" onclick={() => toggleExpanded(idx)}>
							<div class="flex items-center gap-2 px-2.5 py-1.5">
								<div
									class="flex h-5 w-5 shrink-0 items-center justify-center rounded {result
										? isSuccess
											? 'bg-green-500/10 text-green-600'
											: 'bg-red-500/10 text-red-600'
										: 'bg-blue-500/10 text-blue-600'}"
								>
									{#if !result && isStreaming && idx === toolCalls.length - 1}
										<Loader2 class="h-3 w-3 animate-spin" />
									{:else if result}
										{#if isSuccess}
											<CheckCircle2 class="h-3 w-3" />
										{:else}
											<XCircle class="h-3 w-3" />
										{/if}
									{:else}
										<IconComponent class="h-3 w-3" />
									{/if}
								</div>

								<span class="text-xs font-medium">{getToolLabel(toolCall.name)}</span>

								<span class="flex-1 truncate text-left text-xs text-muted-foreground">
									{getToolDescription(toolCall)}
								</span>

								{#if isExpanded}
									<ChevronDown class="h-3.5 w-3.5 text-muted-foreground" />
								{:else}
									<ChevronRight class="h-3.5 w-3.5 text-muted-foreground" />
								{/if}
							</div>
						</CollapsibleTrigger>

						<CollapsibleContent>
							{#if isExpanded}
								<div
									class="border-t bg-background/50 px-2.5 py-2 text-xs"
									transition:slide={{ duration: 150 }}
								>
									<!-- Arguments -->
									{#if toolCall.arguments && Object.keys(toolCall.arguments).length > 0}
										<div class="mb-2">
											<div class="mb-1 font-medium text-muted-foreground">Arguments</div>
											<div class="space-y-1">
												{#each Object.entries(toolCall.arguments) as [key, value]}
													{#if key !== 'content' || (typeof value === 'string' && value.length < 500)}
														<div class="flex gap-2">
															<span class="shrink-0 font-mono text-blue-600">{key}:</span>
															<span class="break-all font-mono text-foreground/80">
																{formatArgValue(value)}
															</span>
														</div>
													{:else}
														<div class="flex gap-2">
															<span class="shrink-0 font-mono text-blue-600">{key}:</span>
															<span class="text-muted-foreground">
																({typeof value === 'string' ? value.length : '?'} chars)
															</span>
														</div>
													{/if}
												{/each}
											</div>
										</div>
									{/if}

									<!-- Result -->
									{#if result}
										<div>
											<div class="mb-1 font-medium text-muted-foreground">Result</div>
											<div
												class="rounded border p-1.5 {isSuccess
													? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200'
													: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200'}"
											>
												{#if result.message}
													<div class="break-words">{result.message}</div>
												{:else if result.output}
													<div class="max-h-32 overflow-auto font-mono">
														{result.output.substring(0, 500)}
														{#if result.output.length > 500}...{/if}
													</div>
												{:else}
													<div>{isSuccess ? 'Success' : 'Failed'}</div>
												{/if}
											</div>
										</div>
									{/if}
								</div>
							{/if}
						</CollapsibleContent>
					</Collapsible>
				</div>
			{/each}
		</div>
	</div>
{/if}
