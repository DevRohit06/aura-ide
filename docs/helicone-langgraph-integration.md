# Helicone LangGraph Integration

This project includes a modular and scalable integration of Helicone with LangGraph for AI-powered chat functionality in the Aura IDE.

## Setup

### 1. Environment Variables

Copy the example environment file and configure your API keys:

```bash
cp .env.example.helicone .env
```

Edit the `.env` file with your actual API keys:

```bash
# Required
HELICONE_API_KEY=your_helicone_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Optional
ANTHROPIC_API_KEY=your_anthropic_api_key_here
TAVILY_API_KEY=your_tavily_api_key_here
```

### 2. Getting API Keys

- **Helicone API Key**: Get from [https://us.helicone.ai/settings/api-keys](https://us.helicone.ai/settings/api-keys)
- **OpenAI API Key**: Get from [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Anthropic API Key**: Get from [https://console.anthropic.com/](https://console.anthropic.com/)
- **Tavily API Key**: Get from [https://app.tavily.com/](https://app.tavily.com/) (for web search functionality)

## Architecture

### Core Components

1. **LLM Service** (`src/lib/services/llm.service.ts`)
   - Manages LangGraph agents with Helicone integration
   - Supports OpenAI and Anthropic models
   - Handles agent lifecycle and invocation

2. **Chat Store** (`src/lib/stores/chat.store.ts`)
   - Manages chat sessions and messages
   - Handles sending messages to the LLM API
   - Provides reactive state for the UI

3. **API Endpoint** (`src/routes/api/llm/agent/+server.ts`)
   - Server-side endpoint for LLM interactions
   - Validates requests and manages agent instances
   - Returns responses with proper error handling

4. **Chat Components**
   - `ChatSidebar`: Main chat interface
   - `ChatContainer`: Message display area
   - `ChatInput`: Message input component
   - `Message`: Individual message display

## Usage

### Basic Chat

The chat functionality is integrated into the editor sidebar. Users can:

1. Open the chat sidebar in the editor
2. Type messages to interact with the AI assistant
3. Receive responses powered by LangGraph agents
4. Start new conversations

### Programmatic Usage

You can also use the LLM service programmatically:

```typescript
import { llmService } from '$lib/services/llm.service';
import { HumanMessage } from '@langchain/core/messages';

// Create an agent
const agentId = llmService.createAgent({
	llmConfig: {
		provider: 'openai',
		model: 'gpt-4o',
		temperature: 0
	},
	heliconeConfig: {
		apiKey: 'your-helicone-key',
		cacheEnabled: true
	}
});

// Invoke the agent
const result = await llmService.invokeAgent(
	agentId,
	{
		messages: [new HumanMessage('Hello, how are you?')]
	},
	{
		promptId: 'greeting',
		sessionId: 'session-123',
		sessionName: 'User Chat',
		sessionPath: '/chat'
	}
);
```

## Features

### Helicone Integration

- **Observability**: All requests are logged and monitored through Helicone
- **Caching**: Intelligent caching to reduce API costs
- **Custom Properties**: Session tracking, prompt IDs, and custom metadata
- **Rate Limiting**: Built-in rate limiting and usage tracking

### LangGraph Features

- **Agent Framework**: Uses LangGraph for complex multi-step reasoning
- **Tool Integration**: Supports tools like web search (Tavily)
- **Memory Management**: Persistent conversation memory
- **Modular Architecture**: Easy to extend with new tools and capabilities

### Scalability

- **Session Management**: Multiple concurrent chat sessions
- **Agent Pooling**: Reusable agent instances
- **Error Handling**: Robust error handling and recovery
- **Performance**: Optimized for low latency responses

## Configuration Options

### LLM Configuration

```typescript
interface LLMConfig {
	provider: 'openai' | 'anthropic';
	model: string;
	temperature?: number;
	apiKey?: string;
}
```

### Helicone Configuration

```typescript
interface HeliconeConfig {
	apiKey: string;
	cacheEnabled?: boolean;
}
```

### Agent Invocation Options

```typescript
interface AgentInvocationOptions {
	promptId?: string;
	sessionId?: string;
	sessionName?: string;
	sessionPath?: string;
	headers?: Record<string, string>;
}
```

## Extending the Integration

### Adding New Tools

To add new tools to the LangGraph agent:

1. Define the tool in the LLM service
2. Update the `createAgent` method to include the new tool
3. Ensure proper imports and dependencies

### Adding New Providers

To support additional LLM providers:

1. Update the `LLMConfig` interface
2. Add provider handling in the `initializeLLM` method
3. Update environment variable declarations
4. Add provider-specific configuration

### Custom Agent Behaviors

Create specialized agents by:

1. Extending the `AgentConfig` interface
2. Modifying the agent creation logic
3. Adding custom tools and behaviors

## Monitoring and Analytics

All interactions are automatically tracked through Helicone, providing:

- Request/response logging
- Performance metrics
- Cost tracking
- Error monitoring
- Usage analytics

Access your Helicone dashboard at [https://us.helicone.ai/](https://us.helicone.ai/) to view detailed analytics.

## Troubleshooting

### Common Issues

1. **Missing API Keys**: Ensure all required environment variables are set
2. **Network Errors**: Check internet connectivity and API endpoints
3. **Rate Limits**: Monitor usage in Helicone dashboard
4. **Model Errors**: Verify model names and availability

### Debug Mode

Enable debug logging by setting:

```bash
DEBUG=llm:*
```

## Security Considerations

- API keys are stored securely in environment variables
- All LLM requests go through Helicone's proxy for monitoring
- No sensitive data is logged in client-side code
- Server-side validation prevents unauthorized access

## Contributing

When extending this integration:

1. Follow the existing modular architecture
2. Add proper TypeScript types
3. Include error handling
4. Update documentation
5. Test thoroughly with different scenarios
