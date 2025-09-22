<script lang="ts">
	interface MessageType {
		id: string;
		content: string;
		role: 'user' | 'assistant';
		timestamp: Date;
		isLoading?: boolean;
	}

	interface Props {
		message: MessageType;
		isLast?: boolean;
	}

	let { message, isLast = false }: Props = $props();

	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { Badge } from '$lib/components/ui/badge';

	function formatTime(date: Date): string {
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}
</script>

<div class="flex gap-3 p-4 {message.role === 'user' ? 'bg-muted/20' : ''} {isLast ? 'mb-4' : ''}">
	<Avatar class="h-8 w-8 shrink-0">
		<AvatarFallback class="text-xs">
			{message.role === 'user' ? 'U' : 'AI'}
		</AvatarFallback>
	</Avatar>

	<div class="flex-1 space-y-2">
		<div class="flex items-center gap-2">
			<Badge variant={message.role === 'user' ? 'default' : 'secondary'} class="text-xs">
				{message.role === 'user' ? 'You' : 'Assistant'}
			</Badge>
			<span class="text-xs text-muted-foreground">
				{formatTime(message.timestamp)}
			</span>
		</div>

		<div class="prose prose-sm dark:prose-invert max-w-none">
			{#if message.isLoading}
				<div class="flex items-center gap-2">
					<div class="flex space-x-1">
						<div
							class="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.3s]"
						></div>
						<div
							class="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.15s]"
						></div>
						<div class="h-2 w-2 animate-bounce rounded-full bg-current"></div>
					</div>
					<span class="text-xs text-muted-foreground">Thinking...</span>
				</div>
			{:else}
				<p class="text-sm leading-relaxed whitespace-pre-wrap">
					{message.content}
				</p>
			{/if}
		</div>
	</div>
</div>
