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
	import { AlertCircleIcon, ArrowLeft, CheckCircle, Rocket, Settings } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	// Import validation utilities
	import {
		ApiError,
		handleFormSubmission,
		logError,
		showErrorToast,
		type ValidationError
	} from '$lib/utils/error-handling';
	import {
		createDebouncedValidator,
		FORM_STATES,
		type FormState
	} from '$lib/utils/form-validation';
	import {
		checkProjectNameAvailability,
		getStepValidation,
		validateProjectNameFormat,
		validateProjectSetup,
		type ProjectSetupData
	} from '$lib/validations/project.validation';

	let currentStep = $state(1);
	let projectName = $state('');
	let projectDescription = $state('');
	let framework = $state('');
	let sandboxProvider = $state('daytona'); // Default to Daytona
	let packageManager = $state('npm');
	let typescript = $state(true);
	let eslint = $state(true);
	let prettier = $state(true);
	let tailwindcss = $state(true);
	let additionalDependencies = $state('');

	let frameworks = $state<any[]>([]);
	let loading = $state(false);
	let creating = $state(false);
	let projectId = $state<string | null>(null);
	let statusPolling = $state<NodeJS.Timeout | null>(null);
	let currentStatus = $state<{
		phase: string;
		progress: number;
		message: string;
		details?: any;
	} | null>(null);

	// Form validation state
	let formState: FormState = $state(FORM_STATES.IDLE);
	let projectNameCheckState = $state<'idle' | 'checking' | 'available' | 'unavailable'>('idle');
	let projectNameAvailabilityMessage = $state('');

	// Simple validation state
	let validationErrors = $state<ValidationError[]>([]);
	let touchedFields = $state(new Set<string>());

	// Debounced validations
	const debouncedProjectNameValidation = createDebouncedValidator(async () => {
		if (projectName.trim()) {
			const formatValidation = validateProjectNameFormat(projectName);
			if (formatValidation.isValid) {
				projectNameCheckState = 'checking';
				try {
					const availability = await checkProjectNameAvailability(projectName);
					projectNameCheckState = availability.isAvailable ? 'available' : 'unavailable';
					projectNameAvailabilityMessage = availability.message || '';
				} catch (error) {
					projectNameCheckState = 'idle';
					projectNameAvailabilityMessage = 'Unable to check availability';
				}
			} else {
				projectNameCheckState = 'idle';
				projectNameAvailabilityMessage = formatValidation.errors[0] || '';
			}
		} else {
			projectNameCheckState = 'idle';
			projectNameAvailabilityMessage = '';
		}
	}, 800);

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

	// Sandbox provider options
	const sandboxProviderOptions = [
		{
			value: 'daytona',
			label: 'Daytona',
			description: 'Persistent sandbox with git operations and direct terminal access',
			features: ['Persistent', 'Git Integration', 'SSH Access', 'VS Code Support']
		},
		{
			value: 'e2b',
			label: 'E2B',
			description: 'Cloud-based sandbox with R2 storage integration',
			features: ['Cloud Storage', 'Fast Startup', 'Session-based', 'API-driven']
		}
	];

	function getPackageManagerLabel(value: string) {
		const option = packageManagerOptions.find((opt) => opt.value === value);
		return option?.label || value;
	}

	// Enhanced validation with real-time feedback
	const isStepValid = $derived(() => {
		const currentData = getCurrentStepData();
		const validation = getStepValidation(currentStep, currentData);
		return validation.isValid && (currentStep !== 1 || projectNameCheckState === 'available');
	});

	const getCurrentStepData = () => {
		switch (currentStep) {
			case 1:
				return { name: projectName, description: projectDescription };
			case 2:
				return { framework };
			case 3:
				return { sandboxProvider };
			case 4:
				return {
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
				};
			default:
				return {};
		}
	};

	// Enhanced error messages
	const projectNameErrorMessage = $derived(() => {
		if (!projectName.trim()) return '';

		const formatValidation = validateProjectNameFormat(projectName);
		if (!formatValidation.isValid) {
			return formatValidation.errors[0] || 'Invalid project name';
		}

		if (projectNameCheckState === 'unavailable') {
			return projectNameAvailabilityMessage || 'This project name is not available';
		}

		return '';
	});

	const currentStepErrors = $derived(() => {
		const currentData = getCurrentStepData();
		const validation = getStepValidation(currentStep, currentData);
		return validation.errors;
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
		if (currentStep < 4 && isStepValid()) {
			currentStep++;
		}
	}

	function selectFramework(selectedFramework: any) {
		framework = selectedFramework.id;
		if (isStepValid()) {
			nextStep();
		}
	}

	// Input handlers with validation
	function handleProjectNameInput(event: Event): void {
		const target = event.target as HTMLInputElement;
		projectName = target.value;
		debouncedProjectNameValidation();
	}

	function handleProjectNameBlur(): void {
		if (projectName.trim()) {
			const formatValidation = validateProjectNameFormat(projectName);
			if (!formatValidation.isValid) {
				projectNameAvailabilityMessage = formatValidation.errors[0] || 'Invalid project name';
				projectNameCheckState = 'unavailable';
			}
		}
	}

	async function createProject() {
		if (formState === FORM_STATES.SUBMITTING) return;

		// Final validation
		const projectData: ProjectSetupData = {
			name: projectName.trim(),
			description: projectDescription.trim() || undefined,
			framework,
			sandboxProvider: sandboxProvider as 'daytona' | 'e2b',
			configuration: {
				typescript,
				eslint,
				prettier,
				tailwindcss,
				packageManager: packageManager as 'npm' | 'yarn' | 'pnpm' | 'bun',
				additionalDependencies: additionalDependencies
					.split(',')
					.map((dep) => dep.trim())
					.filter((dep) => dep.length > 0)
			}
		};

		const validation = validateProjectSetup(projectData);
		if (!validation.success) {
			formState = FORM_STATES.ERROR;
			showErrorToast('Please fix all validation errors before creating the project.');
			return;
		}

		if (!$user) {
			showErrorToast('You must be logged in to create a project');
			goto('/auth/login');
			return;
		}

		if (projectNameCheckState !== 'available') {
			showErrorToast('Please choose an available project name');
			return;
		}

		formState = FORM_STATES.SUBMITTING;
		creating = true;
		projectId = null;
		currentStatus = {
			phase: 'initializing',
			progress: 0,
			message: getStatusMessage('initializing', sandboxProvider),
			details: {}
		};

		const result = await handleFormSubmission(
			async () => {
				try {
					const response = await fetch('/api/projects', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify(projectData)
					});

					if (!response.ok) {
						let errorData: any = {};
						try {
							errorData = await response.json();
						} catch {
							// If we can't parse the response, use a generic error
						}

						throw new ApiError({
							message: errorData.message || errorData.error || 'Failed to create project',
							statusCode: response.status,
							code: errorData.code || `HTTP_${response.status}`,
							details: errorData.details || {}
						});
					}

					const result = await response.json();
					projectId = result.project?.id;

					if (!projectId) {
						throw new ApiError({
							message: 'Project created but no ID returned',
							statusCode: 500,
							code: 'MISSING_PROJECT_ID'
						});
					}

					return result;
				} catch (error) {
					logError(error, 'Project Creation');
					throw error;
				}
			},
			{
				loadingMessage: 'Creating your project...',
				onSuccess: (result) => {
					formState = FORM_STATES.SUCCESS;
					// Start polling for status
					startStatusPolling();
				},
				onError: (error) => {
					formState = FORM_STATES.ERROR;
					creating = false;
					logError(error, 'Project Creation Form');
				},
				suppressErrorToast: false
			}
		);
	}

	function startStatusPolling() {
		if (!projectId) return;

		// Poll every 2 seconds
		statusPolling = setInterval(async () => {
			try {
				const response = await fetch(`/api/projects/${projectId}/status`);
				if (response.ok) {
					const statusData = await response.json();

					if (statusData.success && statusData.data) {
						const initStatus = statusData.data.initialization;
						currentStatus = {
							phase: initStatus.status,
							progress: initStatus.progress || 0,
							message: getStatusMessage(initStatus.status, sandboxProvider),
							details: initStatus
						};

						// Check if project is ready
						if (initStatus.status === 'ready' || initStatus.status === 'completed') {
							stopStatusPolling();
							toast.success('Project created successfully!');
							// Redirect after a short delay to show completion
							setTimeout(() => {
								goto(`/editor/${projectId}`);
							}, 2000);
						} else if (initStatus.status === 'error') {
							stopStatusPolling();
							toast.error('Project creation failed');
							creating = false;
						}
					}
				}
			} catch (error) {
				console.error('Failed to poll project status:', error);
			}
		}, 2000);
	}

	function stopStatusPolling() {
		if (statusPolling) {
			clearInterval(statusPolling);
			statusPolling = null;
		}
	}

	function getStatusMessage(status: string, provider: string): string {
		const messages = {
			initializing: 'Initializing project...',
			downloading: 'Downloading template files...',
			uploading:
				provider === 'e2b'
					? 'Uploading files to cloud storage...'
					: 'Setting up sandbox environment...',
			'creating-sandboxes':
				provider === 'daytona'
					? 'Creating Daytona workspace and cloning project...'
					: 'Creating sandbox environment...',
			ready: 'Project ready!',
			completed: 'Project completed!',
			error: 'Project creation failed'
		};
		return messages[status as keyof typeof messages] || 'Working...';
	}

	// Get carousel phases based on provider
	function getCarouselPhases(provider: string) {
		const basePhases = [
			{
				id: 'initializing',
				title: 'Initializing',
				description: 'Setting up your project configuration',
				icon: Settings,
				color: 'text-blue-500'
			},
			{
				id: 'downloading',
				title: 'Downloading',
				description: 'Fetching template files and dependencies',
				icon: ArrowLeft, // We'll use this as download icon
				color: 'text-yellow-500'
			}
		];

		const providerPhases =
			provider === 'e2b'
				? [
						{
							id: 'uploading',
							title: 'Uploading',
							description: 'Storing files in secure cloud storage',
							icon: Rocket,
							color: 'text-purple-500'
						}
					]
				: [
						{
							id: 'uploading',
							title: 'Configuring',
							description: 'Setting up sandbox environment',
							icon: Rocket,
							color: 'text-purple-500'
						}
					];

		const finalPhases = [
			{
				id: 'creating-sandboxes',
				title: provider === 'daytona' ? 'Daytona Workspace' : 'E2B Sandbox',
				description:
					provider === 'daytona'
						? 'Creating persistent workspace with git integration'
						: 'Initializing cloud-powered sandbox',
				icon: CheckCircle,
				color: 'text-green-500'
			},
			{
				id: 'ready',
				title: 'Ready',
				description: 'Your development environment is ready!',
				icon: CheckCircle,
				color: 'text-green-500'
			}
		];

		return [...basePhases, ...providerPhases, ...finalPhases];
	}

	// Get current phase index for carousel
	const currentPhaseIndex = $derived(() => {
		if (!currentStatus) return 0;
		const phases = getCarouselPhases(sandboxProvider);
		const currentIndex = phases.findIndex((phase) => phase.id === currentStatus!.phase);
		return currentIndex >= 0 ? currentIndex : 0;
	});

	// Get visible phases for carousel (current + next few)
	const visiblePhases = $derived.by(() => {
		const phases = getCarouselPhases(sandboxProvider);
		const currentIdx = currentPhaseIndex();
		const startIdx = Math.max(0, currentIdx - 1);
		const endIdx = Math.min(phases.length, currentIdx + 3);
		return phases.slice(startIdx, endIdx) as Array<{
			id: string;
			title: string;
			description: string;
			icon: any;
			color: string;
		}>;
	});

	function getStepStatus(step: number) {
		if (step < currentStep) return 'completed';
		if (step === currentStep) return 'current';
		return 'upcoming';
	}

	function getProgressValue() {
		return ((currentStep - 1) / 3) * 100;
	}

	const steps = [
		{ number: 1, title: 'Project Details', description: 'Basic information about your project' },
		{ number: 2, title: 'Framework', description: 'Choose your JavaScript framework' },
		{ number: 3, title: 'Sandbox Provider', description: 'Choose your development environment' },
		{ number: 4, title: 'Configuration', description: 'Customize your project setup' }
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
						{#if currentStepErrors().length > 0}
							<div
								class="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
							>
								<AlertCircleIcon class="h-4 w-4 flex-shrink-0" />
								<div>
									<p class="font-medium">Please fix the following errors:</p>
									<ul class="mt-1 list-inside list-disc space-y-1">
										{#each currentStepErrors() as error}
											<li>{error}</li>
										{/each}
									</ul>
								</div>
							</div>
						{/if}

						<div class="space-y-2">
							<Label for="projectName">Project Name *</Label>
							<div class="relative">
								<Input
									id="projectName"
									bind:value={projectName}
									placeholder="my-awesome-app"
									required
									class={projectNameErrorMessage()
										? 'border-destructive focus-visible:ring-destructive'
										: projectNameCheckState === 'available'
											? 'border-green-500 focus-visible:ring-green-500'
											: ''}
									oninput={handleProjectNameInput}
									onblur={handleProjectNameBlur}
									disabled={formState === FORM_STATES.SUBMITTING}
								/>
								{#if projectNameCheckState === 'checking'}
									<div class="absolute top-3 right-3">
										<div
											class="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent"
										></div>
									</div>
								{:else if projectNameCheckState === 'available'}
									<CheckCircle class="absolute top-3 right-3 h-4 w-4 text-green-500" />
								{:else if projectNameCheckState === 'unavailable'}
									<AlertCircleIcon class="absolute top-3 right-3 h-4 w-4 text-destructive" />
								{/if}
							</div>
							{#if projectNameErrorMessage()}
								<p class="flex items-center gap-1 text-sm text-destructive">
									<AlertCircleIcon class="h-3 w-3" />
									{projectNameErrorMessage()}
								</p>
							{:else if projectNameCheckState === 'available'}
								<p class="flex items-center gap-1 text-sm text-green-600">
									<CheckCircle class="h-3 w-3" />
									This project name is available
								</p>
							{:else if projectNameAvailabilityMessage && projectNameCheckState === 'unavailable'}
								<p class="flex items-center gap-1 text-sm text-destructive">
									<AlertCircleIcon class="h-3 w-3" />
									{projectNameAvailabilityMessage}
								</p>
							{/if}
							<p class="text-xs text-muted-foreground">
								Project name must be 2-50 characters and can only contain letters, numbers, hyphens,
								and underscores
							</p>
						</div>
						<div class="space-y-2">
							<Label for="projectDescription">Description</Label>
							<Textarea
								id="projectDescription"
								bind:value={projectDescription}
								placeholder="A brief description of your project"
								rows={3}
								maxlength={500}
								disabled={formState === FORM_STATES.SUBMITTING}
							/>
							<div class="flex justify-between text-xs text-muted-foreground">
								<span>Optional but helpful for team collaboration</span>
								<span>{projectDescription.length}/500</span>
							</div>
						</div>
						<Button
							onclick={nextStep}
							disabled={!isStepValid() || formState === FORM_STATES.SUBMITTING}
							class="w-full"
							size="lg"
						>
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
				<!-- Step 3: Sandbox Provider Selection -->
				<Card>
					<CardHeader>
						<CardTitle class="flex items-center">
							<Settings class="mr-2 h-5 w-5" />
							Choose Sandbox Provider
						</CardTitle>
						<CardDescription>
							Select the development environment that best fits your workflow
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
							{#each sandboxProviderOptions as provider (provider.value)}
								<Card
									class="group cursor-pointer border-2 transition-all hover:border-primary hover:shadow-lg {sandboxProvider ===
									provider.value
										? 'border-primary bg-primary/5'
										: ''}"
									onclick={() => (sandboxProvider = provider.value)}
								>
									<CardContent class="p-6">
										<div class="mb-3 flex items-center justify-between">
											<h3 class="text-lg font-semibold group-hover:text-primary">
												{provider.label}
											</h3>
											{#if sandboxProvider === provider.value}
												<CheckCircle class="h-5 w-5 text-primary" />
											{/if}
										</div>
										<p class="mb-3 text-sm text-muted-foreground">
											{provider.description}
										</p>
										<div class="flex flex-wrap gap-1">
											{#each provider.features as feature}
												<Badge variant="secondary" class="text-xs">{feature}</Badge>
											{/each}
										</div>
									</CardContent>
								</Card>
							{/each}
						</div>
						<Button onclick={nextStep} disabled={!isStepValid()} class="mt-6 w-full" size="lg">
							Continue
							<ArrowLeft class="ml-2 h-4 w-4 rotate-180" />
						</Button>
					</CardContent>
				</Card>
			{:else if currentStep === 4}
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
								disabled={formState === FORM_STATES.SUBMITTING}
								maxlength={500}
							/>
							<div class="flex justify-between text-xs text-muted-foreground">
								<span>Enter package names separated by commas (max 20 packages)</span>
								<span>{additionalDependencies.split(',').filter((d) => d.trim()).length}/20</span>
							</div>
						</div>

						<Separator />

						<Button
							onclick={createProject}
							disabled={creating || formState === FORM_STATES.SUBMITTING || !isStepValid()}
							class="w-full"
							size="lg"
						>
							{#if creating || formState === FORM_STATES.SUBMITTING}
								<div
									class="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-background"
								></div>
								Creating Project...
							{:else if formState === FORM_STATES.SUCCESS}
								<CheckCircle class="mr-2 h-4 w-4" />
								Project Created!
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

	<!-- Project Creation Status Modal -->
	{#if creating && currentStatus}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
		>
			<div class="w-full max-w-2xl space-y-8 rounded-lg bg-background p-8 shadow-2xl">
				<!-- Header -->
				<div class="space-y-2 text-center">
					<h3 class="text-xl font-semibold">Creating Your Project</h3>
					<p class="text-muted-foreground">
						{sandboxProvider === 'daytona'
							? 'Setting up your Daytona workspace'
							: 'Initializing your E2B sandbox'}
					</p>
				</div>

				<!-- Progress Carousel -->
				<div class="space-y-6">
					<!-- Phase Indicators -->
					<div class="flex justify-center space-x-2">
						{#each getCarouselPhases(sandboxProvider) as phase, index}
							{@const isActive = index === currentPhaseIndex()}
							{@const isCompleted = index < currentPhaseIndex()}
							{@const isUpcoming = index > currentPhaseIndex()}
							<div class="flex items-center">
								<div
									class={`flex h-3 w-3 items-center justify-center rounded-full transition-all duration-500 ${
										isCompleted
											? 'scale-110 bg-green-500'
											: isActive
												? 'scale-125 animate-pulse bg-primary'
												: 'scale-100 bg-muted'
									}`}
								>
									{#if isCompleted}
										<div class="h-1.5 w-1.5 rounded-full bg-white"></div>
									{/if}
								</div>
								{#if index < getCarouselPhases(sandboxProvider).length - 1}
									<div
										class={`h-0.5 w-8 transition-colors duration-500 ${
											isCompleted ? 'bg-green-500' : 'bg-muted'
										}`}
									></div>
								{/if}
							</div>
						{/each}
					</div>

					<!-- Current Phase Display -->
					<div class="min-h-[120px] space-y-4 text-center">
						{#each visiblePhases as phase, index}
							{@const isCurrent = phase.id === currentStatus.phase}
							{@const offset = index - 1}
							<!-- Center current phase -->
							<div
								class="absolute inset-0 flex transform items-center justify-center transition-all duration-700 ease-in-out"
								class:translate-x-0={offset === 0}
								class:translate-x-[-100%]={offset === -1}
								class:translate-x-[100%]={offset === 1}
								class:opacity-100={offset === 0}
								class:opacity-60={offset === -1 || offset === 1}
								class:opacity-30={offset === -2 || offset === 2}
								class:scale-100={offset === 0}
								class:scale-90={offset !== 0}
							>
								<div class="space-y-3 text-center">
									<div
										class={`mx-auto flex h-16 w-16 items-center justify-center rounded-full transition-all duration-500 ${
											isCurrent ? 'scale-110 bg-primary/10 shadow-lg' : 'bg-muted/50'
										}`}
									>
										<phase.icon
											class={`h-8 w-8 transition-all duration-500 ${
												isCurrent ? `${phase.color} animate-pulse` : 'text-muted-foreground'
											}`}
										/>
									</div>
									<div class="space-y-1">
										<h4
											class={`text-lg font-semibold transition-colors duration-500 ${
												isCurrent ? 'text-foreground' : 'text-muted-foreground'
											}`}
										>
											{phase.title}
										</h4>
										<p
											class={`text-sm transition-colors duration-500 ${
												isCurrent ? 'text-muted-foreground' : 'text-muted-foreground/70'
											}`}
										>
											{phase.description}
										</p>
									</div>
								</div>
							</div>
						{/each}
					</div>

					<!-- Progress Bar -->
					<div class="space-y-2">
						<Progress value={currentStatus.progress} class="h-3" />
						<div class="flex justify-between text-sm text-muted-foreground">
							<span class="capitalize">{currentStatus.phase.replace('-', ' ')}</span>
							<span>{Math.round(currentStatus.progress)}%</span>
						</div>
					</div>
				</div>

				<!-- Status Details -->
				{#if currentStatus.details}
					<div class="space-y-2 rounded-lg bg-muted/50 p-4 text-sm">
						{#if currentStatus.details.filesDownloaded !== undefined}
							<div class="flex justify-between">
								<span>Files processed:</span>
								<span class="font-medium">{currentStatus.details.filesDownloaded}</span>
							</div>
						{/if}
						{#if currentStatus.details.uploadProgress !== undefined}
							<div class="flex justify-between">
								<span>Upload progress:</span>
								<span class="font-medium">{currentStatus.details.uploadProgress}%</span>
							</div>
						{/if}
						{#if currentStatus.details.sandboxStatus}
							<div class="space-y-1">
								<span class="font-medium">Environment status:</span>
								{#each Object.entries(currentStatus.details.sandboxStatus) as [provider, status]}
									<div class="flex justify-between text-xs">
										<span class="capitalize">{provider}:</span>
										<Badge variant={status === 'ready' ? 'default' : 'secondary'} class="text-xs">
											{status}
										</Badge>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}

				<!-- Provider-specific footer message -->
				<div class="border-t pt-4 text-center text-sm text-muted-foreground">
					{#if sandboxProvider === 'daytona'}
						{#if currentStatus.phase === 'creating-sandboxes'}
							Setting up your persistent Daytona workspace with full git integration and terminal
							access...
						{:else if currentStatus.phase === 'ready'}
							🎉 Your Daytona workspace is ready! Start coding with full development environment
							access.
						{/if}
					{:else if sandboxProvider === 'e2b'}
						{#if currentStatus.phase === 'uploading'}
							Securely uploading your project to cloud storage for fast sandbox initialization...
						{:else if currentStatus.phase === 'creating-sandboxes'}
							Initializing your E2B sandbox with cloud-powered performance...
						{:else if currentStatus.phase === 'ready'}
							🚀 Your E2B sandbox is ready! Experience lightning-fast cloud development.
						{/if}
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
