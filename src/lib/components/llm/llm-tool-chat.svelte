<script lang="ts">
	import ToolCallDisplay from '$lib/components/chat/tool-call-display.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger,
		SelectValue
	} from '$lib/components/ui/select/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import type { ChatMessage } from '$lib/services/llm-tool-agent.service.js';
	import { LLM_PROVIDERS } from '$lib/types/llm.types.js';
	import { Bot, Send, Settings, User } from 'lucide-svelte';

	interface LLMToolAgentResponse {
		success: boolean;
		content: string;
		toolCalls: any[];
		messages: ChatMessage[];
		usage?: {
			promptTokens: number;
			completionTokens: number;
			totalTokens: number;
		};
		error?: string;
	}

	// Reactive state
	let messages = $state<ChatMessage[]>([]);
	let currentMessage = $state('');
	let isLoading = $state(false);
	let showSettings = $state(false);

	// Configuration
	let model = $state('gpt-4');
	let provider = $state('openai');
	let temperature = $state(0.1);
	let maxTokens = $state(4096);
	let maxToolIterations = $state(3);
	let systemPrompt =
		$state(`You are an AI assistant with access to file editing tools. You can help users:

- Read, create, edit, and delete files
- Analyze and improve code
- Manage project structure
- Assist with development tasks

Use tools when appropriate to help complete user requests.`);

	// Context
	let projectId = $state('');
	let sandboxId = $state('');

	/**
	 * Send message to LLM with tool calling
	 */
	async function sendMessage() {
		if (!currentMessage.trim() || isLoading) return;

		const userMessage: ChatMessage = {
			role: 'user',
			content: currentMessage.trim()
		};

		// Add user message to conversation
		messages = [...messages, userMessage];
		const messageToSend = currentMessage;
		currentMessage = '';
		isLoading = true;

		try {
			const response = await fetch('/api/llm/tool-agent', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					messages: [...messages],
					model,
					provider,
					temperature,
					maxTokens,
					maxToolIterations,
					systemPrompt,
					projectId: projectId || undefined,
					sandboxId: sandboxId || undefined
				})
			});

			if (!response.ok) {
				throw new Error(`API request failed: ${response.statusText}`);
			}

			const data: LLMToolAgentResponse = await response.json();

			if (data.success) {
				// Update messages with the complete conversation
				messages = data.messages.filter((m) => m.role !== 'system');

				// Add assistant response if not already included
				const lastMessage = messages[messages.length - 1];
				if (!lastMessage || lastMessage.role !== 'assistant') {
					messages = [
						...messages,
						{
							role: 'assistant',
							content: data.content
						}
					];
				}
			} else {
				// Add error message
				messages = [
					...messages,
					{
						role: 'assistant',
						content: data.error || 'Sorry, I encountered an error processing your request.'
					}
				];
			}
		} catch (error) {
			console.error('Failed to send message:', error);
			messages = [
				...messages,
				{
					role: 'assistant',
					content: 'Sorry, I encountered an error sending your message. Please try again.'
				}
			];
		} finally {
			isLoading = false;
		}
	}

	/**
	 * Handle Enter key in textarea
	 */
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendMessage();
		}
	}

	/**
	 * Clear conversation
	 */
	function clearConversation() {
		messages = [];
	}

	/**
	 * Get available models for selected provider
	 */
	function getModelsForProvider(providerKey: string) {
		return LLM_PROVIDERS[providerKey]?.models || [];
	}

	// Auto-scroll to bottom when messages change
	let messagesContainer: HTMLElement;
	$effect(() => {
		if (messagesContainer && messages.length) {
			setTimeout(() => {
				messagesContainer.scrollTop = messagesContainer.scrollHeight;
			}, 100);
		}
	});
</script>

;

