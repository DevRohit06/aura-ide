<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { cn } from '$lib/utils.js';
	import { Code2, FileText, Package, Palette, Shield, Sparkles, Timer, Zap } from 'lucide-svelte';

	interface Props {
		packageManager: string;
		typescript: boolean;
		eslint: boolean;
		prettier: boolean;
		tailwindcss: boolean;
		additionalDependencies: string;
		onPackageManagerChange: (value: string) => void;
		onTypescriptChange: (value: boolean) => void;
		onEslintChange: (value: boolean) => void;
		onPrettierChange: (value: boolean) => void;
		onTailwindChange: (value: boolean) => void;
		onDependenciesChange: (value: string) => void;
		class?: string;
	}

	let {
		packageManager,
		typescript,
		eslint,
		prettier,
		tailwindcss,
		additionalDependencies,
		onPackageManagerChange,
		onTypescriptChange,
		onEslintChange,
		onPrettierChange,
		onTailwindChange,
		onDependenciesChange,
		class: className
	}: Props = $props();

	// Package manager options with enhanced metadata
	const packageManagerOptions = [
		{
			value: 'npm',
			label: 'npm',
			description: 'Node Package Manager (default)',
			icon: '📦',
			performance: 'standard',
			features: ['Built-in', 'Large Registry', 'Stable']
		},
		{
			value: 'yarn',
			label: 'Yarn',
			description: 'Fast, reliable, and secure dependency management',
			icon: '🧶',
			performance: 'fast',
			features: ['Workspaces', 'Offline Mode', 'Deterministic']
		},
		{
			value: 'pnpm',
			label: 'pnpm',
			description: 'Fast, disk space efficient package manager',
			icon: '⚡',
			performance: 'fastest',
			features: ['Space Efficient', 'Fastest', 'Monorepos']
		},
		{
			value: 'bun',
			label: 'Bun',
			description: 'Incredibly fast JavaScript runtime and package manager',
			icon: '🥟',
			performance: 'ultra-fast',
			features: ['All-in-one', 'Native Speed', 'TypeScript']
		}
	];

	// Development tools configuration
	const devTools = [
		{
			id: 'typescript',
			name: 'TypeScript',
			description: 'Add type safety to your JavaScript',
			icon: Code2,
			checked: typescript,
			onChange: onTypescriptChange,
			color: 'text-blue-600',
			benefits: ['Type Safety', 'Better IDE Support', 'Fewer Runtime Errors'],
			category: 'Language'
		},
		{
			id: 'eslint',
			name: 'ESLint',
			description: 'Find and fix problems in your code',
			icon: Shield,
			checked: eslint,
			onChange: onEslintChange,
			color: 'text-purple-600',
			benefits: ['Code Quality', 'Consistent Style', 'Bug Prevention'],
			category: 'Linting'
		},
		{
			id: 'prettier',
			name: 'Prettier',
			description: 'Format your code automatically',
			icon: Sparkles,
			checked: prettier,
			onChange: onPrettierChange,
			color: 'text-pink-600',
			benefits: ['Auto Formatting', 'Team Consistency', 'Less Debates'],
			category: 'Formatting'
		},
		{
			id: 'tailwindcss',
			name: 'Tailwind CSS',
			description: 'Utility-first CSS framework',
			icon: Palette,
			checked: tailwindcss,
			onChange: onTailwindChange,
			color: 'text-cyan-600',
			benefits: ['Rapid Styling', 'Responsive Design', 'Small Bundle'],
			category: 'Styling'
		}
	];

	function getPackageManagerMeta(value: string) {
		return packageManagerOptions.find((opt) => opt.value === value) || packageManagerOptions[0];
	}

	function getPerformanceColor(performance: string) {
		switch (performance) {
			case 'ultra-fast':
				return 'text-green-600 bg-green-100 dark:bg-green-900/30';
			case 'fastest':
				return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';
			case 'fast':
				return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
			default:
				return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30';
		}
	}

	function getSelectedToolsCount() {
		return devTools.filter((tool) => tool.checked).length;
	}

	function getEstimatedSetupTime() {
		const base = 30; // base setup time in seconds
		const toolTime = getSelectedToolsCount() * 10; // 10 seconds per tool
		const depTime = additionalDependencies.split(',').filter((d) => d.trim()).length * 5; // 5 seconds per dependency
		return Math.round(((base + toolTime + depTime) / 60) * 10) / 10; // convert to minutes, round to 1 decimal
	}

	function getProjectSize() {
		const base = 15; // base project size in MB
		const toolSize = getSelectedToolsCount() * 5; // 5MB per tool
		const depSize = additionalDependencies.split(',').filter((d) => d.trim()).length * 2; // 2MB per dependency
		return base + toolSize + depSize;
	}

	const dependencyCount = $derived(
		additionalDependencies.split(',').filter((d) => d.trim()).length
	);
