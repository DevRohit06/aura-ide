<!--
  SandboxMetrics.svelte
  Performance monitoring and analytics for sandbox environments
-->
<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Progress } from '$lib/components/ui/progress';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import {
		Activity,
		AlertTriangle,
		Clock,
		Cpu,
		Download,
		HardDrive,
		MemoryStick,
		Network,
		RefreshCw,
		Timer,
		TrendingUp,
		Upload
	} from 'lucide-svelte';
	import { onDestroy, onMount } from 'svelte';

	interface Props {
		sandboxId: string;
		refreshInterval?: number;
	}

	let { sandboxId, refreshInterval = 5000 }: Props = $props();

	interface SystemMetrics {
		cpu: {
			usage: number;
			cores: number;
			loadAverage: number[];
		};
		memory: {
			used: number;
			total: number;
			available: number;
			percentage: number;
		};
		disk: {
			used: number;
			total: number;
			available: number;
			percentage: number;
		};
		network: {
			bytesIn: number;
			bytesOut: number;
			packetsIn: number;
			packetsOut: number;
		};
		uptime: number;
		timestamp: Date;
	}

	interface ProcessInfo {
		pid: number;
		name: string;
		cpu: number;
		memory: number;
		user: string;
		status: string;
	}

	interface PerformanceLog {
		timestamp: Date;
		event: string;
		duration: number;
		success: boolean;
		details?: string;
	}

	// Component state
	let metrics = $state<SystemMetrics | null>(null);
	let processes = $state<ProcessInfo[]>([]);
	let performanceLogs = $state<PerformanceLog[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let lastUpdate = $state<Date | null>(null);

	// Auto-refresh interval
	let refreshTimer: NodeJS.Timeout | null = null;
	let autoRefresh = $state(true);

	// Fetch system metrics
	async function fetchMetrics() {
		loading = true;
		error = null;

		try {
			const response = await fetch(`/api/sandbox/${sandboxId}/metrics`);

			if (!response.ok) {
				throw new Error('Failed to fetch metrics');
			}

			const data = await response.json();

			metrics = {
				cpu: {
					usage: data.cpu?.usage || 0,
					cores: data.cpu?.cores || 1,
					loadAverage: data.cpu?.loadAverage || [0, 0, 0]
				},
				memory: {
					used: data.memory?.used || 0,
					total: data.memory?.total || 1,
					available: data.memory?.available || 1,
					percentage: data.memory?.percentage || 0
				},
				disk: {
					used: data.disk?.used || 0,
					total: data.disk?.total || 1,
					available: data.disk?.available || 1,
					percentage: data.disk?.percentage || 0
				},
				network: {
					bytesIn: data.network?.bytesIn || 0,
					bytesOut: data.network?.bytesOut || 0,
					packetsIn: data.network?.packetsIn || 0,
					packetsOut: data.network?.packetsOut || 0
				},
				uptime: data.uptime || 0,
				timestamp: new Date()
			};

			lastUpdate = new Date();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to fetch metrics';
			console.error('Error fetching metrics:', err);
		} finally {
			loading = false;
		}
	}

	// Fetch process information
	async function fetchProcesses() {
		try {
			const response = await fetch(`/api/sandbox/${sandboxId}/processes`);

			if (!response.ok) {
				throw new Error('Failed to fetch processes');
			}

			const data = await response.json();
			processes = data.processes || [];
		} catch (err) {
			console.error('Error fetching processes:', err);
		}
	}

	// Fetch performance logs
	async function fetchPerformanceLogs() {
		try {
			const response = await fetch(`/api/sandbox/${sandboxId}/logs?type=performance&limit=50`);

			if (!response.ok) {
				throw new Error('Failed to fetch performance logs');
			}

			const data = await response.json();
			performanceLogs =
				data.logs?.map((log: any) => ({
					timestamp: new Date(log.timestamp),
					event: log.event,
					duration: log.duration,
					success: log.success,
					details: log.details
				})) || [];
		} catch (err) {
			console.error('Error fetching performance logs:', err);
		}
	}

	// Format bytes
	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	// Format uptime
	function formatUptime(seconds: number): string {
		const days = Math.floor(seconds / 86400);
		const hours = Math.floor((seconds % 86400) / 3600);
		const mins = Math.floor((seconds % 3600) / 60);

		if (days > 0) {
			return `${days}d ${hours}h ${mins}m`;
		} else if (hours > 0) {
			return `${hours}h ${mins}m`;
		}
		return `${mins}m`;
	}

	// Format duration
	function formatDuration(ms: number): string {
		if (ms < 1000) return `${ms}ms`;
		return `${(ms / 1000).toFixed(2)}s`;
	}

	// Get status color based on usage
	function getUsageColor(percentage: number): string {
		if (percentage > 90) return 'text-red-600';
		if (percentage > 70) return 'text-yellow-600';
		return 'text-green-600';
	}

	// Get status variant
	function getUsageVariant(percentage: number): 'default' | 'secondary' | 'destructive' {
		if (percentage > 90) return 'destructive';
		if (percentage > 70) return 'secondary';
		return 'default';
	}

	// Setup auto-refresh
	function startAutoRefresh() {
		if (refreshTimer) {
			clearInterval(refreshTimer);
		}

		if (autoRefresh) {
			refreshTimer = setInterval(() => {
				fetchMetrics();
				fetchProcesses();
				fetchPerformanceLogs();
			}, refreshInterval);
		}
	}

	// Manual refresh
	function refresh() {
		fetchMetrics();
		fetchProcesses();
		fetchPerformanceLogs();
	}

	// Toggle auto-refresh
	function toggleAutoRefresh() {
		autoRefresh = !autoRefresh;
		if (autoRefresh) {
			startAutoRefresh();
		} else if (refreshTimer) {
			clearInterval(refreshTimer);
			refreshTimer = null;
		}
	}

	// Initialize
	onMount(() => {
		refresh();
		startAutoRefresh();
	});

	onDestroy(() => {
		if (refreshTimer) {
			clearInterval(refreshTimer);
		}
	});

	// Restart auto-refresh when interval changes
	$effect(() => {
		startAutoRefresh();
	});
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h3 class="text-lg font-semibold">System Metrics</h3>
			<p class="text-sm text-muted-foreground">
				Real-time performance monitoring for sandbox environment
			</p>
		</div>

		<div class="flex items-center gap-2">
			<Button
				size="sm"
				variant="outline"
				onclick={toggleAutoRefresh}
				class="flex items-center gap-2"
			>
				<RefreshCw class="h-4 w-4" />
				Auto-refresh: {autoRefresh ? 'On' : 'Off'}
			</Button>

			<Button size="sm" onclick={refresh} disabled={loading} class="flex items-center gap-2">
				<RefreshCw class="h-4 w-4 {loading ? 'animate-spin' : ''}" />
				Refresh
			</Button>
		</div>
	</div>

	{#if lastUpdate}
		<p class="text-xs text-muted-foreground">
			Last updated: {lastUpdate.toLocaleTimeString()}
		</p>
	{/if}

	{#if error}
		<Card class="border-red-200 bg-red-50">
			<CardContent class="pt-6">
				<div class="flex items-center gap-2 text-red-800">
					<AlertTriangle class="h-4 w-4" />
					<span>{error}</span>
				</div>
			</CardContent>
		</Card>
	{/if}

	{#if metrics}
		<!-- System Overview -->
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
			<!-- CPU Usage -->
			<Card>
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium">CPU Usage</CardTitle>
					<Cpu class="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold {getUsageColor(metrics.cpu.usage)}">
						{metrics.cpu.usage.toFixed(1)}%
					</div>
					<Progress value={metrics.cpu.usage} class="mt-2" />
					<p class="mt-2 text-xs text-muted-foreground">
						{metrics.cpu.cores} cores • Load: {metrics.cpu.loadAverage[0]?.toFixed(2) || 0}
					</p>
				</CardContent>
			</Card>

			<!-- Memory Usage -->
			<Card>
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium">Memory</CardTitle>
					<MemoryStick class="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold {getUsageColor(metrics.memory.percentage)}">
						{metrics.memory.percentage.toFixed(1)}%
					</div>
					<Progress value={metrics.memory.percentage} class="mt-2" />
					<p class="mt-2 text-xs text-muted-foreground">
						{formatBytes(metrics.memory.used)} / {formatBytes(metrics.memory.total)}
					</p>
				</CardContent>
			</Card>

			<!-- Disk Usage -->
			<Card>
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium">Disk Space</CardTitle>
					<HardDrive class="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold {getUsageColor(metrics.disk.percentage)}">
						{metrics.disk.percentage.toFixed(1)}%
					</div>
					<Progress value={metrics.disk.percentage} class="mt-2" />
					<p class="mt-2 text-xs text-muted-foreground">
						{formatBytes(metrics.disk.used)} / {formatBytes(metrics.disk.total)}
					</p>
				</CardContent>
			</Card>

			<!-- Uptime -->
			<Card>
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium">Uptime</CardTitle>
					<Clock class="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold">
						{formatUptime(metrics.uptime)}
					</div>
					<p class="mt-4 text-xs text-muted-foreground">System running time</p>
				</CardContent>
			</Card>
		</div>

		<!-- Network Activity -->
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<Network class="h-4 w-4" />
					Network Activity
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
					<div class="text-center">
						<div class="flex items-center justify-center gap-2 text-green-600">
							<Download class="h-4 w-4" />
							<span class="text-lg font-semibold">{formatBytes(metrics.network.bytesIn)}</span>
						</div>
						<p class="text-xs text-muted-foreground">Downloaded</p>
					</div>

					<div class="text-center">
						<div class="flex items-center justify-center gap-2 text-blue-600">
							<Upload class="h-4 w-4" />
							<span class="text-lg font-semibold">{formatBytes(metrics.network.bytesOut)}</span>
						</div>
						<p class="text-xs text-muted-foreground">Uploaded</p>
					</div>

					<div class="text-center">
						<div class="flex items-center justify-center gap-2">
							<span class="text-lg font-semibold">{metrics.network.packetsIn.toLocaleString()}</span
							>
						</div>
						<p class="text-xs text-muted-foreground">Packets In</p>
					</div>

					<div class="text-center">
						<div class="flex items-center justify-center gap-2">
							<span class="text-lg font-semibold"
								>{metrics.network.packetsOut.toLocaleString()}</span
							>
						</div>
						<p class="text-xs text-muted-foreground">Packets Out</p>
					</div>
				</div>
			</CardContent>
		</Card>
	{/if}

	<!-- Process List -->
	{#if processes.length > 0}
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<Activity class="h-4 w-4" />
					Top Processes
				</CardTitle>
			</CardHeader>
			<CardContent class="p-0">
				<ScrollArea class="h-64">
					<div class="space-y-1 p-4">
						{#each processes.slice(0, 10) as process}
							<div
								class="flex items-center justify-between border-b border-gray-100 py-2 last:border-0"
							>
								<div class="flex-1">
									<div class="flex items-center gap-2">
										<span class="text-sm font-medium">{process.name}</span>
										<Badge variant="outline" class="text-xs">
											PID: {process.pid}
										</Badge>
										<Badge
											variant={process.status === 'running' ? 'default' : 'secondary'}
											class="text-xs"
										>
											{process.status}
										</Badge>
									</div>
									<p class="text-xs text-muted-foreground">User: {process.user}</p>
								</div>

								<div class="text-right text-sm">
									<div class="font-medium">CPU: {process.cpu.toFixed(1)}%</div>
									<div class="text-muted-foreground">Mem: {process.memory.toFixed(1)}%</div>
								</div>
							</div>
						{/each}
					</div>
				</ScrollArea>
			</CardContent>
		</Card>
	{/if}

	<!-- Performance Logs -->
	{#if performanceLogs.length > 0}
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<TrendingUp class="h-4 w-4" />
					Performance Events
				</CardTitle>
			</CardHeader>
			<CardContent class="p-0">
				<ScrollArea class="h-64">
					<div class="space-y-1 p-4">
						{#each performanceLogs as log}
							<div
								class="flex items-center justify-between border-b border-gray-100 py-2 last:border-0"
							>
								<div class="flex-1">
									<div class="flex items-center gap-2">
										<span class="text-sm font-medium">{log.event}</span>
										<Badge variant={log.success ? 'default' : 'destructive'} class="text-xs">
											{log.success ? 'Success' : 'Failed'}
										</Badge>
									</div>
									{#if log.details}
										<p class="text-xs text-muted-foreground">{log.details}</p>
									{/if}
								</div>

								<div class="text-right text-sm">
									<div class="flex items-center gap-1 font-medium">
										<Timer class="h-3 w-3" />
										{formatDuration(log.duration)}
									</div>
									<div class="text-xs text-muted-foreground">
										{log.timestamp.toLocaleTimeString()}
									</div>
								</div>
							</div>
						{/each}
					</div>
				</ScrollArea>
			</CardContent>
		</Card>
	{/if}

	{#if loading && !metrics}
		<Card>
			<CardContent class="pt-6">
				<div class="flex items-center justify-center">
					<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
					<span class="ml-2">Loading metrics...</span>
				</div>
			</CardContent>
		</Card>
	{/if}
</div>
