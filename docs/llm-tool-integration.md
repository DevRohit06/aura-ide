# LLM Tool Integration

## Overview

The LLM Tool Integration provides a comprehensive system for connecting AI language models with file editing capabilities. This allows AI assistants to read, create, edit, and manage files in your project through natural language conversations.

## Architecture

### Core Components

1. **LLMToolAgentService** (`src/lib/services/llm-tool-agent.service.ts`)
   - Orchestrates LLM conversations with tool calling
   - Handles multiple tool iterations
   - Manages conversation state and tool execution

2. **Tool Manager** (`src/lib/services/tool-manager.service.ts`)
   - Provides file operation tools (read, write, delete, list)
   - Manages tool definitions and execution
   - Handles R2 storage integration

3. **Chat Tool Integration** (`src/lib/services/chat-tool-integration.service.ts`)
   - Formats tools for OpenAI/Anthropic APIs
   - Executes tool calls from AI responses
   - Provides system prompts for tool usage

4. **API Endpoint** (`src/routes/api/llm/tool-agent/+server.ts`)
   - RESTful API for LLM tool conversations
   - Authentication and context management
   - Error handling and response formatting

5. **UI Components**
   - `LlmToolChat.svelte` - Interactive chat interface
   - `ToolCallDisplay.svelte` - Real-time tool execution display
   - Reactive state management with Svelte 5

### Tool System

The integration provides these file operation tools:

- **read_file** - Read file contents from R2 storage
- **write_file** - Create or update files in R2 storage
- **delete_file** - Remove files from R2 storage
- **list_files** - List files in a directory

Each tool supports:

- Validation of parameters
- Error handling and recovery
- Progress tracking in the UI
- Detailed execution results

## Usage

### Basic Chat with Tools

```typescript
import { llmToolAgent } from '$lib/services/llm-tool-agent.service.js';

// Simple chat with tool calling
const response = await llmToolAgent.chat(
	'Please read the package.json file and create a README.md with the project description',
	{
		userId: 'user123',
		projectId: 'my-project'
	}
);

console.log(response.content); // AI's response
console.log(response.toolCalls); // Tools that were executed
```

### Advanced Configuration

```typescript
import { LLMToolAgentService } from '$lib/services/llm-tool-agent.service.js';

const agent = new LLMToolAgentService({
	model: 'gpt-4',
	provider: 'openai',
	temperature: 0.1,
	maxTokens: 4096,
	maxToolIterations: 3,
	systemPrompt: `You are a senior software engineer helping with code review and optimization.`
});

const response = await agent.processMessage(
	[{ role: 'user', content: 'Review the main.ts file and suggest improvements' }],
	{
		userId: 'user123',
		projectId: 'my-project',
		sandboxId: 'sandbox456'
	}
);
```

### API Integration

```javascript
// POST to /api/llm/tool-agent
const response = await fetch('/api/llm/tool-agent', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({
		messages: [{ role: 'user', content: 'Create a new component for the login form' }],
		model: 'gpt-4',
		provider: 'openai',
		temperature: 0.1,
		systemPrompt: 'You are a React/TypeScript expert.',
		projectId: 'my-project'
	})
});

const data = await response.json();
```

## Configuration

### Environment Variables

```bash
# Required for LLM providers
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
HELICONE_API_KEY=your-helicone-key

# File storage (R2)
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret
R2_BUCKET_NAME=your-bucket-name
```

### Model Support

Supported LLM providers and models:

- **OpenAI**: gpt-4, gpt-4-turbo, gpt-3.5-turbo
- **Anthropic**: claude-3-sonnet, claude-3-haiku, claude-3-opus
- **Groq**: llama-3.1-70b, llama-3.1-8b, mixtral-8x7b
- **OpenRouter**: Various models through OpenRouter proxy

All models support:

- Function calling/tool use
- Streaming responses
- Context management
- Token usage tracking

## Features

### Tool Execution Flow

1. **User Message** - User sends natural language request
2. **LLM Processing** - AI analyzes request and determines needed tools
3. **Tool Calls** - AI generates structured tool calls with parameters
4. **Execution** - Tools are executed with real-time progress tracking
5. **Results** - Tool results are fed back to the AI for next steps
6. **Response** - AI provides final response based on tool outcomes

