<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { authActions } from '$lib/stores/auth';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import {
		ApiError,
		formatZodErrors,
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
	import { loginSchema, validateLogin, type LoginFormData } from '$lib/validations/auth.validation';
	import { authClient } from '@/auth.client';
	import GalleryVerticalEndIcon from '@lucide/svelte/icons/gallery-vertical-end';
	import { AlertCircleIcon, CheckCircleIcon, EyeIcon, EyeOffIcon } from 'lucide-svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();

	const id = Math.random().toString(36).substr(2, 9);

	// Form state
	let email = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let formState: FormState = $state(FORM_STATES.IDLE);

	// Simple validation state
	let validationErrors = $state<ValidationError[]>([]);
	let touchedFields = $state(new Set<string>());

	// Get success message from URL params if redirected from registration
	let successMessage = $state('');
	$effect(() => {
		const urlParams = new URLSearchParams($page.url.search);
		successMessage = urlParams.get('message') || '';
	});

	// Real-time validation with debouncing
	const debouncedEmailValidation = createDebouncedValidator(() => {
		if (email.trim()) {
			try {
				loginSchema.shape.email.parse(email);
				validationErrors = validationErrors.filter((e) => e.field !== 'email');
			} catch (error) {
				if (error instanceof Error) {
					validationErrors = [
						...validationErrors.filter((e) => e.field !== 'email'),
						{ field: 'email', message: 'Please enter a valid email address' }
					];
				}
			}
		}
	}, 500);

	const debouncedPasswordValidation = createDebouncedValidator(() => {
		if (password.trim()) {
			try {
				loginSchema.shape.password.parse(password);
				validationErrors = validationErrors.filter((e) => e.field !== 'password');
			} catch (error) {
				if (error instanceof Error) {
					validationErrors = [
						...validationErrors.filter((e) => e.field !== 'password'),
						{ field: 'password', message: 'Please enter a valid password' }
					];
				}
			}
		}
	}, 300);

	// Form validation state
	const isFormValid = $derived(() => {
		return email.trim() && password.trim() && validationErrors.length === 0;
	});

	const emailError = $derived.by(() => {
		return touchedFields.has('email')
			? validationErrors.find((e) => e.field === 'email')?.message
			: undefined;
	});

	const passwordError = $derived.by(() => {
		return touchedFields.has('password')
			? validationErrors.find((e) => e.field === 'password')?.message
			: undefined;
	});

	async function handleSubmit(event: Event): Promise<void> {
		event.preventDefault();

		if (formState === FORM_STATES.SUBMITTING) return;

		// Mark all fields as touched
		touchedFields.add('email');
		touchedFields.add('password');

		// Validate the entire form
		const formData: LoginFormData = { email: email.trim(), password };
		const validation = validateLogin(formData);

		if (!validation.success) {
			formState = FORM_STATES.ERROR;
			if (validation.errors) {
				validationErrors = formatZodErrors(validation.errors);
			}
			showErrorToast('Please fix the validation errors before submitting.');
			return;
		}

		formState = FORM_STATES.SUBMITTING;

		try {
			const result = await handleFormSubmission(async () => {
				try {
					const result = await authClient.signIn.email({
						email: formData.email,
						password: formData.password,
						rememberMe: true
					});
					if (result.error) {
						throw result.error;
					}
					return result;
				} catch (error) {
					logError(error, 'Login');

					// Handle specific authentication errors
					if (error && typeof error === 'object' && 'status' in error) {
						const status = (error as any).status;
						if (status === 401) {
							throw new ApiError({
								message: 'Invalid email or password. Please check your credentials and try again.',
								statusCode: 401,
								code: 'INVALID_CREDENTIALS'
							});
						} else if (status === 429) {
							throw new ApiError({
								message: 'Too many login attempts. Please wait a moment before trying again.',
								statusCode: 429,
								code: 'RATE_LIMITED'
							});
						} else if (status === 403) {
							throw new ApiError({
								message: 'Your account has been locked. Please contact support.',
								statusCode: 403,
								code: 'ACCOUNT_LOCKED'
							});
						}
					}

					// Generic error handling
					throw new ApiError({
						message: 'Login failed. Please check your credentials and try again.',
						statusCode: 500,
						code: 'LOGIN_FAILED'
					});
				}
			});

			if (result.success) {
				formState = FORM_STATES.SUCCESS;
				// Redirect to dashboard after successful login
				setTimeout(() => {
					goto('/dashboard');
				}, 1000);
			}
		} catch (error) {
			formState = FORM_STATES.ERROR;
		} finally {
			if (formState !== FORM_STATES.SUCCESS) {
				formState = FORM_STATES.IDLE;
			}
		}
	}

	async function handleGoogleLogin(): Promise<any> {
		if (formState === FORM_STATES.SUBMITTING) return;

		try {
			formState = FORM_STATES.SUBMITTING;
			const result = await authActions.loginWithGoogle();
			if (result.error) {
				throw result.error;
			}
			formState = FORM_STATES.SUCCESS;
			// Redirect to dashboard after successful Google login
			setTimeout(() => {
				goto('/dashboard');
			}, 1000);
		} catch (error) {
			formState = FORM_STATES.IDLE;
			logError(error, 'Google Login');
			showErrorToast('Google login failed. Please try again.');
		} finally {
			if (formState !== FORM_STATES.SUCCESS) {
				formState = FORM_STATES.IDLE;
			}
		}
	}

	async function handleGitHubLogin(): Promise<any> {
		if (formState === FORM_STATES.SUBMITTING) return;

		try {
			formState = FORM_STATES.SUBMITTING;
			const result = await authActions.loginWithGitHub();
			if (result.error) {
				throw result.error;
			}
			formState = FORM_STATES.SUCCESS;
			// Redirect to dashboard after successful GitHub login
			setTimeout(() => {
				goto('/dashboard');
			}, 1000);
		} catch (error) {
			formState = FORM_STATES.IDLE;
			logError(error, 'GitHub Login');
			showErrorToast('GitHub login failed. Please try again.');
		} finally {
			if (formState !== FORM_STATES.SUCCESS) {
				formState = FORM_STATES.IDLE;
			}
		}
	}

	function handleEmailInput(event: Event): void {
		const target = event.target as HTMLInputElement;
		email = target.value;
		touchedFields.add('email');
		debouncedEmailValidation();
	}

	function handleEmailBlur(): void {
		if (email.trim()) {
			try {
				loginSchema.shape.email.parse(email);
				validationErrors = validationErrors.filter((e) => e.field !== 'email');
			} catch (error) {
				if (error instanceof Error) {
					validationErrors = [
						...validationErrors.filter((e) => e.field !== 'email'),
						{ field: 'email', message: 'Please enter a valid email address' }
					];
				}
			}
		}
	}

	function handlePasswordInput(event: Event): void {
		const target = event.target as HTMLInputElement;
		password = target.value;
		touchedFields.add('password');
		debouncedPasswordValidation();
	}

	function handlePasswordBlur(): void {
		if (password.trim()) {
			try {
				loginSchema.shape.password.parse(password);
				validationErrors = validationErrors.filter((e) => e.field !== 'password');
			} catch (error) {
				if (error instanceof Error) {
					validationErrors = [
						...validationErrors.filter((e) => e.field !== 'password'),
						{ field: 'password', message: 'Please enter a valid password' }
					];
				}
			}
		}
	}

	function togglePasswordVisibility(): void {
		showPassword = !showPassword;
	}

	// Clear form state when component unmounts
	$effect(() => {
		return () => {
			validationErrors = [];
			touchedFields = new Set();
			formState = FORM_STATES.IDLE;
		};
	});
</script>

<div class={cn('flex flex-col gap-6', className)} bind:this={ref} {...restProps}>
	{#if successMessage}
		<div
			class="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
		>
			<CheckCircleIcon class="h-4 w-4 flex-shrink-0" />
			{successMessage}
		</div>
	{/if}

	{#if formState === FORM_STATES.ERROR && validationErrors.length > 0}
		<div
			class="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
		>
			<AlertCircleIcon class="h-4 w-4 flex-shrink-0" />
			<div>
				<p class="font-medium">Please fix the following errors:</p>
				<ul class="mt-1 list-inside list-disc space-y-1">
					{#each validationErrors as error}
						<li>{error.message}</li>
					{/each}
				</ul>
			</div>
		</div>
	{/if}

	<form onsubmit={handleSubmit}>
		<div class="flex flex-col gap-6">
			<div class="flex flex-col items-center gap-2">
				<a href="/" class="flex flex-col items-center gap-2 font-medium">
					<div class="flex size-8 items-center justify-center rounded-md">
						<GalleryVerticalEndIcon class="size-6" />
					</div>
					<span class="sr-only">Aura IDE</span>
				</a>
				<h1 class="text-xl font-bold">Welcome to Aura IDE</h1>
				<div class="text-center text-sm">
					Don&apos;t have an account?
					<a href="/auth/register" class="underline underline-offset-4"> Sign up </a>
				</div>
			</div>
			<div class="flex flex-col gap-6">
				<div class="grid gap-3">
					<Label for="email-{id}">Email</Label>
					<Input
						id="email-{id}"
						type="email"
						placeholder="john@example.com"
						bind:value={email}
						disabled={formState === FORM_STATES.SUBMITTING}
						required
						autocomplete="email"
						class={emailError ? 'border-destructive focus-visible:ring-destructive' : ''}
						oninput={handleEmailInput}
						onblur={handleEmailBlur}
					/>
					{#if emailError}
						<p class="flex items-center gap-1 text-sm text-destructive">
							<AlertCircleIcon class="h-3 w-3" />
							{emailError}
						</p>
					{/if}
				</div>
				<div class="grid gap-3">
					<Label for="password-{id}">Password</Label>
					<div class="relative">
						<Input
							id="password-{id}"
							type={showPassword ? 'text' : 'password'}
							placeholder="••••••••"
							bind:value={password}
							disabled={formState === FORM_STATES.SUBMITTING}
							required
							autocomplete="current-password"
							class={cn(
								'pr-10',
								passwordError ? 'border-destructive focus-visible:ring-destructive' : ''
							)}
							oninput={handlePasswordInput}
							onblur={handlePasswordBlur}
						/>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							class="absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent"
							onclick={togglePasswordVisibility}
							disabled={formState === FORM_STATES.SUBMITTING}
						>
							{#if showPassword}
								<EyeOffIcon class="h-4 w-4" />
								<span class="sr-only">Hide password</span>
							{:else}
								<EyeIcon class="h-4 w-4" />
								<span class="sr-only">Show password</span>
							{/if}
						</Button>
					</div>
					{#if passwordError}
						<p class="flex items-center gap-1 text-sm text-destructive">
							<AlertCircleIcon class="h-3 w-3" />
							{passwordError}
						</p>
					{/if}
				</div>
				<div class="flex items-center justify-between">
					<a
						href="/auth/forgot-password"
						class="text-sm text-muted-foreground underline underline-offset-4 hover:text-primary"
					>
						Forgot your password?
					</a>
				</div>
				<Button
					type="submit"
					class="w-full"
					disabled={formState === FORM_STATES.SUBMITTING || !isFormValid}
				>
					{#if formState === FORM_STATES.SUBMITTING}
						<svg
							class="mr-3 -ml-1 h-4 w-4 animate-spin text-white"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
						Signing in...
					{:else if formState === FORM_STATES.SUCCESS}
						<CheckCircleIcon class="mr-2 h-4 w-4" />
						Success!
					{:else}
						Sign In
					{/if}
				</Button>
			</div>
			<div
				class="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border"
			>
				<span class="relative z-10 bg-background px-2 text-muted-foreground"> Or </span>
			</div>
			<div class="grid gap-4 sm:grid-cols-2">
				<Button
					variant="outline"
					type="button"
					class="w-full"
					onclick={handleGoogleLogin}
					disabled={formState === FORM_STATES.SUBMITTING}
				>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="mr-2 h-4 w-4">
						<path
							d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
							fill="#4285F4"
						/>
						<path
							d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
							fill="#34A853"
						/>
						<path
							d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
							fill="#FBBC05"
						/>
						<path
							d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
							fill="#EA4335"
						/>
					</svg>
					Continue with Google
				</Button>
				<Button
					variant="outline"
					type="button"
					class="w-full"
					onclick={handleGitHubLogin}
					disabled={formState === FORM_STATES.SUBMITTING}
				>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="mr-2 h-4 w-4">
						<path
							d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
							fill="currentColor"
						/>
					</svg>
					Continue with GitHub
				</Button>
			</div>
		</div>
	</form>
	<div
		class="text-center text-xs text-balance text-muted-foreground *:[a]:underline *:[a]:underline-offset-4 *:[a]:hover:text-primary"
	>
		By clicking continue, you agree to our <a href="/terms">Terms of Service</a>
		and <a href="/privacy">Privacy Policy</a>.
	</div>
</div>
