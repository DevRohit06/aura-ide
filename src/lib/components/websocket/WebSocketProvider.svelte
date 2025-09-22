<!--
  WebSocketProvider.svelte
  Global WebSocket provider component for real-time features
-->
<script lang="ts">
	import { useWebSocket } from '$lib/hooks/useWebSocket';
	import { webSocketService } from '$lib/services/websocket.service';
	import { onDestroy, onMount, setContext } from 'svelte';
	import { writable } from 'svelte/store';

	interface Props {
		autoConnect?: boolean;
		authToken?: string;
		children: import('svelte').Snippet;
	}

	let { autoConnect = true, authToken, children }: Props = $props();

	// Global WebSocket state
	const { state, connect, disconnect, send, subscribe } = useWebSocket();

	// Connection status store
	const connectionStatus = writable({
		isConnected: false,
		isConnecting: false,
		error: null as string | null,
		reconnectAttempts: 0
	});

	// Provide WebSocket context to child components
	setContext('websocket', {
		state,
		connectionStatus,
		connect,
		disconnect,
		send,
		subscribe,
		service: webSocketService
	});

	// Auto-connect on mount if enabled
	onMount(async () => {
		if (autoConnect) {
			await handleConnect();
		}

		// Listen to connection state changes
		const unsubscribe = state.subscribe(($state) => {
			connectionStatus.update((status) => ({
				...status,
				isConnected: $state.connected,
				isConnecting: $state.connecting,
				error: $state.error
			}));
		});

		return () => {
			unsubscribe();
		};
	});

	// Cleanup on destroy
	onDestroy(() => {
		disconnect();
	});

	// Handle connection
	async function handleConnect() {
		try {
			await connect(authToken);
		} catch (error) {
			console.error('Failed to connect to WebSocket:', error);
		}
	}

	// Handle reconnection
	async function handleReconnect() {
		connectionStatus.update((status) => ({
			...status,
			reconnectAttempts: status.reconnectAttempts + 1
		}));

		await handleConnect();
	}

	// Connection state derived from store
	let isConnected = $derived($state.connected);
	let isConnecting = $derived($state.connecting);
	let connectionError = $derived($state.error);
</script>

<!-- Connection Status Indicator (optional visual feedback) -->
{#if isConnecting}
	<div class="fixed top-4 right-4 z-50 rounded-lg border border-blue-300 bg-blue-100 p-3 shadow-lg">
		<div class="flex items-center gap-2">
			<div class="h-4 w-4 animate-spin rounded-full border-b-2 border-blue-600"></div>
			<span class="text-sm text-blue-800">Connecting to real-time services...</span>
		</div>
	</div>
{:else if connectionError}
	<div class="fixed top-4 right-4 z-50 rounded-lg border border-red-300 bg-red-100 p-3 shadow-lg">
		<div class="flex items-center justify-between gap-3">
			<div class="flex items-center gap-2">
				<svg class="h-4 w-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
					<path
						fill-rule="evenodd"
						d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
						clip-rule="evenodd"
					></path>
				</svg>
				<span class="text-sm text-red-800">Connection failed: {connectionError}</span>
			</div>
			<button
				onclick={handleReconnect}
				class="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
			>
				Retry
			</button>
		</div>
	</div>
{:else if isConnected}
	<div
		class="fixed top-4 right-4 z-50 animate-pulse rounded-lg border border-green-300 bg-green-100 p-3 shadow-lg"
	>
		<div class="flex items-center gap-2">
			<div class="h-2 w-2 rounded-full bg-green-600"></div>
			<span class="text-sm text-green-800">Real-time services connected</span>
		</div>
	</div>
{/if}

<!-- Render children with WebSocket context -->
{@render children()}

<style>
	/* Auto-hide connection status after a few seconds for successful connections */
	.animate-pulse {
		animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) 3;
	}
</style>
