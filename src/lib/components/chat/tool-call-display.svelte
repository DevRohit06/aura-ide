<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import {
		Collapsible,
		CollapsibleContent,
		CollapsibleTrigger
	} from '$lib/components/ui/collapsible/index.js';
	import { toolManager } from '$lib/services/tool-manager.service.js';
	import type { ToolCall } from '$lib/types/tools.js';
	import {
		CheckCircle,
		ChevronDown,
		ChevronRight,
		Clock,
		Eye,
		FileEdit,
		FolderOpen,
		Loader2,
		Plus,
		Trash2,
		XCircle
	} from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';

	let activeCalls = $state<Map<string, ToolCall>>(new Map());
	let completedCalls = $state<ToolCall[]>([]);
	let expandedCalls = $state<Set<string>>(new Set());

	// Subscribe to active calls
	onMount(() => {
		const unsubscribe = toolManager.activeCalls.subscribe((calls) => {
			// Move completed calls to history
			calls.forEach((call) => {
				if ((call.status === 'success' || call.status === 'error') && !activeCalls.has(call.id)) {
					completedCalls = [...completedCalls.slice(-9), call]; // Keep last 10
				}
			});
			activeCalls = calls;
		});

		return unsubscribe;
	});

	function toggleExpanded(callId: string) {
		if (expandedCalls.has(callId)) {
			expandedCalls.delete(callId);
		} else {
			expandedCalls.add(callId);
		}
		expandedCalls = new Set(expandedCalls);
	}

	function getToolIcon(toolName: string) {
		switch (toolName) {
			case 'edit_file':
				return FileEdit;
			case 'read_file':
				return Eye;
			case 'list_files':
				return FolderOpen;
			default:
				return FileEdit;
		}
	}

	function getOperationIcon(operation: string) {
		switch (operation) {
			case 'create':
				return Plus;
			case 'update':
				return FileEdit;
			case 'delete':
				return Trash2;
			case 'read':
				return Eye;
			case 'list':
				return FolderOpen;
			default:
				return FileEdit;
		}
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'pending':
				return 'bg-yellow-100 text-yellow-800 border-yellow-200';
			case 'executing':
				return 'bg-blue-100 text-blue-800 border-blue-200';
			case 'success':
				return 'bg-green-100 text-green-800 border-green-200';
			case 'error':
				return 'bg-red-100 text-red-800 border-red-200';
			default:
				return 'bg-gray-100 text-gray-800 border-gray-200';
		}
	}

	function formatDuration(duration?: number) {
		if (!duration) return '';
		if (duration < 1000) return `${duration}ms`;
		return `${(duration / 1000).toFixed(1)}s`;
	}

	function clearCompleted() {
		completedCalls = [];
	}

	function removeCall(callId: string) {
		toolManager.removeCall(callId);
	}

	let allCalls = $derived(
		[...Array.from(activeCalls.values()), ...completedCalls].sort(
			(a, b) => b.timestamp.getTime() - a.timestamp.getTime()
		)
	);
</script>

