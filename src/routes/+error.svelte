<script lang="ts">
	import { page } from '$app/stores';
	import NotFoundImage from '$lib/assets/404.png?url';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import Icon from '@iconify/svelte';
	import { fade } from 'svelte/transition';

	let status: number;
	let error: any;

	$: status = $page.status;
	$: error = $page.error;
</script>

<svelte:head>
	<title>{status} - Aura IDE</title>
</svelte:head>

<div
	class="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted/20 p-4"
	transition:fade={{ duration: 300 }}
>
	<div
		class="flex w-full max-w-md flex-col items-center space-y-6 rounded-lg bg-popover/50 p-8 text-center"
	>
		{#if status === 404}
			<img
				src={NotFoundImage}
				alt="404 Not Found Illustration"
				class="mx-auto size-52 opacity-80"
			/>
			<p class="text-lg text-muted-foreground">
				The page you're looking for seems to have wandered off. Don't worry, it happens to the best
				of us!
			</p>
		{:else}
			<Alert variant="destructive" class="text-left">
				<Icon icon="mdi:alert-circle" class="h-4 w-4" />
				<AlertTitle>Error Details</AlertTitle>
				<AlertDescription>
					{error?.message || 'An unexpected error occurred. Please try again later.'}
				</AlertDescription>
			</Alert>
		{/if}
		<div class="flex flex-col justify-center gap-3 sm:flex-row">
			<Button variant="outline" onclick={() => window.history.back()}>
				<Icon icon="mdi:arrow-left" class="mr-2 h-4 w-4" />
				Go Back
			</Button>
			<a href="/">
				<Button variant="default">
					<Icon icon="mdi:home" class="mr-2 h-4 w-4" />
					Go Home
				</Button>
			</a>
		</div>
	</div>
</div>
