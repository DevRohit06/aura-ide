// Prompt template management utility for dynamic and context-aware prompts
import type { ContextVariables, PromptTemplate } from '../types/llm.types.js';

export interface TemplateCondition {
	variable: string;
	operator: 'equals' | 'contains' | 'exists' | 'not_exists' | 'greater_than' | 'less_than';
	value?: unknown;
}

export interface ConditionalTemplate {
	condition: TemplateCondition;
	template: string;
}

export interface DynamicPromptTemplate extends PromptTemplate {
	conditionalSections?: ConditionalTemplate[];
	defaultFallbacks?: Record<string, string>;
	requiredVariables?: string[];
	optionalVariables?: string[];
}

/**
 * Advanced prompt template manager with conditional logic and dynamic content
 */
export class PromptTemplateManager {
	private templates: Map<string, DynamicPromptTemplate> = new Map();

	/**
	 * Register a dynamic prompt template
	 */
	registerTemplate(template: DynamicPromptTemplate): void {
		this.templates.set(template.id, template);
	}

	/**
	 * Render a template with advanced features
	 */
	renderTemplate(
		templateId: string,
		variables: ContextVariables = {}
	): { content: string; warnings: string[]; errors: string[] } {
		const template = this.templates.get(templateId);
		if (!template) {
			return {
				content: '',
				warnings: [],
				errors: [`Template '${templateId}' not found`]
			};
		}

		const warnings: string[] = [];
		const errors: string[] = [];

		// Validate required variables
		if (template.requiredVariables) {
			for (const required of template.requiredVariables) {
				if (
					!variables.hasOwnProperty(required) ||
					variables[required] === undefined ||
					variables[required] === null
				) {
					errors.push(`Required variable '${required}' is missing`);
				}
			}
		}

		// Apply default fallbacks
		const enrichedVariables = { ...variables };
		if (template.defaultFallbacks) {
			for (const [key, defaultValue] of Object.entries(template.defaultFallbacks)) {
				if (
					!enrichedVariables.hasOwnProperty(key) ||
					enrichedVariables[key] === undefined ||
					enrichedVariables[key] === null
				) {
					enrichedVariables[key] = defaultValue;
					warnings.push(`Using default value for variable '${key}': ${defaultValue}`);
				}
			}
		}

		// Start with base template content
		let content = template.content;

		// Process conditional sections
		if (template.conditionalSections) {
			for (const conditional of template.conditionalSections) {
				if (this.evaluateCondition(conditional.condition, enrichedVariables)) {
					content += '\n' + conditional.template;
				}
			}
		}

		// Replace variables
		content = this.replaceVariables(content, enrichedVariables);

		return { content, warnings, errors };
	}

	/**
	 * Evaluate a template condition
	 */
	private evaluateCondition(condition: TemplateCondition, variables: ContextVariables): boolean {
		const variableValue = variables[condition.variable];

		switch (condition.operator) {
			case 'exists':
				return variableValue !== undefined && variableValue !== null && variableValue !== '';

			case 'not_exists':
				return variableValue === undefined || variableValue === null || variableValue === '';

			case 'equals':
				return variableValue === condition.value;

			case 'contains':
				if (typeof variableValue === 'string' && typeof condition.value === 'string') {
					return variableValue.includes(condition.value);
				}
				return false;

			case 'greater_than':
				if (typeof variableValue === 'number' && typeof condition.value === 'number') {
					return variableValue > condition.value;
				}
				return false;

			case 'less_than':
				if (typeof variableValue === 'number' && typeof condition.value === 'number') {
					return variableValue < condition.value;
				}
				return false;

			default:
				return false;
		}
	}

	/**
	 * Replace template variables with enhanced logic
	 */
	private replaceVariables(content: string, variables: ContextVariables): string {
		let result = content;

		// Replace simple variables {{variable}}
		result = result.replace(/{{(\w+)}}/g, (match, variableName) => {
			const value = variables[variableName];
			return this.formatValue(value);
		});

		// Replace variables with formatters {{variable|formatter}}
		result = result.replace(/{{(\w+)\|(\w+)}}/g, (match, variableName, formatter) => {
			const value = variables[variableName];
			return this.applyFormatter(value, formatter);
		});

		// Replace conditional variables {{variable?value:default}}
		result = result.replace(
			/{{(\w+)\?([^:]+):([^}]+)}}/g,
			(match, variableName, trueValue, falseValue) => {
				const value = variables[variableName];
				const hasValue = value !== undefined && value !== null && value !== '';
				return hasValue ? trueValue : falseValue;
			}
		);