</script>

<div class={cn('space-y-8', className)}>
	<!-- Package Manager Selection -->
	<Card>
		<CardHeader>
			<CardTitle class="flex items-center space-x-2">
				<Package class="h-5 w-5 text-primary" />
				<span>Package Manager</span>
			</CardTitle>
			<CardDescription>
				Choose your preferred package manager for dependency management
			</CardDescription>
		</CardHeader>
		<CardContent>
			<div class="grid gap-4 md:grid-cols-2">
				{#each packageManagerOptions as option}
					{@const isSelected = packageManager === option.value}
					<Card
						class={cn(
							'cursor-pointer border-2 transition-all duration-200 hover:shadow-md',
							isSelected
								? 'border-primary bg-primary/5 shadow-sm'
								: 'border-muted hover:border-primary/50'
						)}
						onclick={() => onPackageManagerChange(option.value)}
					>
						<CardContent class="p-4">
							<div class="flex items-start space-x-3">
								<div class="text-2xl">{option.icon}</div>
								<div class="flex-1 space-y-2">
									<div class="flex items-center justify-between">
										<h3 class="font-semibold">{option.label}</h3>
										<Badge class={getPerformanceColor(option.performance)}>
											{option.performance}
										</Badge>
									</div>
									<p class="text-sm text-muted-foreground">{option.description}</p>
									<div class="flex flex-wrap gap-1">
										{#each option.features as feature}
											<Badge variant="outline" class="text-xs">
												{feature}
											</Badge>
										{/each}
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				{/each}
			</div>
		</CardContent>
	</Card>

	<Separator />

	<!-- Development Tools -->
	<Card>
		<CardHeader>
			<CardTitle class="flex items-center space-x-2">
				<Zap class="h-5 w-5 text-primary" />
				<span>Development Tools</span>
			</CardTitle>
			<CardDescription>Configure your development environment with essential tools</CardDescription>
		</CardHeader>
		<CardContent>
			<div class="grid gap-4 sm:grid-cols-2">
				{#each devTools as tool}
					<Card
						class={cn(
							'border transition-all duration-200',
							tool.checked
								? 'border-primary/50 bg-primary/5 shadow-sm'
								: 'border-muted hover:border-primary/30'
						)}
					>
						<CardContent class="p-4">
							<div class="flex items-start space-x-3">
								<div class="mt-1">
									<Checkbox
										id={tool.id}
										bind:checked={tool.checked}
										onCheckedChange={tool.onChange}
									/>
								</div>
								<div class="flex-1 space-y-2">
									<div class="flex items-center space-x-2">
										<tool.icon class={cn('h-4 w-4', tool.color)} />
										<Label for={tool.id} class="cursor-pointer font-medium">
											{tool.name}
										</Label>
										<Badge variant="outline" class="text-xs">
											{tool.category}
										</Badge>
									</div>
									<p class="text-sm text-muted-foreground">{tool.description}</p>
									{#if tool.checked}
										<div class="flex flex-wrap gap-1">
											{#each tool.benefits as benefit}
												<Badge variant="secondary" class="text-xs">
													{benefit}
												</Badge>
											{/each}
										</div>
									{/if}
								</div>
							</div>
						</CardContent>
					</Card>
				{/each}
			</div>
		</CardContent>
	</Card>

	<Separator />

	<!-- Additional Dependencies -->
	<Card>
		<CardHeader>
			<CardTitle class="flex items-center space-x-2">
				<Package class="h-5 w-5 text-primary" />
				<span>Additional Dependencies</span>
			</CardTitle>
			<CardDescription>Add extra packages you need for your project (optional)</CardDescription>
		</CardHeader>
		<CardContent class="space-y-4">
			<div class="space-y-2">
				<Label for="additionalDeps">Package Names</Label>
				<Input
					id="additionalDeps"
					bind:value={additionalDependencies}
					oninput={(e) => onDependenciesChange(e.target.value)}
					placeholder="lodash, axios, uuid, react-router-dom"
					class="font-mono text-sm"
				/>
				<div class="flex justify-between text-xs text-muted-foreground">
					<span>
						Enter package names separated by commas
						{#if dependencyCount > 0}
							• {dependencyCount} package{dependencyCount !== 1 ? 's' : ''} listed
						{/if}
					</span>
					<span>{dependencyCount}/20</span>
				</div>
			</div>

			{#if additionalDependencies.trim()}
				<div class="space-y-2">
					<Label class="text-sm font-medium">Preview:</Label>
					<div class="rounded-lg border bg-muted/50 p-3">
						<div class="flex flex-wrap gap-1">
							{#each additionalDependencies.split(',') as dep}
								{@const cleanDep = dep.trim()}
								{#if cleanDep}
									<Badge variant="outline" class="font-mono text-xs">
										{cleanDep}
									</Badge>
								{/if}
							{/each}
						</div>
					</div>
				</div>
			{/if}
		</CardContent>
	</Card>

	<Separator />

	<!-- Project Summary -->
	<Card class="border-primary/20 bg-primary/5">
		<CardHeader>
			<CardTitle class="flex items-center space-x-2">
				<FileText class="h-5 w-5 text-primary" />
				<span>Project Summary</span>
			</CardTitle>
			<CardDescription>Overview of your project configuration</CardDescription>
		</CardHeader>
		<CardContent>
			<div class="grid gap-4 sm:grid-cols-3">
				<div class="space-y-1 text-center">
					<div class="flex items-center justify-center space-x-1">
						<Timer class="h-4 w-4 text-primary" />
						<span class="text-sm font-medium">Setup Time</span>
					</div>
					<p class="text-lg font-bold text-primary">~{getEstimatedSetupTime()}m</p>
				</div>
				<div class="space-y-1 text-center">
					<div class="flex items-center justify-center space-x-1">
						<Package class="h-4 w-4 text-primary" />
						<span class="text-sm font-medium">Project Size</span>
					</div>
					<p class="text-lg font-bold text-primary">~{getProjectSize()}MB</p>
				</div>
				<div class="space-y-1 text-center">
					<div class="flex items-center justify-center space-x-1">
						<Zap class="h-4 w-4 text-primary" />
						<span class="text-sm font-medium">Tools</span>
					</div>
					<p class="text-lg font-bold text-primary">{getSelectedToolsCount()}/4</p>
				</div>
			</div>

			<Separator class="my-4" />

			<div class="space-y-2">
				<h4 class="text-sm font-medium">Configuration:</h4>
				<div class="flex flex-wrap gap-2">
					<Badge class="text-xs">
						{getPackageManagerMeta(packageManager).label}
					</Badge>
					{#each devTools.filter((tool) => tool.checked) as tool}
						<Badge variant="secondary" class="text-xs">
							{tool.name}
						</Badge>
					{/each}
					{#if dependencyCount > 0}
						<Badge variant="outline" class="text-xs">
							+{dependencyCount} dependencies
						</Badge>
					{/if}
				</div>
			</div>
		</CardContent>
	</Card>
</div>
