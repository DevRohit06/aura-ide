<!--
  SandboxManager.svelte
  Main component for managing sandbox environments with creation, listing, and actions
-->
<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger,
		SelectValue
	} from '$lib/components/ui/select';
	import { FolderOpen, Play, RotateCcw, Settings, Square, Terminal, Trash2 } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';
	import SandboxCreateDialog from './SandboxCreateDialog.svelte';
	import SandboxFileExplorer from './SandboxFileExplorer.svelte';
	import SandboxMetrics from './SandboxMetrics.svelte';
	import SandboxTerminal from './SandboxTerminal.svelte';

	interface Sandbox {
		id: string;
		name: string;
		provider: 'daytona' | 'e2b' | 'local';
		status: 'initializing' | 'running' | 'stopped' | 'error' | 'terminated';
		template: string;
		created: string;
		lastActivity: string;
		resourceUsage?: {
			cpu: number;
			memory: number;
			storage: number;
		};
	}

	// Component state
	let sandboxes = writable<Sandbox[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let selectedSandbox = $state<Sandbox | null>(null);
	let searchQuery = $state('');
	let statusFilter = $state<string>('all');
	let providerFilter = $state<string>('all');
	let showCreateDialog = $state(false);
	let showFileExplorer = $state(false);
	let showTerminal = $state(false);
	let showMetrics = $state(false);

	// Pagination
	let currentPage = $state(1);
	let pageSize = $state(10);
	let totalSandboxes = $state(0);

	// Reactive filtered sandboxes
	let filteredSandboxes = $derived(() => {
		return $sandboxes.filter((sandbox) => {
			const matchesSearch =
				!searchQuery ||
				sandbox.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				sandbox.template.toLowerCase().includes(searchQuery.toLowerCase());

			const matchesStatus = statusFilter === 'all' || sandbox.status === statusFilter;
			const matchesProvider = providerFilter === 'all' || sandbox.provider === providerFilter;

			return matchesSearch && matchesStatus && matchesProvider;
		});
	});

	// Load sandboxes from API
	async function loadSandboxes() {
		loading = true;
		error = null;

		try {
			const params = new URLSearchParams({
				page: currentPage.toString(),
				limit: pageSize.toString(),
				...(statusFilter !== 'all' && { status: statusFilter }),
				...(providerFilter !== 'all' && { provider: providerFilter }),
				...(searchQuery && { search: searchQuery })
			});

			const response = await fetch(`/api/sandbox?${params}`);
			if (!response.ok) {
				throw new Error(`Failed to load sandboxes: ${response.statusText}`);
			}

			const data = await response.json();
			sandboxes.set(data.sandboxes);
			totalSandboxes = data.pagination.total;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load sandboxes';
			console.error('Error loading sandboxes:', err);
		} finally {
			loading = false;
		}
	}

	// Sandbox actions
	async function performSandboxAction(sandboxId: string, action: 'start' | 'stop' | 'restart') {
		try {
			const response = await fetch(`/api/sandbox/${sandboxId}/action`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action })
			});

			if (!response.ok) {
				throw new Error(`Failed to ${action} sandbox`);
			}

			// Reload sandboxes to get updated status
			await loadSandboxes();
		} catch (err) {
			error = err instanceof Error ? err.message : `Failed to ${action} sandbox`;
		}
	}

	async function deleteSandbox(sandboxId: string) {
		if (!confirm('Are you sure you want to delete this sandbox? This action cannot be undone.')) {
			return;
		}

		try {
			const response = await fetch(`/api/sandbox/${sandboxId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				throw new Error('Failed to delete sandbox');
			}

			await loadSandboxes();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete sandbox';
		}
	}

	// Handle sandbox creation
	function handleSandboxCreated() {
		showCreateDialog = false;
		loadSandboxes();
	}

	// Status badge styling
	function getStatusColor(status: string) {
		switch (status) {
			case 'running':
				return 'bg-green-100 text-green-800';
			case 'stopped':
				return 'bg-gray-100 text-gray-800';
			case 'initializing':
				return 'bg-blue-100 text-blue-800';
			case 'error':
				return 'bg-red-100 text-red-800';
			case 'terminated':
				return 'bg-orange-100 text-orange-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}

	// Lifecycle
	onMount(() => {
		loadSandboxes();
	});

	// Auto-refresh every 30 seconds
	onMount(() => {
		const interval = setInterval(loadSandboxes, 30000);
		return () => clearInterval(interval);
	});
</script>

<!-- Main Sandbox Manager Interface -->
<div class="space-y-6">
	<!-- Header & Controls -->
	<div class="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Sandbox Environments</h1>
			<p class="text-muted-foreground">
				Manage your development environments and code execution sandboxes
			</p>
		</div>

		<Button onclick={() => (showCreateDialog = true)} class="w-full sm:w-auto">
			Create Sandbox
		</Button>
	</div>

	<!-- Filters & Search -->
	<div class="flex flex-col gap-4 sm:flex-row">
		<div class="flex-1">
			<Input
				type="text"
				placeholder="Search sandboxes by name or template..."
				bind:value={searchQuery}
				oninput={() => loadSandboxes()}
			/>
		</div>

		<Select bind:value={statusFilter} onValueChange={() => loadSandboxes()}>
			<SelectTrigger class="w-full sm:w-40">
				<SelectValue placeholder="Status" />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="all">All Status</SelectItem>
				<SelectItem value="running">Running</SelectItem>
				<SelectItem value="stopped">Stopped</SelectItem>
				<SelectItem value="initializing">Initializing</SelectItem>
				<SelectItem value="error">Error</SelectItem>
			</SelectContent>
		</Select>

		<Select bind:value={providerFilter} onValueChange={() => loadSandboxes()}>
			<SelectTrigger class="w-full sm:w-40">
				<SelectValue placeholder="Provider" />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="all">All Providers</SelectItem>
				<SelectItem value="daytona">Daytona</SelectItem>
				<SelectItem value="e2b">E2B</SelectItem>
				<SelectItem value="local">Local</SelectItem>
			</SelectContent>
		</Select>
	</div>

	<!-- Error Display -->
	{#if error}
		<Card class="border-red-200 bg-red-50">
			<CardContent class="pt-6">
				<p class="text-red-800">{error}</p>
				<Button onclick={() => (error = null)} variant="outline" size="sm" class="mt-2">
					Dismiss
				</Button>
			</CardContent>
		</Card>
	{/if}

	<!-- Loading State -->
	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
			<span class="ml-2">Loading sandboxes...</span>
		</div>
	{/if}

	<!-- Sandboxes Grid -->
	{#if !loading && filteredSandboxes().length > 0}
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each filteredSandboxes() as sandbox (sandbox.id)}
				<Card class="group relative transition-shadow hover:shadow-md">
					<CardHeader class="pb-3">
						<div class="flex items-start justify-between">
							<div>
								<CardTitle class="text-lg">{sandbox.name}</CardTitle>
								<CardDescription class="mt-1 flex items-center gap-2">
									<Badge class={getStatusColor(sandbox.status)}>
										{sandbox.status}
									</Badge>
									<span class="text-xs">{sandbox.provider}</span>
								</CardDescription>
							</div>
						</div>
					</CardHeader>

					<CardContent>
						<div class="space-y-3">
							<div class="text-sm text-muted-foreground">
								<p><strong>Template:</strong> {sandbox.template}</p>
								<p><strong>Created:</strong> {new Date(sandbox.created).toLocaleDateString()}</p>
								<p>
									<strong>Last Activity:</strong>
									{new Date(sandbox.lastActivity).toLocaleString()}
								</p>
							</div>

							{#if sandbox.resourceUsage}
								<div class="space-y-1 text-xs">
									<div class="flex justify-between">
										<span>CPU:</span>
										<span>{sandbox.resourceUsage.cpu}%</span>
									</div>
									<div class="flex justify-between">
										<span>Memory:</span>
										<span>{sandbox.resourceUsage.memory}MB</span>
									</div>
									<div class="flex justify-between">
										<span>Storage:</span>
										<span>{sandbox.resourceUsage.storage}MB</span>
									</div>
								</div>
							{/if}

							<!-- Action Buttons -->
							<div class="flex flex-wrap gap-1 pt-2">
								{#if sandbox.status === 'stopped'}
									<Button
										size="sm"
										variant="outline"
										onclick={() => performSandboxAction(sandbox.id, 'start')}
									>
										<Play class="mr-1 h-3 w-3" />
										Start
									</Button>
								{:else if sandbox.status === 'running'}
									<Button
										size="sm"
										variant="outline"
										onclick={() => performSandboxAction(sandbox.id, 'stop')}
									>
										<Square class="mr-1 h-3 w-3" />
										Stop
									</Button>
									<Button
										size="sm"
										variant="outline"
										onclick={() => performSandboxAction(sandbox.id, 'restart')}
									>
										<RotateCcw class="mr-1 h-3 w-3" />
										Restart
									</Button>
								{/if}

								<Button
									size="sm"
									variant="ghost"
									onclick={() => {
										selectedSandbox = sandbox;
										showFileExplorer = true;
									}}
								>
									<FolderOpen class="mr-1 h-3 w-3" />
									Files
								</Button>

								{#if sandbox.status === 'running'}
									<Button
										size="sm"
										variant="ghost"
										onclick={() => {
											selectedSandbox = sandbox;
											showTerminal = true;
										}}
									>
										<Terminal class="mr-1 h-3 w-3" />
										Terminal
									</Button>
								{/if}

								<Button
									size="sm"
									variant="ghost"
									onclick={() => {
										selectedSandbox = sandbox;
										showMetrics = true;
									}}
								>
									<Settings class="mr-1 h-3 w-3" />
									Metrics
								</Button>

								<Button
									size="sm"
									variant="ghost"
									onclick={() => deleteSandbox(sandbox.id)}
									class="text-red-600 hover:text-red-700"
								>
									<Trash2 class="h-3 w-3" />
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			{/each}
		</div>

		<!-- Pagination -->
		{#if totalSandboxes > pageSize}
			<div class="flex items-center justify-between">
				<p class="text-sm text-muted-foreground">
					Showing {(currentPage - 1) * pageSize + 1} to {Math.min(
						currentPage * pageSize,
						totalSandboxes
					)} of {totalSandboxes} sandboxes
				</p>
				<div class="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						disabled={currentPage === 1}
						onclick={() => {
							currentPage--;
							loadSandboxes();
						}}
					>
						Previous
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={currentPage * pageSize >= totalSandboxes}
						onclick={() => {
							currentPage++;
							loadSandboxes();
						}}
					>
						Next
					</Button>
				</div>
			</div>
		{/if}
	{:else if !loading}
		<Card>
			<CardContent class="flex flex-col items-center justify-center py-12">
				<p class="mb-4 text-muted-foreground">No sandboxes found</p>
				<Button onclick={() => (showCreateDialog = true)}>Create Your First Sandbox</Button>
			</CardContent>
		</Card>
	{/if}
</div>

<!-- Dialogs -->
{#if showCreateDialog}
	<SandboxCreateDialog bind:open={showCreateDialog} onCreated={handleSandboxCreated} />
{/if}

{#if selectedSandbox && showFileExplorer}
	<SandboxFileExplorer sandbox={selectedSandbox} bind:open={showFileExplorer} />
{/if}

{#if selectedSandbox && showTerminal}
	<SandboxTerminal sandbox={selectedSandbox} bind:open={showTerminal} />
{/if}

{#if selectedSandbox && showMetrics}
	<SandboxMetrics sandbox={selectedSandbox} bind:open={showMetrics} />
{/if}
