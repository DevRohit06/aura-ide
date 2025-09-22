# Enhanced LLM Service with System Prompts

This document describes the enhanced LLM service in Aura IDE that now supports system prompts for context-aware AI assistance.

## Overview

The enhanced LLM service provides:

- **System Prompt Management**: Pre-defined prompts for different contexts
- **Dynamic Variable Substitution**: Context-aware prompt generation
- **Template Engine**: Advanced prompt templating with conditional logic
- **Multiple AI Providers**: Support for OpenAI and Anthropic with Helicone proxy
- **Streaming Support**: Real-time response generation

## Quick Start

```typescript
import { LLMService, createCodeAssistantService } from '@/services/llm.enhanced';

// Create a service configured for code assistance
const llmService = await createCodeAssistantService();

// Create a request with system prompt
const request = llmService.createCodeAssistantRequest(
	'Help me implement a user authentication function',
	{
		projectName: 'My Project',
		fileName: 'auth.ts',
		language: 'typescript'
	}
);

// Get response
const response = await llmService.invoke(request);
console.log(response.content);
```

## System Prompt Contexts

The service includes pre-defined system prompts for different contexts:

### 1. Code Assistant (`code-assistant`)

- **Purpose**: General coding assistance and code completion
- **Variables**: `projectName`, `language`, `fileName`, `selectedCode`
- **Use Cases**: Code generation, refactoring, optimization

### 2. Code Review (`code-review`)

- **Purpose**: Code quality analysis and review
- **Variables**: `projectName`, `language`, `fileName`, `branchName`
- **Use Cases**: Pull request reviews, code quality checks

### 3. Documentation (`documentation`)

- **Purpose**: Documentation generation and improvement
- **Variables**: `projectName`, `language`, `docType`, `audience`
- **Use Cases**: API docs, README files, code comments

### 4. Debugging (`debugging`)

- **Purpose**: Error analysis and debugging assistance
- **Variables**: `projectName`, `language`, `errorMessage`, `fileName`, `environment`
- **Use Cases**: Error resolution, troubleshooting

### 5. General Chat (`general-chat`)

- **Purpose**: General purpose assistance
- **Variables**: `userName`, `projectName`
- **Use Cases**: General questions, IDE help

## Usage Examples

### Basic Code Assistance

```typescript
import { LLMService } from '@/services/llm.enhanced';

const llmService = new LLMService({
	enableSystemPrompts: true,
	defaultSystemPromptContext: 'code-assistant'
});

const request = llmService.createCodeAssistantRequest(
	'How do I implement error handling in this function?',
	{
		projectName: 'Aura IDE',
		fileName: 'auth.service.ts',
		language: 'typescript',
		selectedCode: `
      export async function authenticateUser(token: string) {
        const user = await validateToken(token);
        return user;
      }
    `
	}
);

const response = await llmService.invoke(request);
```

### Debugging Assistance

```typescript
const debugRequest = llmService.createDebuggingRequest(
	"Getting 'Cannot read property id of undefined' error",
	{
		fileName: 'user.service.ts',
		language: 'typescript',
		errorMessage: "TypeError: Cannot read property 'id' of undefined",
		stackTrace: 'at getUserById (user.service.ts:45:12)'
	}
);

const debugResponse = await llmService.invoke(debugRequest);
```

### Streaming Response

```typescript
const request = llmService.createCodeAssistantRequest('Explain TypeScript generics with examples');

for await (const chunk of llmService.stream(request)) {
	if (chunk.done) break;
	process.stdout.write(chunk.content);
}
```

### Custom System Prompt

```typescript
const customRequest: LLMRequest = {
	messages: [
		{
			role: 'user',
			content: 'Review this API endpoint design',
			timestamp: new Date()
		}
	],
	systemPrompt: {
		promptId: 'code-review', // Use specific prompt ID
		variables: {
			projectName: 'My API',
			language: 'typescript',
			fileName: 'api.routes.ts'
		},
		override: true // Override any existing system message
	},
	model: 'gpt-4',
	temperature: 0.1
};

const response = await llmService.invoke(customRequest);
```

## Advanced Features

### System Prompt Configuration

```typescript
import { systemPromptConfig } from '@/services/llm.enhanced';

// Get available prompts
const prompts = systemPromptConfig.getAllPrompts();

// Get prompt by context
const codePrompt = systemPromptConfig.getPromptByContext('code-assistant');

// Render prompt with variables
const rendered = systemPromptConfig.renderPrompt('code-assistant', {
	projectName: 'My Project',
	language: 'TypeScript'
});

// Validate required variables
const validation = systemPromptConfig.validateVariables('code-assistant', {
	projectName: 'Test'
	// Missing other variables
});
```