<div class="flex h-full flex-col gap-4">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">LLM Tool Agent</h1>
		<div class="flex items-center gap-2">
			<Button variant="outline" size="sm" onclick={() => (showSettings = !showSettings)}>
				<Settings class="h-4 w-4" />
				Settings
			</Button>
			<Button variant="outline" size="sm" onclick={clearConversation}>Clear</Button>
		</div>
	</div>

	<!-- Settings Panel -->
	{#if showSettings}
		<Card class="mb-4">
			<CardHeader>
				<CardTitle>Configuration</CardTitle>
			</CardHeader>
			<CardContent class="space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<div>
						<Label for="provider">Provider</Label>
						<Select bind:value={provider}>
							<SelectTrigger>
								<SelectValue placeholder="Select provider" />
							</SelectTrigger>
							<SelectContent>
								{#each Object.entries(LLM_PROVIDERS) as [key, p]}
									<SelectItem value={key}>{p.displayName}</SelectItem>
								{/each}
							</SelectContent>
						</Select>
					</div>
					<div>
						<Label for="model">Model</Label>
						<Select bind:value={model}>
							<SelectTrigger>
								<SelectValue placeholder="Select model" />
							</SelectTrigger>
							<SelectContent>
								{#each getModelsForProvider(provider) as modelOption}
									<SelectItem value={modelOption.id}>{modelOption.name}</SelectItem>
								{/each}
							</SelectContent>
						</Select>
					</div>
				</div>

				<div class="grid grid-cols-3 gap-4">
					<div>
						<Label for="temperature">Temperature: {temperature}</Label>
						<input
							type="range"
							min="0"
							max="2"
							step="0.1"
							bind:value={temperature}
							class="w-full"
						/>
					</div>
					<div>
						<Label for="maxTokens">Max Tokens</Label>
						<Input type="number" bind:value={maxTokens} min="100" max="8192" />
					</div>
					<div>
						<Label for="maxIterations">Max Tool Iterations</Label>
						<Input type="number" bind:value={maxToolIterations} min="1" max="10" />
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<Label for="projectId">Project ID (optional)</Label>
						<Input bind:value={projectId} placeholder="project-123" />
					</div>
					<div>
						<Label for="sandboxId">Sandbox ID (optional)</Label>
						<Input bind:value={sandboxId} placeholder="sandbox-456" />
					</div>
				</div>

				<div>
					<Label for="systemPrompt">System Prompt</Label>
					<Textarea bind:value={systemPrompt} placeholder="System prompt for the AI..." rows={4} />
				</div>
			</CardContent>
		</Card>
	{/if}

	<!-- Chat Container -->
	<div class="flex flex-1 flex-col gap-4 overflow-hidden">
		<!-- Messages -->
		<ScrollArea bind:element={messagesContainer} class="flex-1 pr-4">
			<div class="space-y-4">
				{#each messages as message}
					<div class="flex items-start gap-3">
						<div class="flex-shrink-0">
							{#if message.role === 'user'}
								<div
									class="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900"
								>
									<User class="h-4 w-4 text-blue-600 dark:text-blue-300" />
								</div>
							{:else}
								<div
									class="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900"
								>
									<Bot class="h-4 w-4 text-green-600 dark:text-green-300" />
								</div>
							{/if}
						</div>
						<div class="flex-1 space-y-2">
							<div class="rounded-lg bg-muted p-3">
								<p class="text-sm whitespace-pre-wrap">{message.content}</p>
							</div>

							<!-- Show tool calls if present -->
							{#if message.toolCalls && message.toolCalls.length > 0}
								<div class="space-y-2">
									{#each message.toolCalls as toolCall}
										<Badge variant="secondary" class="text-xs">
											Tool: {toolCall.function.name}
										</Badge>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				{/each}

				{#if isLoading}
					<div class="flex items-start gap-3">
						<div
							class="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900"
						>
							<Bot class="h-4 w-4 text-green-600 dark:text-green-300" />
						</div>
						<div class="flex-1">
							<div class="rounded-lg bg-muted p-3">
								<div class="flex items-center gap-2">
									<div class="h-2 w-2 animate-pulse rounded-full bg-current" />
									<div
										class="h-2 w-2 animate-pulse rounded-full bg-current"
										style="animation-delay: 0.1s"
									/>
									<div
										class="h-2 w-2 animate-pulse rounded-full bg-current"
										style="animation-delay: 0.2s"
									/>
									<span class="text-sm text-muted-foreground">Thinking...</span>
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</ScrollArea>

		<!-- Tool Call Display -->
		<ToolCallDisplay />

		<!-- Input Area -->
		<div class="flex gap-2">
			<Textarea
				bind:value={currentMessage}
				placeholder="Type your message... (Shift+Enter for new line)"
				onkeydown={handleKeydown}
				rows={3}
				class="flex-1 resize-none"
			/>
			<Button
				onclick={sendMessage}
				disabled={!currentMessage.trim() || isLoading}
				size="lg"
				class="h-auto px-6"
			>
				<Send class="h-4 w-4" />
			</Button>
		</div>
	</div>
</div>
