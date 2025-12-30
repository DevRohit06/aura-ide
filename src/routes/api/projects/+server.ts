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

		const { name, framework, templateId, description, configuration, sandboxProvider, customRepo } =
			await request.json();

		// Debug logging
		console.log('🔍 API DEBUG: Received project creation request:');
		console.log('  - framework:', framework);
		console.log('  - customRepo:', JSON.stringify(customRepo, null, 2));
		console.log('  - templateId:', templateId);

		// Validate required fields
		if (!name || !framework || !sandboxProvider) {
			return json(
				{ error: 'Project name, framework, and sandbox provider are required' },
				{ status: 400 }
			);
		}

		// Validate sandbox provider
		if (sandboxProvider !== 'daytona') {
			return json(
				{ error: 'Invalid sandbox provider. Only "daytona" is supported.' },
				{ status: 400 }
			);
		}

		// Validate custom repository if provided
		if (customRepo) {
			if (!customRepo.owner || !customRepo.repo) {
				return json({ error: 'Custom repository must include owner and repo' }, { status: 400 });
			}

			// Validate owner and repo names
			const validNamePattern = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
			const validRepoPattern = /^[a-zA-Z0-9._-]+$/;

			if (!validNamePattern.test(customRepo.owner)) {
				return json({ error: 'Invalid GitHub username/organization name' }, { status: 400 });
			}

			if (!validRepoPattern.test(customRepo.repo)) {
				return json({ error: 'Invalid repository name' }, { status: 400 });
			}

			// Validate branch if provided
			if (customRepo.branch) {
				const validBranchPattern = /^[a-zA-Z0-9._/-]+$/;
				if (!validBranchPattern.test(customRepo.branch)) {
					return json({ error: 'Invalid branch name' }, { status: 400 });
				}
			}
		}

		// Map framework to proper StackBlitz starter name
		const getTemplateId = (
			framework: string,
			providedTemplateId?: string,
			hasCustomRepo?: boolean
		): string => {
			// If using custom repo, use a placeholder template ID
			if (hasCustomRepo) return 'custom-repo';

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

		// Use project initialization service for complete setup with chosen sandbox provider
		const initializationResult = await projectInitializationService.initializeProject({
			name: name.trim(),
			templateId: getTemplateId(framework, templateId, !!customRepo),
			framework,
			userId: locals.user.id,
			description: description?.trim() || `${framework} project`,
			sandboxProvider,
			customRepo: customRepo || undefined,
			configuration: {
				typescript: configuration?.typescript ?? false,
				eslint: configuration?.eslint ?? true,
				prettier: configuration?.prettier ?? true,
				tailwindcss: configuration?.tailwindcss ?? false,
				packageManager: configuration?.packageManager ?? 'npm',
				additionalDependencies: configuration?.additionalDependencies ?? []
			},
			sandboxOptions: {
				// Provider-specific options can be added here if needed
			}
		});

		return json(
			{
				project: initializationResult.project,
				initialization: {
					filesCount: initializationResult.files.length,
					sandboxResult: initializationResult.sandboxResult
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
