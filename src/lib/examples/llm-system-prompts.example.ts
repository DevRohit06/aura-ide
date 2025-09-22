// Example usage of the enhanced LLM service with system prompts
import {
	LLMService,
	promptTemplateManager,
	systemPromptConfig,
	type ContextVariables,
	type LLMRequest
} from '../services/llm.enhanced.js';

/**
 * Example: Using the LLM service for code assistance with system prompts
 */
export async function exampleCodeAssistance() {
	// Create an LLM service instance
	const llmService = new LLMService({
		enableSystemPrompts: true,
		defaultSystemPromptContext: 'code-assistant',
		defaultModel: 'gpt-4',
		defaultTemperature: 0.1
	});

	// Define context variables for the current coding session
	const contextVariables: ContextVariables = {
		projectName: 'Aura IDE',
		fileName: 'user-service.ts',
		language: 'typescript',
		framework: 'SvelteKit',
		selectedCode: `
export interface User {
	id: string;
	email: string;
	username: string;
}

export class UserService {
	private users: User[] = [];
	
	// TODO: Implement user creation method
}`,
		userId: 'user123',
		environment: 'development'
	};

	// Method 1: Use the convenience method
	const codeRequest = llmService.createCodeAssistantRequest(
		'Please help me implement the user creation method. It should validate the email and ensure the username is unique.',
		contextVariables
	);

	console.log('=== Code Assistant Request ===');
	console.log(JSON.stringify(codeRequest, null, 2));

	// Method 2: Create a custom request with specific system prompt
	const customRequest: LLMRequest = {
		messages: [
			{
				role: 'user',
				content: 'Can you review this TypeScript interface and suggest improvements?',
				timestamp: new Date()
			}
		],
		systemPrompt: {
			context: 'code-review',
			variables: contextVariables
		},
		model: 'gpt-4',
		temperature: 0.1
	};

	// Execute the request
	try {
		const response = await llmService.invoke(codeRequest);
		console.log('=== LLM Response ===');
		console.log('Content:', response.content);
		console.log('Metadata:', response.metadata);
		console.log('Usage:', response.usage);
	} catch (error) {
		console.error('Error invoking LLM:', error);
	}
}

/**
 * Example: Using streaming for real-time responses
 */
export async function exampleStreamingResponse() {
	const llmService = new LLMService();

	const request: LLMRequest = {
		messages: [
			{
				role: 'user',
				content: 'Explain how TypeScript generics work with detailed examples.',
				timestamp: new Date()
			}
		],
		systemPrompt: {
			context: 'documentation',
			variables: {
				projectName: 'Aura IDE',
				docType: 'guide',
				audience: 'developer',
				language: 'typescript'
			}
		}
	};

	console.log('=== Streaming Response ===');
	try {
		for await (const chunk of llmService.stream(request)) {
			if (chunk.done) {
				console.log('\n=== Stream Complete ===');
				break;
			}
			process.stdout.write(chunk.content);
		}
	} catch (error) {
		console.error('Error in streaming:', error);
	}
}

/**
 * Example: Debugging assistance with error context
 */
export async function exampleDebuggingAssistance() {
	const llmService = new LLMService();

	const errorContext: ContextVariables = {
		projectName: 'Aura IDE',
		fileName: 'auth.service.ts',
		language: 'typescript',
		environment: 'development',
		errorMessage: "TypeError: Cannot read property 'id' of undefined",
		stackTrace: `
at UserService.getUserById (auth.service.ts:45:12)
at AuthMiddleware.validateUser (auth.middleware.ts:23:8)
at Router.authenticate (router.ts:156:5)
		`
	};

	const debugRequest = llmService.createDebuggingRequest(
		"I'm getting a TypeError when trying to access user.id. The error happens in the getUserById method.",
		errorContext
	);

	try {
		const response = await llmService.invoke(debugRequest);
		console.log('=== Debugging Assistance ===');
		console.log(response.content);
	} catch (error) {
		console.error('Error getting debugging help:', error);
	}
}

/**
 * Example: Working with system prompt templates directly
 */
export async function exampleSystemPromptManagement() {
	console.log('=== Available System Prompts ===');

	// List all available system prompts
	const prompts = systemPromptConfig.getAllPrompts();
	prompts.forEach((prompt) => {
		console.log(`- ${prompt.name} (${prompt.id}): ${prompt.context}`);
	});

	// Get a specific prompt and render it with variables
	const codeAssistantPrompt = systemPromptConfig.getPromptByContext('code-assistant');
	if (codeAssistantPrompt) {
		const renderedPrompt = systemPromptConfig.renderPrompt(codeAssistantPrompt.id, {
			projectName: 'My Awesome Project',
			language: 'TypeScript',
			fileName: 'main.ts'
		});

		console.log('=== Rendered System Prompt ===');
		console.log(renderedPrompt);
	}

	// Validate variables for a prompt
	const validation = systemPromptConfig.validateVariables('code-assistant', {
		projectName: 'Test Project'
		// Missing other variables
	});

	console.log('=== Validation Result ===');
	console.log('Is valid:', validation.isValid);
	console.log('Missing variables:', validation.missingVariables);
}

/**
 * Example: Using advanced prompt templates
 */
export async function exampleAdvancedTemplates() {
	// Register a custom template
	const customTemplate = {
		id: 'custom-api-helper',
		name: 'API Development Helper',
		content: `You are an API development expert for {{projectName}}.

## Current Context
- Endpoint: {{endpoint|code}}
- HTTP Method: {{method|upper}}
- Language: {{language|title}}

{{requestBody?
## Request Body
\`\`\`json
{{requestBody}}
\`\`\`
}}

Provide expert guidance on API design, security, and best practices.`,
		variables: ['projectName', 'endpoint', 'method', 'language'],
		conditionalSections: [
			{
				condition: { variable: 'method', operator: 'equals' as const, value: 'POST' },
				template: 'Remember to validate input data and handle potential security vulnerabilities.'
			}
		],
		defaultFallbacks: {
			method: 'GET',
			language: 'JavaScript'
		},
		requiredVariables: ['projectName', 'endpoint'],
		optionalVariables: ['method', 'language', 'requestBody'],
		category: 'api',
		tags: ['api', 'backend', 'security'],
		isSystem: true
	};

	promptTemplateManager.registerTemplate(customTemplate);

	// Render the template with variables
	const result = promptTemplateManager.renderTemplate('custom-api-helper', {
		projectName: 'Aura IDE API',
		endpoint: '/api/users',
		method: 'POST',
		language: 'typescript',
		requestBody: JSON.stringify({ username: 'string', email: 'string' }, null, 2)
	});

	console.log('=== Advanced Template Result ===');
	console.log('Content:', result.content);
	console.log('Warnings:', result.warnings);
	console.log('Errors:', result.errors);
}

/**
 * Run all examples
 */
async function runExamples() {
	console.log('🚀 Running Enhanced LLM Service Examples\n');

	await exampleSystemPromptManagement();
	console.log('\n' + '='.repeat(50) + '\n');

	await exampleAdvancedTemplates();
	console.log('\n' + '='.repeat(50) + '\n');

	// Note: These examples require actual API keys to run
	// await exampleCodeAssistance();
	// await exampleStreamingResponse();
	// await exampleDebuggingAssistance();

	console.log('✅ Examples completed!');
}

// Export for use in other parts of the application
export { runExamples };
