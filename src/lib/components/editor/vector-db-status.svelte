<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import {
		forceReindexAllFiles,
		getIndexedHashesDebug,
		indexAllFilesFromStore
	} from '$lib/services/vector-indexer.client';
	import { indexerStatus } from '$lib/stores/vector-indexer.store';
	import CheckCircleIcon from '@lucide/svelte/icons/check-circle';
	import DatabaseIcon from '@lucide/svelte/icons/database';
	import LoaderIcon from '@lucide/svelte/icons/loader-2';
	import XCircleIcon from '@lucide/svelte/icons/x-circle';
	import { onMount } from 'svelte';

	let { project } = $props<{ project: any }>();

	let vectorDbStats = $state<{
		totalDocuments: number;
		indexedProjects: string[];
		connection: string;
	} | null>(null);

	let isLoadingStats = $state(false);

	async function loadVectorDbStats() {
		try {
			isLoadingStats = true;
			const response = await fetch('/api/vector-db/test', {
				credentials: 'same-origin'
			});

			if (response.ok) {
				const data = await response.json();
				vectorDbStats = data.stats;
				vectorDbStats!.connection = data.connection;
			}
		} catch (error) {
			console.error('Failed to load vector DB stats:', error);
		} finally {
			isLoadingStats = false;
		}
	}

	async function triggerReindexing() {
		try {
			console.log('🔄 Manual re-indexing triggered');
			getIndexedHashesDebug(); // Show current hashes for debugging
			const result = await indexAllFilesFromStore({
				projectId: project.id,
				async: true
			});
			console.log('✅ Reindexing result:', result);
			// Refresh stats after a delay
			setTimeout(loadVectorDbStats, 2000);
		} catch (error) {
			console.error('❌ Failed to trigger reindexing:', error);
		}
	}

	async function forceReindexing() {
		try {
			console.log('🔄 Force re-indexing triggered (clearing hashes)');
			const result = await forceReindexAllFiles({
				projectId: project.id,
				async: true
			});
			console.log('✅ Force reindexing result:', result);
			// Refresh stats after a delay
			setTimeout(loadVectorDbStats, 3000);
		} catch (error) {
			console.error('❌ Failed to force reindexing:', error);
		}
	}

	onMount(() => {
		loadVectorDbStats();
		// Refresh stats every 30 seconds
		const interval = setInterval(loadVectorDbStats, 30000);
		return () => clearInterval(interval);
	});

	let statusIcon = $derived(() => {
		switch ($indexerStatus.status) {
			case 'indexing':
				return LoaderIcon;
			case 'done':
				return CheckCircleIcon;
			case 'error':
				return XCircleIcon;
			default:
				return DatabaseIcon;
		}
	});

	let statusColor = $derived(() => {
		switch ($indexerStatus.status) {
			case 'indexing':
				return 'text-blue-500';
			case 'done':
				return 'text-green-500';
			case 'error':
				return 'text-red-500';
			default:
				return 'text-muted-foreground';
		}
	});
</script>

<div class="space-y-4">
	<!-- Header with Status Icon -->
	<div class="flex items-center gap-2 border-b border-border pb-2">
		<statusIcon class="h-4 w-4 {statusColor}"></statusIcon>
		<span class="text-sm font-medium">Vector Database</span>
		<Badge variant="outline" class="ml-auto text-xs">
			{$indexerStatus.status || 'idle'}
		</Badge>
	</div>

	<!-- Status List -->
	<div class="space-y-3">
		<!-- Connection Status -->
		<div class="flex items-center gap-3">
			<div class="flex min-w-0 flex-1 items-center gap-2">
				<div
					class="h-2 w-2 rounded-full {vectorDbStats?.connection === 'OK'
						? 'bg-green-500'
						: 'bg-red-500'}"
				></div>
				<span class="text-sm text-muted-foreground">Connection</span>
			</div>
			<span
				class="text-sm font-medium {vectorDbStats?.connection === 'OK'
					? 'text-green-600'
					: 'text-red-600'}"
			>
				{isLoadingStats ? 'Checking...' : vectorDbStats?.connection || 'Unknown'}
			</span>
		</div>

		<!-- Document Count -->
		<div class="flex items-center gap-3">
			<div class="flex min-w-0 flex-1 items-center gap-2">
				<DatabaseIcon class="h-3 w-3 text-muted-foreground" />
				<span class="text-sm text-muted-foreground">Documents</span>
			</div>
			<span class="text-sm font-medium">
				{isLoadingStats ? '...' : (vectorDbStats?.totalDocuments || 0).toLocaleString()}
			</span>
		</div>

		<!-- Indexing Progress -->
		{#if $indexerStatus.status === 'indexing'}
			<div class="space-y-2">
				<div class="flex items-center gap-3">
					<div class="flex min-w-0 flex-1 items-center gap-2">
						<LoaderIcon class="h-3 w-3 animate-spin text-blue-500" />
						<span class="text-sm text-muted-foreground">Progress</span>
					</div>
					<span class="text-sm font-medium">
						{$indexerStatus.indexed}/{$indexerStatus.pending}
					</span>
				</div>
				<Progress
					value={$indexerStatus.pending > 0
						? ($indexerStatus.indexed / $indexerStatus.pending) * 100
						: 0}
					class="h-2"
				/>
			</div>
		{/if}

		<!-- Last Run -->
		{#if $indexerStatus.lastRun}
			<div class="flex items-center gap-3">
				<div class="flex min-w-0 flex-1 items-center gap-2">
					<div class="h-3 w-3 rounded-full bg-muted-foreground/30"></div>
					<span class="text-sm text-muted-foreground">Last indexed</span>
				</div>
				<span class="text-sm font-medium">
					{new Date($indexerStatus.lastRun).toLocaleTimeString()}
				</span>
			</div>
		{/if}

		<!-- Status Summary -->
		<div class="flex items-center gap-3">
			<div class="flex min-w-0 flex-1 items-center gap-2">
				<statusIcon class="h-3 w-3 {statusColor}"></statusIcon>
				<span class="text-sm text-muted-foreground">Status</span>
			</div>
			<div class="text-sm font-medium">
				{#if $indexerStatus.status === 'idle'}
					<span class="text-muted-foreground">Ready</span>
				{:else if $indexerStatus.status === 'indexing'}
					<span class="text-blue-600">Indexing...</span>
				{:else if $indexerStatus.status === 'done'}
					<span class="text-green-600">
						{$indexerStatus.indexed} indexed
						{#if $indexerStatus.failed > 0}, {$indexerStatus.failed} failed{/if}
					</span>
				{:else if $indexerStatus.status === 'error'}
					<span class="text-red-600">Error</span>
				{/if}
			</div>
		</div>
	</div>

	<!-- Actions -->
	<div class="flex gap-2 border-t border-border pt-2">
		<Button
			size="sm"
			variant="outline"
			onclick={triggerReindexing}
			disabled={$indexerStatus.status === 'indexing'}
			class="flex-1 text-xs"
		>
			{#if $indexerStatus.status === 'indexing'}
				<LoaderIcon class="mr-1 h-3 w-3 animate-spin" />
			{/if}
			Re-index
		</Button>
		<Button
			size="sm"
			variant="destructive"
			onclick={forceReindexing}
			disabled={$indexerStatus.status === 'indexing'}
			class="text-xs"
		>
			Force
		</Button>
		<Button
			size="sm"
			variant="ghost"
			onclick={loadVectorDbStats}
			disabled={isLoadingStats}
			class="h-8 w-8 p-0"
		>
			↻
		</Button>
	</div>
</div>
