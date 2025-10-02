<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card/index.js';
	import { FrameworkIcon } from '$lib/components/ui/framework-icon/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { cn } from '$lib/utils.js';
	import Icon from '@iconify/svelte';

	interface Framework {
		id: string;
		name: string;
		description: string;
		version: string;
		category: string;
		icon: string;
		tags: string[];
		features: string[];
		stackblitzId: string;
		popularity?: 'high' | 'medium' | 'low';
		setupTime?: string;
		difficulty?: 'beginner' | 'intermediate' | 'advanced';
	}

	interface Props {
		frameworks: Framework[];
		selectedFramework?: string;
		onFrameworkSelect: (framework: Framework) => void;
		class?: string;
	}

	let { frameworks, selectedFramework, onFrameworkSelect, class: className }: Props = $props();

	// Enhanced framework data with popularity and setup info
	const enhancedFrameworks = $derived(
		frameworks.map((fw) => ({
			...fw,
			popularity: getPopularity(fw.id),
			setupTime: getSetupTime(fw.id),
			difficulty: getDifficulty(fw.id)
		}))
	);

	// Group frameworks by category
	const categorizedFrameworks = $derived(() => {
		const categories: Record<string, Framework[]> = {};
		enhancedFrameworks.forEach((fw) => {
			if (!categories[fw.category]) {
				categories[fw.category] = [];
			}
			categories[fw.category].push(fw);
		});
		return categories;
	});

	const categoryMeta = {
		frontend: {
			title: 'Frontend Frameworks',
			description: 'Build modern user interfaces',
			icon: '🎨',
			color: 'text-blue-600'
		},
		fullstack: {
			title: 'Full-Stack Frameworks',
			description: 'End-to-end web applications',
			icon: '⚡',
			color: 'text-purple-600'
		},
		backend: {
			title: 'Backend Frameworks',
			description: 'Server-side development',
			icon: '🔧',
			color: 'text-green-600'
		},
		static: {
			title: 'Static Site Generators',
			description: 'Fast, optimized websites',
			icon: '🚀',
			color: 'text-orange-600'
		},
		'build-tools': {
			title: 'Build Tools',
			description: 'Development tooling',
			icon: '🛠️',
			color: 'text-gray-600'
		}
	};

	function getPopularity(id: string): 'high' | 'medium' | 'low' {
		const highPop = ['react', 'nextjs', 'vue', 'angular', 'node', 'express'];
		const mediumPop = ['svelte', 'sveltekit', 'react-ts', 'nextjs-ts', 'vue-ts'];
		if (highPop.includes(id)) return 'high';
		if (mediumPop.includes(id)) return 'medium';
		return 'low';
	}

	function getSetupTime(id: string): string {
		const quick = ['vite', 'vanilla', 'vanilla-ts'];
		const medium = ['react', 'vue', 'svelte', 'react-ts', 'vue-ts'];
		const longer = ['nextjs', 'angular', 'sveltekit', 'nextjs-ts', 'astro'];
		if (quick.includes(id)) return '~30s';
		if (medium.includes(id)) return '~1m';
		if (longer.includes(id)) return '~2m';
		return '~1m';
	}

	function getDifficulty(id: string): 'beginner' | 'intermediate' | 'advanced' {
		const beginner = ['vanilla', 'vanilla-ts', 'vite'];
		const advanced = ['angular', 'astro'];
		if (beginner.includes(id)) return 'beginner';
		if (advanced.includes(id)) return 'advanced';
		return 'intermediate';
	}

	function getPopularityColor(popularity: string) {
		switch (popularity) {
			case 'high':
				return 'text-green-600 bg-green-100 dark:bg-green-900/30';
			case 'medium':
				return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
			default:
				return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30';
		}
	}

	function getDifficultyColor(difficulty: string) {
		switch (difficulty) {
			case 'beginner':
				return 'text-green-600';
			case 'advanced':
				return 'text-red-600';
			default:
				return 'text-blue-600';
		}
	}
