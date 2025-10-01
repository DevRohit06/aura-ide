<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import modelCatalog from '$lib/data/models.json';
	import { Check, ChevronDown } from 'lucide-svelte';
	import { createEventDispatcher } from 'svelte';

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
	// Compact selector search/filter value (used to clear after selection)
	let searchValue = $state('');

	// Build provider groups from static catalog
	const providerGroups = $derived.by(() => {
		const catalogModels = (modelCatalog as any)?.data?.models || [];
		// Only display these providers for now
		const allowedProviders = new Set(['openrouter', 'anthropic', 'openai', 'groq']);
		const groups: Record<string, any> = {};
		for (const entry of catalogModels) {
			if (!entry.endpoints || !Array.isArray(entry.endpoints)) continue;
			for (const ep of entry.endpoints) {
				const providerKey = ep.providerSlug || ep.provider || ep.endpoint?.provider || 'other';
				if (!allowedProviders.has(providerKey)) continue;
				if (!groups[providerKey])
					groups[providerKey] = { name: providerKey, displayName: providerKey, models: [] };
				const providerModelId =
					ep?.endpoint?.modelConfig?.providerModelId || ep?.endpoint?.providerModelId;
				groups[providerKey].models.push({
					modelId: entry.id,
					modelName: entry.name,
					providerModelId,
					endpoint: ep
				});
			}
		}
		return Object.values(groups);
	});

	// Find the selected model
	const selectedModel = $derived.by(() => {
		if (!value) return null;
		const catalogModels = (modelCatalog as any)?.data?.models || [];
		for (const m of catalogModels) {
			for (const ep of m.endpoints || []) {
				const pmid = ep?.endpoint?.modelConfig?.providerModelId || ep?.endpoint?.providerModelId;
				if (pmid === value) {
					return {
						modelId: m.id,
						modelName: m.name,
						providerModelId: pmid,
						endpoint: ep
					};
				}
			}
		}
		return null;
	});

	// Get display name for selected model
	const displayName = $derived.by(() => {
		if (!selectedModel) return placeholder;
		const name = selectedModel.modelName || selectedModel.name || selectedModel.modelId;
		// For Claude models, show just the model name without "Claude"
		if (name?.includes('Claude')) return name.replace('Claude ', '');
		return name;
	});

	const dispatch = createEventDispatcher();

	function selectModel(modelId: string) {
		value = modelId;
		onValueChange?.(modelId);
		// Dispatch an event for consumers that prefer DOM events
		try {
			dispatch('change', modelId);
		} catch (e) {
			// ignore if consumer doesn't listen
		}
		// Debug log selection in development
		if (import.meta.env?.MODE !== 'production')
			console.debug('compact-model-selector selected', modelId);
		open = false;
		searchValue = '';
	}
</script>

<DropdownMenu.Root bind:open>
	<DropdownMenu.Trigger
		class="flex cursor-pointer items-center gap-1 text-sm font-medium text-foreground transition-colors hover:text-primary"
	>
		<span>{displayName}</span>
		<ChevronDown class="h-3 w-3 text-muted-foreground" />
	</DropdownMenu.Trigger>

	<DropdownMenu.Content class="max-h-[250px] w-[300px] p-1" align="start">
		{#each providerGroups as provider (provider.name)}
			<div class="px-2 py-1">
				<div class="mb-1 text-xs font-medium text-muted-foreground">
					{provider.displayName}
				</div>
				{#each provider.models as model (model.modelId + '-' + model.providerModelId)}
					<DropdownMenu.Item
						class="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-muted"
						onclick={() => selectModel(model.providerModelId)}
					>
						<span class="truncate">{model.modelName}</span>
						{#if value === model.providerModelId}
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
