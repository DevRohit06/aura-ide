import { z } from 'zod';

// Registration Schema for client-side validation
export const registerSchema = z.object({
	email: z.string().email('Please provide a valid email address'),
	username: z
		.string()
		.min(3, 'Username must be at least 3 characters long')
		.max(30, 'Username cannot exceed 30 characters')
		.regex(/^[a-zA-Z0-9]+$/, 'Username must contain only letters and numbers'),
	password: z
		.string()
		.min(8, 'Password must be at least 8 characters long')
		.regex(
			/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/,
			'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
		),
	firstName: z.string().min(1, 'First name is required').max(50).optional(),
	lastName: z.string().min(1, 'Last name is required').max(50).optional()
});

// Login Schema for client-side validation
export const loginSchema = z.object({
	email: z.string().email('Please provide a valid email address'),
	password: z.string().min(1, 'Password is required')
});

export type RegisterFormData = z.infer<typeof registerSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
