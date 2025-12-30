import { z } from 'zod';

// Project name validation - stricter rules for project names
const projectNameSchema = z
	.string()
	.min(2, 'Project name must be at least 2 characters long')
	.max(50, 'Project name must be less than 50 characters')
	.regex(
		/^[a-zA-Z0-9]([a-zA-Z0-9\-_]*[a-zA-Z0-9])?$/,
		'Project name must start and end with alphanumeric characters and can only contain letters, numbers, hyphens, and underscores'
	)
	.refine(
		(name) =>
			![
				'con',
				'prn',
				'aux',
				'nul',
				'com1',
				'com2',
				'com3',
				'com4',
				'com5',
				'com6',
				'com7',
				'com8',
				'com9',
				'lpt1',
				'lpt2',
				'lpt3',
				'lpt4',
				'lpt5',
				'lpt6',
				'lpt7',
				'lpt8',
				'lpt9'
			].includes(name.toLowerCase()),
		'Project name cannot be a reserved system name'
	)
	.refine(
		(name) => !name.startsWith('.') && !name.endsWith('.'),
		'Project name cannot start or end with a period'
	)
	.trim();

// Project description validation
const projectDescriptionSchema = z
	.string()
	.max(500, 'Project description must be less than 500 characters')
	.optional()
	.transform((val) => val?.trim() || undefined);

// Framework validation
const frameworkSchema = z
	.string()
	.min(1, 'Please select a framework')
	.max(50, 'Framework name is too long');

// Sandbox provider validation
const sandboxProviderSchema = z
	.enum(['daytona'])
	.refine((val) => ['daytona'].includes(val), {
		message: 'Please select a valid sandbox provider'
	});


// Package manager validation
const packageManagerSchema = z
	.enum(['npm', 'yarn', 'pnpm', 'bun'])
	.refine((val) => ['npm', 'yarn', 'pnpm', 'bun'].includes(val), {
		message: 'Please select a valid package manager'
	});

// Additional dependencies validation
const additionalDependenciesSchema = z
	.string()
	.optional()
	.transform((val) => {
		if (!val?.trim()) return [];
		return val
			.split(',')
			.map((dep) => dep.trim())
			.filter((dep) => dep.length > 0)
			.filter((dep) => /^[a-zA-Z0-9@\-_.\/]+$/.test(dep)); // Basic npm package name validation
	})
	.refine((deps) => deps.length <= 20, 'Too many dependencies. Please limit to 20 packages.')
	.refine(
		(deps) => deps.every((dep) => dep.length <= 100),
		'Dependency names must be less than 100 characters each'
	);

// Configuration schema
const configurationSchema = z.object({
	typescript: z.boolean().default(true).optional(),
	eslint: z.boolean().default(true).optional(),
	prettier: z.boolean().default(true).optional(),
	tailwindcss: z.boolean().default(true).optional(),
	packageManager: packageManagerSchema.default('npm').optional(),
	additionalDependencies: additionalDependenciesSchema.default([]).optional()
});

// Custom repository schema
const customRepoSchema = z
	.object({
		owner: z.string().min(1, 'Repository owner is required'),
		repo: z.string().min(1, 'Repository name is required'),
		branch: z.string().optional(),
		path: z.string().optional()
	})
	.optional();

// Main project setup schema
export const projectSetupSchema = z.object({
	name: projectNameSchema,
	description: projectDescriptionSchema,
	framework: frameworkSchema,
	sandboxProvider: sandboxProviderSchema,
	customRepo: customRepoSchema,
	configuration: configurationSchema
});

// Step-by-step validation schemas for better UX
export const projectDetailsSchema = z.object({
	name: projectNameSchema,
	description: projectDescriptionSchema
});

export const frameworkSelectionSchema = z.object({
	framework: frameworkSchema
});

export const sandboxProviderSelectionSchema = z.object({
	sandboxProvider: sandboxProviderSchema
});

export const projectConfigurationSchema = z.object({
	configuration: configurationSchema
});

// Types
export type ProjectSetupData = z.infer<typeof projectSetupSchema>;
export type ProjectDetailsData = z.infer<typeof projectDetailsSchema>;
export type FrameworkSelectionData = z.infer<typeof frameworkSelectionSchema>;
export type SandboxProviderSelectionData = z.infer<typeof sandboxProviderSelectionSchema>;
export type ProjectConfigurationData = z.infer<typeof projectConfigurationSchema>;
export type ConfigurationData = z.infer<typeof configurationSchema>;

// Validation functions
export function validateProjectSetup(data: unknown): {
	success: boolean;
	data?: ProjectSetupData;
	errors?: z.ZodError;
} {
	const result = projectSetupSchema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, errors: result.error };
}

export function validateProjectDetails(data: unknown): {
	success: boolean;
	data?: ProjectDetailsData;
	errors?: z.ZodError;
} {
	const result = projectDetailsSchema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, errors: result.error };
}

export function validateFrameworkSelection(data: unknown): {
	success: boolean;
	data?: FrameworkSelectionData;
	errors?: z.ZodError;
} {
	const result = frameworkSelectionSchema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, errors: result.error };
}

export function validateSandboxProviderSelection(data: unknown): {
	success: boolean;
	data?: SandboxProviderSelectionData;
	errors?: z.ZodError;
} {
	const result = sandboxProviderSelectionSchema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, errors: result.error };
}

export function validateProjectConfiguration(data: unknown): {
	success: boolean;
	data?: ProjectConfigurationData;
	errors?: z.ZodError;
} {
	const result = projectConfigurationSchema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, errors: result.error };
}

// Project name availability check (client-side validation)
export function validateProjectNameFormat(name: string): {
	isValid: boolean;
	errors: string[];
} {
	const errors: string[] = [];

	if (!name.trim()) {
		errors.push('Project name is required');
		return { isValid: false, errors };
	}

	const result = projectNameSchema.safeParse(name);
	if (!result.success) {
		errors.push(...result.error.issues.map((err: any) => err.message));
	}

	return {
		isValid: result.success,
		errors
	};
}

// Utility function to get step validation
export function getStepValidation(
	step: number,
	data: any
): {
	isValid: boolean;
	errors: string[];
} {
	switch (step) {
		case 1:
			const detailsResult = validateProjectDetails(data);
			return {
				isValid: detailsResult.success,
				errors: detailsResult.errors?.issues.map((err: any) => err.message) || []
			};
		case 2:
			const frameworkResult = validateFrameworkSelection(data);
			return {
				isValid: frameworkResult.success,
				errors: frameworkResult.errors?.issues.map((err: any) => err.message) || []
			};
		case 3:
			const providerResult = validateSandboxProviderSelection(data);
			return {
				isValid: providerResult.success,
				errors: providerResult.errors?.issues.map((err: any) => err.message) || []
			};
		case 4:
			const configResult = validateProjectConfiguration(data);
			return {
				isValid: configResult.success,
				errors: configResult.errors?.issues.map((err: any) => err.message) || []
			};
		default:
			return { isValid: false, errors: ['Invalid step'] };
	}
}
