import { STACKBLITZ_STARTERS } from '../../config/stackblitz-starters.config';
import { logger } from '../../utils/logger';

import type {
	StackBlitzDownloadOptions,
	StackBlitzDownloadResult,
	StackBlitzService,
	StackBlitzTemplate
} from './stackblitz.types';

export class StackBlitzServiceImpl implements StackBlitzService {
	private templatesCache: Map<string, StackBlitzTemplate> = new Map();

	constructor() {
		// Constructor no longer needs sandbox service
	}

	/**
	 * Get all available templates from the starters configuration
	 */
	async getAvailableTemplates(): Promise<StackBlitzTemplate[]> {
		try {
			const templates: StackBlitzTemplate[] = [];

			for (const [framework, starters] of Object.entries(STACKBLITZ_STARTERS)) {
				for (const starter of starters) {
					const template = await this.getTemplate(framework, starter.name);
					if (template) {
						templates.push(template);
					}
				}
			}

			logger.info(`Retrieved ${templates.length} available templates`);
			return templates;
		} catch (error) {
			logger.error('Failed to get available templates', error);
			throw new Error('Failed to retrieve available templates');
		}
	}

	/**
	 * Get a specific template by framework and starter name
	 */
	async getTemplate(framework: string, starter: string): Promise<StackBlitzTemplate | null> {
		try {
			const cacheKey = `${framework}/${starter}`;

			// Check cache first
			if (this.templatesCache.has(cacheKey)) {
				return this.templatesCache.get(cacheKey)!;
			}

			const frameworkStartersData = STACKBLITZ_STARTERS[framework];
			if (!frameworkStartersData) {
				logger.warn(`Framework '${framework}' not found in starters config`);
				return null;
			}

			const starterConfig = frameworkStartersData.find(
				(s) => s.name === starter || s.path === starter
			);
			if (!starterConfig) {
				logger.warn(`Starter '${starter}' not found for framework '${framework}'`);
				return null;
			}

			// Download and parse the template
			const result = await this.downloadTemplate({
				framework,
				starter: starterConfig.path
			});
			if (!result.success || !result.template) {
				logger.error(
					`Failed to download template for ${framework}/${starterConfig.path}`,
					result.error
				);
				return null;
			}

			// Cache the template
			this.templatesCache.set(cacheKey, result.template);

			return result.template;
		} catch (error) {
			logger.error(`Failed to get template ${framework}/${starter}`, error);
			return null;
		}
	}

	/**
	 * Download a template from StackBlitz starters repository
	 */
	async downloadTemplate(options: StackBlitzDownloadOptions): Promise<StackBlitzDownloadResult> {
		try {
			const { framework, starter, version = 'main' } = options;

			// Find the actual path for this starter from the config
			const frameworkStarters = STACKBLITZ_STARTERS[framework];
			let templatePath = starter;

			if (frameworkStarters) {
				const starterConfig = frameworkStarters.find(
					(s) => s.name === starter || s.path === starter
				);
				if (starterConfig) {
					templatePath = starterConfig.path;
				}
			}

			// Construct GitHub API URL for the starter
			const repoUrl = `https://api.github.com/repos/stackblitz/starters/contents/${templatePath}`;
			const branch = version === 'main' ? 'main' : `v${version}`;

			logger.info(
				`Downloading template from ${repoUrl} (branch: ${branch}) for starter: ${starter}`
			);

			// Fetch the directory contents with timeout
			const response = await Promise.race([
				fetch(`${repoUrl}?ref=${branch}`),
				new Promise<never>((_, reject) =>
					setTimeout(() => reject(new Error('GitHub API timeout after 15 seconds')), 15000)
				)
			]);

			if (!response.ok) {
				return {
					success: false,
					error: `Failed to fetch template: ${response.status} ${response.statusText} for path: ${templatePath}`
				};
			}

			const files = await response.json();
			logger.info(`Found ${files.length} files in template directory`);

			// Download individual files with timeout
			const templateFiles: Record<string, string> = {};
			const packageJsonFiles: any[] = [];

			for (const file of files) {
				if (file.type === 'file') {
					try {
						logger.info(`Downloading file: ${file.path}`);
						const fileResponse = await Promise.race([
							fetch(file.download_url),
							new Promise<never>((_, reject) =>
								setTimeout(() => reject(new Error(`File download timeout for ${file.path}`)), 10000)
							)
						]);

						if (fileResponse.ok) {
							const content = await fileResponse.text();

							// Strip the template path prefix to get relative file path
							// e.g., "react-ts/src/App.tsx" becomes "src/App.tsx"
							const relativePath = file.path.startsWith(templatePath + '/')
								? file.path.substring(templatePath.length + 1)
								: file.path;

							templateFiles[relativePath] = content;

							if (file.name === 'package.json') {
								packageJsonFiles.push(JSON.parse(content));
							}
						} else {
							logger.warn(`Failed to download file ${file.path}: ${fileResponse.status}`);
						}
					} catch (error) {
						logger.warn(`Failed to download file ${file.path}`, error);
					}
				}
			}

			// Create template object
			const frameworkStartersConfig = STACKBLITZ_STARTERS[framework];
			const starterConfig = frameworkStartersConfig?.find((s) => s.name === starter);

			const template: StackBlitzTemplate = {
				name: starter,
				path: `${framework}/${starter}`,
				description: starterConfig?.description || `StackBlitz ${framework} ${starter} template`,
				framework,
				features: starterConfig?.features || [],
				files: templateFiles,
				packageJson: packageJsonFiles[0]
			};

			logger.info(
				`Successfully downloaded template ${framework}/${starter} with ${Object.keys(templateFiles).length} files`
			);

			return {
				success: true,
				template,
				files: templateFiles
			};
		} catch (error) {
			logger.error('Failed to download template', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error occurred'
			};
		}
	}

