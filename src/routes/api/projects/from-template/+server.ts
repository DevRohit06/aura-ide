import { projectInitializationService } from '$lib/services/project-initialization.service.js';
import { TemplateService } from '$lib/services/template.service.js';
import { error, json, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Check authentication
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { templateId, projectName, projectDescription, configuration, sandboxOptions } =
			await request.json();

		// Validate required fields
		if (!templateId || !projectName) {
			return json({ error: 'Template ID and project name are required' }, { status: 400 });
		}

		// Get template details to determine framework
		const templateService = new TemplateService();
		const template = await templateService.getTemplate(templateId);
		if (!template) {
			throw error(404, 'Template not found');
		}

		// Start complete project initialization with cloning, R2 upload, and Daytona sandbox creation
		const initializationResult = await projectInitializationService.initializeProject({
			name: projectName.trim(),
			templateId,
			framework: template.type,
			userId: locals.user.id,
			description: projectDescription?.trim() || template.description,
			configuration: {
				typescript: configuration?.typescript ?? false,
				eslint: configuration?.eslint ?? true,
				prettier: configuration?.prettier ?? true,
				tailwindcss: configuration?.tailwindcss ?? false,
				packageManager: configuration?.packageManager ?? 'npm',
				additionalDependencies: configuration?.additionalDependencies ?? []
			},
			sandboxOptions: {
				createDaytona: true, // Always create Daytona sandbox for now
				createE2B: false, // Disable E2B for now
				daytonaConfig: sandboxOptions?.daytonaConfig || {},
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
	} catch (err) {
		console.error('Error creating project from template:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		return json(
			{
				error: 'Failed to create project from template',
				details: err instanceof Error ? err.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
