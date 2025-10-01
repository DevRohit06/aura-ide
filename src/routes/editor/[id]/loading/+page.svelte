<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Progress } from '$lib/components/ui/progress';
	import { onMount } from 'svelte';

	let { data } = $props();
	
	let status = $state('Initializing...');
	let progress = $state(0);
	let steps = $state<Array<{ name: string; status: 'pending' | 'loading' | 'complete' | 'error'; message?: string }>>([
		{ name: 'Loading project', status: 'pending' },
		{ name: 'Starting sandbox', status: 'pending' },
		{ name: 'Loading files', status: 'pending' },
		{ name: 'Indexing workspace', status: 'pending' }
	]);

	const projectId = data.projectId;
	const projectName = data.projectName;

	async function checkStatus() {
		try {
			const response = await fetch(`/api/projects/${projectId}/init-status`);
			if (!response.ok) throw new Error('Status check failed');
			
			const data = await response.json();
			
			// Update status
			status = data.message || 'Initializing...';
			progress = data.progress || 0;
			
			// Update steps
			if (data.steps) {
				steps = data.steps;
			}
			
			// If complete, redirect to editor
			if (data.complete) {
				setTimeout(() => {
					goto(`/editor/${projectId}?from=loading`);
				}, 500);
			} else if (data.error) {
				status = `Error: ${data.error}`;
			} else {
				// Continue polling
				setTimeout(checkStatus, 1000);
			}
		} catch (error) {
			console.error('Status check error:', error);
			// Retry after delay
			setTimeout(checkStatus, 2000);
		}
	}

	onMount(() => {
		// Start status polling
		checkStatus();
	});
</script>

<svelte:head>
	<title>Loading Project - Aura IDE</title>
</svelte:head>

<div class="flex h-screen items-center justify-center bg-background">
	<div class="w-full max-w-md space-y-6 p-6">
		<!-- Logo/Header -->
		<div class="text-center">
			<h1 class="text-2xl font-bold">Aura IDE</h1>
			<p class="text-sm text-muted-foreground mt-2">Preparing {projectName}</p>
		</div>

		<!-- Progress Bar -->
		<div class="space-y-2">
			<Progress value={progress} class="h-2" />
			<p class="text-sm text-center text-muted-foreground">{Math.round(progress)}%</p>
		</div>

		<!-- Current Status -->
		<div class="text-center">
			<div class="flex items-center justify-center gap-2">
				<div class="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
				<p class="text-sm font-medium">{status}</p>
			</div>
		</div>

		<!-- Steps -->
		<div class="space-y-3">
			{#each steps as step, index}
				<div class="flex items-center gap-3 rounded-lg border p-3 {step.status === 'complete' ? 'bg-green-50 dark:bg-green-950/20' : step.status === 'loading' ? 'bg-blue-50 dark:bg-blue-950/20' : step.status === 'error' ? 'bg-red-50 dark:bg-red-950/20' : ''}">
					<!-- Status Icon -->
					<div class="flex-shrink-0">
						{#if step.status === 'complete'}
							<div class="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white">
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
								</svg>
							</div>
						{:else if step.status === 'loading'}
							<div class="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
						{:else if step.status === 'error'}
							<div class="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white">
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
								</svg>
							</div>
						{:else}
							<div class="h-6 w-6 rounded-full border-2 border-muted"></div>
						{/if}
					</div>

					<!-- Step Info -->
					<div class="flex-1">
						<p class="text-sm font-medium">{step.name}</p>
						{#if step.message}
							<p class="text-xs text-muted-foreground">{step.message}</p>
						{/if}
					</div>
				</div>
			{/each}
		</div>

		<!-- Tip -->
		<div class="rounded-lg bg-muted/50 p-4 text-center">
			<p class="text-xs text-muted-foreground">
				💡 Tip: This only happens once. Your sandbox persists across sessions!
			</p>
		</div>
	</div>
</div>
