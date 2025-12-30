<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { ProjectConfiguration } from '$lib/components/ui/project-configuration/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { isAuthenticated, user } from '$lib/stores/auth';
	import { cn } from '$lib/utils';
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
	import { ArrowLeft, CheckCircle, Rocket } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
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

	// Custom GitHub repository support
	let useCustomRepo = $state(false);
	let customGithubUrl = $state('');
	let customRepoError = $state('');

	let frameworks = $state<any[]>([]);
	let loading = $state(false);
	let creating = $state(false);
	let projectId = $state<string | null>(null);

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
				return {
					framework,
					useCustomRepo,
					customGithubUrl: useCustomRepo ? customGithubUrl : undefined
				};
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
		useCustomRepo = false;
		customGithubUrl = '';
		customRepoError = '';
		if (isStepValid()) {
			nextStep();
		}
	}

	/**
	 * Validate and parse custom GitHub URL
	 * Supports formats:
	 * - https://github.com/owner/repo
	 * - github.com/owner/repo
	 * - owner/repo
	 */
	function validateCustomGithubUrl(url: string): {
		isValid: boolean;
		error?: string;
		parsed?: { owner: string; repo: string };
	} {
		if (!url.trim()) {
			return { isValid: false, error: 'GitHub URL is required' };
		}

		// Remove trailing slashes and .git suffix
		url = url
			.trim()
			.replace(/\.git$/, '')
			.replace(/\/$/, '');

		let owner = '';
		let repo = '';

		// Try to parse various formats
		// Format 1: https://github.com/owner/repo
		const fullUrlMatch = url.match(/^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)/);
		if (fullUrlMatch) {
			owner = fullUrlMatch[1];
			repo = fullUrlMatch[2];
		} else {
			// Format 2: github.com/owner/repo
			const domainMatch = url.match(/^github\.com\/([^\/]+)\/([^\/]+)/);
			if (domainMatch) {
				owner = domainMatch[1];
				repo = domainMatch[2];
			} else {
				// Format 3: owner/repo
				const shortMatch = url.match(/^([^\/]+)\/([^\/]+)$/);
				if (shortMatch) {
					owner = shortMatch[1];
					repo = shortMatch[2];
				}
			}
		}

		if (!owner || !repo) {
			return {
				isValid: false,
				error: 'Invalid GitHub URL format. Use: owner/repo or https://github.com/owner/repo'
			};
		}

		// Validate owner and repo names (GitHub username/repo rules)
		const validNamePattern = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
		const validRepoPattern = /^[a-zA-Z0-9._-]+$/;

		if (!validNamePattern.test(owner)) {
			return { isValid: false, error: 'Invalid GitHub username/organization' };
		}

		if (!validRepoPattern.test(repo)) {
			return { isValid: false, error: 'Invalid repository name' };
		}

		return { isValid: true, parsed: { owner, repo } };
	}

	function handleCustomRepoInput(event: Event) {
		const target = event.target as HTMLInputElement;
		customGithubUrl = target.value;
		customRepoError = '';
	}

	function handleCustomRepoBlur() {
		if (customGithubUrl.trim()) {
			const validation = validateCustomGithubUrl(customGithubUrl);
			if (!validation.isValid) {
				customRepoError = validation.error || 'Invalid GitHub URL';
			} else {
				customRepoError = '';
			}
		}
	}

	function selectCustomRepo() {
		const validation = validateCustomGithubUrl(customGithubUrl);
		if (!validation.isValid) {
			customRepoError = validation.error || 'Invalid GitHub URL';
			return;
		}

		// Set framework to 'custom' and enable custom repo mode
		framework = 'custom';
		useCustomRepo = true;
		customRepoError = '';

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

		// Parse custom GitHub URL if using custom repo
		let customRepoData: { owner: string; repo: string; branch?: string } | undefined;
		console.log(
			'🔍 Frontend DEBUG: useCustomRepo =',
			useCustomRepo,
			'customGithubUrl =',
			customGithubUrl
		);

		if (useCustomRepo && customGithubUrl) {
			const validation = validateCustomGithubUrl(customGithubUrl);
			if (!validation.isValid || !validation.parsed) {
				showErrorToast(validation.error || 'Invalid GitHub URL');
				return;
			}
			customRepoData = validation.parsed;
			console.log(
				'✅ Frontend DEBUG: customRepoData parsed:',
				JSON.stringify(customRepoData, null, 2)
			);
		}

		// Final validation
		const projectData = {
			name: projectName.trim(),
			description: projectDescription.trim() || undefined,
			framework,
			sandboxProvider: sandboxProvider as 'daytona',
			customRepo: customRepoData,
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
					toast.success('Project created! Redirecting to editor...');

					// Redirect immediately to editor page where initialization will be shown
					setTimeout(() => {
						goto(`/editor/${projectId}`);
					}, 500);
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

									<!-- Custom GitHub Repository Option -->
									<div class="space-y-3">
										<h3 class="text-lg font-semibold text-foreground">
											Or Use Your Own Repository
										</h3>
										<div class="rounded-lg border border-border bg-card p-6">
											<div class="space-y-4">
												<div class="flex items-start gap-3">
													<div class="flex-1 space-y-1">
														<h4 class="font-semibold">Clone from GitHub</h4>
														<p class="text-sm text-muted-foreground">
															Enter any public GitHub repository URL to use as your starting
															template
														</p>
													</div>
													{#if useCustomRepo && framework === 'custom'}
														<div class="h-3 w-3 rounded-full bg-primary"></div>
													{/if}
												</div>

												<div class="space-y-3">
													<div class="space-y-2">
														<Label for="customGithubUrl" class="text-sm font-medium">
															GitHub Repository URL
														</Label>
														<Input
															id="customGithubUrl"
															type="text"
															bind:value={customGithubUrl}
															oninput={handleCustomRepoInput}
															onblur={handleCustomRepoBlur}
															placeholder="e.g., owner/repo or https://github.com/owner/repo"
															class={cn(
																'font-mono text-sm',
																customRepoError ? 'border-destructive' : ''
															)}
															disabled={formState === FORM_STATES.SUBMITTING}
														/>
														{#if customRepoError}
															<p
																class="text-sm text-destructive"
																transition:slide={{ duration: 200 }}
															>
																{customRepoError}
															</p>
														{/if}
														<p class="text-xs text-muted-foreground">
															Supported formats: <code class="rounded bg-muted px-1 py-0.5"
																>owner/repo</code
															> or full URL
														</p>
													</div>

													<Button
														onclick={() => {
															useCustomRepo = true;
															selectCustomRepo();
														}}
														variant={useCustomRepo && framework === 'custom'
															? 'default'
															: 'outline'}
														class="w-full"
														disabled={!customGithubUrl.trim() ||
															formState === FORM_STATES.SUBMITTING}
													>
														{#if useCustomRepo && framework === 'custom'}
															<CheckCircle class="mr-2 h-4 w-4" />
															Selected
														{:else}
															Use This Repository
														{/if}
													</Button>
												</div>
											</div>
										</div>
									</div>
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
	</div>
</div>