### Custom Prompt Registration

```typescript
import { systemPromptConfig } from '@/services/llm.enhanced';

// Register a custom system prompt
systemPromptConfig.registerPrompt({
	id: 'custom-prompt',
	name: 'Custom Assistant',
	content: 'You are a {{role}} expert helping with {{taskType}}.',
	variables: ['role', 'taskType'],
	context: 'general-chat'
});
```

### Advanced Template Engine

```typescript
import { promptTemplateManager } from '@/services/llm.enhanced';

// Create dynamic template with conditional logic
const template = {
	id: 'advanced-assistant',
	name: 'Advanced Assistant',
	content: `You are an expert in {{language|upper}}.
  
{{framework?
## Framework Context
Using {{framework}} framework.
}}

Provide {{complexity?advanced:basic}} guidance.`,
	variables: ['language', 'framework', 'complexity'],
	conditionalSections: [
		{
			condition: { variable: 'language', operator: 'equals', value: 'javascript' },
			template: 'Focus on modern ES6+ features and best practices.'
		}
	],
	defaultFallbacks: {
		language: 'JavaScript',
		complexity: 'basic'
	}
};

promptTemplateManager.registerTemplate(template);

// Render with advanced features
const result = promptTemplateManager.renderTemplate('advanced-assistant', {
	language: 'typescript',
	framework: 'svelte',
	complexity: 'advanced'
});
```

## Configuration

### LLM Service Configuration

```typescript
const config = {
	defaultModel: 'gpt-4',
	defaultTemperature: 0.1,
	maxTokens: 4096,
	enableSystemPrompts: true,
	defaultSystemPromptContext: 'code-assistant',
	retryConfig: {
		maxRetries: 3,
		backoffMultiplier: 2,
		initialDelay: 1000
	}
};

const llmService = new LLMService(config);
```

### Environment Variables

Ensure these environment variables are set:

```bash
# Required
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
HELICONE_API_KEY=your-helicone-key

# Optional Helicone configuration
HELICONE_BASE_URL=https://oai.helicone.ai
HELICONE_CACHE_ENABLED=true
```

## Integration with Aura IDE

### Editor Integration

```typescript
// In your editor component
import { createQuickCodeRequest } from '@/services/llm.enhanced';

async function handleCodeAssistance(userQuery: string) {
	const editorContext = {
		projectName: currentProject.name,
		fileName: activeFile.name,
		language: detectLanguage(activeFile.extension),
		selectedCode: editor.getSelectedText()
	};

	const request = await createQuickCodeRequest(userQuery, editorContext);
	const response = await llmService.invoke(request);

	// Display response in IDE
	showAssistantResponse(response.content);
}
```

### Error Handling Integration

```typescript
// In your error handling system
import { createQuickDebugRequest } from '@/services/llm.enhanced';

async function handleError(error: Error, context: any) {
	const debugRequest = await createQuickDebugRequest(error.message, {
		fileName: context.fileName,
		language: context.language,
		stackTrace: error.stack
	});

	const assistance = await llmService.invoke(debugRequest);

	// Show debugging suggestions
	showDebugSuggestions(assistance.content);
}
```

## Performance Considerations

1. **Caching**: Responses are cached through Helicone for repeated queries
2. **Streaming**: Use streaming for long responses to improve perceived performance
3. **Context Size**: Be mindful of context variables to avoid token limits
4. **Model Selection**: Choose appropriate models based on use case complexity

## Best Practices

1. **Context Variables**: Provide as much relevant context as possible
2. **Temperature Settings**: Use lower temperatures (0.1-0.3) for code, higher (0.6-0.9) for creative tasks
3. **Error Handling**: Always wrap LLM calls in try-catch blocks
4. **Variable Validation**: Validate required variables before making requests
5. **Prompt Evolution**: Regularly review and improve system prompts based on usage

## Troubleshooting

### Common Issues

1. **Missing Environment Variables**: Ensure all required API keys are set
2. **Variable Validation Errors**: Check that all required variables are provided
3. **Token Limits**: Reduce context size if hitting token limits
4. **Rate Limits**: Implement proper retry logic for rate-limited requests

### Debug Mode

Enable debug logging to see detailed information:

```typescript
const llmService = new LLMService({
	// ... other config
	debugMode: true
});
```

## Future Enhancements

- [ ] Prompt versioning and A/B testing
- [ ] User-specific prompt customization
- [ ] Integration with project-specific knowledge bases
- [ ] Automated prompt optimization based on feedback
- [ ] Multi-language system prompt support
