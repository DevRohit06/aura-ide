import { z } from 'zod';
import type { ValidationError } from './error-handling';
import { formatZodErrors, getFieldError, hasFieldError } from './error-handling';

// Form validation state type
export interface FormValidationState {
	isValid: boolean;
	errors: ValidationError[];
	touched: Set<string>;
	isSubmitting: boolean;
}

// Field validation result
export interface FieldValidationResult {
	isValid: boolean;
	error?: string;
}

// Create reactive form validation state
export function createFormValidation(): {
	state: FormValidationState;
	validateField: (fieldName: string, value: any, schema: z.ZodType) => FieldValidationResult;
	validateForm: <T>(
		data: T,
		schema: z.ZodType<T>
	) => { isValid: boolean; errors: ValidationError[] };
	setFieldTouched: (fieldName: string) => void;
	clearErrors: () => void;
	setSubmitting: (isSubmitting: boolean) => void;
	getFieldError: (fieldName: string) => string | undefined;
	hasFieldError: (fieldName: string) => boolean;
	isFieldTouched: (fieldName: string) => boolean;
} {
	let state: FormValidationState = {
		isValid: false,
		errors: [],
		touched: new Set(),
		isSubmitting: false
	};

	const validateField = (
		fieldName: string,
		value: any,
		schema: z.ZodType
	): FieldValidationResult => {
		try {
			schema.parse(value);
			// Remove any existing errors for this field
			state.errors = state.errors.filter((error) => error.field !== fieldName);
			return { isValid: true };
		} catch (error) {
			if (error instanceof z.ZodError) {
				const zodErrors = formatZodErrors(error);
				// Update errors for this field
				state.errors = [
					...state.errors.filter((e) => e.field !== fieldName),
					...zodErrors.map((e) => ({ ...e, field: fieldName }))
				];
				return { isValid: false, error: zodErrors[0]?.message };
			}
			return { isValid: false, error: 'Validation error' };
		}
	};

	const validateForm = <T>(
		data: T,
		schema: z.ZodType<T>
	): { isValid: boolean; errors: ValidationError[] } => {
		try {
			schema.parse(data);
			state.errors = [];
			state.isValid = true;
			return { isValid: true, errors: [] };
		} catch (error) {
			if (error instanceof z.ZodError) {
				const errors = formatZodErrors(error);
				state.errors = errors;
				state.isValid = false;
				return { isValid: false, errors };
			}
			const fallbackError: ValidationError = { field: 'form', message: 'Validation failed' };
			state.errors = [fallbackError];
			state.isValid = false;
			return { isValid: false, errors: [fallbackError] };
		}
	};

	const setFieldTouched = (fieldName: string) => {
		state.touched.add(fieldName);
	};

	const clearErrors = () => {
		state.errors = [];
		state.isValid = false;
	};

	const setSubmitting = (isSubmitting: boolean) => {
		state.isSubmitting = isSubmitting;
	};

	const getFieldErrorFn = (fieldName: string): string | undefined => {
		return getFieldError(state.errors, fieldName);
	};

	const hasFieldErrorFn = (fieldName: string): boolean => {
		return hasFieldError(state.errors, fieldName);
	};

	const isFieldTouched = (fieldName: string): boolean => {
		return state.touched.has(fieldName);
	};

	return {
		state,
		validateField,
		validateForm,
		setFieldTouched,
		clearErrors,
		setSubmitting,
		getFieldError: getFieldErrorFn,
		hasFieldError: hasFieldErrorFn,
		isFieldTouched
	};
}

// Debounced validation function
export function createDebouncedValidator(validationFn: () => void, delay = 300): () => void {
	let timeoutId: NodeJS.Timeout | null = null;

	return () => {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
		timeoutId = setTimeout(validationFn, delay);
	};
}

// Real-time validation mixin for input components
export function createFieldValidator(
	fieldName: string,
	schema: z.ZodType,
	formValidation: ReturnType<typeof createFormValidation>
) {
	const debouncedValidate = createDebouncedValidator(() => {
		// This would be called with the current value
	}, 300);

	return {
		onInput: (value: any) => {
			formValidation.setFieldTouched(fieldName);
			debouncedValidate();
		},
		onBlur: (value: any) => {
			formValidation.setFieldTouched(fieldName);
			formValidation.validateField(fieldName, value, schema);
		},
		getError: () => formValidation.getFieldError(fieldName),
		hasError: () =>
			formValidation.hasFieldError(fieldName) && formValidation.isFieldTouched(fieldName),
		isValid: () =>
			!formValidation.hasFieldError(fieldName) && formValidation.isFieldTouched(fieldName)
	};
}

