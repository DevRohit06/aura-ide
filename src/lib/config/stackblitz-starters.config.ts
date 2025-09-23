/**
 * StackBlitz Starters Configuration
 * Defines available starter templates from StackBlitz starters repository
 */

export interface StackBlitzStarter {
	name: string;
	path: string;
	description: string;
	framework: string;
	features: string[];
}

export const STACKBLITZ_STARTERS: Record<string, StackBlitzStarter[]> = {
	react: [
		{
			name: 'React',
			path: 'react',
			description: 'React with JavaScript and Vite',
			framework: 'react',
			features: ['JavaScript', 'Vite', 'ESLint']
		},
		{
			name: 'React TypeScript',
			path: 'react-ts',
			description: 'React with TypeScript and Vite',
			framework: 'react',
			features: ['TypeScript', 'Vite', 'ESLint']
		},
		{
			name: 'Vite + shadcn/ui',
			path: 'vite-shadcn',
			description: 'React with Vite and shadcn/ui components',
			framework: 'react',
			features: ['TypeScript', 'Vite', 'shadcn/ui', 'Tailwind CSS']
		}
	],
	angular: [
		{
			name: 'Angular',
			path: 'angular',
			description: 'Angular with TypeScript',
			framework: 'angular',
			features: ['TypeScript', 'Angular CLI', 'ESLint']
		}
	],
	astro: [
		{
			name: 'Astro + shadcn/ui',
			path: 'astro-shadcn',
			description: 'Astro with shadcn/ui components',
			framework: 'astro',
			features: ['TypeScript', 'Astro', 'shadcn/ui', 'Tailwind CSS']
		}
	],
	svelte: [
		{
			name: 'SvelteKit',
			path: 'sveltekit',
			description: 'SvelteKit with TypeScript',
			framework: 'svelte',
			features: ['TypeScript', 'SvelteKit', 'Vite']
		}
	],
	vue: [
		{
			name: 'Vue 3',
			path: 'vue',
			description: 'Vue 3 with TypeScript',
			framework: 'vue',
			features: ['TypeScript', 'Vue 3', 'Vite']
		}
	],
	nextjs: [
		{
			name: 'Next.js',
			path: 'nextjs',
			description: 'Next.js with TypeScript',
			framework: 'nextjs',
			features: ['TypeScript', 'Next.js', 'App Router']
		},
		{
			name: 'Next.js + shadcn/ui',
			path: 'nextjs-shadcn',
			description: 'Next.js with shadcn/ui components',
			framework: 'nextjs',
			features: ['TypeScript', 'Next.js', 'shadcn/ui', 'Tailwind CSS']
		}
	],
	bootstrap: [
		{
			name: 'Bootstrap 5',
			path: 'bootstrap-5',
			description: 'HTML with Bootstrap 5',
			framework: 'bootstrap',
			features: ['HTML', 'CSS', 'Bootstrap 5']
		}
	]
};

/**
 * Get available starters for a framework
 */
export function getStackBlitzStarters(framework: string): StackBlitzStarter[] {
	return STACKBLITZ_STARTERS[framework] || [];
}

/**
 * Get default starter for a framework
 */
export function getDefaultStackBlitzStarter(framework: string): StackBlitzStarter | null {
	const starters = getStackBlitzStarters(framework);
	return starters.length > 0 ? starters[0] : null;
}

/**
 * Get starter by name and framework
 */
export function getStackBlitzStarter(
	framework: string,
	starterName: string
): StackBlitzStarter | null {
	const starters = getStackBlitzStarters(framework);
	return (
		starters.find((starter) => starter.name === starterName || starter.path === starterName) || null
	);
}

/**
 * Get all available starters across all frameworks
 */
export function getAllStackBlitzStarters(): { framework: string; starters: StackBlitzStarter[] }[] {
	return Object.entries(STACKBLITZ_STARTERS).map(([framework, starters]) => ({
		framework,
		starters
	}));
}
