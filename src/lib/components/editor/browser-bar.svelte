<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import {
		getActivePreviewURL,
		getAllPreviewURLs,
		previewURLStore
	} from '$lib/stores/preview-url.store';
	import {
		ArrowLeft,
		ArrowRight,
		Check,
		ChevronDown,
		Home,
		Lock,
		MoreVertical,
		RefreshCw,
		X
	} from 'lucide-svelte';

	interface Props {
		project?: any;
		onClose?: () => void;
	}

	let { project, onClose }: Props = $props();

	// Get preview URLs from store
	const activePreviewURL = project?.id ? getActivePreviewURL(project.id) : null;
	const allPreviewURLs = project?.id ? getAllPreviewURLs(project.id) : null;

	// Compute initial URL
	let computedInitialUrl = $derived.by(() => {
		return (
			$activePreviewURL?.url || project?.previewUrl || `http://localhost:${project?.port || 3000}`
		);
	});

	// Browser state
	let currentUrl = $state('');
	let urlInputValue = $state('');
	let history = $state<string[]>([]);
	let historyIndex = $state(0);
	let isLoading = $state(false);
	let iframeRef: HTMLIFrameElement | null = $state(null);

	// Initialize URL
	$effect(() => {
		if (computedInitialUrl && currentUrl === '') {
			currentUrl = computedInitialUrl;
			urlInputValue = computedInitialUrl;
			history = [computedInitialUrl];
		}
	});

	// Update when preview URL changes
	$effect(() => {
		if ($activePreviewURL?.url && currentUrl !== $activePreviewURL.url) {
			navigateTo($activePreviewURL.url);
		}
	});

	// Derived states
	let canGoBack = $derived(historyIndex > 0);
	let canGoForward = $derived(historyIndex < history.length - 1);
	let isSecure = $derived(currentUrl.startsWith('https://'));

	// Navigation handlers
	function goBack() {
		if (canGoBack) {
			historyIndex--;
			currentUrl = history[historyIndex];
			urlInputValue = currentUrl;
			loadUrl(currentUrl);
		}
	}

	function goForward() {
		if (canGoForward) {
			historyIndex++;
			currentUrl = history[historyIndex];
			urlInputValue = currentUrl;
			loadUrl(currentUrl);
		}
	}

	function refresh() {
		if (iframeRef) {
			isLoading = true;
			iframeRef.src = currentUrl;
			setTimeout(() => {
				isLoading = false;
			}, 1000);
		}
	}

	function goHome() {
		const homeUrl = $activePreviewURL?.url || `http://localhost:${project?.port || 3000}`;
		navigateTo(homeUrl);
	}

	function handleUrlSelect(value: string) {
		if (value && project?.id) {
			const urlIndex = $allPreviewURLs?.findIndex((u) => u.url === value);
			if (urlIndex !== undefined && urlIndex >= 0) {
				previewURLStore.setActiveURL(project.id, urlIndex);
			}
		}
	}

	function handleUrlSubmit(event: Event) {
		event.preventDefault();
		let url = urlInputValue.trim();

		if (!url) return;

		// Add protocol if missing
		if (!url.startsWith('http://') && !url.startsWith('https://')) {
			// Check if it looks like localhost or IP address
			if (url.startsWith('localhost') || url.match(/^\d+\.\d+\.\d+\.\d+/)) {
				url = 'http://' + url;
			} else if (url.includes(':')) {
				// Has port, assume http
				url = 'http://' + url;
			} else {
				// Assume it's a domain, use https
				url = 'https://' + url;
			}
		}

		navigateTo(url);
	}

	function navigateTo(url: string) {
		console.log('Navigating to:', url);

		// Don't add duplicate URLs to history
		if (currentUrl === url) {
			loadUrl(url);
			return;
		}

		// Add to history
		if (historyIndex < history.length - 1) {
			history = history.slice(0, historyIndex + 1);
		}

		// Don't add if it's the same as the current URL
		if (history[historyIndex] !== url) {
			history.push(url);
			historyIndex = history.length - 1;
		}

		currentUrl = url;
		urlInputValue = url;
		loadUrl(url);
	}

	function loadUrl(url: string) {
		console.log('Loading URL in iframe:', url);
		if (iframeRef) {
			isLoading = true;
			// Force reload by setting src
			iframeRef.src = url;

			// Clear loading state after timeout
			const loadingTimeout = setTimeout(() => {
				isLoading = false;
			}, 2000);

			// Clear on actual load (if it happens before timeout)
			const clearLoading = () => {
				clearTimeout(loadingTimeout);
				isLoading = false;
			};

			iframeRef.addEventListener('load', clearLoading, { once: true });
		}
	}

	function handleIframeLoad() {
		isLoading = false;
		// Try to get the actual URL from iframe (may be blocked by CORS)
		try {
			if (iframeRef?.contentWindow?.location.href) {
				const newUrl = iframeRef.contentWindow.location.href;
				if (newUrl !== 'about:blank' && newUrl !== currentUrl) {
					currentUrl = newUrl;
					urlInputValue = newUrl;
				}
			}
		} catch (e) {
			// CORS restriction, keep current URL
		}
	}

	function handleUrlFocus(event: FocusEvent) {
		const input = event.target as HTMLInputElement;
		input.select();
	}
</script>

