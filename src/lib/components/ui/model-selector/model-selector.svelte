<script lang="ts">
	import modelCatalog from '$lib/data/models.json';
	import { Badge } from '@/components/ui/badge';
	import * as Command from '@/components/ui/command';
	import * as DropdownMenu from '@/components/ui/dropdown-menu';
	import { Separator } from '@/components/ui/separator';
	import { LLM_PROVIDERS } from '@/types/llm.types';
	import { Check, ChevronDown, Code, Eye, SquareFunction, Zap } from 'lucide-svelte';
	import { createEventDispatcher } from 'svelte';

	let {
		value = $bindable(),
		onValueChange,
		placeholder = 'Select a model...',
		className = '',
		disabled = false
	}: {
		value?: string;
		onValueChange?: (value: string) => void;
		placeholder?: string;
		className?: string;
		disabled?: boolean;
	} = $props();

	let open = $state(false);
	let searchValue = $state('');

	// Build provider groups from the static model catalog
	const providerGroups = $derived.by(() => {
		const catalogModels = (modelCatalog as any)?.data?.models || [];
		const groups: Record<string, any> = {};
		for (const entry of catalogModels) {
			const provider =
				entry.endpoints?.[0]?.providerSlug || entry.endpoints?.[0]?.provider || 'other';
			if (!groups[provider])
				groups[provider] = { name: provider, displayName: provider, models: [] };

			// derive a simplified model descriptor used by the UI
			const firstEp = entry.endpoints && entry.endpoints[0] ? entry.endpoints[0] : null;
			const pricing = firstEp?.endpoint?.pricing?.[0] || firstEp?.pricing?.[0] || {};
			const inputCost = pricing.input ? pricing.input * 1e6 : undefined;
			const outputCost = pricing.output ? pricing.output * 1e6 : undefined;
			const capabilities = {
				text: true,
				vision: Array.isArray(entry.inputModalities) && entry.inputModalities.includes('image'),
				functionCalling:
					(entry.supportedParameters || []).includes('tools') ||
					(entry.supportedParameters || []).includes('tool_choice'),
				codeExecution: false
			};

			// Extract API model name from description
			const desc = entry.description || '';
			const match = desc.match(/API model name: ([^\s]+)/);
			const apiModelName = match ? match[1] : entry.id;

			groups[provider].models.push({
				id: entry.id,
				name: entry.name,
				provider: provider,
				contextLength: entry.contextLength || entry.maxOutput || 0,
				inputCost,
				outputCost,
				capabilities,
				apiModelName
			});
		}

		// Convert to array and apply search filter
		return Object.values(groups).map((g: any) => ({
			...g,
			models: g.models.filter(
				(model: any) =>
					(model.name || '').toLowerCase().includes(searchValue.toLowerCase()) ||
					(model.id || '').toLowerCase().includes(searchValue.toLowerCase()) ||
					(model.apiModelName || '').toLowerCase().includes(searchValue.toLowerCase())
			)
		}));
	});

	// Find the selected model from the static catalog-derived providerGroups
	const selectedModel = $derived.by(() => {
		if (!value) return null;
		const groups = providerGroups as any;
		for (const g of groups) {
			const found = g.models.find((m: any) => m.id === value);
			if (found) return found;
		}
		return null;
	});

	const dispatch = createEventDispatcher();

	function selectModel(modelId: string) {
		value = modelId;
		onValueChange?.(modelId);
		open = false;
		searchValue = '';
		try {
			dispatch('change', selectedModel?.apiModelName || modelId);
		} catch (e) {}
		// Development-only debug
		if (import.meta.env?.MODE !== 'production') console.debug('model-selector selected', modelId);
	}

	function getCapabilityIcon(capability: string) {
		switch (capability) {
			case 'vision':
				return Eye;
			case 'functionCalling':
				return SquareFunction;
			case 'codeExecution':
				return Code;
			default:
				return Zap;
		}
	}

	function formatCost(inputCost?: number, outputCost?: number): string {
		if (!inputCost && !outputCost) return 'Free';
		if (inputCost === 0 && outputCost === 0) return 'Free';
		return `$${inputCost?.toFixed(2) || '0'}/$${outputCost?.toFixed(2) || '0'}`;
	}

	// Log value changes in development via a reactive statement
	if (import.meta.env?.MODE !== 'production') {
		$: console.debug('model-selector value', value);
	}
</script>

<DropdownMenu.Root bind:open>
	<DropdownMenu.Trigger>
		{#if selectedModel}
			<div class="flex items-center gap-2">
				<Badge variant="secondary" class="text-xs">
					{LLM_PROVIDERS[selectedModel.provider]?.displayName || selectedModel.provider}
				</Badge>
				<span class="truncate">{selectedModel.name}</span>
			</div>
		{:else}
			<span class="text-muted-foreground">{placeholder}</span>
		{/if}
		<ChevronDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
	</DropdownMenu.Trigger>

	<DropdownMenu.Content class="w-[400px] p-0" align="start">
		<Command.Root shouldFilter={false}>
			<Command.Input bind:value={searchValue} placeholder="Search models..." class="h-9" />
			<Command.Empty>No models found.</Command.Empty>
			<Command.List class="max-h-[300px]">
				{#each providerGroups as provider (provider.name)}
					<Command.Group heading={provider.displayName}>
						{#each provider.models.filter((model: any) => (model.name || '')
									.toLowerCase()
									.includes(searchValue.toLowerCase()) || (model.id || '')
									.toLowerCase()
									.includes(searchValue.toLowerCase())) as model (model.id)}
							<Command.Item
								value={model.id}
								onSelect={() => selectModel(model.id)}
								class="flex flex-col items-start gap-1 px-2 py-3"
							>
								<div class="flex w-full items-center justify-between">
									<div class="flex items-center gap-2">
										<div class="flex items-center gap-1">
											<span class="font-medium">{model.name}</span>
											{#if value === model.id}
												<Check class="h-4 w-4 text-primary" />
											{/if}
										</div>
									</div>
									<div class="flex items-center gap-1 text-xs text-muted-foreground">
										{formatCost(model.inputCost, model.outputCost)}
									</div>
								</div>

								<div class="flex w-full items-center justify-between text-xs text-muted-foreground">
									<span>{model.contextLength.toLocaleString()} tokens</span>
									<div class="flex items-center gap-1">
										{#each Object.entries(model.capabilities) as [capability, enabled]}
											{@const Icon = getCapabilityIcon(capability)}
											{#if enabled && capability !== 'text'}
												<Icon class="h-4 w-4" />
											{/if}
										{/each}
									</div>
								</div>

								{#if model.id.includes('/')}
									<code class="rounded bg-muted px-1 text-xs text-muted-foreground">
										{model.id}
									</code>
								{/if}
							</Command.Item>
						{/each}
					</Command.Group>
					{#if provider !== providerGroups[providerGroups.length - 1]}
						<Separator class="my-1" />
					{/if}
				{/each}
			</Command.List>
		</Command.Root>
	</DropdownMenu.Content>
</DropdownMenu.Root>