### Real-time UI

- **Live Progress** - See tool execution in real-time
- **Status Indicators** - Visual feedback for pending/success/error states
- **Expandable Details** - Click to see full tool parameters and results
- **History Tracking** - Keep track of all tool calls in a session

### Error Handling

- **Graceful Degradation** - If a tool fails, the AI can try alternatives
- **Retry Logic** - Automatic retries for transient failures
- **User Feedback** - Clear error messages for troubleshooting
- **Fallback Responses** - AI continues conversation even if tools fail

### Context Management

- **Project Context** - Tools operate within specific project boundaries
- **User Permissions** - Respect user access controls and authentication
- **Session State** - Maintain conversation context across tool executions
- **File Tracking** - Track which files have been accessed or modified

## Security

### Authentication

- All API endpoints require user authentication via Better Auth
- Tool execution context includes user ID for audit trails
- Project-level access controls prevent unauthorized file access

### File Access

- Tools operate within project boundaries (projectId required)
- R2 storage provides secure, isolated file storage
- File paths are validated to prevent directory traversal
- Operations are logged for audit and debugging

### Input Validation

- Tool parameters are validated against schemas
- File content is sanitized and size-limited
- Rate limiting prevents abuse of API endpoints
- Error messages don't expose sensitive system information

## Performance

### Optimization Strategies

- **Concurrent Execution** - Multiple tools can run in parallel when safe
- **Caching** - Helicone provides intelligent response caching
- **Streaming** - Real-time response streaming for better UX
- **Batching** - Group related file operations for efficiency

### Monitoring

- **Token Usage** - Track LLM token consumption and costs
- **Tool Metrics** - Monitor tool execution times and success rates
- **Error Tracking** - Log and analyze tool execution failures
- **Performance** - Track response times and optimization opportunities

## Development

### Adding New Tools

1. **Define Tool** - Create tool definition with parameters schema
2. **Implement Handler** - Write async function to execute tool logic
3. **Register Tool** - Add to tool manager for availability
4. **Test Integration** - Verify AI can discover and use the tool

Example:

```typescript
const myTool: ToolDefinition = {
	name: 'analyze_code',
	description: 'Analyze code quality and suggest improvements',
	parameters: {
		type: 'object',
		properties: {
			filePath: { type: 'string', description: 'Path to file to analyze' },
			language: { type: 'string', description: 'Programming language' }
		},
		required: ['filePath']
	},
	handler: async (params, context) => {
		// Implementation here
		return { success: true, data: analysis, message: 'Analysis complete' };
	}
};

toolManager.registerTool(myTool);
```

### Testing

- Unit tests for individual tools and services
- Integration tests for full LLM + tool workflows
- E2E tests for UI interactions and API endpoints
- Mock providers for development and testing

### Debugging

- Enable debug logging via environment variables
- Inspect tool call parameters and results
- Monitor Helicone dashboard for LLM interactions
- Use browser dev tools for UI state inspection

## Examples

### Code Review Assistant

```typescript
const codeReviewAgent = LLMToolAgentService.createCodeAssistant('user123', 'gpt-4');

const response = await codeReviewAgent.processMessage(
	[
		{
			role: 'user',
			content:
				'Review all TypeScript files in the src/components directory and suggest improvements'
		}
	],
	{ projectId: 'my-app', userId: 'user123' }
);
```

### Project Setup Helper

```typescript
const setupAgent = LLMToolAgentService.createFileManager('user123', 'claude-3-sonnet');

const response = await setupAgent.processMessage(
	[
		{
			role: 'user',
			content: 'Set up a new React component library with TypeScript, Jest, and Storybook'
		}
	],
	{ projectId: 'component-lib', userId: 'user123' }
);
```

### Bug Fix Assistant

```typescript
const response = await llmToolAgent.chat(
	"There's a bug in the login component - users can't submit the form. Please investigate and fix it.",
	{
		userId: 'user123',
		projectId: 'webapp'
	},
	{
		model: 'gpt-4',
		systemPrompt:
			'You are an expert debugger. Always read the relevant files first to understand the issue before making changes.'
	}
);
```

This LLM Tool Integration provides a powerful foundation for AI-assisted development workflows, enabling natural language interaction with project files and automated code management tasks.
