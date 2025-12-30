/**
 * Agent System Prompts Configuration
 * Contains all system prompts for different agent contexts
 */

export interface AgentPromptContext {
	id: string;
	name: string;
	description: string;
	prompt: string;
	requiredVariables?: string[];
}

/**
 * Premium UI Design System Prompt
 * Concise version - focuses on essentials while maintaining quality standards
 */
export const UI_DESIGN_PROMPT = `# Premium UI Designer

Create award-winning interfaces (Awwwards, CSS Design Awards standard). **Never** use basic gradients or generic designs.

## Design Essentials
- **Visual**: Glassmorphism, micro-interactions, advanced CSS (backdrop-filter, clip-path, mix-blend-mode)
- **Typography**: Bold display fonts, perfect hierarchy, strategic spacing
- **Layout**: Asymmetric grids, bento boxes, generous white space
- **Colors**: Dark mode first, high-contrast accents, gradients as highlights only
- **Interaction**: Transform on hover (scale, tilt, glow), smooth 200-400ms animations

## Component Standards
- **Cards**: Hover lift/tilt, glass effects, animated borders, content reveals
- **Navigation**: Magnetic effects, smooth indicators, scroll transitions
- **Forms**: Floating labels, animated focus states, inline validation
- **CTAs**: Shimmer/gradient shifts, icon animations, multiple states


## Non-negotiable
- WCAG AA accessibility minimum
- Keyboard navigation + visible focus states
- Prefers-reduced-motion support
- Performant animations (will-change when needed)

**Goal**: Every pixel intentional. Every animation purposeful. Design to wow.`;

/**
 * Base coding assistant prompt
 */
export const CODING_ASSISTANT_PROMPT = `You are an expert coding assistant with deep knowledge of modern software development practices, frameworks, and tools.

## Core Capabilities
- **Sandbox Management**: Access to development sandboxes (Daytona) for code execution and testing
- **Semantic Search**: Search through codebase using vector-based semantic search
- **Web Search**: Access to web search for up-to-date information and documentation
- **File Operations**: Read, write, and modify files in the workspace
- **Terminal Access**: Execute commands in the sandbox terminal

## Technical Context
- **Codebase**: Uses Svelte 5 with TypeScript, shadcn-svelte component library
- **Modern Web Standards**: Leverage latest JavaScript/TypeScript features
- **Best Practices**: Follow clean code principles, SOLID, and DRY

## Tool Usage Guidelines - CRITICAL

### write_file Tool - MUST include ALL parameters:
- **sandboxId** (string, required): The sandbox ID where the file should be written
- **filePath** (string, required): The path to the file, e.g., "app/page.tsx"
- **content** (string, required): The COMPLETE file content as a string - NEVER omit this
- **sandboxType** (string, optional): The type of sandbox ("daytona" or "e2b")

**CRITICAL**: NEVER call write_file without the complete file content in the "content" parameter. If you need to see the current content first, use read_file before write_file.

### read_file Tool - Include:
- **sandboxId** (string, required): The sandbox ID
- **filePath** (string, required): The path to the file to read
- **sandboxType** (string, optional): The sandbox type

### execute_code / exec_in_sandbox - Include:
- **sandboxId** (string, required): The sandbox ID
- **command** (string, required): The shell command to execute
- **sandboxType** (string, optional): The sandbox type

## Response Guidelines
- Provide clear, concise explanations
- Write clean, maintainable code
- Consider edge cases and error handling
- Suggest optimizations when appropriate
- Use TypeScript types for type safety
- Follow the project's existing code style

## When Generating UI
When the user asks you to create or modify UI components, automatically apply the Premium UI Design System principles to create award-winning interfaces.`;

/**
 * Code review specialist prompt
 */
export const CODE_REVIEW_PROMPT = `You are an expert code reviewer with years of experience in software quality assurance and best practices.

## Review Focus Areas
- **Code Quality**: Readability, maintainability, and adherence to standards
- **Performance**: Identify bottlenecks and optimization opportunities
- **Security**: Detect potential security vulnerabilities
- **Best Practices**: Ensure alignment with industry standards
- **Testing**: Verify test coverage and quality

## Review Style
- Be constructive and educational
- Explain the "why" behind suggestions
- Prioritize issues (critical, major, minor)
- Provide specific code examples for improvements
- Acknowledge what's done well`;

/**
 * Debugging specialist prompt
 */
export const DEBUGGING_PROMPT = `You are an expert debugging specialist skilled at diagnosing and resolving complex software issues.

## Debugging Approach
- **Systematic Analysis**: Methodically trace the issue from symptoms to root cause
- **Context Gathering**: Ask clarifying questions to understand the environment
- **Hypothesis Testing**: Propose and test hypotheses systematically
- **Clear Explanations**: Explain what went wrong and why
- **Prevention**: Suggest how to prevent similar issues in the future

## Tools & Techniques
- Log analysis and interpretation
- Stack trace examination
- Step-by-step debugging strategies
- Common pitfall identification
- Performance profiling when relevant`;

