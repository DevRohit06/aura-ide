<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';
</script>

<div class="bg-terminal-bg text-terminal-fg flex h-full flex-col border-t">
	<!-- Terminal Header -->
	<div class="border-terminal-border flex items-center gap-2 border-b px-3 py-2">
		<div class="flex gap-1">
			<Skeleton class="h-3 w-3 rounded-full bg-red-500/50" />
			<Skeleton class="h-3 w-3 rounded-full bg-yellow-500/50" />
			<Skeleton class="h-3 w-3 rounded-full bg-green-500/50" />
		</div>
		<Skeleton class="ml-2 h-4 w-20" />
		<div class="ml-auto">
			<Skeleton class="h-4 w-4" />
		</div>
	</div>

	<!-- Terminal Content -->
	<div class="flex-1 p-3 font-mono text-sm">
		<div class="flex flex-col gap-1">
			<!-- Welcome message -->
			<div class="flex gap-2">
				<Skeleton class="h-4 w-4 bg-green-500/30" />
				<Skeleton class="h-4 w-48" />
			</div>

			<!-- Prompt lines -->
			{#each Array(5) as _, i}
				<div class="mt-2 flex gap-2">
					<Skeleton class="h-4 w-8 bg-blue-500/30" />
					<Skeleton class="h-4 w-32" />
				</div>
			{/each}

			<!-- Current prompt -->
			<div class="mt-3 flex gap-2">
				<Skeleton class="h-4 w-8 bg-blue-500/30" />
				<Skeleton class="h-4 w-2 animate-pulse bg-white/50" />
			</div>
		</div>
	</div>
</div>

<style>
	:global(.bg-terminal-bg) {
		background-color: rgb(30, 30, 30);
	}
	:global(.text-terminal-fg) {
		color: rgb(229, 229, 229);
	}
	:global(.border-terminal-border) {
		border-color: rgb(64, 64, 64);
	}
</style>
