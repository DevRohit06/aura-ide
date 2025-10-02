<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { CheckCircle } from 'lucide-svelte';

	interface Step {
		number: number;
		title: string;
		description: string;
		icon?: any;
	}

	interface Props {
		steps: Step[];
		currentStep: number;
		onStepClick?: (step: number) => void;
		allowClickNavigation?: boolean;
		class?: string;
	}

	let {
		steps,
		currentStep,
		onStepClick,
		allowClickNavigation = false,
		class: className
	}: Props = $props();

	function getStepStatus(stepNumber: number) {
		if (stepNumber < currentStep) return 'completed';
		if (stepNumber === currentStep) return 'current';
		return 'upcoming';
	}

	function handleStepClick(stepNumber: number) {
		if (allowClickNavigation && stepNumber < currentStep && onStepClick) {
			onStepClick(stepNumber);
		}
	}

	function getProgressValue() {
		return ((currentStep - 1) / (steps.length - 1)) * 100;
	}
</script>

<div class={cn('w-full space-y-6', className)}>
	<!-- Progress Bar -->
	<div class="relative">
		<div class="h-2 w-full overflow-hidden rounded-full bg-muted">
			<div
				class="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500 ease-out"
				style="width: {getProgressValue()}%"
			></div>
		</div>
		<div class="absolute inset-0 flex justify-between">
			{#each steps as step}
				{@const status = getStepStatus(step.number)}
				{@const isClickable = allowClickNavigation && step.number < currentStep}
				<button
					class={cn(
						'flex h-8 w-8 -translate-y-3 items-center justify-center rounded-full border-2 bg-background text-sm font-semibold transition-all duration-300',
						status === 'completed'
							? 'scale-105 border-primary bg-primary text-primary-foreground shadow-lg'
							: status === 'current'
								? 'scale-110 animate-pulse border-primary bg-primary text-primary-foreground shadow-lg'
								: 'border-muted-foreground/30 text-muted-foreground hover:border-primary/50',
						isClickable && 'cursor-pointer hover:scale-105 hover:shadow-md',
						!isClickable && 'cursor-default'
					)}
					onclick={() => handleStepClick(step.number)}
					disabled={!isClickable}
				>
					{#if status === 'completed'}
						<CheckCircle class="h-4 w-4" />
					{:else if step.icon}
						<step.icon class="h-4 w-4" />
					{:else}
						{step.number}
					{/if}
				</button>
			{/each}
		</div>
	</div>

	<!-- Steps List -->
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		{#each steps as step}
			{@const status = getStepStatus(step.number)}
			{@const isClickable = allowClickNavigation && step.number < currentStep}
			<button
				class={cn(
					'group relative rounded-lg border p-4 text-left transition-all duration-200',
					status === 'completed'
						? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30'
						: status === 'current'
							? 'border-primary bg-primary/5 shadow-md'
							: 'border-muted bg-background',
					isClickable && 'cursor-pointer hover:border-primary hover:shadow-sm',
					!isClickable && 'cursor-default'
				)}
				onclick={() => handleStepClick(step.number)}
				disabled={!isClickable}
			>
				<!-- Status Indicator -->
				<div class="mb-3 flex items-center space-x-3">
					<div
						class={cn(
							'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors',
							status === 'completed'
								? 'bg-green-500 text-white'
								: status === 'current'
									? 'bg-primary text-primary-foreground'
									: 'bg-muted text-muted-foreground'
						)}
					>
						{#if status === 'completed'}
							<CheckCircle class="h-3 w-3" />
						{:else}
							{step.number}
						{/if}
					</div>
					{#if status === 'current'}
						<div class="h-2 w-2 animate-pulse rounded-full bg-primary" title="Current step"></div>
					{/if}
				</div>

				<!-- Step Content -->
				<div class="space-y-1">
					<h3
						class={cn(
							'font-semibold transition-colors',
							status === 'current'
								? 'text-foreground'
								: status === 'completed'
									? 'text-green-700 dark:text-green-300'
									: 'text-muted-foreground group-hover:text-foreground'
						)}
					>
						{step.title}
					</h3>
					<p
						class={cn(
							'text-xs transition-colors',
							status === 'current'
								? 'text-muted-foreground'
								: status === 'completed'
									? 'text-green-600 dark:text-green-400'
									: 'text-muted-foreground/70'
						)}
					>
						{step.description}
					</p>
				</div>

				<!-- Navigation Hint -->
				{#if isClickable}
					<div
						class="absolute inset-0 rounded-lg bg-primary/5 opacity-0 transition-opacity group-hover:opacity-100"
					></div>
				{/if}
			</button>
		{/each}
	</div>
</div>
