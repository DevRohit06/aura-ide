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
	import { Switch } from '$lib/components/ui/switch';
	import { onMount } from 'svelte';

	interface MCPServerConfig {
		name: string;
		url?: string;
		command?: string;
		args?: string[];
		env?: Record<string, string>;
		apiKey?: string;
		enabled: boolean;
		type: 'local' | 'remote';
		description?: string;
		capabilities?: string[];
	}

	let servers: MCPServerConfig[] = [];
	let stats = {
		totalServers: 0,
		connectedServers: 0,
		enabledServers: 0,
		totalTools: 0,
		totalResources: 0
	};
	let loading = true;
	let error: string | null = null;

	onMount(async () => {
		await loadServers();
	});

	async function loadServers() {
		try {
			loading = true;
			error = null;

			const response = await fetch('/api/mcp/servers');
			const data = await response.json();

			if (data.success) {
				servers = data.data.servers;
				stats = data.data.stats;
			} else {
				error = data.message || 'Failed to load MCP servers';
			}
		} catch (err) {
			console.error('Failed to load MCP servers:', err);
			error = err instanceof Error ? err.message : 'Unknown error';
		} finally {
			loading = false;
		}
	}

	async function toggleServer(serverName: string, currentState: boolean) {
		try {
			const action = currentState ? 'disable' : 'enable';

			const response = await fetch('/api/mcp/servers', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: serverName, action })
			});

			const data = await response.json();

			if (data.success) {
				await loadServers();
			} else {
				error = data.message || 'Failed to toggle server';
			}
		} catch (err) {
			console.error('Failed to toggle server:', err);
			error = err instanceof Error ? err.message : 'Unknown error';
		}
	}

	function getServerTypeColor(type: string) {
		return type === 'remote' ? 'bg-blue-500' : 'bg-green-500';
	}

	function getServerStatusColor(enabled: boolean) {
		return enabled ? 'bg-green-500' : 'bg-gray-500';
	}
</script>

<div class="space-y-6">
	<!-- Stats Cards -->
	<div class="grid grid-cols-1 gap-4 md:grid-cols-5">
		<Card>
			<CardHeader class="pb-2">
				<CardDescription>Total Servers</CardDescription>
				<CardTitle class="text-2xl">{stats.totalServers}</CardTitle>
			</CardHeader>
		</Card>
		<Card>
			<CardHeader class="pb-2">
				<CardDescription>Connected</CardDescription>
				<CardTitle class="text-2xl">{stats.connectedServers}</CardTitle>
			</CardHeader>
		</Card>
		<Card>
			<CardHeader class="pb-2">
				<CardDescription>Enabled</CardDescription>
				<CardTitle class="text-2xl">{stats.enabledServers}</CardTitle>
			</CardHeader>
		</Card>
		<Card>
			<CardHeader class="pb-2">
				<CardDescription>Tools Available</CardDescription>
				<CardTitle class="text-2xl">{stats.totalTools}</CardTitle>
			</CardHeader>
		</Card>
		<Card>
			<CardHeader class="pb-2">
				<CardDescription>Resources</CardDescription>
				<CardTitle class="text-2xl">{stats.totalResources}</CardTitle>
			</CardHeader>
		</Card>
	</div>

	<!-- Error Display -->
	{#if error}
		<Card class="border-red-500">
			<CardContent class="pt-6">
				<p class="text-sm text-red-500">{error}</p>
			</CardContent>
		</Card>
	{/if}

	<!-- Servers List -->
	<Card>
		<CardHeader>
			<div class="flex items-center justify-between">
				<div>
					<CardTitle>MCP Servers</CardTitle>
					<CardDescription>Manage Model Context Protocol server connections</CardDescription>
				</div>
				<Button variant="outline" size="sm" onclick={loadServers} disabled={loading}>
					{loading ? 'Loading...' : 'Refresh'}
				</Button>
			</div>
		</CardHeader>
		<CardContent>
			{#if loading}
				<div class="flex items-center justify-center py-8">
					<div class="text-sm text-muted-foreground">Loading MCP servers...</div>
				</div>
			{:else if servers.length === 0}
				<div class="flex items-center justify-center py-8">
					<div class="text-sm text-muted-foreground">No MCP servers configured</div>
				</div>
			{:else}
				<div class="space-y-4">
					{#each servers as server (server.name)}
						<div class="flex items-center justify-between rounded-lg border p-4">
							<div class="flex-1 space-y-2">
								<div class="flex items-center gap-2">
									<h3 class="font-semibold">{server.name}</h3>
									<Badge variant="outline" class={getServerTypeColor(server.type)}>
										{server.type}
									</Badge>
									<Badge variant="outline" class={getServerStatusColor(server.enabled)}>
										{server.enabled ? 'Enabled' : 'Disabled'}
									</Badge>
								</div>
								<p class="text-sm text-muted-foreground">
									{server.description || 'No description'}
								</p>
								{#if server.capabilities && server.capabilities.length > 0}
									<div class="flex flex-wrap gap-1">
										{#each server.capabilities as capability}
											<Badge variant="secondary" class="text-xs">
												{capability}
											</Badge>
										{/each}
									</div>
								{/if}
							</div>
							<div class="ml-4">
								<Switch
									checked={server.enabled}
									onCheckedChange={() => toggleServer(server.name, server.enabled)}
								/>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</CardContent>
	</Card>

	<!-- Information Card -->
	<Card>
		<CardHeader>
			<CardTitle>About MCP Servers</CardTitle>
			<CardDescription>Model Context Protocol Integration</CardDescription>
		</CardHeader>
		<CardContent class="space-y-2">
			<p class="text-sm text-muted-foreground">
				MCP (Model Context Protocol) allows AI models to connect to external data sources and tools.
				Enable servers to give your AI access to:
			</p>
			<ul class="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
				<li><strong>Context7:</strong> Search programming documentation across 200+ languages</li>
				<li><strong>Memory:</strong> Persistent knowledge graph for long-term memory</li>
				<li><strong>Filesystem:</strong> Enhanced file system operations</li>
				<li><strong>Brave Search:</strong> Web search capabilities</li>
				<li><strong>GitHub:</strong> Repository management and integrations (coming soon)</li>
			</ul>
		</CardContent>
	</Card>
</div>
