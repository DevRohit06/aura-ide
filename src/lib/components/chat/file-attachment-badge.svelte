<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { fileContext, fileContextStore, getHumanFileSize } from '$lib/stores/file-context.store';
	import Icon from '@iconify/svelte';
	import { Paperclip, X } from '@lucide/svelte';
	import { getFileIcon } from '../editor';

	interface Props {
		variant?: 'default' | 'compact' | 'detailed';
		showDetach?: boolean;
		class?: string;
	}

	let { variant = 'default', showDetach = true, class: className = '' }: Props = $props();

	function handleDetach() {
		fileContextStore.disable();
	}
</script>

{#if $fileContext.isAttached && $fileContext.file}
	{@const file = $fileContext.file}
	{@const icon = getFileIcon(file.name)}

	<div class="file-attachment-badge {className}">
		{#if variant === 'compact'}
			<!-- Compact badge - just icon and filename -->
			<Badge variant="secondary" class="flex items-center gap-1.5 ">
				<Icon {icon} class="text-sm" />
				<span class="max-w-20 truncate text-xs font-medium">{file.name}</span>
				{#if showDetach}
					<button
						onclick={handleDetach}
						class="ml-1 rounded-sm p-0.5 transition-colors hover:bg-black/10"
						title="Detach file"
					>
						<X size={10} />
					</button>
				{/if}
			</Badge>
		{:else if variant === 'detailed'}
			<!-- Detailed badge - with more info -->
			<div class="flex items-center gap-2 rounded-lg border p-3">
				<div class="flex min-w-0 flex-1 items-center gap-2">
					<Paperclip size={14} class="shrink-0 text-muted-foreground" />
					<div class="flex min-w-0 flex-1 items-center gap-1.5">
						<span class="text-base">{icon}</span>
						<div class="min-w-0 flex-1">
							<div class="truncate text-sm font-medium">{file.name}</div>
							<div class="truncate text-xs text-muted-foreground">
								{file.path} • {file.language}
								{#if file.size}
									• {getHumanFileSize(file.size)}
								{/if}
							</div>
						</div>
					</div>
				</div>
				{#if showDetach}
					<Button
						variant="ghost"
						size="icon"
						class="h-6 w-6"
						onclick={handleDetach}
						title="Detach file from chat"
					>
						<X size={12} />
					</Button>
				{/if}
			</div>
		{:else}
			<!-- Default badge -->
			<Badge class="flex items-center gap-1.5 ">
				<Paperclip size={12} />
				<span class="text-sm">{icon}</span>
				<span class="text-xs font-medium">{file.name}</span>
				{#if showDetach}
					<button
						onclick={handleDetach}
						class="ml-1 rounded-sm p-0.5 transition-colors hover:bg-black/10"
						title="Detach file"
					>
						<X size={10} />
					</button>
				{/if}
			</Badge>
		{/if}
	</div>
{/if}

<style>
	.file-attachment-badge {
		display: inline-flex;
		align-items: center;
	}
</style>