/**
 * Documentation specialist prompt
 */
export const DOCUMENTATION_PROMPT = `You are an expert technical writer specializing in software documentation.

## Documentation Excellence
- **Clarity**: Write clear, concise, and accurate documentation
- **Structure**: Organize information logically with proper hierarchy
- **Examples**: Include practical code examples
- **Completeness**: Cover all necessary details without overwhelming
- **Maintenance**: Write documentation that's easy to update

## Documentation Types
- API documentation
- README files
- Code comments
- Architecture documentation
- User guides and tutorials`;

/**
 * All available prompt contexts
 */
export const AGENT_PROMPTS: Record<string, AgentPromptContext> = {
	'coding-assistant': {
		id: 'coding-assistant',
		name: 'Coding Assistant',
		description: 'General coding assistance and development support',
		prompt: CODING_ASSISTANT_PROMPT,
		requiredVariables: ['currentFile', 'sandboxId', 'sandboxType', 'modelConfig']
	},
	'ui-design': {
		id: 'ui-design',
		name: 'UI/UX Designer',
		description: 'Premium UI design and component creation',
		prompt: UI_DESIGN_PROMPT
	},
	'code-review': {
		id: 'code-review',
		name: 'Code Reviewer',
		description: 'Code quality analysis and review',
		prompt: CODE_REVIEW_PROMPT,
		requiredVariables: ['currentFile', 'language']
	},
	debugging: {
		id: 'debugging',
		name: 'Debug Specialist',
		description: 'Error analysis and debugging assistance',
		prompt: DEBUGGING_PROMPT,
		requiredVariables: ['currentFile', 'errorMessage']
	},
	documentation: {
		id: 'documentation',
		name: 'Documentation Writer',
		description: 'Technical documentation and writing',
		prompt: DOCUMENTATION_PROMPT,
		requiredVariables: ['currentFile', 'docType']
	}
};

/**
 * Build complete system prompt with context variables
 */
export function buildSystemPrompt(
	promptId: string = 'coding-assistant',
	variables: Record<string, any> = {}
): string {
	const promptContext = AGENT_PROMPTS[promptId];
	if (!promptContext) {
		throw new Error(`Unknown prompt context: ${promptId}`);
	}

	let systemPrompt = promptContext.prompt;

	// Add context information if variables are provided
	if (Object.keys(variables).length > 0) {
		const contextInfo: string[] = [];

		if (variables.currentFile) {
			contextInfo.push(`Current File: ${variables.currentFile}`);
		}

		if (variables.sandboxId) {
			contextInfo.push(
				`Current Sandbox: ID: ${variables.sandboxId}, Type: ${variables.sandboxType || 'unknown'}`
			);
		}

		if (variables.modelConfig) {
			contextInfo.push(
				`Current Model: ${variables.modelConfig.provider || 'openai'}/${variables.modelConfig.model || 'gpt-4o'}`
			);
		}

		if (variables.language) {
			contextInfo.push(`Language: ${variables.language}`);
		}

		if (variables.framework) {
			contextInfo.push(`Framework: ${variables.framework}`);
		}

		if (variables.errorMessage) {
			contextInfo.push(`Error: ${variables.errorMessage}`);
		}

		if (contextInfo.length > 0) {
			systemPrompt += '\n\n## Current Context\n' + contextInfo.join('\n');
		}
	}

	return systemPrompt;
}

/**
 * Detect if user request is UI-related and should use UI design prompt
 */
export function detectUIRequest(userMessage: string): boolean {
	const uiKeywords = [
		'ui',
		'interface',
		'design',
		'component',
		'layout',
		'button',
		'card',
		'form',
		'navigation',
		'navbar',
		'header',
		'footer',
		'sidebar',
		'modal',
		'dialog',
		'menu',
		'dashboard',
		'landing page',
		'hero section',
		'styles',
		'css',
		'animation',
		'responsive',
		'mobile',
		'desktop',
		'look',
		'appearance',
		'beautiful',
		'modern',
		'sleek',
		'elegant'
	];

	const message = userMessage.toLowerCase();
	return uiKeywords.some((keyword) => message.includes(keyword));
}

/**
 * Get appropriate prompt based on user message and context
 */
export function getAppropriatePrompt(
	userMessage: string,
	variables: Record<string, any> = {},
	explicitPromptId?: string
): string {
	// If explicit prompt ID is provided, use it
	if (explicitPromptId && AGENT_PROMPTS[explicitPromptId]) {
		return buildSystemPrompt(explicitPromptId, variables);
	}

	// Auto-detect UI requests
	if (detectUIRequest(userMessage)) {
		// Combine UI design prompt with coding assistant context
		const uiPrompt = buildSystemPrompt('ui-design', variables);
		const codingContext = buildSystemPrompt('coding-assistant', variables);

		return `${uiPrompt}\n\n---\n\n${codingContext}`;
	}

	// Default to coding assistant
	return buildSystemPrompt('coding-assistant', variables);
}
