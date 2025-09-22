import Joi from 'joi';

// User Registration Schema
export const userRegistrationSchema = Joi.object({
	email: Joi.string().email().required().messages({
		'string.email': 'Please provide a valid email address',
		'any.required': 'Email is required'
	}),
	username: Joi.string().alphanum().min(3).max(30).required().messages({
		'string.alphanum': 'Username must contain only letters and numbers',
		'string.min': 'Username must be at least 3 characters long',
		'string.max': 'Username cannot exceed 30 characters',
		'any.required': 'Username is required'
	}),
	password: Joi.string()
		.min(8)
		.pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])'))
		.required()
		.messages({
			'string.min': 'Password must be at least 8 characters long',
			'string.pattern.base':
				'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character',
			'any.required': 'Password is required'
		}),
	firstName: Joi.string().min(1).max(50).optional(),
	lastName: Joi.string().min(1).max(50).optional()
});

// User Login Schema
export const userLoginSchema = Joi.object({
	email: Joi.string().email().required().messages({
		'string.email': 'Please provide a valid email address',
		'any.required': 'Email is required'
	}),
	password: Joi.string().required().messages({
		'any.required': 'Password is required'
	})
});

// Profile Update Schema
export const profileUpdateSchema = Joi.object({
	firstName: Joi.string().min(1).max(50).optional(),
	lastName: Joi.string().min(1).max(50).optional(),
	avatar: Joi.string().uri().optional(),
	preferences: Joi.object({
		theme: Joi.string().valid('light', 'dark', 'system').optional(),
		defaultFramework: Joi.string()
			.valid(
				'react',
				'nextjs',
				'svelte',
				'vue',
				'angular',
				'astro',
				'vite',
				'express',
				'node',
				'javascript',
				'typescript',
				'static',
				'bootstrap'
			)
			.optional(),
		editorSettings: Joi.object().optional()
	}).optional()
});

// Token Refresh Schema
export const tokenRefreshSchema = Joi.object({
	refreshToken: Joi.string().required().messages({
		'any.required': 'Refresh token is required'
	})
});
