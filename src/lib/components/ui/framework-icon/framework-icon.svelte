<script lang="ts">
	import { cn } from '$lib/utils.js';
	import Icon from '@iconify/svelte';

	interface Props {
		framework: string;
		size?: 'sm' | 'md' | 'lg' | 'xl';
		class?: string;
		animated?: boolean;
	}

	let { framework, size = 'md', class: className, animated = true }: Props = $props();

	const sizeClasses = {
		sm: 'h-4 w-4',
		md: 'h-6 w-6',
		lg: 'h-8 w-8',
		xl: 'h-12 w-12'
	};

	const iconMap = {
		react: 'devicon:react',
		'react-ts': 'devicon:react',
		nextjs: 'devicon:nextjs',
		'nextjs-ts': 'devicon:nextjs',
		vue: 'devicon:vuejs',
		'vue-ts': 'devicon:vuejs',
		svelte: 'devicon:svelte',
		sveltekit: 'devicon:svelte',
		angular: 'devicon:angular',
		node: 'devicon:nodejs',
		express: 'devicon:express',
		astro: 'vscode-icons:file-type-astro',
		vite: 'devicon:vite',
		vanilla: 'devicon:javascript',
		'vanilla-ts': 'devicon:typescript',
		javascript: 'devicon:javascript',
		typescript: 'devicon:typescript'
	};

	const iconClass = cn(
		sizeClasses[size],
		animated && 'transition-all duration-200 hover:scale-110',
		className
	);
</script>

<Icon icon={iconMap[framework as keyof typeof iconMap] || 'devicon:javascript'} class={iconClass} />