<div class="tool-calls-container space-y-3">
	{#if allCalls.length === 0}
		<div class="py-4 text-center text-sm text-gray-500">No tool calls yet</div>
	{:else}
		<div class="space-y-2">
			{#each allCalls as call (call.id)}
				{@const IconComponent = getToolIcon(call.name)}
				{@const OperationIcon = getOperationIcon(call.parameters?.operation || '')}
				<div in:slide={{ duration: 300 }}>
					<Card
						class="border-l-4 transition-all duration-200 hover:shadow-md {call.status === 'pending'
							? 'border-l-yellow-500'
							: call.status === 'executing'
								? 'border-l-blue-500'
								: call.status === 'success'
									? 'border-l-green-500'
									: call.status === 'error'
										? 'border-l-red-500'
										: 'border-l-transparent'}"
					>
						<CardHeader class="pb-2">
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2">
									<IconComponent class="h-4 w-4 text-gray-600" />
									<CardTitle class="text-sm font-medium">
										{call.name.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
									</CardTitle>
									<Badge variant="outline" class={getStatusColor(call.status)}>
										{#if call.status === 'pending'}
											<Clock class="mr-1 h-3 w-3" />
										{:else if call.status === 'executing'}
											<Loader2 class="mr-1 h-3 w-3 animate-spin" />
										{:else if call.status === 'success'}
											<CheckCircle class="mr-1 h-3 w-3" />
										{:else if call.status === 'error'}
											<XCircle class="mr-1 h-3 w-3" />
										{/if}
										{call.status}
									</Badge>
								</div>

								<div class="flex items-center gap-2">
									{#if call.duration}
										<span class="text-xs text-gray-500">
											{formatDuration(call.duration)}
										</span>
									{/if}

									<Collapsible>
										<CollapsibleTrigger
											class="rounded p-1 hover:bg-gray-100"
											onclick={() => toggleExpanded(call.id)}
										>
											{#if expandedCalls.has(call.id)}
												<ChevronDown class="h-4 w-4" />
											{:else}
												<ChevronRight class="h-4 w-4" />
											{/if}
										</CollapsibleTrigger>
									</Collapsible>

									{#if call.status === 'success' || call.status === 'error'}
										<Button
											variant="ghost"
											size="sm"
											onclick={() => removeCall(call.id)}
											class="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
										>
											<XCircle class="h-3 w-3" />
										</Button>
									{/if}
								</div>
							</div>

							<!-- Quick preview for file operations -->
							{#if call.parameters?.operation && call.parameters?.filePath}
								<div class="mt-1 flex items-center gap-2 text-xs text-gray-600">
									<OperationIcon class="h-3 w-3" />
									<span class="rounded bg-gray-100 px-1 font-mono">
										{call.parameters.filePath}
									</span>
									{#if call.parameters.reason}
										<span class="text-gray-500">• {call.parameters.reason}</span>
									{/if}
								</div>
							{/if}
						</CardHeader>

						{#if expandedCalls.has(call.id)}
							<CollapsibleContent>
								<CardContent class="space-y-3 pt-0">
									<!-- Parameters -->
									<div>
										<h4 class="mb-2 text-xs font-medium text-gray-700">Parameters</h4>
										<div class="rounded bg-gray-50 p-2 font-mono text-xs">
											<pre class="whitespace-pre-wrap">{JSON.stringify(
													call.parameters,
													null,
													2
												)}</pre>
										</div>
									</div>

									<!-- Result or Error -->
									{#if call.result}
										<div>
											<h4 class="mb-2 text-xs font-medium text-gray-700">Result</h4>
											<div class="rounded border border-green-200 bg-green-50 p-2 text-xs">
												<div class="mb-1 font-medium text-green-800">
													{call.result.message}
												</div>
												{#if call.result.data}
													<div class="font-mono text-green-700">
														<pre class="whitespace-pre-wrap">{JSON.stringify(
																call.result.data,
																null,
																2
															)}</pre>
													</div>
												{/if}
											</div>
										</div>
									{/if}

									{#if call.error}
										<div>
											<h4 class="mb-2 text-xs font-medium text-gray-700">Error</h4>
											<div class="rounded border border-red-200 bg-red-50 p-2 text-xs">
												<div class="font-medium text-red-800">
													{call.error}
												</div>
											</div>
										</div>
									{/if}

									<!-- Metadata -->
									<div class="border-t pt-2 text-xs text-gray-500">
										<div>Called at: {call.timestamp.toLocaleTimeString()}</div>
										<div>ID: {call.id}</div>
									</div>
								</CardContent>
							</CollapsibleContent>
						{/if}
					</Card>
				</div>
			{/each}
		</div>

		{#if completedCalls.length > 0}
			<div class="flex justify-end">
				<Button variant="ghost" size="sm" onclick={clearCompleted} class="text-xs text-gray-500">
					Clear completed
				</Button>
			</div>
		{/if}
	{/if}
</div>

<style>
	.tool-calls-container {
		max-height: 400px;
		overflow-y: auto;
	}
</style>
