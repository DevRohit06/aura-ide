import { stackblitzTemplates, templateCategories } from '$lib/config/template.config.js';
import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	try {
		// Define available frameworks with their metadata
		const frameworks = [
			{
				id: 'react',
				name: 'React',
				description: 'A JavaScript library for building user interfaces',
				version: '18.x',
				category: 'frontend',
				icon: 'react',
				tags: ['javascript', 'typescript', 'frontend', 'spa'],
				features: ['Hot Reload', 'Component-based', 'Virtual DOM', 'JSX'],
				stackblitzId: stackblitzTemplates.react
			},
			{
				id: 'react-ts',
				name: 'React (TypeScript)',
				description: 'React with TypeScript for type-safe development',
				version: '18.x',
				category: 'frontend',
				icon: 'react',
				tags: ['typescript', 'frontend', 'spa'],
				features: ['Hot Reload', 'Type Safety', 'Component-based', 'Virtual DOM'],
				stackblitzId: stackblitzTemplates['react-ts']
			},
			{
				id: 'nextjs',
				name: 'Next.js',
				description: 'The React framework for production with SSR and SSG',
				version: '14.x',
				category: 'fullstack',
				icon: 'nextjs',
				tags: ['react', 'typescript', 'ssr', 'ssg', 'fullstack'],
				features: [
					'Server-side Rendering',
					'Static Generation',
					'API Routes',
					'File-based Routing'
				],
				stackblitzId: stackblitzTemplates.nextjs
			},
			{
				id: 'nextjs-ts',
				name: 'Next.js (TypeScript)',
				description: 'Next.js with TypeScript for type-safe full-stack development',
				version: '14.x',
				category: 'fullstack',
				icon: 'nextjs',
				tags: ['react', 'typescript', 'ssr', 'ssg', 'fullstack'],
				features: ['Server-side Rendering', 'Type Safety', 'API Routes', 'Static Generation'],
				stackblitzId: stackblitzTemplates['nextjs-ts']
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
				stackblitzId: stackblitzTemplates.vue
			},
			{
				id: 'vue-ts',
				name: 'Vue.js (TypeScript)',
				description: 'Vue.js with TypeScript and Composition API',
				version: '3.x',
				category: 'frontend',
				icon: 'vue',
				tags: ['typescript', 'frontend', 'spa'],
				features: ['Composition API', 'Type Safety', 'Reactive Data', 'Progressive'],
				stackblitzId: stackblitzTemplates['vue-ts']
			},
			{
				id: 'svelte',
				name: 'Svelte',
				description: 'Cybernetically enhanced web apps',
				version: '4.x',
				category: 'frontend',
				icon: 'svelte',
				tags: ['javascript', 'typescript', 'frontend', 'spa'],
				features: ['No Virtual DOM', 'Compile-time Optimizations', 'Reactive', 'Small Bundle Size'],
				stackblitzId: stackblitzTemplates.svelte
			},
			{
				id: 'sveltekit',
				name: 'SvelteKit',
				description: 'The fastest way to build svelte apps with SSR and SSG',
				version: '2.x',
				category: 'fullstack',
				icon: 'svelte',
				tags: ['svelte', 'typescript', 'ssr', 'ssg', 'fullstack'],
				features: [
					'Server-side Rendering',
					'Static Generation',
					'File-based Routing',
					'Hot Module Replacement'
				],
				stackblitzId: stackblitzTemplates.sveltekit
			},
			{
				id: 'angular',
				name: 'Angular',
				description: 'Platform for building mobile and desktop web applications',
				version: '17.x',
				category: 'frontend',
				icon: 'angular',
				tags: ['typescript', 'frontend', 'spa', 'enterprise'],
				features: ['Dependency Injection', 'CLI', 'TypeScript First', 'Component-based'],
				stackblitzId: stackblitzTemplates.angular
			},
			{
				id: 'node',
				name: 'Node.js',
				description: 'JavaScript runtime for server-side development',
				version: '20.x',
				category: 'backend',
				icon: 'node',
				tags: ['javascript', 'typescript', 'backend', 'api'],
				features: ['Non-blocking I/O', 'NPM Ecosystem', 'Cross-platform', 'Event-driven'],
				stackblitzId: stackblitzTemplates.node
			},
			{
				id: 'express',
				name: 'Express.js',
				description: 'Fast, unopinionated, minimalist web framework for Node.js',
				version: '4.x',
				category: 'backend',
				icon: 'node',
				tags: ['javascript', 'typescript', 'backend', 'api', 'rest'],
				features: ['Middleware', 'Routing', 'Template Engines', 'RESTful APIs'],
				stackblitzId: stackblitzTemplates.express
			},
			{
				id: 'astro',
				name: 'Astro',
				description: 'The web framework for content-driven websites',
				version: '4.x',
				category: 'static',
				icon: 'astro',
				tags: ['javascript', 'typescript', 'static', 'islands'],
				features: [
					'Islands Architecture',
					'Zero JS by Default',
					'Component Framework Agnostic',
					'Fast'
				],
				stackblitzId: stackblitzTemplates.astro
			},
			{
				id: 'vite',
				name: 'Vite',
				description: 'Next generation frontend tooling with instant dev server',
				version: '5.x',
				category: 'build-tools',
				icon: 'vite',
				tags: ['javascript', 'typescript', 'build-tool', 'dev-server'],
				features: ['Instant HMR', 'Lightning Fast', 'Rich Features', 'Universal Plugin API'],
				stackblitzId: stackblitzTemplates.vite
			},
			{
				id: 'vanilla',
				name: 'Vanilla JavaScript',
				description: 'Pure JavaScript with no frameworks',
				version: 'ES2023',
				category: 'frontend',
				icon: 'javascript',
				tags: ['javascript', 'vanilla', 'frontend'],
				features: ['No Dependencies', 'Lightweight', 'Full Control', 'Modern ES Features'],
				stackblitzId: stackblitzTemplates.vanilla
			},
			{
				id: 'vanilla-ts',
				name: 'Vanilla TypeScript',
				description: 'Pure TypeScript with no frameworks',
				version: '5.x',
				category: 'frontend',
				icon: 'typescript',
				tags: ['typescript', 'vanilla', 'frontend'],
				features: ['Type Safety', 'No Dependencies', 'Modern Features', 'Full Control'],
				stackblitzId: stackblitzTemplates['vanilla-ts']
			}
		];

		// Group frameworks by category for easier organization
		const categorizedFrameworks: Record<string, typeof frameworks> = {};
		for (const [category, frameworkIds] of Object.entries(templateCategories)) {
			categorizedFrameworks[category] = frameworks.filter(
				(fw) => (frameworkIds as readonly string[]).includes(fw.id) || fw.category === category
			);
		}

		return json({
			frameworks,
			categories: categorizedFrameworks,
			total: frameworks.length
		});
	} catch (error) {
		console.error('Error fetching frameworks:', error);
		return json({ error: 'Failed to fetch frameworks' }, { status: 500 });
	}
};