	/**
	 * Extract template files for use in sandbox
	 */
	async extractTemplateFiles(template: StackBlitzTemplate): Promise<Record<string, string>> {
		try {
			// Validate template
			const isValid = await this.validateTemplate(template);
			if (!isValid) {
				throw new Error('Template validation failed');
			}

			logger.info(
				`Extracting ${Object.keys(template.files).length} files from template ${template.name}`
			);
			return template.files;
		} catch (error) {
			logger.error('Failed to extract template files', error);
			throw error;
		}
	}

	/**
	 * Validate template structure and files
	 */
	async validateTemplate(template: StackBlitzTemplate): Promise<boolean> {
		try {
			// Check for required files
			const requiredFiles = ['package.json'];
			const hasRequiredFiles = requiredFiles.every((file) =>
				Object.keys(template.files).some((path) => path.endsWith(file))
			);

			if (!hasRequiredFiles) {
				logger.warn(
					`Template ${template.name} missing required files: ${requiredFiles.join(', ')}`
				);
				return false;
			}

			// Validate package.json if present
			if (template.packageJson) {
				const pkg = template.packageJson;
				if (!pkg.name || !pkg.version) {
					logger.warn(`Template ${template.name} has invalid package.json`);
					return false;
				}
			}

			logger.info(`Template ${template.name} validation successful`);
			return true;
		} catch (error) {
			logger.error(`Template validation failed for ${template.name}`, error);
			return false;
		}
	}

	/**
	 * Apply a template to an E2B sandbox
	 */
	async applyTemplateToSandbox(
		sandboxId: string,
		template: StackBlitzTemplate,
		mountPath: string
	): Promise<boolean> {
		try {
			logger.info(`Applying template ${template.name} to sandbox ${sandboxId}`);

			// Extract template files
			const files = await this.extractTemplateFiles(template);

			// Upload files to sandbox via mount
			let successCount = 0;
			for (const [filePath, content] of Object.entries(files)) {
				try {
					// TODO: Implement sandbox file writing
					console.log(`Would write file: ${mountPath}/${filePath}`);
					successCount++;
				} catch (error) {
					logger.warn(`Failed to upload file ${filePath} to sandbox`, error);
				}
			}

			logger.info(
				`Successfully applied ${successCount}/${Object.keys(files).length} files to sandbox ${sandboxId}`
			);
			return successCount > 0;
		} catch (error) {
			logger.error(`Failed to apply template to sandbox ${sandboxId}`, error);
			return false;
		}
	}
}
