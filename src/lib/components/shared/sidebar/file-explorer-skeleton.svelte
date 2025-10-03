<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
</script>

<div class="flex h-full flex-col">
	<!-- Explorer Header -->

	<!-- File Tree Loading Skeleton -->
	<div class="flex-1 space-y-1 overflow-y-auto p-2">
		<!-- Root folder items -->
		{#each Array(8) as _, i}
			<div
				class="flex items-center gap-2 px-2 py-1"
				style="margin-left: {Math.floor(Math.random() * 3) * 16}px;"
			>
				<Skeleton class="h-4 w-4 rounded-sm" />
				<Skeleton class="h-4 flex-1" style="width: {60 + Math.random() * 40}%;" />
			</div>
		{/each}

		<!-- Nested items -->
		{#each Array(6) as _, i}
			<div
				class="flex items-center gap-2 px-2 py-1"
				style="margin-left: {(1 + Math.floor(Math.random() * 2)) * 16}px;"
			>
				<Skeleton class="h-4 w-4 rounded-sm" />
				<Skeleton class="h-4 flex-1" style="width: {40 + Math.random() * 50}%;" />
			</div>
		{/each}

		<!-- More deeply nested items -->
		{#each Array(4) as _, i}
			<div
				class="flex items-center gap-2 px-2 py-1"
				style="margin-left: {(2 + Math.floor(Math.random() * 2)) * 16}px;"
			>
				<Skeleton class="h-4 w-4 rounded-sm" />
				<Skeleton class="h-4 flex-1" style="width: {30 + Math.random() * 40}%;" />
			</div>
		{/each}
	</div>

	<!-- Loading indicator at bottom -->
	<div class="border-t border-border p-3">
		<div class="flex items-center gap-2 text-xs text-muted-foreground">
			<div
				class="h-3 w-3 animate-spin rounded-full border border-muted-foreground border-t-transparent"
			></div>
			<span>Loading project files...</span>
		</div>
	</div>
</div>