		return result;
	}

	/**
	 * Format a value for template output
	 */
	private formatValue(value: unknown): string {
		if (value === null || value === undefined) {
			return '';
		}
		if (typeof value === 'string') {
			return value;
		}
		if (typeof value === 'number' || typeof value === 'boolean') {
			return String(value);
		}
		if (Array.isArray(value)) {
			return value.join(', ');
		}
		if (typeof value === 'object') {
			// Format objects nicely for templates
			if ('line' in value && 'column' in value) {
				return `line ${value.line}, column ${value.column}`;
			}
			return JSON.stringify(value, null, 2);
		}
		return String(value);
	}

	/**
	 * Apply formatters to values
	 */
	private applyFormatter(value: unknown, formatter: string): string {
		const stringValue = this.formatValue(value);

		switch (formatter) {
			case 'upper':
				return stringValue.toUpperCase();
			case 'lower':
				return stringValue.toLowerCase();
			case 'title':
				return stringValue.replace(
					/\w\S*/g,
					(txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
				);
			case 'truncate':
				return stringValue.length > 100 ? stringValue.substring(0, 100) + '...' : stringValue;
			case 'code':
				return `\`${stringValue}\``;
			case 'quote':
				return `"${stringValue}"`;
			default:
				return stringValue;
		}
	}

	/**
	 * Get all registered templates
	 */
	getAllTemplates(): DynamicPromptTemplate[] {
		return Array.from(this.templates.values());
	}

	/**
	 * Get template by ID
	 */
	getTemplate(id: string): DynamicPromptTemplate | undefined {
		return this.templates.get(id);
	}

	/**
	 * Remove a template
	 */
	removeTemplate(id: string): boolean {
		return this.templates.delete(id);
	}

	/**
	 * Create a context-aware code assistant template
	 */
	static createCodeAssistantTemplate(): DynamicPromptTemplate {
		return {
			id: 'advanced-code-assistant',
			name: 'Advanced Code Assistant',
			content: `You are an expert AI programming assistant in Aura IDE.

## Current Context
- Project: {{projectName|quote}}
- File: {{fileName|quote}}
- Language: {{language|upper}}{{framework? ({{framework}})}}

{{selectedCode?
## Selected Code
\`\`\`{{language}}
{{selectedCode}}
\`\`\`
}}

## Your Capabilities
- Code completion and generation
- Bug detection and fixes
- Refactoring suggestions
- Performance optimization
- Security analysis`,
			variables: ['projectName', 'fileName', 'language', 'framework', 'selectedCode'],
			conditionalSections: [
				{
					condition: { variable: 'language', operator: 'equals', value: 'typescript' },
					template: '- TypeScript-specific type analysis and suggestions'
				},
				{
					condition: { variable: 'language', operator: 'equals', value: 'python' },
					template: '- Python-specific code style and best practices (PEP 8)'
				},
				{
					condition: { variable: 'errorMessage', operator: 'exists' },
					template: `
## Current Error
{{errorMessage}}

Focus on helping resolve this specific issue.`
				}
			],
			defaultFallbacks: {
				projectName: 'Current Project',
				language: 'code',
				fileName: 'current file'
			},
			requiredVariables: [],
			optionalVariables: [
				'projectName',
				'fileName',
				'language',
				'framework',
				'selectedCode',
				'errorMessage'
			],
			category: 'coding',
			tags: ['assistant', 'code', 'dynamic'],
			isSystem: true
		};
	}

	/**
	 * Create a debugging template with progressive assistance
	 */
	static createDebuggingTemplate(): DynamicPromptTemplate {
		return {
			id: 'progressive-debugging',
			name: 'Progressive Debugging Assistant',
			content: `You are a debugging expert in Aura IDE. Help identify and resolve the issue systematically.

## Error Context
- Error: {{errorMessage|quote}}
- File: {{fileName|quote}}{{language? ({{language}})}}
{{stackTrace?
- Stack trace available: Yes
}}

## Debugging Approach
1. **Analyze** the error message and context
2. **Investigate** potential root causes
3. **Suggest** specific debugging steps
4. **Provide** targeted solutions`,
			variables: ['errorMessage', 'fileName', 'language', 'stackTrace'],
			conditionalSections: [
				{
					condition: { variable: 'stackTrace', operator: 'exists' },
					template: `
## Stack Trace Analysis
\`\`\`
{{stackTrace|truncate}}
\`\`\`

I'll analyze this stack trace to pinpoint the issue.`
				},
				{
					condition: { variable: 'language', operator: 'equals', value: 'javascript' },
					template: `
## JavaScript-Specific Debugging
- Check for undefined variables and null references
- Verify asynchronous code handling (Promises, async/await)
- Inspect browser console for additional errors`
				}
			],
			defaultFallbacks: {
				fileName: 'source file'
			},
			requiredVariables: ['errorMessage'],
			optionalVariables: ['fileName', 'language', 'stackTrace'],
			category: 'debugging',
			tags: ['debug', 'error', 'analysis'],
			isSystem: true
		};
	}
}

// Create a singleton instance
export const promptTemplateManager = new PromptTemplateManager();

// Register default templates
promptTemplateManager.registerTemplate(PromptTemplateManager.createCodeAssistantTemplate());
promptTemplateManager.registerTemplate(PromptTemplateManager.createDebuggingTemplate());
