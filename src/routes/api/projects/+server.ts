import { DatabaseService } from '$lib/services/database.service.js';
import { projectInitializationService } from '$lib/services/project-initialization.service.js';
import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		// Check authentication
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Get user projects
		const projects = await DatabaseService.findProjectsByUserId(locals.user.id);

		return json({
			projects: projects || [],
			total: projects?.length || 0
		});
	} catch (error) {
		console.error('Error fetching projects:', error);
		return json({ error: 'Failed to fetch projects' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Check authentication
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { name, framework, templateId, description, configuration } = await request.json();

		// Validate required fields
		if (!name || !framework) {
			return json({ error: 'Project name and framework are required' }, { status: 400 });
		}

		// Map framework to proper StackBlitz starter name
		const getTemplateId = (framework: string, providedTemplateId?: string): string => {
			if (providedTemplateId) return providedTemplateId;

			// Map common frameworks to their StackBlitz starter folder paths
			const frameworkMap: Record<string, string> = {
				react: 'react-ts',
				vue: 'vue-ts',
				svelte: 'svelte-ts',
				angular: 'angular',
				next: 'nextjs',
				nextjs: 'nextjs',
				nuxt: 'nuxtjs',
				node: 'node',
				nodejs: 'node',
				typescript: 'typescript',
				javascript: 'javascript'
			};

			return frameworkMap[framework.toLowerCase()] || 'react-ts'; // Default to react-ts
		};

		// Use project initialization service for complete setup with Daytona sandbox
		const initializationResult = await projectInitializationService.initializeProject({
			name: name.trim(),
			templateId: getTemplateId(framework, templateId),
			framework,
			userId: locals.user.id,
			description: description?.trim() || `${framework} project`,
			configuration: {
				typescript: configuration?.typescript ?? false,
				eslint: configuration?.eslint ?? true,
				prettier: configuration?.prettier ?? true,
				tailwindcss: configuration?.tailwindcss ?? false,
				packageManager: configuration?.packageManager ?? 'npm',
				additionalDependencies: configuration?.additionalDependencies ?? []
			},
			sandboxOptions: {
				createDaytona: true, // Always create Daytona sandbox
				createE2B: false,
				daytonaConfig: {},
				e2bConfig: {}
			}
		});

		return json(
			{
				project: initializationResult.project,
				initialization: {
					filesCount: initializationResult.files.length,
					storageUrl: initializationResult.storage.url,
					sandboxes: initializationResult.sandboxes
				}
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('Error creating project:', error);
		return json(
			{
				error: 'Failed to create project',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
