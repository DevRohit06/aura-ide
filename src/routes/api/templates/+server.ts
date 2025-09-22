import { stackblitzTemplates, templateCategories } from '$lib/config/template.config.js';
import { TemplateService } from '$lib/services/template.service.js';
import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
	try {
		// Parse query parameters
		const category = url.searchParams.get('category');
		const search = url.searchParams.get('search');
		const limit = parseInt(url.searchParams.get('limit') || '50');
		const offset = parseInt(url.searchParams.get('offset') || '0');
		const sortBy = url.searchParams.get('sortBy') || 'popularity';
		const sortOrder = url.searchParams.get('sortOrder') || 'desc';

		const searchOptions = {
			category: category || undefined,
			search: search || undefined,
			limit,
			offset,
			sortBy: sortBy as 'popularity' | 'name' | 'created_at' | 'updated_at',
			sortOrder: sortOrder as 'asc' | 'desc'
		};

		// Get templates from service
		const templateService = new TemplateService();
		const result = await templateService.searchTemplates(searchOptions);

		// If no templates found, return static template list
		if (!result.templates || result.templates.length === 0) {
			// Create static template list based on stackblitz templates
			const staticTemplates = [
				{
					id: 'react',
					name: 'React',
					description: 'A JavaScript library for building user interfaces',
					category: 'frontend',
					framework: 'react',
					language: 'javascript',
					tags: ['react', 'javascript', 'frontend', 'spa'],
					popularity_score: 95,
					stackblitz_id: stackblitzTemplates.react,
					thumbnail: 'https://vitejs.dev/logo.svg',
					author: 'React Team',
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString()
				},
				{
					id: 'react-ts',
					name: 'React with TypeScript',
					description: 'React with TypeScript for type-safe development',
					category: 'frontend',
					framework: 'react',
					language: 'typescript',
					tags: ['react', 'typescript', 'frontend', 'spa'],
					popularity_score: 92,
					stackblitz_id: stackblitzTemplates['react-ts'],
					thumbnail: 'https://vitejs.dev/logo.svg',
					author: 'React Team',
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString()
				},
				{
					id: 'nextjs',
					name: 'Next.js',
					description: 'The React framework for production',
					category: 'fullstack',
					framework: 'nextjs',
					language: 'javascript',
					tags: ['nextjs', 'react', 'ssr', 'ssg', 'fullstack'],
					popularity_score: 90,
					stackblitz_id: stackblitzTemplates.nextjs,
					thumbnail: 'https://nextjs.org/static/favicon/favicon.ico',
					author: 'Vercel',
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString()
				},
				{
					id: 'nextjs-ts',
					name: 'Next.js with TypeScript',
					description: 'Next.js with TypeScript for type-safe full-stack development',
					category: 'fullstack',
					framework: 'nextjs',
					language: 'typescript',
					tags: ['nextjs', 'react', 'typescript', 'ssr', 'ssg'],
					popularity_score: 89,
					stackblitz_id: stackblitzTemplates['nextjs-ts'],
					thumbnail: 'https://nextjs.org/static/favicon/favicon.ico',
					author: 'Vercel',
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString()
				},
				{
					id: 'vue',
					name: 'Vue.js',
					description: 'The progressive JavaScript framework',
					category: 'frontend',
					framework: 'vue',
					language: 'javascript',
					tags: ['vue', 'javascript', 'frontend', 'spa'],
					popularity_score: 85,
					stackblitz_id: stackblitzTemplates.vue,
					thumbnail: 'https://vuejs.org/logo.svg',
					author: 'Vue Team',
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString()
				},
				{
					id: 'vue-ts',
					name: 'Vue.js with TypeScript',
					description: 'Vue.js with TypeScript and Composition API',
					category: 'frontend',
					framework: 'vue',
					language: 'typescript',
					tags: ['vue', 'typescript', 'frontend', 'spa'],
					popularity_score: 82,
					stackblitz_id: stackblitzTemplates['vue-ts'],
					thumbnail: 'https://vuejs.org/logo.svg',
					author: 'Vue Team',
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString()
				},
				{
					id: 'svelte',
					name: 'Svelte',
					description: 'Cybernetically enhanced web apps',
					category: 'frontend',
					framework: 'svelte',
					language: 'javascript',
					tags: ['svelte', 'javascript', 'frontend', 'spa'],
					popularity_score: 80,
					stackblitz_id: stackblitzTemplates.svelte,
					thumbnail: 'https://svelte.dev/favicon.png',
					author: 'Svelte Team',
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString()
				},
				{
					id: 'sveltekit',
					name: 'SvelteKit',
					description: 'The fastest way to build svelte apps',
					category: 'fullstack',
					framework: 'sveltekit',
					language: 'typescript',
					tags: ['sveltekit', 'svelte', 'typescript', 'ssr', 'ssg'],
					popularity_score: 78,
					stackblitz_id: stackblitzTemplates.sveltekit,
					thumbnail: 'https://svelte.dev/favicon.png',
					author: 'Svelte Team',
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString()
				},
				{
					id: 'angular',
					name: 'Angular',
					description: 'Platform for building mobile and desktop web applications',
					category: 'frontend',
					framework: 'angular',
					language: 'typescript',
					tags: ['angular', 'typescript', 'frontend', 'spa'],
					popularity_score: 75,
					stackblitz_id: stackblitzTemplates.angular,
					thumbnail: 'https://angular.io/assets/images/favicons/favicon.ico',
					author: 'Angular Team',
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString()
				},
				{
					id: 'node',
					name: 'Node.js',
					description: 'JavaScript runtime for server-side development',
					category: 'backend',
					framework: 'node',
					language: 'javascript',
					tags: ['node', 'javascript', 'backend', 'api'],
					popularity_score: 88,
					stackblitz_id: stackblitzTemplates.node,
					thumbnail: 'https://nodejs.org/static/images/favicons/favicon.ico',
					author: 'Node.js Team',
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString()
				},
				{
					id: 'express',
					name: 'Express.js',
					description: 'Fast, unopinionated, minimalist web framework for Node.js',
					category: 'backend',
					framework: 'express',
					language: 'javascript',
					tags: ['express', 'node', 'javascript', 'backend', 'api'],
					popularity_score: 86,
					stackblitz_id: stackblitzTemplates.express,
					thumbnail: 'https://expressjs.com/images/favicon.png',
					author: 'Express Team',
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString()
				},
				{
					id: 'astro',
					name: 'Astro',
					description: 'The web framework for content-driven websites',
					category: 'static',
					framework: 'astro',
					language: 'typescript',
					tags: ['astro', 'typescript', 'static', 'islands'],
					popularity_score: 72,
					stackblitz_id: stackblitzTemplates.astro,
					thumbnail: 'https://astro.build/favicon.ico',
					author: 'Astro Team',
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString()
				},
				{
					id: 'vite',
					name: 'Vite',
					description: 'Next generation frontend tooling',
					category: 'build-tools',
					framework: 'vite',
					language: 'javascript',
					tags: ['vite', 'javascript', 'build-tool', 'dev-server'],
					popularity_score: 84,
					stackblitz_id: stackblitzTemplates.vite,
					thumbnail: 'https://vitejs.dev/logo.svg',
					author: 'Vite Team',
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString()
				},
				{
					id: 'vanilla',
					name: 'Vanilla JavaScript',
					description: 'Pure JavaScript with no frameworks',
					category: 'frontend',
					framework: 'vanilla',
					language: 'javascript',
					tags: ['vanilla', 'javascript', 'frontend'],
					popularity_score: 70,
					stackblitz_id: stackblitzTemplates.vanilla,
					thumbnail: 'https://developer.mozilla.org/favicon-48x48.png',
					author: 'Community',
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString()
				},
				{
					id: 'vanilla-ts',
					name: 'Vanilla TypeScript',
					description: 'Pure TypeScript with no frameworks',
					category: 'frontend',
					framework: 'vanilla',
					language: 'typescript',
					tags: ['vanilla', 'typescript', 'frontend'],
					popularity_score: 68,
					stackblitz_id: stackblitzTemplates['vanilla-ts'],
					thumbnail: 'https://www.typescriptlang.org/favicon-32x32.png',
					author: 'Community',
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString()
				}
			];

			// Apply filters
			let filteredTemplates = staticTemplates;

			if (category) {
				filteredTemplates = filteredTemplates.filter((t) => t.category === category);
			}

			if (search) {
				const searchLower = search.toLowerCase();
				filteredTemplates = filteredTemplates.filter(
					(t) =>
						t.name.toLowerCase().includes(searchLower) ||
						t.description.toLowerCase().includes(searchLower) ||
						t.tags.some((tag) => tag.toLowerCase().includes(searchLower))
				);
			}

			// Apply sorting
			if (sortBy === 'popularity') {
				filteredTemplates.sort((a, b) =>
					sortOrder === 'desc'
						? b.popularity_score - a.popularity_score
						: a.popularity_score - b.popularity_score
				);
			} else if (sortBy === 'name') {
				filteredTemplates.sort((a, b) =>
					sortOrder === 'desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)
				);
			}

			// Apply pagination
			const paginatedTemplates = filteredTemplates.slice(offset, offset + limit);

			return json({
				templates: paginatedTemplates,
				total: filteredTemplates.length,
				categories: Object.keys(templateCategories),
				page: Math.floor(offset / limit) + 1,
				pageSize: limit,
				hasMore: offset + limit < filteredTemplates.length
			});
		}

		return json(result);
	} catch (error) {
		console.error('Error fetching templates:', error);
		return json({ error: 'Failed to fetch templates' }, { status: 500 });
	}
};
