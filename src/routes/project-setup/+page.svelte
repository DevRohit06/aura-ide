<script lang="ts">
	import { goto } from '$app/navigation';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
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
	import { Progress } from '$lib/components/ui/progress/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { isAuthenticated, user } from '$lib/stores/auth';
	import { ArrowLeft, CheckCircle, Rocket, Settings } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	let currentStep = $state(1);
	let projectName = $state('');
	let projectDescription = $state('');
	let framework = $state('');
	let packageManager = $state('npm');
	let typescript = $state(true);
	let eslint = $state(true);
	let prettier = $state(true);
	let tailwindcss = $state(true);
	let additionalDependencies = $state('');

	let frameworks = $state<any[]>([]);
	let loading = $state(false);
	let creating = $state(false);

	// Package manager display names
	const packageManagerOptions = [
		{ value: 'npm', label: 'npm', description: 'Node Package Manager (default)' },
		{
			value: 'yarn',
			label: 'Yarn',
			description: 'Fast, reliable, and secure dependency management'
		},
		{ value: 'pnpm', label: 'pnpm', description: 'Fast, disk space efficient package manager' },
		{
			value: 'bun',
			label: 'Bun',
			description: 'Incredibly fast JavaScript runtime and package manager'
		}
	];

	function getPackageManagerLabel(value: string) {
		const option = packageManagerOptions.find((opt) => opt.value === value);
		return option?.label || value;
	}

	// Pure validation function (no state mutation)
	function isProjectNameValid(name: string) {
		const trimmedName = name.trim();
		if (!trimmedName) return false;
		if (trimmedName.length < 2) return false;
		if (!/^[a-zA-Z0-9-_]+$/.test(trimmedName)) return false;
		return true;
	}

	// Validate project name and set error message (for onblur)
	function validateProjectName(name: string) {
		// This function is only for triggering validation on blur
		// The actual validation logic is in isProjectNameValid
		return isProjectNameValid(name);
	}

	// Computed values for better UX
	const isStepValid = $derived(() => {
		switch (currentStep) {
			case 1:
				return isProjectNameValid(projectName);
			case 2:
				return framework.length > 0;
			case 3:
				return true; // Configuration is optional
			default:
				return false;
		}
	});

	// Reactive error message for project name
	const projectNameErrorMessage = $derived(() => {
		const name = projectName.trim();
		if (!name) return 'Project name is required';
		if (name.length < 2) return 'Project name must be at least 2 characters';
		if (!/^[a-zA-Z0-9-_]+$/.test(name))
			return 'Project name can only contain letters, numbers, hyphens, and underscores';
		return '';
	});

	// Redirect if not authenticated
	$effect(() => {
		if (!$isAuthenticated && !$user) {
			goto('/auth/login');
		}
	});

	onMount(async () => {
		loading = true;
		// Load available frameworks
		try {
			const response = await fetch('/api/projects/frameworks');
			if (response.ok) {
				const data = await response.json();
				frameworks = data.frameworks || [];
			} else {
				toast.error('Failed to load available frameworks');
			}
		} catch (error) {
			console.error('Error loading frameworks:', error);
			toast.error('Network error while loading frameworks');
		} finally {
			loading = false;
		}
	});

	function goBack() {
		if (currentStep > 1) {
			currentStep--;
		} else {
			goto('/dashboard');
		}
	}

	function nextStep() {
		if (currentStep < 3 && isStepValid()) {
			currentStep++;
		}
	}

	function selectFramework(selectedFramework: any) {
		framework = selectedFramework.id;
		if (isStepValid()) {
			nextStep();
		}
	}

	async function createProject() {
		if (!projectName.trim()) {
			toast.error('Please enter a project name');
			return;
		}

		if (!$user) {
			toast.error('You must be logged in to create a project');
			goto('/auth/login');
			return;
		}

		creating = true;

		try {
			const response = await fetch('/api/projects', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name: projectName.trim(),
					description: projectDescription.trim() || undefined,
					framework,
					configuration: {
						typescript,
						eslint,
						prettier,
						tailwindcss,
						packageManager,
						additionalDependencies: additionalDependencies
							.split(',')
							.map((dep) => dep.trim())
							.filter((dep) => dep.length > 0)
					}
				})
			});

			const result = await response.json();

			if (response.ok) {
				// Project created successfully
				toast.success('Project created successfully!');
				goto(`/editor/${result.project.id}`);
			} else {
				toast.error(result.message || 'Failed to create project');
			}
		} catch (error) {
			console.error('Error creating project:', error);
			toast.error('Network error. Please try again.');
		} finally {
			creating = false;
		}
	}

	function getStepStatus(step: number) {
		if (step < currentStep) return 'completed';
		if (step === currentStep) return 'current';
		return 'upcoming';
	}

	function getProgressValue() {
		return ((currentStep - 1) / 2) * 100;
	}

	const steps = [
		{ number: 1, title: 'Project Details', description: 'Basic information about your project' },
		{ number: 2, title: 'Framework', description: 'Choose your JavaScript framework' },
		{ number: 3, title: 'Configuration', description: 'Customize your project setup' }
	];
