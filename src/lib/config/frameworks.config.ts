import type { Framework, FrameworkDefinition } from '$lib/types';

export const SUPPORTED_FRAMEWORKS: Record<Framework, FrameworkDefinition> = {
	// Frontend Frameworks
	react: {
		id: 'react',
		name: 'React',
		version: '18.x',
		description:
			'A JavaScript library for building user interfaces with a component-based architecture',
		template: 'create-react-app',
		starterRepo: 'https://github.com/stackblitz/starters.git',
		starterPath: 'react-ts'
	},

	nextjs: {
		id: 'nextjs',
		name: 'Next.js',
		version: '14.x',
		description: 'The React Framework for Production with App Router, SSR, and API routes',
		template: 'create-next-app',
		starterRepo: 'https://github.com/stackblitz/starters.git',
		starterPath: 'nextjs'
	},

	svelte: {
		id: 'svelte',
		name: 'SvelteKit',
		version: '2.x',
		description: 'The fastest way to build svelte apps with SSR, routing, and more',
		template: 'create-svelte',
		starterRepo: 'https://github.com/stackblitz/starters.git',
		starterPath: 'sveltekit'
	},

	vue: {
		id: 'vue',
		name: 'Vue.js',
		version: '3.x',
		description: 'The Progressive JavaScript Framework for building user interfaces',
		template: 'create-vue',
		starterRepo: 'https://github.com/stackblitz/starters.git',
		starterPath: 'vue'
	},

	angular: {
		id: 'angular',
		name: 'Angular',
		version: '17.x',
		description: 'Platform for building mobile and desktop web applications',
		template: 'ng-new',
		starterRepo: 'https://github.com/stackblitz/starters.git',
		starterPath: 'angular'
	},

	astro: {
		id: 'astro',
		name: 'Astro',
		version: '4.x',
		description: 'Build faster websites with less client-side JavaScript',
		template: 'create-astro',
		starterRepo: 'https://github.com/stackblitz/starters.git',
		starterPath: 'astro-shadcn'
	},

	vite: {
		id: 'vite',
		name: 'Vite',
		version: '5.x',
		description: 'Next generation frontend tooling with lightning fast HMR',
		template: 'create-vite',
		starterRepo: 'https://github.com/stackblitz/starters.git',
		starterPath: 'vite-shadcn'
	},

	// Backend Frameworks
	express: {
		id: 'express',
		name: 'Express.js',
		version: '4.x',
		description: 'Fast, unopinionated, minimalist web framework for Node.js',
		template: 'express-generator',
		starterRepo: 'https://github.com/stackblitz/starters.git',
		starterPath: 'express-simple'
	},

	node: {
		id: 'node',
		name: 'Node.js',
		version: '20.x',
		description: "JavaScript runtime built on Chrome's V8 JavaScript engine",
		template: 'node',
		starterRepo: 'https://github.com/stackblitz/starters.git',
		starterPath: 'node'
	},

	// Language Specific
	javascript: {
		id: 'javascript',
		name: 'Vanilla JavaScript',
		version: 'ES2023',
		description: 'Plain JavaScript without frameworks - modern ES modules',
		template: 'js',
		starterRepo: 'https://github.com/stackblitz/starters.git',
		starterPath: 'js'
	},

	typescript: {
		id: 'typescript',
		name: 'TypeScript',
		version: '5.x',
		description: 'JavaScript with syntax for types - strongly typed programming',
		template: 'typescript',
		starterRepo: 'https://github.com/stackblitz/starters.git',
		starterPath: 'typescript'
	},

	// Static Sites
	static: {
		id: 'static',
		name: 'Static HTML/CSS',
		version: 'HTML5',
		description: 'Simple static website with HTML, CSS, and JavaScript',
		template: 'static',
		starterRepo: 'https://github.com/stackblitz/starters.git',
		starterPath: 'static'
	},

	bootstrap: {
		id: 'bootstrap',
		name: 'Bootstrap',
		version: '5.x',
		description: 'The most popular HTML, CSS, and JS library in the world',
		template: 'bootstrap',
		starterRepo: 'https://github.com/stackblitz/starters.git',
		starterPath: 'bootstrap-5'
	}
};

export const getFrameworkByName = (name: Framework): FrameworkDefinition | undefined => {
	return SUPPORTED_FRAMEWORKS[name];
};
