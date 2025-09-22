<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { LLM_PROVIDERS } from '$lib/types/llm.types';
	import { Check, ChevronDown } from 'lucide-svelte';

	let {
		value = $bindable(),
		onValueChange,
		placeholder = 'Select model...'
	}: {
		value?: string;
		onValueChange?: (value: string) => void;
		placeholder?: string;
	} = $props();

	let open = $state(false);

	// Find the selected model
	const selectedModel = $derived.by(() => {
		if (!value) return null;
		return Object.values(LLM_PROVIDERS)
			.flatMap((p) => p.models)
			.find((m) => m.id === value);
	});

	// Get all models grouped by provider
	const providerGroups = $derived(Object.values(LLM_PROVIDERS));

	function selectModel(modelId: string) {
		value = modelId;
		onValueChange?.(modelId);
		open = false;
	}

	// Get display name for selected model
	const displayName = $derived.by(() => {
		if (!selectedModel) return placeholder;
		// For Claude models, show just the model name without "Claude"
		if (selectedModel.name.includes('Claude')) {
			return selectedModel.name.replace('Claude ', '');
		}
		return selectedModel.name;
	});
</script>

<DropdownMenu.Root bind:open>
	<DropdownMenu.Trigger
		class="flex cursor-pointer items-center gap-1 text-sm font-medium text-foreground transition-colors hover:text-primary"
	>
		<span>{displayName}</span>
		<ChevronDown class="h-3 w-3 text-muted-foreground" />
	</DropdownMenu.Trigger>

	<DropdownMenu.Content class="w-[300px] p-1" align="start">
		{#each providerGroups as provider (provider.name)}
			<div class="px-2 py-1">
				<div class="mb-1 text-xs font-medium text-muted-foreground">
					{provider.displayName}
				</div>
				{#each provider.models as model (model.id)}
					<DropdownMenu.Item
						class="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-muted"
						onclick={() => selectModel(model.id)}
					>
						<span class="truncate">{model.name}</span>
						{#if value === model.id}
							<Check class="h-3 w-3 text-primary" />
						{/if}
					</DropdownMenu.Item>
				{/each}
			</div>
			{#if provider !== providerGroups[providerGroups.length - 1]}
				<div class="my-1 h-px bg-border"></div>
			{/if}
		{/each}
	</DropdownMenu.Content>
</DropdownMenu.Root>
