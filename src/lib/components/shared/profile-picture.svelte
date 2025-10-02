<script lang="ts">
	import { cn } from '$lib/utils.js';

	interface Props {
		/**
		 * User's display name or email for generating initials
		 */
		name?: string;
		/**
		 * Profile image URL
		 */
		src?: string;
		/**
		 * Alternative text for the image
		 */
		alt?: string;
		/**
		 * Size of the profile picture
		 */
		size?: 'sm' | 'md' | 'lg' | 'xl';
		/**
		 * Additional CSS classes
		 */
		class?: string;
		/**
		 * Whether the image should be clickable
		 */
		clickable?: boolean;
		/**
		 * Click handler
		 */
		onclick?: () => void;
	}

	let {
		name = '',
		src,
		alt,
		size = 'md',
		class: className,
		clickable = false,
		onclick
	}: Props = $props();

	// Generate initials from name
	const initials = $derived(() => {
		if (!name) return '';
		return name
			.split(' ')
			.map((word) => word.charAt(0))
			.join('')
			.toUpperCase()
			.slice(0, 2);
	});

	// Size classes
	const sizeClasses = {
		sm: 'h-6 w-6 text-xs',
		md: 'h-8 w-8 text-sm',
		lg: 'h-10 w-10 text-base',
		xl: 'h-12 w-12 text-lg'
	};

	let imageLoaded = $state(false);
	let imageError = $state(false);

	function handleImageLoad() {
		imageLoaded = true;
		imageError = false;
	}

	function handleImageError() {
		imageError = true;
		imageLoaded = false;
	}

	function handleClick() {
		if (clickable && onclick) {
			onclick();
		}
	}
</script>

<div
	class={cn(
		'relative inline-flex shrink-0 items-center justify-center rounded-full border border-border bg-muted font-medium text-muted-foreground',
		sizeClasses[size],
		clickable && 'cursor-pointer transition-colors hover:bg-muted/80',
		className
	)}
	onclick={handleClick}
	role={clickable ? 'button' : undefined}
	tabindex={clickable ? 0 : -1}
	onkeydown={(e) => {
		if (clickable && (e.key === 'Enter' || e.key === ' ')) {
			e.preventDefault();
			handleClick();
		}
	}}
>
	{#if src && !imageError}
		<img
			{src}
			alt={alt || name || 'Profile picture'}
			class={cn('h-full w-full rounded-full object-cover', !imageLoaded && 'opacity-0')}
			onload={handleImageLoad}
			onerror={handleImageError}
		/>
	{/if}

	{#if !src || imageError || !imageLoaded}
		<span class="select-none">
			{initials() || '?'}
		</span>
	{/if}
</div>
