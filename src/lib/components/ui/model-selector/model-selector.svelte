<script lang="ts">
	import { Badge } from '@/components/ui/badge';
	import * as Command from '@/components/ui/command';
	import * as DropdownMenu from '@/components/ui/dropdown-menu';
	import { Separator } from '@/components/ui/separator';
	import { LLM_PROVIDERS } from '@/types/llm.types';
	import { Check, ChevronDown, Code, Eye, SquareFunction, Zap } from 'lucide-svelte';

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

	// Get all models grouped by provider
	const providerGroups = $derived.by(() => {
		return Object.values(LLM_PROVIDERS).filter((provider) =>
			provider.models.some(
				(model) =>
					model.name.toLowerCase().includes(searchValue.toLowerCase()) ||
					model.id.toLowerCase().includes(searchValue.toLowerCase())
			)
		);
	});

	// Find the selected model
	const selectedModel = $derived.by(() => {
		if (!value) return null;
		return Object.values(LLM_PROVIDERS)
			.flatMap((p) => p.models)
			.find((m) => m.id === value);
	});

	function selectModel(modelId: string) {
		value = modelId;
		onValueChange?.(modelId);
		open = false;
		searchValue = '';
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
</script>

<DropdownMenu.Root bind:open>
	<DropdownMenu.Trigger>
		{#if selectedModel}
			<div class="flex items-center gap-2">
				<Badge variant="secondary" class="text-xs">
					{LLM_PROVIDERS[selectedModel.provider]?.displayName}
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
						{#each provider.models.filter((model) => model.name
									.toLowerCase()
									.includes(searchValue.toLowerCase()) || model.id
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
