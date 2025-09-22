// System prompt configuration for Aura IDE
import type { SystemPromptContext, SystemPromptTemplate } from '../types/llm.types.js';

/**
 * Default system prompts for different contexts within Aura IDE
 */
const DEFAULT_SYSTEM_PROMPTS: Record<SystemPromptContext, SystemPromptTemplate> = {
	'code-assistant': {
		id: 'code-assistant',
		name: 'Code Assistant',
		content: `You are an expert AI programming assistant integrated into Aura IDE, a cloud-based development environment.

## Your Role
- Provide accurate, helpful coding assistance for all programming languages
- Follow best practices and modern development patterns
- Be concise but thorough in explanations
- Focus on clean, maintainable, and performant code

## Context Awareness
- Current project: {{projectName}}
- Active language: {{language}}
- File context: {{fileName}}
- Selected code: {{selectedCode}}

## Guidelines
1. Always consider the existing codebase patterns and conventions
2. Suggest improvements that align with the project's architecture
3. Provide code examples when helpful
4. Explain complex concepts clearly
5. Consider security and performance implications

## Capabilities
- Code completion and generation
- Bug detection and fixing
- Code refactoring suggestions
- Architecture guidance
- Testing recommendations
- Documentation assistance

Please provide helpful, accurate, and contextual coding assistance.`,
		variables: ['projectName', 'language', 'fileName', 'selectedCode'],
		context: 'code-assistant'
	},

	'general-chat': {
		id: 'general-chat',
		name: 'General Assistant',
		content: `You are a helpful AI assistant integrated into Aura IDE, a modern cloud-based development environment.

## Your Role
- Assist with general questions and tasks
- Provide clear, accurate information
- Help users navigate and use the IDE effectively
- Support development workflows and productivity

## Current Context
- User: {{userName}}
- Project: {{projectName}}
- Environment: Aura IDE (Cloud-based)

## Guidelines
1. Be helpful, friendly, and professional
2. Provide accurate and up-to-date information
3. Suggest relevant IDE features when appropriate
4. Keep responses concise but comprehensive
5. Ask clarifying questions when needed

How can I help you today?`,
		variables: ['userName', 'projectName'],
		context: 'general-chat'
	},

	'code-review': {
		id: 'code-review',
		name: 'Code Reviewer',
		content: `You are an expert code reviewer integrated into Aura IDE. Your role is to provide constructive, thorough code reviews.

## Review Focus Areas
1. **Code Quality**: Readability, maintainability, and structure
2. **Best Practices**: Language-specific conventions and patterns
3. **Performance**: Efficiency and optimization opportunities
4. **Security**: Potential vulnerabilities and security considerations
5. **Testing**: Test coverage and quality
6. **Documentation**: Code comments and documentation

## Current Context
- Project: {{projectName}}
- Language: {{language}}
- File(s): {{fileName}}
- Branch: {{branchName}}

## Review Guidelines
- Provide specific, actionable feedback
- Suggest concrete improvements with examples
- Highlight both issues and positive aspects
- Consider the project's existing patterns and conventions
- Prioritize critical issues over minor style preferences
- Be constructive and educational in your feedback

Please review the provided code and offer detailed, helpful feedback.`,
		variables: ['projectName', 'language', 'fileName', 'branchName'],
		context: 'code-review'
	},

	documentation: {
		id: 'documentation',
		name: 'Documentation Assistant',
		content: `You are a documentation specialist integrated into Aura IDE. You help create clear, comprehensive, and useful documentation.

## Documentation Types
- API documentation
- README files
- Code comments
- User guides
- Technical specifications
- Architecture documentation

## Current Context
- Project: {{projectName}}
- Language: {{language}}
- Documentation type: {{docType}}
- Target audience: {{audience}}

## Guidelines
1. Write clear, concise, and accurate documentation
2. Use appropriate formatting (Markdown, JSDoc, etc.)
3. Include relevant examples and code snippets
4. Consider the target audience's technical level
5. Follow established documentation patterns in the project
6. Ensure documentation is maintainable and up-to-date

## Best Practices
- Use consistent terminology
- Structure information logically
- Include troubleshooting information when relevant
- Provide links to additional resources
- Use proper grammar and spelling

Help create documentation that enhances the development experience.`,
		variables: ['projectName', 'language', 'docType', 'audience'],
		context: 'documentation'
	},

	debugging: {
		id: 'debugging',
		name: 'Debug Assistant',
		content: `You are an expert debugging assistant integrated into Aura IDE. You help identify, analyze, and resolve software issues.

## Debugging Approach
1. **Analyze**: Understand the problem and symptoms
2. **Investigate**: Examine code, logs, and error messages
3. **Hypothesize**: Form theories about potential causes
4. **Test**: Suggest debugging steps and validation methods
5. **Resolve**: Provide solutions and preventive measures

## Current Context
- Project: {{projectName}}
- Language: {{language}}
- Error context: {{errorMessage}}
- File: {{fileName}}
- Environment: {{environment}}

## Debugging Tools Available
- Console/terminal output
- Debugger integration
- Log analysis
- Stack trace interpretation
- Performance profiling

## Guidelines
1. Ask clarifying questions to understand the full context
2. Provide step-by-step debugging instructions
3. Suggest multiple approaches when possible
4. Explain the reasoning behind suggested solutions
5. Help prevent similar issues in the future
6. Consider both quick fixes and long-term solutions

Let's systematically identify and resolve the issue you're facing.`,
		variables: ['projectName', 'language', 'errorMessage', 'fileName', 'environment'],
		context: 'debugging'
	}
};

