import { z } from 'zod';

// Password validation schema with strength requirements
const passwordSchema = z
	.string()
	.min(8, 'Password must be at least 8 characters long')
	.max(128, 'Password must be less than 128 characters')
	.regex(
		/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
		'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
	);

// Email validation schema
const emailSchema = z
	.string()
	.email('Please enter a valid email address')
	.max(254, 'Email address is too long')
	.toLowerCase()
	.trim();

// Name validation schema
const nameSchema = z
	.string()
	.min(1, 'Name is required')
	.max(50, 'Name must be less than 50 characters')
	.regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')
	.trim();

// Login form validation schema
export const loginSchema = z.object({
	email: emailSchema,
	password: z.string().min(1, 'Password is required').max(128, 'Password is too long')
});

// Register form validation schema
export const registerSchema = z
	.object({
		firstName: nameSchema,
		lastName: nameSchema,
		email: emailSchema,
		password: passwordSchema,
		confirmPassword: z.string().min(1, 'Please confirm your password'),
		acceptTerms: z.boolean().refine((value) => value === true, {
			message: 'You must accept the Terms of Service and Privacy Policy'
		})
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: 'Passwords do not match',
		path: ['confirmPassword']
	});

// Password reset request schema
export const passwordResetRequestSchema = z.object({
	email: emailSchema
});

// Password reset schema
export const passwordResetSchema = z
	.object({
		token: z.string().min(1, 'Reset token is required'),
		password: passwordSchema,
		confirmPassword: z.string().min(1, 'Please confirm your password')
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: 'Passwords do not match',
		path: ['confirmPassword']
	});

// Types
export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type PasswordResetRequestData = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetData = z.infer<typeof passwordResetSchema>;

// Validation functions with detailed error handling
export function validateLogin(data: unknown): {
	success: boolean;
	data?: LoginFormData;
	errors?: z.ZodError;
} {
	const result = loginSchema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, errors: result.error };
}

export function validateRegister(data: unknown): {
	success: boolean;
	data?: RegisterFormData;
	errors?: z.ZodError;
} {
	const result = registerSchema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, errors: result.error };
}

export function validatePasswordResetRequest(data: unknown): {
	success: boolean;
	data?: PasswordResetRequestData;
	errors?: z.ZodError;
} {
	const result = passwordResetRequestSchema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, errors: result.error };
}

export function validatePasswordReset(data: unknown): {
	success: boolean;
	data?: PasswordResetData;
	errors?: z.ZodError;
} {
	const result = passwordResetSchema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, errors: result.error };
}

// Password strength checker
export function checkPasswordStrength(password: string): {
	score: number;
	feedback: string[];
	isStrong: boolean;
} {
	const feedback: string[] = [];
	let score = 0;

	// Length check
	if (password.length >= 8) {
		score += 1;
	} else {
		feedback.push('Use at least 8 characters');
	}

	if (password.length >= 12) {
		score += 1;
	}

	// Character variety checks
	if (/[a-z]/.test(password)) {
		score += 1;
	} else {
		feedback.push('Include lowercase letters');
	}

	if (/[A-Z]/.test(password)) {
		score += 1;
	} else {
		feedback.push('Include uppercase letters');
	}

	if (/\d/.test(password)) {
		score += 1;
	} else {
		feedback.push('Include numbers');
	}

	if (/[@$!%*?&]/.test(password)) {
		score += 1;
	} else {
		feedback.push('Include special characters (@$!%*?&)');
	}

	// Common patterns to avoid
	if (!/(.)\1{2,}/.test(password)) {
		score += 1;
	} else {
		feedback.push('Avoid repeating characters');
	}

	// Sequential patterns
	if (!/(?:123|abc|qwe)/i.test(password)) {
		score += 1;
	} else {
		feedback.push('Avoid sequential patterns');
	}

	const isStrong = score >= 6;

	return {
		score: Math.min(score, 8),
		feedback,
		isStrong
	};
}

// Email validation function
export function isValidEmail(email: string): boolean {
	return emailSchema.safeParse(email).success;
}

// Password validation function
export function isValidPassword(password: string): boolean {
	return passwordSchema.safeParse(password).success;
}