<div class="flex h-full flex-col bg-background">
	<!-- Browser Controls Bar -->
	<div class="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
		<!-- Navigation Controls -->
		<div class="flex items-center gap-1">
			<Tooltip.Provider>
				<Tooltip.Root>
					<Tooltip.Trigger>
						<Button
							variant="ghost"
							size="sm"
							class="h-8 w-8 p-0"
							disabled={!canGoBack}
							onclick={goBack}
						>
							<ArrowLeft class="h-4 w-4" />
						</Button>
					</Tooltip.Trigger>
					<Tooltip.Content>
						<p>Back</p>
					</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>

			<Tooltip.Provider>
				<Tooltip.Root>
					<Tooltip.Trigger>
						<Button
							variant="ghost"
							size="sm"
							class="h-8 w-8 p-0"
							disabled={!canGoForward}
							onclick={goForward}
						>
							<ArrowRight class="h-4 w-4" />
						</Button>
					</Tooltip.Trigger>
					<Tooltip.Content>
						<p>Forward</p>
					</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>

			<Tooltip.Provider>
				<Tooltip.Root>
					<Tooltip.Trigger>
						<Button
							variant="ghost"
							size="sm"
							class="h-8 w-8 p-0"
							onclick={refresh}
							disabled={isLoading}
						>
							<RefreshCw class={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
						</Button>
					</Tooltip.Trigger>
					<Tooltip.Content>
						<p>Refresh</p>
					</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>

			<Tooltip.Provider>
				<Tooltip.Root>
					<Tooltip.Trigger>
						<Button variant="ghost" size="sm" class="h-8 w-8 p-0" onclick={goHome}>
							<Home class="h-4 w-4" />
						</Button>
					</Tooltip.Trigger>
					<Tooltip.Content>
						<p>Home</p>
					</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>
		</div>

		<!-- URL Selector (if multiple URLs available) -->
		{#if $allPreviewURLs && $allPreviewURLs.length > 1}
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					<Button variant="outline" size="sm" class="h-8 gap-1 text-xs">
						<span class="max-w-[120px] truncate">
							{$activePreviewURL?.label || 'Select URL'}
						</span>
						<ChevronDown class="h-3 w-3 opacity-50" />
					</Button>
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="start" class="w-56">
					<DropdownMenu.Label>Preview URLs</DropdownMenu.Label>
					<DropdownMenu.Separator />
					{#each $allPreviewURLs as previewUrl}
						<DropdownMenu.Item
							onclick={() => handleUrlSelect(previewUrl.url)}
							class="flex items-center justify-between"
						>
							<div class="flex flex-col items-start gap-0.5">
								<span class="text-xs font-medium"
									>{previewUrl.label || `Port ${previewUrl.port}`}</span
								>
								<span class="text-[10px] text-muted-foreground">{previewUrl.url}</span>
							</div>
							{#if $activePreviewURL?.url === previewUrl.url}
								<Check class="h-3 w-3" />
							{/if}
						</DropdownMenu.Item>
					{/each}
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		{/if}

		<!-- Address Bar -->
		<form onsubmit={handleUrlSubmit} class="flex flex-1 items-center gap-2">
			<div
				class="flex flex-1 items-center gap-2 rounded-md border bg-background px-3 py-1.5 focus-within:ring-2 focus-within:ring-ring"
			>
				{#if isSecure}
					<Lock class="h-3.5 w-3.5 text-green-600" />
				{:else}
					<div class="h-3.5 w-3.5"></div>
				{/if}
				<input
					type="text"
					bind:value={urlInputValue}
					onfocus={handleUrlFocus}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							handleUrlSubmit(e);
						}
					}}
					placeholder="Enter URL or localhost:3000"
					class="h-6 flex-1 border-none bg-transparent p-0 text-sm outline-none focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
				/>
			</div>
		</form>

		<!-- Browser Menu -->
		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger>
					<Button variant="ghost" size="sm" class="h-8 w-8 p-0">
						<MoreVertical class="h-4 w-4" />
					</Button>
				</Tooltip.Trigger>
				<Tooltip.Content>
					<p>More options</p>
				</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>

		<!-- Close Button -->
		{#if onClose}
			<Tooltip.Provider>
				<Tooltip.Root>
					<Tooltip.Trigger>
						<Button variant="ghost" size="sm" class="h-8 w-8 p-0" onclick={onClose}>
							<X class="h-4 w-4" />
						</Button>
					</Tooltip.Trigger>
					<Tooltip.Content>
						<p>Close browser</p>
					</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>
		{/if}
	</div>

	<!-- Browser Content -->
	<div class="relative flex-1 overflow-hidden bg-white">
		{#if isLoading}
			<div
				class="absolute top-0 left-0 z-10 h-1 w-full overflow-hidden bg-transparent"
				role="progressbar"
			>
				<div class="h-full w-1/3 animate-pulse bg-primary"></div>
			</div>
		{/if}

		<!-- Cookie/Security Warning Banner -->
		<!-- {#if currentUrl.includes('daytona')}
			<div
				class="absolute top-0 right-0 left-0 z-20 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800"
			>
				<div class="flex items-center gap-2">
					<svg class="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
							clip-rule="evenodd"
						></path>
					</svg>
					<span
						>If you see a security warning, click <strong>"Accept"</strong> in the preview to enable
						access.</span
					>
				</div>
			</div>
		{/if} -->

		<iframe
			bind:this={iframeRef}
			src={currentUrl}
			onload={handleIframeLoad}
			title="Browser Preview"
			class="h-full w-full border-none"
			sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation allow-top-navigation-by-user-activation allow-downloads allow-pointer-lock allow-storage-access-by-user-activation"
			allow="storage-access *"
		></iframe>
	</div>
</div>

<style>
	@keyframes progress {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(400%);
		}
	}

	.animate-pulse {
		animation: progress 1.5s ease-in-out infinite;
	}
</style>
