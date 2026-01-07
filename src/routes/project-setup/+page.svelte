<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { isAuthenticated, user } from '$lib/stores/auth';
	import { cn } from '$lib/utils';
	import {
		ApiError,
		handleFormSubmission,
		logError,
		showErrorToast
	} from '$lib/utils/error-handling';
	import { FORM_STATES, type FormState } from '$lib/utils/form-validation';
	import {
		validateProjectNameFormat,
		validateProjectSetup
	} from '$lib/validations/project.validation';
	import FrameworkIcon from '@/components/ui/framework-icon/framework-icon.svelte';
	import { ArrowLeft, ChevronDown, Rocket, Settings, Sparkles } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { slide } from 'svelte/transition';

	// Core project state
	let projectName = $state('');
	let framework = $state('');
	let initialPrompt = $state(''); // What the user wants to build

	// Advanced settings (collapsed by default)
	let showAdvanced = $state(false);
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

	// UI state
	let frameworks = $state<any[]>([]);
	let loading = $state(false);
	let creating = $state(false);
	let projectId = $state<string | null>(null);
	let formState: FormState = $state(FORM_STATES.IDLE);

	// Package manager options
	const packageManagerOptions = [
		{ value: 'npm', label: 'npm' },
		{ value: 'yarn', label: 'Yarn' },
		{ value: 'pnpm', label: 'pnpm' },
		{ value: 'bun', label: 'Bun' }
	];

	// Validation
	const isFormValid = $derived(() => {
		const hasValidName = projectName.trim().length >= 2 && !projectNameErrorMessage();
		const hasFramework = framework || (useCustomRepo && customGithubUrl.trim());
		return hasValidName && hasFramework;
	});

	const projectNameErrorMessage = $derived(() => {
		if (!projectName.trim()) return '';
		const formatValidation = validateProjectNameFormat(projectName);
		if (!formatValidation.isValid) {
			return formatValidation.errors[0] || 'Invalid project name';
		}
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
		try {
			const response = await fetch('/api/projects/frameworks');
			if (response.ok) {
				const data = await response.json();
				frameworks = data.frameworks || [];
			} else {
				// Fallback frameworks
				frameworks = [
					{
						id: 'react',
						name: 'React',
						description: 'A JavaScript library for building user interfaces',
						icon: 'react'
					},
					{
						id: 'nextjs',
						name: 'Next.js',
						description: 'The React framework for production',
						icon: 'nextjs'
					},
					{
						id: 'vue',
						name: 'Vue.js',
						description: 'The progressive JavaScript framework',
						icon: 'vue'
					},
					{
						id: 'svelte',
						name: 'Svelte',
						description: 'Cybernetically enhanced web apps',
						icon: 'svelte'
					},
					{
						id: 'angular',
						name: 'Angular',
						description: 'Platform for building web applications',
						icon: 'angular'
					}
				];
				toast.error('Failed to load frameworks, using defaults');
			}
		} catch (error) {
			console.error('Error loading frameworks:', error);
			frameworks = [
				{ id: 'react', name: 'React', description: 'Build user interfaces', icon: 'react' },
				{ id: 'vue', name: 'Vue.js', description: 'Progressive framework', icon: 'vue' },
				{ id: 'svelte', name: 'Svelte', description: 'Compile-time framework', icon: 'svelte' }
			];
			toast.error('Network error, using default frameworks');
		} finally {
			loading = false;
		}
	});

	function selectFramework(selectedFramework: any) {
		framework = selectedFramework.id;
		useCustomRepo = false;
		customGithubUrl = '';
		customRepoError = '';
	}

	function validateCustomGithubUrl(url: string): {
		isValid: boolean;
		error?: string;
		parsed?: { owner: string; repo: string };
	} {
		if (!url.trim()) {
			return { isValid: false, error: 'GitHub URL is required' };
		}

		url = url
			.trim()
			.replace(/\.git$/, '')
			.replace(/\/$/, '');

		let owner = '';
		let repo = '';

		const fullUrlMatch = url.match(/^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)/);
		if (fullUrlMatch) {
			owner = fullUrlMatch[1];
			repo = fullUrlMatch[2];
		} else {
			const domainMatch = url.match(/^github\.com\/([^\/]+)\/([^\/]+)/);
			if (domainMatch) {
				owner = domainMatch[1];
				repo = domainMatch[2];
			} else {
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
				error: 'Invalid format. Use: owner/repo or https://github.com/owner/repo'
			};
		}

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

	function handleCustomRepoBlur() {
		if (customGithubUrl.trim()) {
			const validation = validateCustomGithubUrl(customGithubUrl);
			if (!validation.isValid) {
				customRepoError = validation.error || 'Invalid GitHub URL';
			} else {
				customRepoError = '';
				framework = 'custom';
				useCustomRepo = true;
			}
		}
	}

	async function createProject() {
		if (formState === FORM_STATES.SUBMITTING) return;

		let customRepoData: { owner: string; repo: string; branch?: string } | undefined;

		if (useCustomRepo && customGithubUrl) {
			const validation = validateCustomGithubUrl(customGithubUrl);
			if (!validation.isValid || !validation.parsed) {
				showErrorToast(validation.error || 'Invalid GitHub URL');
				return;
			}
			customRepoData = validation.parsed;
		}

		const projectData = {
			name: projectName.trim(),
			description: undefined,
			framework,
			sandboxProvider: 'daytona' as const,
			customRepo: customRepoData,
			initialPrompt: initialPrompt.trim() || undefined,
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
			showErrorToast('Please fix validation errors before creating the project.');
			return;
		}

		const validatedProjectData = validation.data;

		if (!$user) {
			showErrorToast('You must be logged in to create a project');
			goto('/auth/login');
			return;
		}

		formState = FORM_STATES.SUBMITTING;
		creating = true;
		projectId = null;

		await handleFormSubmission(
			async () => {
				const response = await fetch('/api/projects', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(validatedProjectData)
				});

				if (!response.ok) {
					let errorData: any = {};
					try {
						errorData = await response.json();
					} catch {}

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
			},
			{
				loadingMessage: 'Creating your project...',
				onSuccess: () => {
					formState = FORM_STATES.SUCCESS;
					toast.success('Project created! Redirecting to editor...');
					setTimeout(() => {
						goto(`/editor/${projectId}`);
					}, 500);
				},
				onError: (error) => {
					formState = FORM_STATES.ERROR;
					creating = false;
					logError(error, 'Project Creation');
				},
				suppressErrorToast: false
			}
		);
	}