</script>

<div class={cn('space-y-8', className)}>
	{#each Object.entries(categorizedFrameworks) as [category, frameworkList]}
		{@const meta = categoryMeta[category as keyof typeof categoryMeta]}
		{#if meta && frameworkList.length > 0}
			<section class="space-y-4">
				<!-- Category Header -->
				<div class="flex items-center space-x-3">
					<span class="text-2xl">{meta.icon}</span>
					<div>
						<h3 class={cn('text-xl font-bold', meta.color)}>{meta.title}</h3>
						<p class="text-sm text-muted-foreground">{meta.description}</p>
					</div>
				</div>

				<!-- Framework Grid -->
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each frameworkList as framework (framework.id)}
						<Card
							class={cn(
								'group cursor-pointer border-2 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg',
								selectedFramework === framework.id
									? 'border-primary bg-primary/5 shadow-md'
									: 'border-muted hover:border-primary/50'
							)}
							onclick={() => onFrameworkSelect(framework)}
						>
							<CardHeader class="pb-3">
								<div class="flex items-start justify-between">
									<div class="flex items-center space-x-3">
										<div
											class="flex h-12 w-12 items-center justify-center rounded-lg bg-muted/50 transition-transform group-hover:scale-110"
										>
											<FrameworkIcon framework={framework.id} size="lg" animated={false} />
										</div>
										<div>
											<CardTitle class="flex items-center space-x-2">
												<span class="transition-colors group-hover:text-primary">
													{framework.name}
												</span>
												{#if framework.popularity === 'high'}
													<Badge class={getPopularityColor(framework.popularity)}>
														<Icon icon="mdi:star" class="mr-1 h-3 w-3" />
														Popular
													</Badge>
												{/if}
											</CardTitle>
											<div class="flex items-center space-x-2 text-xs text-muted-foreground">
												<Badge variant="outline" class="text-xs">v{framework.version}</Badge>
												<span class="flex items-center">
													<Icon icon="mdi:clock-outline" class="mr-1 h-3 w-3" />
													{framework.setupTime}
												</span>
											</div>
										</div>
									</div>
								</div>
							</CardHeader>

							<CardContent class="space-y-4">
								<CardDescription class="text-sm leading-relaxed">
									{framework.description}
								</CardDescription>

								<!-- Features -->
								<div class="space-y-2">
									<h4 class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
										Key Features
									</h4>
									<div class="flex flex-wrap gap-1">
										{#each framework.features.slice(0, 3) as feature}
											<Badge variant="secondary" class="text-xs">
												{feature}
											</Badge>
										{/each}
										{#if framework.features.length > 3}
											<Badge variant="outline" class="text-xs">
												+{framework.features.length - 3} more
											</Badge>
										{/if}
									</div>
								</div>

								<Separator />

								<!-- Stats -->
								<div class="flex items-center justify-between text-xs">
									<div class="flex items-center space-x-4">
										<span class="flex items-center space-x-1">
											<Icon icon="mdi:trending-up" class="h-3 w-3" />
											<span class="capitalize">{framework.popularity}</span>
										</span>
										<span
											class={cn(
												'flex items-center space-x-1',
												getDifficultyColor(framework.difficulty)
											)}
										>
											<Icon icon="mdi:account-group" class="h-3 w-3" />
											<span class="capitalize">{framework.difficulty}</span>
										</span>
									</div>
									{#if selectedFramework === framework.id}
										<Badge variant="default" class="text-xs">Selected</Badge>
									{/if}
								</div>
							</CardContent>
						</Card>
					{/each}
				</div>
			</section>
		{/if}
	{/each}

	<!-- Empty State -->
	{#if frameworks.length === 0}
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<div class="mb-4 text-6xl opacity-50">🔍</div>
			<h3 class="mb-2 text-lg font-semibold">No frameworks available</h3>
			<p class="text-sm text-muted-foreground">Please try again later or contact support.</p>
		</div>
	{/if}
</div>
