<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';
</script>

<div class="flex h-full flex-col bg-background">
	<!-- Editor Header Skeleton -->
	<div class="flex items-center gap-2 border-b px-4 py-2">
		<Skeleton class="h-4 w-20" />
		<Skeleton class="h-4 w-1 bg-border" />
		<Skeleton class="h-4 w-32" />
		<div class="ml-auto">
			<Skeleton class="h-4 w-16" />
		</div>
	</div>

	<!-- Line Numbers and Content Skeleton -->
	<div class="flex flex-1 overflow-hidden">
		<!-- Line numbers -->
		<div class="flex flex-col gap-2 border-r bg-muted/20 p-4 pt-6">
			{#each Array(20) as _, i}
				<Skeleton class="h-4 w-6" />
			{/each}
		</div>

		<!-- Editor content -->
		<div class="flex flex-1 flex-col gap-2 p-4 pt-6">
			{#each Array(20) as _, i}
				<div class="flex gap-2">
					<!-- Indentation -->
					{#if i % 4 === 0}
						<Skeleton class="h-4 w-4" />
					{:else if i % 3 === 0}
						<Skeleton class="h-4 w-8" />
					{:else}
						<Skeleton class="h-4 w-12" />
					{/if}

					<!-- Code content -->
					<Skeleton class="h-4 max-w-md flex-1" />
				</div>
			{/each}
		</div>
	</div>
</div>