// Password strength indicator component props
export interface PasswordStrengthProps {
	password: string;
	showRequirements?: boolean;
	className?: string;
}

// Form step validation for multi-step forms
export function createStepValidation<T extends Record<string, any>>(
	steps: Array<{
		name: string;
		schema: z.ZodType;
		fields: (keyof T)[];
	}>
) {
	let currentStep = 0;
	let completedSteps = new Set<number>();

	const validateStep = (stepIndex: number, data: T): { isValid: boolean; errors: string[] } => {
		const step = steps[stepIndex];
		if (!step) return { isValid: false, errors: ['Invalid step'] };

		try {
			// Extract only the fields for this step
			const stepData = Object.fromEntries(step.fields.map((field) => [field, data[field]]));

			step.schema.parse(stepData);
			completedSteps.add(stepIndex);
			return { isValid: true, errors: [] };
		} catch (error) {
			if (error instanceof z.ZodError) {
				completedSteps.delete(stepIndex);
				return {
					isValid: false,
					errors: error.issues.map((issue) => issue.message)
				};
			}
			return { isValid: false, errors: ['Validation failed'] };
		}
	};

	const canProceedToStep = (stepIndex: number): boolean => {
		if (stepIndex === 0) return true;
		return completedSteps.has(stepIndex - 1);
	};

	const goToStep = (stepIndex: number): boolean => {
		if (canProceedToStep(stepIndex)) {
			currentStep = stepIndex;
			return true;
		}
		return false;
	};

	const nextStep = (): boolean => {
		return goToStep(currentStep + 1);
	};

	const previousStep = (): boolean => {
		return goToStep(currentStep - 1);
	};

	const getStepStatus = (stepIndex: number): 'completed' | 'current' | 'locked' | 'available' => {
		if (completedSteps.has(stepIndex)) return 'completed';
		if (stepIndex === currentStep) return 'current';
		if (!canProceedToStep(stepIndex)) return 'locked';
		return 'available';
	};

	return {
		get currentStep() {
			return currentStep;
		},
		get completedSteps() {
			return Array.from(completedSteps);
		},
		get totalSteps() {
			return steps.length;
		},
		get progress() {
			return (completedSteps.size / steps.length) * 100;
		},
		validateStep,
		canProceedToStep,
		goToStep,
		nextStep,
		previousStep,
		getStepStatus,
		get isLastStep() {
			return currentStep === steps.length - 1;
		},
		get isFirstStep() {
			return currentStep === 0;
		}
	};
}

// Input validation utilities
export const inputValidationUtils = {
	// Email domain validation
	isValidEmailDomain: (email: string): boolean => {
		const domain = email.split('@')[1];
		if (!domain) return false;

		// Basic domain validation
		return /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain);
	},

	// Strong password check
	isStrongPassword: (password: string): boolean => {
		return (
			password.length >= 8 &&
			/[A-Z]/.test(password) &&
			/[a-z]/.test(password) &&
			/\d/.test(password) &&
			/[@$!%*?&]/.test(password)
		);
	},

	// File name validation
	isValidFileName: (filename: string): boolean => {
		// Avoid reserved names and invalid characters
		const invalidChars = /[<>:"/\\|?*]/;
		const reservedNames = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

		return (
			filename.length > 0 &&
			filename.length <= 255 &&
			!invalidChars.test(filename) &&
			!reservedNames.test(filename) &&
			!filename.startsWith('.') &&
			!filename.endsWith('.')
		);
	},

	// URL validation
	isValidUrl: (url: string): boolean => {
		try {
			new URL(url);
			return true;
		} catch {
			return false;
		}
	},

	// Phone number validation (basic)
	isValidPhoneNumber: (phone: string): boolean => {
		// Remove all non-digit characters
		const digits = phone.replace(/\D/g, '');
		// Check if it's between 10-15 digits (international format)
		return digits.length >= 10 && digits.length <= 15;
	}
};

// Form submission states
export const FORM_STATES = {
	IDLE: 'idle',
	VALIDATING: 'validating',
	SUBMITTING: 'submitting',
	SUCCESS: 'success',
	ERROR: 'error'
} as const;

export type FormState = (typeof FORM_STATES)[keyof typeof FORM_STATES];
