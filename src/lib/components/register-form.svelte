<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
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
	import {
		checkPasswordStrength,
		registerSchema,
		validateRegister,
		type RegisterFormData
	} from '$lib/validations/auth.validation';
	import GalleryVerticalEndIcon from '@lucide/svelte/icons/gallery-vertical-end';
	import {
		AlertCircleIcon,
		CheckCircleIcon,
		EyeIcon,
		EyeOffIcon,
		ShieldIcon,
		XIcon
	} from 'lucide-svelte';
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
	let confirmPassword = $state('');
	let firstName = $state('');
	let lastName = $state('');
	let acceptTerms = $state(false);
	let showPassword = $state(false);
	let showConfirmPassword = $state(false);
	let formState: FormState = $state(FORM_STATES.IDLE);

	// Simple validation state
	let validationErrors = $state<ValidationError[]>([]);
	let touchedFields = $state(new Set<string>());

	// Password strength check
	const passwordStrength = $derived.by(() => {
		if (!password) return null;
		return checkPasswordStrength(password);
	});

	// Real-time validation with debouncing
	const debouncedEmailValidation = createDebouncedValidator(() => {
		if (email.trim()) {
			try {
				registerSchema.shape.email.parse(email);
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
				registerSchema.shape.password.parse(password);
				validationErrors = validationErrors.filter((e) => e.field !== 'password');
			} catch (error) {
				if (error instanceof Error) {
					validationErrors = [
						...validationErrors.filter((e) => e.field !== 'password'),
						{ field: 'password', message: 'Password must meet the requirements' }
					];
				}
			}
		}
	}, 300);

	const debouncedConfirmPasswordValidation = createDebouncedValidator(() => {
		if (confirmPassword.trim()) {
			if (password !== confirmPassword) {
				validationErrors = [
					...validationErrors.filter((e) => e.field !== 'confirmPassword'),
					{ field: 'confirmPassword', message: 'Passwords do not match' }
				];
			} else {
				validationErrors = validationErrors.filter((e) => e.field !== 'confirmPassword');
			}
		}
	}, 300);

	const debouncedFirstNameValidation = createDebouncedValidator(() => {
		if (firstName.trim()) {
			try {
				registerSchema.shape.firstName.parse(firstName);
				validationErrors = validationErrors.filter((e) => e.field !== 'firstName');
			} catch (error) {
				if (error instanceof Error) {
					validationErrors = [
						...validationErrors.filter((e) => e.field !== 'firstName'),
						{ field: 'firstName', message: 'Please enter a valid first name' }
					];
				}
			}
		}
	}, 500);

	const debouncedLastNameValidation = createDebouncedValidator(() => {
		if (lastName.trim()) {
			try {
				registerSchema.shape.lastName.parse(lastName);
				validationErrors = validationErrors.filter((e) => e.field !== 'lastName');
			} catch (error) {
				if (error instanceof Error) {
					validationErrors = [
						...validationErrors.filter((e) => e.field !== 'lastName'),
						{ field: 'lastName', message: 'Please enter a valid last name' }
					];
				}
			}
		}
	}, 500);

	// Form validation state
	const isFormValid = $derived.by(() => {
		return (
			email.trim() &&
			password.trim() &&
			confirmPassword.trim() &&
			firstName.trim() &&
			lastName.trim() &&
			acceptTerms &&
			validationErrors.length === 0
		);
	});

	// Field error getters
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

	const confirmPasswordError = $derived.by(() => {
		return touchedFields.has('confirmPassword')
			? validationErrors.find((e) => e.field === 'confirmPassword')?.message
			: undefined;
	});

	const firstNameError = $derived.by(() => {
		return touchedFields.has('firstName')
			? validationErrors.find((e) => e.field === 'firstName')?.message
			: undefined;
	});

	const lastNameError = $derived.by(() => {
		return touchedFields.has('lastName')
			? validationErrors.find((e) => e.field === 'lastName')?.message
			: undefined;
	});

	async function handleSubmit(event: Event) {
		event.preventDefault();

		if (formState === FORM_STATES.SUBMITTING) return;

		// Mark all fields as touched
		touchedFields.add('email');
		touchedFields.add('password');
		touchedFields.add('confirmPassword');
		touchedFields.add('firstName');
		touchedFields.add('lastName');

		// Validate the entire form
		const formData: RegisterFormData = {
			email: email.trim(),
			password,
			confirmPassword,
			firstName: firstName.trim(),
			lastName: lastName.trim(),
			acceptTerms
		};

		const validation = validateRegister(formData);

		if (!validation.success) {
			formState = FORM_STATES.ERROR;
			if (validation.errors) {
				validationErrors = formatZodErrors(validation.errors);
			}
			showErrorToast('Please fix the validation errors before submitting.');
			return;
		}

		formState = FORM_STATES.SUBMITTING;

		const result = await handleFormSubmission(
			async () => {
				try {
					const result = await authActions.register(
						formData.email,
						formData.password,
						formData.firstName,
						formData.lastName
					);

					if (!result.success) {
						throw new ApiError({
							message: result.error || 'Registration failed',
							statusCode: 400,
							code: 'REGISTRATION_FAILED'
						});
					}

					if (result.error) {
						throw result.error;
					}

					return result;
				} catch (error) {
					logError(error, 'Registration');

					// Handle specific registration errors
					if (error && typeof error === 'object' && 'status' in error) {
						const status = (error as any).status;
						if (status === 409) {
							throw new ApiError({
								message:
									'An account with this email address already exists. Please try logging in instead.',
								statusCode: 409,
								code: 'USER_EXISTS'
							});
						} else if (status === 422) {
							throw new ApiError({
								message:
									'The provided information is invalid. Please check your input and try again.',
								statusCode: 422,
								code: 'VALIDATION_ERROR'
							});
						} else if (status === 429) {
							throw new ApiError({
								message:
									'Too many registration attempts. Please wait a moment before trying again.',
								statusCode: 429,
								code: 'RATE_LIMITED'
							});
						}
					}

					// Generic error handling
					throw new ApiError({
						message: 'Registration failed. Please try again.',
						statusCode: 500,
						code: 'REGISTRATION_FAILED'
					});
				}
			},
			{
				loadingMessage: 'Creating your account...',
				successMessage:
					'Account created successfully! Please check your email to verify your account.',
				onSuccess: async () => {
					formState = FORM_STATES.SUCCESS;
					// Redirect to login page with success message
					setTimeout(() => {
						goto(
							'/auth/login?message=Registration successful! Please log in with your credentials.'
						);
					}, 2000);
				},
				onError: (error) => {
					formState = FORM_STATES.ERROR;
					logError(error, 'Registration Form');
				},
				suppressErrorToast: false
			}
		);
	}

	async function handleGoogleLogin(): Promise<void> {
		if (formState === FORM_STATES.SUBMITTING) return;

		try {
			formState = FORM_STATES.SUBMITTING;
			await authActions.loginWithGoogle();
			formState = FORM_STATES.SUCCESS;
		} catch (error) {
			formState = FORM_STATES.ERROR;
			logError(error, 'Google Registration');
			showErrorToast('Google registration failed. Please try again.');
		}
	}

	async function handleGitHubLogin(): Promise<void> {
		if (formState === FORM_STATES.SUBMITTING) return;

		try {
			formState = FORM_STATES.SUBMITTING;
			await authActions.loginWithGitHub();
			formState = FORM_STATES.SUCCESS;
		} catch (error) {
			formState = FORM_STATES.ERROR;
			logError(error, 'GitHub Registration');
			showErrorToast('GitHub registration failed. Please try again.');
		}
	}

	// Input handlers
	function handleEmailInput(event: Event): void {
		const target = event.target as HTMLInputElement;
		email = target.value;
		touchedFields.add('email');
		debouncedEmailValidation();
	}

	function handleEmailBlur(): void {
		if (email.trim()) {
			try {
				registerSchema.shape.email.parse(email);
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

		// Also re-validate confirm password if it's been touched
		if (touchedFields.has('confirmPassword')) {
			debouncedConfirmPasswordValidation();
		}
	}

	function handlePasswordBlur(): void {
		if (password.trim()) {
			try {
				registerSchema.shape.password.parse(password);
				validationErrors = validationErrors.filter((e) => e.field !== 'password');
			} catch (error) {
				if (error instanceof Error) {
					validationErrors = [
						...validationErrors.filter((e) => e.field !== 'password'),
						{ field: 'password', message: 'Password must meet the requirements' }
					];
				}
			}
		}
	}

	function handleConfirmPasswordInput(event: Event): void {
		const target = event.target as HTMLInputElement;
		confirmPassword = target.value;
		touchedFields.add('confirmPassword');
		debouncedConfirmPasswordValidation();
	}

	function handleConfirmPasswordBlur(): void {
		if (confirmPassword.trim()) {
			debouncedConfirmPasswordValidation();
		}
	}

	function handleFirstNameInput(event: Event): void {
		const target = event.target as HTMLInputElement;
		firstName = target.value;
		touchedFields.add('firstName');
		debouncedFirstNameValidation();
	}

	function handleFirstNameBlur(): void {
		if (firstName.trim()) {
			try {
				registerSchema.shape.firstName.parse(firstName);
				validationErrors = validationErrors.filter((e) => e.field !== 'firstName');
			} catch (error) {
				if (error instanceof Error) {
					validationErrors = [
						...validationErrors.filter((e) => e.field !== 'firstName'),
						{ field: 'firstName', message: 'Please enter a valid first name' }
					];
				}
			}
		}
	}

	function handleLastNameInput(event: Event): void {
		const target = event.target as HTMLInputElement;
		lastName = target.value;
		touchedFields.add('lastName');
		debouncedLastNameValidation();
	}

	function handleLastNameBlur(): void {
		if (lastName.trim()) {
			try {
				registerSchema.shape.lastName.parse(lastName);
				validationErrors = validationErrors.filter((e) => e.field !== 'lastName');
			} catch (error) {
				if (error instanceof Error) {
					validationErrors = [
						...validationErrors.filter((e) => e.field !== 'lastName'),
						{ field: 'lastName', message: 'Please enter a valid last name' }
					];
				}
			}
		}
	}

	function togglePasswordVisibility(): void {
		showPassword = !showPassword;
	}

	function toggleConfirmPasswordVisibility(): void {
		showConfirmPassword = !showConfirmPassword;
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
	{#if validationErrors.length > 0 && formState === FORM_STATES.ERROR}
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
				<h1 class="text-xl font-bold">Create your account</h1>
				<div class="text-center text-sm">
					Already have an account?
					<a href="/auth/login" class="underline underline-offset-4"> Sign in </a>
				</div>
			</div>
			<div class="flex flex-col gap-6">
				<!-- Name Fields -->
				<div class="grid grid-cols-2 gap-3">
					<div class="grid gap-2">
						<Label for="firstName-{id}">First Name *</Label>
						<Input
							id="firstName-{id}"
							type="text"
							placeholder="John"
							bind:value={firstName}
							disabled={formState === FORM_STATES.SUBMITTING}
							required
							autocomplete="given-name"
							class={firstNameError ? 'border-destructive focus-visible:ring-destructive' : ''}
							oninput={handleFirstNameInput}
							onblur={handleFirstNameBlur}
						/>
						{#if firstNameError}
							<p class="flex items-center gap-1 text-sm text-destructive">
								<AlertCircleIcon class="h-3 w-3" />
								{firstNameError}
							</p>
						{/if}
					</div>
					<div class="grid gap-2">
						<Label for="lastName-{id}">Last Name *</Label>
						<Input
							id="lastName-{id}"
							type="text"
							placeholder="Doe"
							bind:value={lastName}
							disabled={formState === FORM_STATES.SUBMITTING}
							required
							autocomplete="family-name"
							class={lastNameError ? 'border-destructive focus-visible:ring-destructive' : ''}
							oninput={handleLastNameInput}
							onblur={handleLastNameBlur}
						/>
						{#if lastNameError}
							<p class="flex items-center gap-1 text-sm text-destructive">
								<AlertCircleIcon class="h-3 w-3" />
								{lastNameError}
							</p>
						{/if}
					</div>
				</div>

				<!-- Email Field -->
				<div class="grid gap-3">
					<Label for="email-{id}">Email *</Label>
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

				<!-- Password Field -->
				<div class="grid gap-3">
					<Label for="password-{id}">Password *</Label>
					<div class="relative">
						<Input
							id="password-{id}"
							type={showPassword ? 'text' : 'password'}
							placeholder="••••••••"
							bind:value={password}
							disabled={formState === FORM_STATES.SUBMITTING}
							required
							autocomplete="new-password"
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

					<!-- Password Strength Indicator -->
					{#if passwordStrength && password.length > 0}
						<div class="space-y-2">
							<div class="flex items-center gap-2">
								<ShieldIcon class="h-4 w-4 text-muted-foreground" />
								<span class="text-sm font-medium">Password Strength</span>
								<div class="h-2 flex-1 overflow-hidden rounded-full bg-muted">
									<div
										class="h-full transition-all duration-300 {passwordStrength.score <= 2
											? 'bg-red-500'
											: passwordStrength.score <= 5
												? 'bg-yellow-500'
												: 'bg-green-500'}"
										style="width: {(passwordStrength.score / 8) * 100}%"
									></div>
								</div>
								<span class="text-xs text-muted-foreground">
									{passwordStrength.score <= 2
										? 'Weak'
										: passwordStrength.score <= 5
											? 'Good'
											: 'Strong'}
								</span>
							</div>
							{#if passwordStrength.feedback.length > 0}
								<div class="space-y-1">
									{#each passwordStrength.feedback as feedback}
										<div class="flex items-center gap-2 text-xs text-muted-foreground">
											<XIcon class="h-3 w-3 text-red-500" />
											{feedback}
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/if}

					{#if passwordError}
						<p class="flex items-center gap-1 text-sm text-destructive">
							<AlertCircleIcon class="h-3 w-3" />
							{passwordError}
						</p>
					{/if}
				</div>

				<!-- Confirm Password Field -->
				<div class="grid gap-3">
					<Label for="confirmPassword-{id}">Confirm Password *</Label>
					<div class="relative">
						<Input
							id="confirmPassword-{id}"
							type={showConfirmPassword ? 'text' : 'password'}
							placeholder="••••••••"
							bind:value={confirmPassword}
							disabled={formState === FORM_STATES.SUBMITTING}
							required
							autocomplete="new-password"
							class={cn(
								'pr-10',
								confirmPasswordError ? 'border-destructive focus-visible:ring-destructive' : ''
							)}
							oninput={handleConfirmPasswordInput}
							onblur={handleConfirmPasswordBlur}
						/>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							class="absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent"
							onclick={toggleConfirmPasswordVisibility}
							disabled={formState === FORM_STATES.SUBMITTING}
						>
							{#if showConfirmPassword}
								<EyeOffIcon class="h-4 w-4" />
								<span class="sr-only">Hide password</span>
							{:else}
								<EyeIcon class="h-4 w-4" />
								<span class="sr-only">Show password</span>
							{/if}
						</Button>
					</div>
					{#if confirmPasswordError}
						<p class="flex items-center gap-1 text-sm text-destructive">
							<AlertCircleIcon class="h-3 w-3" />
							{confirmPasswordError}
						</p>
					{:else if confirmPassword && password === confirmPassword}
						<p class="flex items-center gap-1 text-sm text-green-600">
							<CheckCircleIcon class="h-3 w-3" />
							Passwords match
						</p>
					{/if}
				</div>

				<!-- Terms and Conditions -->
				<div class="flex items-start space-x-3">
					<Checkbox
						bind:checked={acceptTerms}
						id="terms-{id}"
						disabled={formState === FORM_STATES.SUBMITTING}
						required
					/>
					<div class="grid gap-1.5 leading-none">
						<Label
							for="terms-{id}"
							class="text-sm leading-none font-normal peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
						>
							I agree to the
							<a
								href="/terms"
								class="underline underline-offset-4 hover:text-primary"
								target="_blank">Terms of Service</a
							>
							and
							<a
								href="/privacy"
								class="underline underline-offset-4 hover:text-primary"
								target="_blank">Privacy Policy</a
							>
						</Label>
					</div>
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
						Creating account...
					{:else if formState === FORM_STATES.SUCCESS}
						<CheckCircleIcon class="mr-2 h-4 w-4" />
						Account created!
					{:else}
						Create account
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
