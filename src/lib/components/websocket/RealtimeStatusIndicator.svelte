<!--
  RealtimeStatusIndicator.svelte
  Shows real-time connection status and activity
-->
<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Activity, RefreshCw, Wifi, WifiOff } from 'lucide-svelte';
	import { getContext } from 'svelte';

	interface Props {
		showDetails?: boolean;
		position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
		size?: 'sm' | 'md' | 'lg';
	}

	let { showDetails = false, position = 'top-right', size = 'md' }: Props = $props();

	// Get WebSocket context
	const websocketContext = getContext('websocket') as any;
	const { state, connectionStatus, connect, disconnect } = websocketContext || {};

	// Activity indicator
	let lastActivity = $state<Date | null>(null);
	let showActivity = $state(false);

	// Update last activity when messages are received
	$effect(() => {
		if ($state?.lastMessage) {
			lastActivity = new Date();
			showActivity = true;

			// Hide activity indicator after 3 seconds
			setTimeout(() => {
				showActivity = false;
			}, 3000);
		}
	});

	// Position classes
	const positionClasses = {
		'top-left': 'top-4 left-4',
		'top-right': 'top-4 right-4',
		'bottom-left': 'bottom-4 left-4',
		'bottom-right': 'bottom-4 right-4'
	};

	// Size classes
	const sizeClasses = {
		sm: 'text-xs',
		md: 'text-sm',
		lg: 'text-base'
	};

	// Connection state
	let isConnected = $derived($state?.connected || false);
	let isConnecting = $derived($state?.connecting || false);
	let connectionError = $derived($state?.error);
	let connectionId = $derived($state?.connectionId);

	// Handle reconnect
	async function handleReconnect() {
		try {
			await connect?.();
		} catch (error) {
			console.error('Reconnection failed:', error);
		}
	}

	// Format time ago
	function formatTimeAgo(date: Date): string {
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffSecs = Math.floor(diffMs / 1000);
		const diffMins = Math.floor(diffSecs / 60);
		const diffHours = Math.floor(diffMins / 60);

		if (diffSecs < 60) {
			return `${diffSecs}s ago`;
		} else if (diffMins < 60) {
			return `${diffMins}m ago`;
		} else {
			return `${diffHours}h ago`;
		}
	}
</script>

{#if websocketContext}
	<div class="fixed {positionClasses[position]} z-50 {sizeClasses[size]}">
		{#if isConnecting}
			<!-- Connecting State -->
			<Badge variant="secondary" class="flex animate-pulse items-center gap-2">
				<RefreshCw class="h-3 w-3 animate-spin" />
				Connecting...
			</Badge>
		{:else if connectionError}
			<!-- Error State -->
			<div class="flex items-center gap-2">
				<Badge variant="destructive" class="flex items-center gap-2">
					<WifiOff class="h-3 w-3" />
					Offline
				</Badge>
				{#if showDetails}
					<Button size="sm" variant="outline" onclick={handleReconnect}>
						<RefreshCw class="h-3 w-3" />
						Retry
					</Button>
				{/if}
			</div>
		{:else if isConnected}
			<!-- Connected State -->
			<div class="flex items-center gap-2">
				<Badge variant="default" class="flex items-center gap-2 bg-green-600 hover:bg-green-700">
					<Wifi class="h-3 w-3" />
					{showActivity ? 'Active' : 'Connected'}
					{#if showActivity}
						<Activity class="h-3 w-3 animate-pulse" />
					{/if}
				</Badge>

				{#if showDetails}
					<div class="rounded-lg border bg-white p-2 text-xs shadow-lg">
						<div class="space-y-1">
							<div class="flex justify-between">
								<span class="text-muted-foreground">Status:</span>
								<span class="font-medium text-green-600">Connected</span>
							</div>
							{#if connectionId}
								<div class="flex justify-between">
									<span class="text-muted-foreground">ID:</span>
									<span class="font-mono">{connectionId.slice(0, 8)}...</span>
								</div>
							{/if}
							{#if lastActivity}
								<div class="flex justify-between">
									<span class="text-muted-foreground">Last Activity:</span>
									<span>{formatTimeAgo(lastActivity)}</span>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		{:else}
			<!-- Disconnected State -->
			<Badge variant="outline" class="flex items-center gap-2 text-muted-foreground">
				<WifiOff class="h-3 w-3" />
				Disconnected
			</Badge>
		{/if}
	</div>
{/if}