</script>

<svelte:head>
	<title>New Project - Aura</title>
	<meta name="description" content="Create a new project with Aura" />
</svelte:head>

<div class="min-h-screen bg-background">
	<div class="mx-auto max-w-2xl px-4 py-12">
		<!-- Header -->
		<div class="mb-8">
			<Button variant="ghost" onclick={() => goto('/dashboard')} class="mb-6 -ml-2">
				<ArrowLeft class="mr-2 h-4 w-4" />
				Back to Dashboard
			</Button>

			<h1 class="text-3xl font-bold tracking-tight">Create New Project</h1>
			<p class="mt-2 text-muted-foreground">Get started with a template or your own repository</p>
		</div>

		{#if loading}
			<div class="space-y-6">
				<Skeleton class="h-12 w-full" />
				<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each Array(6) as _}
						<Skeleton class="h-24 w-full" />
					{/each}
				</div>
			</div>
		{:else}
			<div class="space-y-8">
				<!-- Project Name -->
				<div class="space-y-2">
					<Label for="projectName" class="text-sm font-medium">Project Name</Label>
					<Input
						id="projectName"
						bind:value={projectName}
						placeholder="my-awesome-app"
						class={cn(
							'h-12 text-base',
							projectNameErrorMessage() ? 'border-red-500 focus-visible:ring-red-500' : ''
						)}
						disabled={formState === FORM_STATES.SUBMITTING}
					/>
					{#if projectNameErrorMessage()}
						<p class="text-sm text-red-600 dark:text-red-400">
							{projectNameErrorMessage()}
						</p>
					{/if}
				</div>

				<!-- What do you want to build? -->
				<div class="space-y-2">
					<Label for="initialPrompt" class="text-sm font-medium">
						<span class="flex items-center gap-2">
							<Sparkles class="h-4 w-4 text-primary" />
							What do you want to build?
						</span>
					</Label>
					<Textarea
						id="initialPrompt"
						bind:value={initialPrompt}
						placeholder="e.g., A todo app with user authentication, drag-and-drop task ordering, and dark mode support"
						rows={3}
						class="text-base resize-none"
						disabled={formState === FORM_STATES.SUBMITTING}
					/>
					<p class="text-xs text-muted-foreground">
						Describe your project idea and the AI will help you build it
					</p>
				</div>

				<!-- Framework Selection -->
				<div class="space-y-3">
					<Label class="text-sm font-medium">Choose a Framework</Label>
					<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{#each frameworks.slice(0, 6) as fw (fw.id)}
							<button
								class={cn(
									'group relative rounded-lg border bg-card p-4 text-left transition-all hover:shadow-sm',
									framework === fw.id
										? 'border-primary ring-2 ring-primary/20'
										: 'border-border hover:border-primary/50'
								)}
								onclick={() => selectFramework(fw)}
							>
								{#if framework === fw.id}
									<div class="absolute top-3 right-3">
										<div class="h-2.5 w-2.5 rounded-full bg-primary"></div>
									</div>
								{/if}

								<div class="flex items-center gap-3">
									<div
										class="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50"
									>
										<FrameworkIcon framework={fw.icon} class="h-6 w-6" />
									</div>
									<div>
										<h4 class="font-medium">{fw.name}</h4>
										<p class="text-xs text-muted-foreground line-clamp-1">
											{fw.description}
										</p>
									</div>
								</div>
							</button>
						{/each}
					</div>

					<!-- Custom Repository -->
					<div class="mt-4 rounded-lg border border-dashed border-border p-4">
						<div class="space-y-3">
							<div class="flex items-center gap-2 text-sm text-muted-foreground">
								<span>Or clone from GitHub:</span>
							</div>
							<div class="flex gap-2">
								<Input
									type="text"
									bind:value={customGithubUrl}
									onblur={handleCustomRepoBlur}
									placeholder="owner/repo"
									class={cn('flex-1 font-mono text-sm', customRepoError ? 'border-red-500' : '')}
									disabled={formState === FORM_STATES.SUBMITTING}
								/>
							</div>
							{#if customRepoError}
								<p class="text-sm text-red-600 dark:text-red-400" transition:slide>
									{customRepoError}
								</p>
							{/if}
						</div>
					</div>
				</div>

				<!-- Advanced Settings (Collapsed) -->
				<div class="rounded-lg border border-border">
					<button
						class="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-muted/50"
						onclick={() => (showAdvanced = !showAdvanced)}
					>
						<div class="flex items-center gap-2">
							<Settings class="h-4 w-4 text-muted-foreground" />
							<span class="font-medium">Advanced Settings</span>
							<span class="text-xs text-muted-foreground">(optional)</span>
						</div>
						<ChevronDown
							class={cn(
								'h-4 w-4 text-muted-foreground transition-transform',
								showAdvanced ? 'rotate-180' : ''
							)}
						/>
					</button>

					{#if showAdvanced}
						<div class="border-t border-border p-4 space-y-6" transition:slide>
							<!-- Package Manager -->
							<div class="space-y-2">
								<Label class="text-sm font-medium">Package Manager</Label>
								<div class="flex flex-wrap gap-2">
									{#each packageManagerOptions as pm}
										<button
											class={cn(
												'rounded-md border px-3 py-1.5 text-sm transition-colors',
												packageManager === pm.value
													? 'border-primary bg-primary/10 text-primary'
													: 'border-border hover:border-primary/50'
											)}
											onclick={() => (packageManager = pm.value)}
										>
											{pm.label}
										</button>
									{/each}
								</div>
							</div>

							<!-- Development Tools -->
							<div class="space-y-2">
								<Label class="text-sm font-medium">Development Tools</Label>
								<div class="flex flex-wrap gap-2">
									<button
										class={cn(
											'rounded-md border px-3 py-1.5 text-sm transition-colors',
											typescript
												? 'border-primary bg-primary/10 text-primary'
												: 'border-border hover:border-primary/50'
										)}
										onclick={() => (typescript = !typescript)}
									>
										TypeScript
									</button>
									<button
										class={cn(
											'rounded-md border px-3 py-1.5 text-sm transition-colors',
											eslint
												? 'border-primary bg-primary/10 text-primary'
												: 'border-border hover:border-primary/50'
										)}
										onclick={() => (eslint = !eslint)}
									>
										ESLint
									</button>
									<button
										class={cn(
											'rounded-md border px-3 py-1.5 text-sm transition-colors',
											prettier
												? 'border-primary bg-primary/10 text-primary'
												: 'border-border hover:border-primary/50'
										)}
										onclick={() => (prettier = !prettier)}
									>
										Prettier
									</button>
									<button
										class={cn(
											'rounded-md border px-3 py-1.5 text-sm transition-colors',
											tailwindcss
												? 'border-primary bg-primary/10 text-primary'
												: 'border-border hover:border-primary/50'
										)}
										onclick={() => (tailwindcss = !tailwindcss)}
									>
										Tailwind CSS
									</button>
								</div>
							</div>

							<!-- Additional Dependencies -->
							<div class="space-y-2">
								<Label for="additionalDeps" class="text-sm font-medium">
									Additional Dependencies
								</Label>
								<Input
									id="additionalDeps"
									bind:value={additionalDependencies}
									placeholder="lodash, axios, dayjs (comma-separated)"
									class="text-sm"
									disabled={formState === FORM_STATES.SUBMITTING}
								/>
								<p class="text-xs text-muted-foreground">
									Packages to install when project is created
								</p>
							</div>
						</div>
					{/if}
				</div>

				<!-- Create Button -->
				<Button
					onclick={createProject}
					disabled={!isFormValid() || creating || formState === FORM_STATES.SUBMITTING}
					size="lg"
					class="w-full"
				>
					{#if creating || formState === FORM_STATES.SUBMITTING}
						<div class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent"></div>
						Creating Project...
					{:else}
						<Rocket class="mr-2 h-4 w-4" />
						Create Project
					{/if}
				</Button>
			</div>
		{/if}
	</div>
</div>
