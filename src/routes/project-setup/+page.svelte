<script lang="ts">
	import { goto } from '$app/navigation';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import { ProjectConfiguration } from '$lib/components/ui/project-configuration/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { isAuthenticated, user } from '$lib/stores/auth';
	import { cn } from '$lib/utils';
	import { ArrowLeft, CheckCircle, Rocket, Settings } from 'lucide-svelte';
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
	import { FORM_STATES, type FormState } from '$lib/utils/form-validation';
	import {
		getStepValidation,
		validateProjectNameFormat,
		validateProjectSetup
	} from '$lib/validations/project.validation';
	import FrameworkIcon from '@/components/ui/framework-icon/framework-icon.svelte';
	import { slide } from 'svelte/transition';

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

	// Simple validation state
	let validationErrors = $state<ValidationError[]>([]);
	let touchedFields = $state(new Set<string>());

	// Dynamic step information
	const stepInfo = $derived(() => {
		switch (currentStep) {
			case 1:
				return {
					title: 'Project Details',
					description: 'Please select the customer and confirm their details.'
				};
			case 2:
				return {
					title: 'Choose Framework',
					description: 'Select the technology stack for your project.'
				};
			case 3:
				return {
					title: 'Development Environment',
					description: 'Choose your preferred sandbox provider.'
				};
			case 4:
				return {
					title: 'Project Configuration',
					description: 'Customize your development tools and dependencies.'
				};
			default:
				return {
					title: 'Create Project',
					description: 'Setup your development environment'
				};
		}
	});

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
		return validation.isValid;
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
						additionalDependencies
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
				console.log('Loaded frameworks:', frameworks.length, frameworks);
			} else {
				console.error('Failed to fetch frameworks:', response.status, response.statusText);
				// Fallback to basic frameworks if API fails
				frameworks = [
					{
						id: 'react',
						name: 'React',
						description: 'A JavaScript library for building user interfaces',
						version: '18.x',
						category: 'frontend',
						icon: 'react',
						tags: ['javascript', 'typescript', 'frontend', 'spa'],
						features: ['Hot Reload', 'Component-based', 'Virtual DOM', 'JSX'],
						stackblitzId: 'react'
					},
					{
						id: 'vue',
						name: 'Vue.js',
						description: 'The progressive JavaScript framework',
						version: '3.x',
						category: 'frontend',
						icon: 'vue',
						tags: ['javascript', 'typescript', 'frontend', 'spa'],
						features: ['Reactive Data', 'Component-based', 'Template Syntax', 'Progressive'],
						stackblitzId: 'vue'
					},
					{
						id: 'svelte',
						name: 'Svelte',
						description: 'Cybernetically enhanced web apps',
						version: '4.x',
						category: 'frontend',
						icon: 'svelte',
						tags: ['javascript', 'typescript', 'frontend', 'spa'],
						features: [
							'No Virtual DOM',
							'Compile-time Optimizations',
							'Reactive',
							'Small Bundle Size'
						],
						stackblitzId: 'svelte'
					}
				];
				toast.error('Failed to load available frameworks, using defaults');
			}
		} catch (error) {
			console.error('Error loading frameworks:', error);
			// Fallback to basic frameworks if network fails
			frameworks = [
				{
					id: 'react',
					name: 'React',
					description: 'A JavaScript library for building user interfaces',
					version: '18.x',
					category: 'frontend',
					icon: 'react',
					tags: ['javascript', 'typescript', 'frontend', 'spa'],
					features: ['Hot Reload', 'Component-based', 'Virtual DOM', 'JSX'],
					stackblitzId: 'react'
				},
				{
					id: 'vue',
					name: 'Vue.js',
					description: 'The progressive JavaScript framework',
					version: '3.x',
					category: 'frontend',
					icon: 'vue',
					tags: ['javascript', 'typescript', 'frontend', 'spa'],
					features: ['Reactive Data', 'Component-based', 'Template Syntax', 'Progressive'],
					stackblitzId: 'vue'
				}
			];
			toast.error('Network error while loading frameworks, using defaults');
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

	function handleStepClick(step: number) {
		if (step < currentStep) {
			currentStep = step;
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
	}

	function handleProjectNameBlur(): void {
		// Project name validation is handled by the derived projectNameErrorMessage
	}

	async function createProject() {
		if (formState === FORM_STATES.SUBMITTING) return;

		// Final validation
		const projectData = {
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
				additionalDependencies
			}
		};
		const validation = validateProjectSetup(projectData);
		if (!validation.success) {
			formState = FORM_STATES.ERROR;
			console.error('Project setup validation failed:', validation.errors);
			showErrorToast('Please fix all validation errors before creating the project.');
			return;
		}

		// Use the validated and transformed data for the API call
		const validatedProjectData = validation.data;

		if (!$user) {
			showErrorToast('You must be logged in to create a project');
			goto('/auth/login');
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
						body: JSON.stringify(validatedProjectData)
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

<svelte:head>
	<title>Project Setup - Aura</title>
	<meta name="description" content="Set up your new project with Aura" />
</svelte:head>

<div class="min-h-screen bg-background">
	<!-- Modern Layout with Sidebar -->
	<div class="flex h-screen">
		<!-- Sidebar Navigation -->
		<div class="flex w-64 flex-col border-r bg-background">
			<!-- Header with Logo -->
			<div class="border-b p-4">
				<Button variant="ghost" onclick={goBack} class=" mb-4 justify-start text-muted-foreground">
					<ArrowLeft class="mr-2 h-4 w-4" />
					Back
				</Button>
				<div class="flex items-center gap-3">
					<img src="/aura.png" alt="Aura" class="h-8 w-8" />
				</div>
				<div class="mt-8">
					{#key stepInfo()?.title}
						<h1 transition:slide class="font-semibold text-foreground">{stepInfo().title}</h1>
						<p transition:slide class="text-sm text-muted-foreground">{stepInfo().description}</p>
					{/key}
				</div>
			</div>

			<!-- Simple Steps List -->
			<div class="flex-grow p-4">
				<div class="space-y-1">
					{#each steps as step}
						{@const status = getStepStatus(step.number)}
						<button
							class={cn(
								'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
								status === 'current'
									? 'bg-foreground text-background'
									: status === 'completed'
										? 'text-foreground hover:bg-muted/50'
										: 'cursor-not-allowed text-muted-foreground'
							)}
							onclick={() => handleStepClick(step.number)}
							disabled={step.number > currentStep}
						>
							<div
								class={cn(
									'flex h-5 w-5 items-center justify-center rounded-full text-xs',
									status === 'current'
										? 'bg-background text-foreground'
										: status === 'completed'
											? 'bg-foreground text-background'
											: 'bg-muted text-muted-foreground'
								)}
							>
								{#if status === 'completed'}
									•
								{:else}
									{step.number}
								{/if}
							</div>

							<span class="font-medium">{step.title}</span>
						</button>
					{/each}
				</div>
			</div>

			<!-- Save & Close Button -->
		</div>

		<!-- Main Content Area -->
		<div class="flex-1 overflow-auto">
			<div class="flex min-h-full items-center justify-center p-6">
				<div class="w-full max-w-4xl">
					{#if loading}
						<!-- Loading State -->
						<div class="space-y-6">
							<div class="space-y-2">
								<Skeleton class="h-8 w-64" />
								<Skeleton class="h-4 w-96" />
							</div>
							<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
								{#each Array(6) as _}
									<Skeleton class="h-32 w-full" />
								{/each}
							</div>
						</div>
					{:else if currentStep === 1}
						<!-- Step 1: Project Details -->
						<div class="mx-auto max-w-2xl space-y-6">
							<div class="space-y-6">
								<div class="space-y-3">
									<Label for="projectName" class="text-sm font-medium">Project Name *</Label>
									<Input
										id="projectName"
										bind:value={projectName}
										placeholder="my-awesome-app"
										required
										class={cn(
											'h-12 text-base',
											projectNameErrorMessage() ? 'border-red-500 focus-visible:ring-red-500' : ''
										)}
										oninput={handleProjectNameInput}
										onblur={handleProjectNameBlur}
										disabled={formState === FORM_STATES.SUBMITTING}
									/>
									{#if projectNameErrorMessage()}
										<p class="text-sm text-red-600 dark:text-red-400">
											{projectNameErrorMessage()}
										</p>
									{/if}
								</div>

								<div class="space-y-3">
									<Label for="projectDescription" class="text-sm font-medium"
										>Description (Optional)</Label
									>
									<Textarea
										id="projectDescription"
										bind:value={projectDescription}
										placeholder="A brief description of your project"
										rows={4}
										maxlength={500}
										class="text-base"
										disabled={formState === FORM_STATES.SUBMITTING}
									/>
									<div class="text-right text-xs text-muted-foreground">
										{projectDescription.length}/500
									</div>
								</div>
							</div>
							<div class="flex justify-between">
								{#if currentStep > 1}
									<Button variant="outline" onclick={goBack}>
										<ArrowLeft class="mr-2 h-4 w-4" />
										Back
									</Button>
								{/if}
								<Button
									onclick={nextStep}
									disabled={!isStepValid() || formState === FORM_STATES.SUBMITTING}
									size="lg"
									class="px-8"
								>
									Continue
									<ArrowLeft class="ml-2 h-4 w-4 rotate-180" />
								</Button>
							</div>
						</div>
					{:else if currentStep === 2}
						<!-- Step 2: Framework Selection -->
						<div class="space-y-6">
							{#if frameworks && frameworks.length > 0}
								{@const popularFrameworks = frameworks.filter((fw) =>
									['react', 'nextjs', 'vue', 'svelte', 'angular'].includes(fw.id)
								)}
								{@const otherFrameworks = frameworks.filter(
									(fw) => !['react', 'nextjs', 'vue', 'svelte', 'angular'].includes(fw.id)
								)}

								<div class="space-y-6">
									<!-- Popular Frameworks -->
									{#if popularFrameworks.length > 0}
										<div class="space-y-3">
											<h3 class="text-lg font-semibold text-foreground">Popular Choices</h3>
											<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
												{#each popularFrameworks as fw (fw.id)}
													<button
														class={cn(
															'group relative rounded-lg border bg-card p-4 text-left transition-all hover:shadow-sm',
															framework === fw.id
																? 'border-primary shadow-sm ring-1 ring-primary/20'
																: 'border-border hover:border-primary/50'
														)}
														onclick={() => selectFramework(fw)}
													>
														{#if framework === fw.id}
															<div class="absolute top-4 right-4">
																<div class="h-3 w-3 rounded-full bg-primary"></div>
															</div>
														{/if}

														<div class="space-y-3">
															<!-- Framework Icon -->
															<div
																class="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/30"
															>
																<FrameworkIcon framework={fw.icon} class="h-6 w-6 text-primary" />
															</div>

															<!-- Framework Info -->
															<div class="space-y-1">
																<h4 class="font-semibold">{fw.name}</h4>
																<p class="text-sm text-muted-foreground">
																	{fw.description}
																</p>
															</div>
														</div>
													</button>
												{/each}
											</div>
										</div>
									{/if}

									<!-- Other Frameworks -->
									{#if otherFrameworks.length > 0}
										<div class="space-y-3">
											<h3 class="text-lg font-semibold text-foreground">More Options</h3>
											<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
												{#each otherFrameworks as fw (fw.id)}
													<button
														class={cn(
															'flex items-center gap-3 rounded-lg border bg-card p-3 text-left transition-all hover:shadow-sm',
															framework === fw.id
																? 'border-primary bg-primary/5'
																: 'border-border hover:border-primary/50'
														)}
														onclick={() => selectFramework(fw)}
													>
														<div
															class="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/30"
														>
															<FrameworkIcon framework={fw.icon} class="h-5 w-5 text-primary" />
														</div>
														<div class="min-w-0 flex-1">
															<h4 class="truncate text-sm font-medium">{fw.name}</h4>
															<p class="text-xs text-muted-foreground capitalize">{fw.category}</p>
														</div>
														{#if framework === fw.id}
															<div class="h-2 w-2 rounded-full bg-primary"></div>
														{/if}
													</button>
												{/each}
											</div>
										</div>
									{/if}
								</div>
							{:else}
								<div class="flex flex-col items-center justify-center py-12 text-center">
									<div class="mb-4 text-6xl opacity-50">⚠️</div>
									<h3 class="mb-2 text-lg font-semibold">No frameworks available</h3>
									<p class="mb-4 text-sm text-muted-foreground">Please try refreshing the page.</p>
									<Button onclick={() => window.location.reload()} variant="outline">
										Refresh Page
									</Button>
								</div>
							{/if}

							<!-- Navigation Buttons for Step 2 -->
							<div class="flex justify-between pt-6">
								<Button variant="outline" onclick={goBack}>
									<ArrowLeft class="mr-2 h-4 w-4" />
									Back
								</Button>
								{#if framework}
									<Button onclick={nextStep} size="lg" class="px-8">
										Continue
										<ArrowLeft class="ml-2 h-4 w-4 rotate-180" />
									</Button>
								{/if}
							</div>
						</div>
					{:else if currentStep === 3}
						<!-- Step 3: Sandbox Provider Selection -->
						<div class="mx-auto max-w-2xl space-y-6">
							<div class="grid gap-4 sm:grid-cols-2">
								<!-- Daytona Provider -->
								<button
									class={cn(
										'relative rounded-lg border p-6 text-left transition-all hover:shadow-md',
										sandboxProvider === 'daytona'
											? 'border-foreground bg-foreground/5 ring-1 ring-foreground/20'
											: 'border-border hover:border-foreground/50'
									)}
									onclick={() => (sandboxProvider = 'daytona')}
								>
									{#if sandboxProvider === 'daytona'}
										<div class="absolute top-4 right-4">
											<div class="h-3 w-3 rounded-full bg-foreground"></div>
										</div>
									{/if}

									<div class="space-y-4">
										<div class="flex items-center gap-3">
											<img
												src="https://cdn-1.webcatalog.io/catalog/daytona/daytona-icon-filled-256.png?v=1721721896194"
												alt="Daytona"
												class="h-8 w-8 rounded"
											/>
											<h3 class="font-semibold">Daytona</h3>
										</div>
										<p class="text-sm text-muted-foreground">
											Persistent sandbox with git operations and direct terminal access
										</p>
										<div class="flex flex-wrap gap-2">
											<span class="rounded-full bg-muted px-2 py-1 text-xs">Persistent</span>
											<span class="rounded-full bg-muted px-2 py-1 text-xs">Git Integration</span>
											<span class="rounded-full bg-muted px-2 py-1 text-xs">SSH Access</span>
										</div>
									</div>
								</button>

								<!-- E2B Provider -->
								<button
									class={cn(
										'relative rounded-lg border p-6 text-left transition-all hover:shadow-md',
										sandboxProvider === 'e2b'
											? 'border-foreground bg-foreground/5 ring-1 ring-foreground/20'
											: 'border-border hover:border-foreground/50'
									)}
									onclick={() => (sandboxProvider = 'e2b')}
								>
									{#if sandboxProvider === 'e2b'}
										<div class="absolute top-4 right-4">
											<div class="h-3 w-3 rounded-full bg-foreground"></div>
										</div>
									{/if}

									<div class="space-y-4">
										<div class="flex items-center gap-3">
											<img
												src="https://cdn-1.webcatalog.io/catalog/e2b/e2b-icon-filled-256.webp?v=1757567241849"
												alt="E2B"
												class="h-8 w-8 rounded"
											/>
											<h3 class="font-semibold">E2B</h3>
										</div>
										<p class="text-sm text-muted-foreground">
											Cloud-based sandbox with R2 storage integration
										</p>
										<div class="flex flex-wrap gap-2">
											<span class="rounded-full bg-muted px-2 py-1 text-xs">Cloud Storage</span>
											<span class="rounded-full bg-muted px-2 py-1 text-xs">Fast Startup</span>
											<span class="rounded-full bg-muted px-2 py-1 text-xs">API-driven</span>
										</div>
									</div>
								</button>
							</div>

							<div class="flex justify-between pt-4">
								<Button variant="outline" onclick={goBack}>
									<ArrowLeft class="mr-2 h-4 w-4" />
									Back
								</Button>
								<Button onclick={nextStep} disabled={!isStepValid()} size="lg" class="px-8">
									Continue to Configuration
									<ArrowLeft class="ml-2 h-4 w-4 rotate-180" />
								</Button>
							</div>
						</div>
					{:else if currentStep === 4}
						<!-- Step 4: Configuration -->
						<div class="space-y-6">
							{#if currentStepErrors().length > 0}
								<div
									class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/50"
								>
									<div class="flex items-center gap-2">
										<div class="h-5 w-5 text-red-500">⚠️</div>
										<h4 class="font-medium text-red-800 dark:text-red-200">Validation Errors</h4>
									</div>
									<ul class="mt-2 list-inside list-disc text-sm text-red-700 dark:text-red-300">
										{#each currentStepErrors() as error}
											<li>{error}</li>
										{/each}
									</ul>
								</div>
							{/if}

							<ProjectConfiguration
								{packageManager}
								{typescript}
								{eslint}
								{prettier}
								{tailwindcss}
								{additionalDependencies}
								onPackageManagerChange={(value) => (packageManager = value)}
								onTypescriptChange={(value) => (typescript = value)}
								onEslintChange={(value) => (eslint = value)}
								onPrettierChange={(value) => (prettier = value)}
								onTailwindChange={(value) => (tailwindcss = value)}
								onDependenciesChange={(value) => (additionalDependencies = value)}
							/>

							<div class="flex justify-between pt-4">
								<Button variant="outline" onclick={goBack}>
									<ArrowLeft class="mr-2 h-4 w-4" />
									Back
								</Button>
								<Button
									onclick={createProject}
									disabled={creating || formState === FORM_STATES.SUBMITTING || !isStepValid()}
									size="lg"
									class="px-8"
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
							</div>
						</div>
					{/if}
				</div>
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
</div>