</script>

<div class="min-h-screen bg-background">
	<!-- Header -->
	<header
		class="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
	>
		<div class="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
			<div class="flex items-center py-6">
				<Button variant="ghost" size="sm" onclick={goBack} class="mr-4">
					<ArrowLeft class="mr-2 h-4 w-4" />
					Back
				</Button>
				<div class="flex-1">
					<h1 class="text-2xl font-bold">Create New Project</h1>
					<p class="text-muted-foreground">Set up your new development environment</p>
				</div>
			</div>
		</div>
	</header>

	<!-- Progress Section -->
	<div class="container mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
		<div class="mb-8">
			<div class="mb-4">
				<Progress value={getProgressValue()} class="h-2" />
			</div>

			<!-- Steps Navigation -->
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-4">
				{#each steps as step}
					{@const status = getStepStatus(step.number)}
					<div class="flex items-center space-x-3">
						<div
							class={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
								status === 'completed'
									? 'bg-primary text-primary-foreground'
									: status === 'current'
										? 'bg-primary text-primary-foreground'
										: 'bg-muted text-muted-foreground'
							}`}
						>
							{#if status === 'completed'}
								<CheckCircle class="h-4 w-4" />
							{:else}
								{step.number}
							{/if}
						</div>
						<div class="hidden sm:block">
							<p
								class={`text-sm font-medium ${status === 'current' ? 'text-foreground' : 'text-muted-foreground'}`}
							>
								{step.title}
							</p>
							<p class="text-xs text-muted-foreground">{step.description}</p>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Step Content -->
		<div class="mx-auto max-w-2xl">
			{#if loading}
				<Card>
					<CardHeader>
						<Skeleton class="h-6 w-3/4" />
						<Skeleton class="h-4 w-1/2" />
					</CardHeader>
					<CardContent class="space-y-4">
						<Skeleton class="h-10 w-full" />
						<Skeleton class="h-20 w-full" />
						<Skeleton class="h-10 w-full" />
					</CardContent>
				</Card>
			{:else if currentStep === 1}
				<!-- Step 1: Project Details -->
				<Card>
					<CardHeader>
						<CardTitle class="flex items-center">
							<Settings class="mr-2 h-5 w-5" />
							Project Details
						</CardTitle>
						<CardDescription>
							Let's start with the basic information about your project
						</CardDescription>
					</CardHeader>
					<CardContent class="space-y-6">
						<div class="space-y-2">
							<Label for="projectName">Project Name *</Label>
							<Input
								id="projectName"
								bind:value={projectName}
								placeholder="my-awesome-app"
								required
								class={projectNameErrorMessage()
									? 'border-destructive focus-visible:ring-destructive'
									: ''}
								onblur={() => validateProjectName(projectName)}
							/>
							{#if projectNameErrorMessage()}
								<p class="text-sm text-destructive">{projectNameErrorMessage()}</p>
							{/if}
						</div>
						<div class="space-y-2">
							<Label for="projectDescription">Description</Label>
							<Textarea
								id="projectDescription"
								bind:value={projectDescription}
								placeholder="A brief description of your project"
								rows={3}
							/>
							<p class="text-xs text-muted-foreground">
								Optional but helpful for team collaboration
							</p>
						</div>
						<Button onclick={nextStep} disabled={!isStepValid()} class="w-full" size="lg">
							Continue
							<ArrowLeft class="ml-2 h-4 w-4 rotate-180" />
						</Button>
					</CardContent>
				</Card>
			{:else if currentStep === 2}
				<!-- Step 2: Framework Selection -->
				<Card>
					<CardHeader>
						<CardTitle class="flex items-center">
							<Rocket class="mr-2 h-5 w-5" />
							Choose Your Framework
						</CardTitle>
						<CardDescription>
							Select the JavaScript framework you'd like to use for your project
						</CardDescription>
					</CardHeader>
					<CardContent>
						{#if frameworks.length === 0}
							<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
								{#each Array(4) as _}
									<Skeleton class="h-32 w-full" />
								{/each}
							</div>
						{:else}
							<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
								{#each frameworks as fw (fw.id)}
									<Card
										class="group cursor-pointer border-2 transition-all hover:border-primary hover:shadow-lg"
										onclick={() => selectFramework(fw)}
									>
										<CardContent class="p-6">
											<div class="mb-3 flex items-center justify-between">
												<h3 class="text-lg font-semibold group-hover:text-primary">{fw.name}</h3>
												<Badge variant="outline">{fw.version}</Badge>
											</div>
											<p class="text-sm text-muted-foreground">
												{fw.description}
											</p>
										</CardContent>
									</Card>
								{/each}
							</div>
						{/if}
					</CardContent>
				</Card>
			{:else if currentStep === 3}
				<!-- Step 3: Configuration -->
				<Card>
					<CardHeader>
						<CardTitle class="flex items-center">
							<Settings class="mr-2 h-5 w-5" />
							Project Configuration
						</CardTitle>
						<CardDescription>
							Customize your project setup with additional tools and packages
						</CardDescription>
					</CardHeader>
					<CardContent class="space-y-6">
						<!-- Package Manager -->
						<div class="space-y-2">
							<Label for="packageManager">Package Manager</Label>
							<Select.Root type="single" bind:value={packageManager}>
								<Select.Trigger class="w-full">
									{getPackageManagerLabel(packageManager)}
								</Select.Trigger>
								<Select.Content>
									{#each packageManagerOptions as option}
										<Select.Item value={option.value} label={option.label}>
											<div class="flex flex-col">
												<span class="font-medium">{option.label}</span>
												<span class="text-xs text-muted-foreground">{option.description}</span>
											</div>
										</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>

						<Separator />

						<!-- Development Tools -->
						<div class="space-y-4">
							<Label class="text-base font-medium">Development Tools</Label>
							<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<div class="flex items-center space-x-3 rounded-lg border p-4">
									<Checkbox bind:checked={typescript} id="typescript" />
									<div class="grid gap-1.5 leading-none">
										<Label
											for="typescript"
											class="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
										>
											TypeScript
										</Label>
										<p class="text-xs text-muted-foreground">Add type safety to your JavaScript</p>
									</div>
								</div>
								<div class="flex items-center space-x-3 rounded-lg border p-4">
									<Checkbox bind:checked={eslint} id="eslint" />
									<div class="grid gap-1.5 leading-none">
										<Label
											for="eslint"
											class="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
										>
											ESLint
										</Label>
										<p class="text-xs text-muted-foreground">Find and fix problems in your code</p>
									</div>
								</div>
								<div class="flex items-center space-x-3 rounded-lg border p-4">
									<Checkbox bind:checked={prettier} id="prettier" />
									<div class="grid gap-1.5 leading-none">
										<Label
											for="prettier"
											class="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
										>
											Prettier
										</Label>
										<p class="text-xs text-muted-foreground">Format your code automatically</p>
									</div>
								</div>
								<div class="flex items-center space-x-3 rounded-lg border p-4">
									<Checkbox bind:checked={tailwindcss} id="tailwindcss" />
									<div class="grid gap-1.5 leading-none">
										<Label
											for="tailwindcss"
											class="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
										>
											Tailwind CSS
										</Label>
										<p class="text-xs text-muted-foreground">Utility-first CSS framework</p>
									</div>
								</div>
							</div>
						</div>

						<Separator />

						<!-- Additional Dependencies -->
						<div class="space-y-2">
							<Label for="additionalDeps">Additional Dependencies</Label>
							<Input
								id="additionalDeps"
								bind:value={additionalDependencies}
								placeholder="lodash, axios, uuid (comma-separated)"
							/>
							<p class="text-xs text-muted-foreground">Enter package names separated by commas</p>
						</div>

						<Separator />

						<Button onclick={createProject} disabled={creating} class="w-full" size="lg">
							{#if creating}
								<div
									class="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-background"
								></div>
								Creating Project...
							{:else}
								<Rocket class="mr-2 h-4 w-4" />
								Create Project
							{/if}
						</Button>
					</CardContent>
				</Card>
			{/if}
		</div>
	</div>
</div>
