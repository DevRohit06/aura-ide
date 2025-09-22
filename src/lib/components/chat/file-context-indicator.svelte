<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { fileContext, fileContextStore } from '$lib/stores/file-context.store';
	import { Eye, EyeOff, File } from '@lucide/svelte';
	import FileAttachmentBadge from './file-attachment-badge.svelte';

	let showTooltip = $state(false);

	function toggleFileContext() {
		fileContextStore.toggle();
	}

	function getStatusText(): string {
		if (!$fileContext.file) {
			return 'No file open';
		}

		if ($fileContext.isAttached) {
			return 'File context enabled';
		} else {
			return 'File context disabled';
		}
	}

	function getStatusIcon() {
		if (!$fileContext.file) {
			return File;
		}

		return $fileContext.isAttached ? Eye : EyeOff;
	}
</script>

<div class="file-context-indicator">
	{#if $fileContext.file}
		<!-- Show file attachment badge when file is attached -->
		{#if $fileContext.isAttached}
			<div class="flex items-center gap-2">
				<FileAttachmentBadge variant="compact" />
				<Button
					variant="ghost"
					size="icon"
					class="h-6 w-6 text-muted-foreground hover:text-foreground"
					onclick={toggleFileContext}
					title="Disable file context"
				>
					<Eye size={12} />
				</Button>
			</div>
		{:else}
			<!-- Show enable button when file is open but not attached -->
			<div class="flex items-center gap-2">
				<Badge variant="outline" class="text-xs">
					📄 {$fileContext.file.name}
				</Badge>
				<Button
					variant="ghost"
					size="icon"
					class="h-6 w-6 text-muted-foreground hover:text-green-600"
					onclick={toggleFileContext}
					title="Enable file context for chat"
				>
					<EyeOff size={12} />
				</Button>
			</div>
		{/if}
	{:else}
		<!-- Show hint when no file is open -->
		<div class="flex items-center gap-1 text-xs text-muted-foreground/70">
			<File size={10} />
			Open a file to include context
		</div>
	{/if}
</div>

<style>
	.file-context-indicator {
		display: flex;
		align-items: center;
		min-height: 20px;
	}
</style>
