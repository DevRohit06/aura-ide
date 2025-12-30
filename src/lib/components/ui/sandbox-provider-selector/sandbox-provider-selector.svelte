<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card/index.js';
	import { cn } from '$lib/utils.js';
	import {
		CheckCircle,
		GitBranch,
		HardDrive,
		Monitor,
		Server,
		Terminal
	} from 'lucide-svelte';

	interface Provider {
		value: string;
		label: string;
		description: string;
		features: string[];
		logo?: string;
		color?: string;
		setupTime?: string;
		specs?: {
			cpu: string;
			memory: string;
			storage: string;
		};
		pricing?: string;
	}

	interface Props {
		providers: Provider[];
		selectedProvider: string;
		onProviderSelect: (provider: string) => void;
		class?: string;
	}

	let { providers, selectedProvider, onProviderSelect, class: className }: Props = $props();

	// Enhanced provider data - Daytona ONLY
	const enhancedProviders = [
		{
			value: 'daytona',
			label: 'Daytona',
			description: 'Persistent sandbox with git operations and direct terminal access',
			logo: '🏔️',
			color: 'from-blue-500 to-cyan-500',
			setupTime: '~2-3 minutes',
			specs: {
				cpu: '2 vCPU',
				memory: '4GB RAM',
				storage: '20GB SSD'
			},
			pricing: 'Free tier available',
			features: [
				{
					name: 'Persistent Storage',
					icon: HardDrive,
					description: 'Files persist between sessions'
				},
				{ name: 'Git Integration', icon: GitBranch, description: 'Full git operations support' },
				{ name: 'SSH Access', icon: Terminal, description: 'Direct terminal access' },
				{ name: 'VS Code Support', icon: Monitor, description: 'Native VS Code integration' },
				{ name: 'Custom Docker', icon: Server, description: 'Custom Docker environments' }
			],
			advantages: ['Long-running projects', 'Complex workflows', 'Full development environment'],
			bestFor: 'Production-like development, collaborative coding, complex projects'
		}
	];

	function getProviderData(value: string) {
		return enhancedProviders.find((p) => p.value === value) || enhancedProviders[0];
	}
</script>

<div class={cn('space-y-6', className)}>
	<!-- Provider Cards -->
	<div class="grid gap-6">
		{#each enhancedProviders as provider}
			{@const isSelected = selectedProvider === provider.value}
			<Card
				class={cn(
					'group cursor-pointer border-2 transition-all duration-300 hover:shadow-xl',
					isSelected
						? 'scale-[1.01] border-primary bg-gradient-to-br from-primary/5 to-primary/10 shadow-lg'
						: 'border-muted hover:scale-[1.01] hover:border-primary/50 hover:shadow-lg'
				)}
				onclick={() => onProviderSelect(provider.value)}
			>
				<CardHeader class="pb-4">
					<div class="flex items-start justify-between">
						<div class="flex items-center space-x-3">
							<div
								class={cn(
									'flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br text-2xl shadow-lg transition-transform group-hover:scale-110',
									provider.color
								)}
							>
								{provider.logo}
							</div>
							<div>
								<CardTitle class="flex items-center space-x-2">
									<span class="transition-colors group-hover:text-primary">
										{provider.label}
									</span>
									{#if isSelected}
										<CheckCircle class="h-5 w-5 text-primary" />
									{/if}
								</CardTitle>
								<CardDescription class="mt-1">{provider.description}</CardDescription>
							</div>
						</div>
					</div>
				</CardHeader>

				<CardContent class="space-y-6">
					<!-- Quick Stats -->
					<div class="grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-3">
						<div class="space-y-1">
							<p class="text-xs font-medium text-muted-foreground">Setup Time</p>
							<p class="text-sm font-semibold">{provider.setupTime}</p>
						</div>
						<div class="space-y-1">
							<p class="text-xs font-medium text-muted-foreground">Pricing</p>
							<p class="text-sm font-semibold">{provider.pricing}</p>
						</div>
					</div>

					<!-- Specifications -->
					<div class="space-y-3">
						<h4 class="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
							Specifications
						</h4>
						<div class="grid grid-cols-3 gap-2 text-xs">
							<div class="space-y-1">
								<p class="text-muted-foreground">CPU</p>
								<p class="font-medium">{provider.specs.cpu}</p>
							</div>
							<div class="space-y-1">
								<p class="text-muted-foreground">Memory</p>
								<p class="font-medium">{provider.specs.memory}</p>
							</div>
							<div class="space-y-1">
								<p class="text-muted-foreground">Storage</p>
								<p class="font-medium">{provider.specs.storage}</p>
							</div>
						</div>
					</div>

					<!-- Features -->
					<div class="space-y-3">
						<h4 class="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
							Key Features
						</h4>
						<div class="space-y-2">
							{#each provider.features as feature}
								<div class="flex items-center space-x-3 rounded-lg border p-2">
									<feature.icon class="h-4 w-4 text-primary" />
									<div class="flex-1">
										<p class="text-sm font-medium">{feature.name}</p>
										<p class="text-xs text-muted-foreground">{feature.description}</p>
									</div>
								</div>
							{/each}
						</div>
					</div>

					<!-- Best For -->
					<div class="space-y-2">
						<h4 class="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
							Best For
						</h4>
						<p class="text-sm leading-relaxed">{provider.bestFor}</p>
					</div>

					<!-- Advantages -->
					<div class="space-y-2">
						<h4 class="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
							Advantages
						</h4>
						<div class="flex flex-wrap gap-1">
							{#each provider.advantages as advantage}
								<Badge variant="secondary" class="text-xs">
									{advantage}
								</Badge>
							{/each}
						</div>
					</div>
				</CardContent>
			</Card>
		{/each}
	</div>

	<!-- Recommendation -->
	{#if selectedProvider}
		{@const provider = getProviderData(selectedProvider)}
		<Card class="border-primary/20 bg-primary/5">
			<CardContent class="p-6">
				<div class="flex items-start space-x-4">
					<div
						class={cn(
							'flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br text-xl',
							provider.color
						)}
					>
						{provider.logo}
					</div>
					<div class="flex-1 space-y-2">
						<h3 class="font-semibold">
							Great choice! You've selected {provider.label}
						</h3>
						<p class="text-sm text-muted-foreground">
							{provider.label} is perfect for {provider.bestFor.toLowerCase()}. Your environment
							will be ready in approximately {provider.setupTime}.
						</p>
						<div class="mt-3 flex flex-wrap gap-2">
							{#each provider.advantages as advantage}
								<Badge variant="outline" class="text-xs">
									✓ {advantage}
								</Badge>
							{/each}
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	{/if}
</div>
