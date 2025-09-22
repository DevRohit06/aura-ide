import Joi from 'joi';

// Framework types
export const frameworkSchema = Joi.string().valid('react', 'nextjs', 'svelte', 'vue', 'angular');

// Project Creation Schema
export const projectCreationSchema = Joi.object({
	name: Joi.string()
		.min(1)
		.max(100)
		.pattern(/^[a-zA-Z0-9-_\s]+$/)
		.required()
		.messages({
			'string.min': 'Project name is required',
			'string.max': 'Project name cannot exceed 100 characters',
			'string.pattern.base':
				'Project name can only contain letters, numbers, spaces, hyphens, and underscores',
			'any.required': 'Project name is required'
		}),
	description: Joi.string().max(500).optional(),
	framework: frameworkSchema.required().messages({
		'any.required': 'Framework selection is required'
	}),
	configuration: Joi.object({
		typescript: Joi.boolean().default(true),
		eslint: Joi.boolean().default(true),
		prettier: Joi.boolean().default(true),
		tailwindcss: Joi.boolean().default(false),
		packageManager: Joi.string().valid('npm', 'yarn', 'pnpm', 'bun').default('npm'),
		additionalDependencies: Joi.array().items(Joi.string()).default([])
	}).default({})
});

// Project Update Schema
export const projectUpdateSchema = Joi.object({
	name: Joi.string()
		.min(1)
		.max(100)
		.pattern(/^[a-zA-Z0-9-_\s]+$/)
		.optional(),
	description: Joi.string().max(500).allow('').optional(),
	configuration: Joi.object({
		typescript: Joi.boolean().optional(),
		eslint: Joi.boolean().optional(),
		prettier: Joi.boolean().optional(),
		tailwindcss: Joi.boolean().optional(),
		packageManager: Joi.string().valid('npm', 'yarn', 'pnpm', 'bun').optional(),
		additionalDependencies: Joi.array().items(Joi.string()).optional()
	}).optional()
});

// Session Creation Schema
export const sessionCreationSchema = Joi.object({
	projectId: Joi.string().required().messages({
		'any.required': 'Project ID is required'
	}),
	type: Joi.string().valid('editor', 'ai-agent').required().messages({
		'any.required': 'Session type is required'
	})
});