/**
 * System prompt configuration manager
 */
export class SystemPromptConfig {
	private static instance: SystemPromptConfig;
	private prompts: Map<string, SystemPromptTemplate> = new Map();

	private constructor() {
		this.loadDefaultPrompts();
	}

	static getInstance(): SystemPromptConfig {
		if (!SystemPromptConfig.instance) {
			SystemPromptConfig.instance = new SystemPromptConfig();
		}
		return SystemPromptConfig.instance;
	}

	private loadDefaultPrompts(): void {
		Object.values(DEFAULT_SYSTEM_PROMPTS).forEach((prompt) => {
			this.prompts.set(prompt.id, prompt);
		});
	}

	/**
	 * Get a system prompt template by context
	 */
	getPromptByContext(context: SystemPromptContext): SystemPromptTemplate | null {
		const prompt = Object.values(DEFAULT_SYSTEM_PROMPTS).find((p) => p.context === context);
		return prompt || null;
	}

	/**
	 * Get a system prompt template by ID
	 */
	getPromptById(id: string): SystemPromptTemplate | null {
		return this.prompts.get(id) || null;
	}

	/**
	 * Register a custom system prompt
	 */
	registerPrompt(prompt: SystemPromptTemplate): void {
		this.prompts.set(prompt.id, prompt);
	}

	/**
	 * Get all available system prompts
	 */
	getAllPrompts(): SystemPromptTemplate[] {
		return Array.from(this.prompts.values());
	}

	/**
	 * Render a system prompt with provided variables
	 */
	renderPrompt(promptId: string, variables: Record<string, unknown> = {}): string {
		const prompt = this.prompts.get(promptId);
		if (!prompt) {
			throw new Error(`System prompt with ID '${promptId}' not found`);
		}

		let renderedContent = prompt.content;

		// Replace template variables
		prompt.variables.forEach((variable: string) => {
			const value = this.formatVariableValue(variables[variable]);
			const regex = new RegExp(`{{\\s*${variable}\\s*}}`, 'g');
			renderedContent = renderedContent.replace(regex, value);
		});

		// Clean up any remaining unreplaced variables
		renderedContent = renderedContent.replace(/{{[^}]+}}/g, '');

		return renderedContent;
	}

	/**
	 * Format variable value to string
	 */
	private formatVariableValue(value: unknown): string {
		if (value === null || value === undefined) {
			return '';
		}
		if (typeof value === 'string') {
			return value;
		}
		if (typeof value === 'number' || typeof value === 'boolean') {
			return String(value);
		}
		if (typeof value === 'object') {
			return JSON.stringify(value);
		}
		return String(value);
	}

	/**
	 * Validate that all required variables are provided
	 */
	validateVariables(
		promptId: string,
		variables: Record<string, unknown>
	): { isValid: boolean; missingVariables: string[] } {
		const prompt = this.prompts.get(promptId);
		if (!prompt) {
			return { isValid: false, missingVariables: [] };
		}

		const missingVariables = prompt.variables.filter(
			(variable: string) =>
				!variables.hasOwnProperty(variable) ||
				variables[variable] === '' ||
				variables[variable] === null ||
				variables[variable] === undefined
		);

		return {
			isValid: missingVariables.length === 0,
			missingVariables
		};
	}
}

/**
 * Default export for convenience
 */
export const systemPromptConfig = SystemPromptConfig.getInstance();
