<script lang="ts">
	interface MessageType {
		id: string;
		content: string;
		role: 'user' | 'assistant';
		timestamp: Date;
		isLoading?: boolean;
		fileContext?: {
			fileName?: string;
			filePath?: string;
			language?: string;
		};
	}

	interface Props {
		message: MessageType;
		isLast?: boolean;
	}

	let { message, isLast = false }: Props = $props();

	import { Avatar, AvatarFallback } from '$lib/components/ui/avatar';
	import { Badge } from '$lib/components/ui/badge';
	import Icon from '@iconify/svelte';
	import { getFileIcon } from '../editor';
	import Markdown from './markdown.svelte';

	function formatTime(date: Date): string {
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	// Parse markdown content using marked lexer tokens
</script>

<div
	class="flex flex-col gap-3 p-4 {message.role === 'user' ? 'bg-muted/20' : ''} {isLast
		? 'mb-4'
		: ''}"
>
	<div class="flex-1 space-y-2">
		<div class="flex items-center gap-2">
			<Avatar class="h-8 w-8 shrink-0">
				<AvatarFallback class="text-xs">
					{message.role === 'user' ? 'U' : 'AI'}
				</AvatarFallback>
			</Avatar>
			<Badge variant={message.role === 'user' ? 'default' : 'secondary'} class="text-xs">
				{message.role === 'user' ? 'You' : 'Assistant'}
			</Badge>

			<!-- Show file context badge for user messages -->
			{#if message.role === 'user' && message.fileContext?.fileName}
				<Badge variant="outline" class="flex items-center gap-1 text-xs">
					<Icon icon={getFileIcon(message.fileContext.fileName)} class="h-3 w-3" />
					<span>{message.fileContext.fileName}</span>
				</Badge>
			{/if}

			<span class="text-xs text-muted-foreground">
				{formatTime(message.timestamp)}
			</span>
		</div>
	</div>
	<div class="">
		{#if message.isLoading}
			<div class="flex items-center gap-2">
				<div class="flex space-x-1">
					<div class="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.3s]"></div>
					<div
						class="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.15s]"
					></div>
					<div class="h-2 w-2 animate-bounce rounded-full bg-current"></div>
				</div>
				<span class="text-xs text-muted-foreground">Thinking...</span>
			</div>
		{:else}
			<div class="space-y-4 text-sm leading-relaxed">
				<Markdown content={message.content} messageId={message.id} />
			</div>
		{/if}
	</div>
</div>
