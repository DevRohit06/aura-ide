I'll create comprehensive documentation for integrating Helicone AI Gateway with multiple providers and enabling dynamic model switching in the same chat session.[1][2][3]

## Helicone AI Gateway Integration with Dynamic Model Switching

Here's the updated documentation and implementation for your coding agent with Helicone gateway support and seamless model switching:

### Environment Variables Update

```bash
# Add to .env file

# Helicone Gateway
HELICONE_API_KEY=sk-helicone-...

# LLM Provider Keys (used through Helicone)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GROQ_API_KEY=gsk_...
OPENROUTER_API_KEY=sk-or-...

# Default model
DEFAULT_MODEL_PROVIDER=openai
DEFAULT_MODEL=gpt-4o
```

### Model Manager Implementation

**File:** `src/lib/agent/model-manager.ts`

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { 
  HELICONE_API_KEY,
  OPENAI_API_KEY,
  ANTHROPIC_API_KEY,
  GROQ_API_KEY,
  OPENROUTER_API_KEY 
} from "$env/static/private";

export interface ModelConfig {
  provider: "openai" | "anthropic" | "groq" | "openrouter";
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export const MODEL_PRESETS = {
  // OpenAI models
  "gpt-4o": { provider: "openai", model: "gpt-4o", cost: 0.005 },
  "gpt-4o-mini": { provider: "openai", model: "gpt-4o-mini", cost: 0.00015 },
  "gpt-4-turbo": { provider: "openai", model: "gpt-4-turbo", cost: 0.01 },
  "o1-preview": { provider: "openai", model: "o1-preview", cost: 0.015 },
  
  // Anthropic models
  "claude-3-5-sonnet": { provider: "anthropic", model: "claude-3-5-sonnet-20241022", cost: 0.003 },
  "claude-3-5-haiku": { provider: "anthropic", model: "claude-3-5-haiku-20241022", cost: 0.001 },
  "claude-3-opus": { provider: "anthropic", model: "claude-3-opus-20240229", cost: 0.015 },
  
  // Groq models (ultra-fast inference)
  "llama-3.3-70b": { provider: "groq", model: "llama-3.3-70b-versatile", cost: 0.00059 },
  "llama-3.1-8b": { provider: "groq", model: "llama-3.1-8b-instant", cost: 0.00005 },
  "mixtral-8x7b": { provider: "groq", model: "mixtral-8x7b-32768", cost: 0.00024 },
  
  // OpenRouter models (access to 100+ models)
  "deepseek-chat": { provider: "openrouter", model: "deepseek/deepseek-chat", cost: 0.00014 },
  "qwen-2.5-72b": { provider: "openrouter", model: "qwen/qwen-2.5-72b-instruct", cost: 0.0004 },
  "gemini-pro": { provider: "openrouter", model: "google/gemini-pro-1.5", cost: 0.00125 },
} as const;

export class ModelManager {
  private models: Map<string, BaseChatModel> = new Map();
  
  /**
   * Get or create a model instance with Helicone gateway
   */
  getModel(config: ModelConfig): BaseChatModel {
    const cacheKey = `${config.provider}:${config.model}`;
    
    if (this.models.has(cacheKey)) {
      return this.models.get(cacheKey)!;
    }
    
    const model = this.createModel(config);
    this.models.set(cacheKey, model);
    return model;
  }
  
  /**
   * Create a new model instance with Helicone proxy
   */
  private createModel(config: ModelConfig): BaseChatModel {
    const { provider, model, temperature = 0, maxTokens } = config;
    
    const commonConfig = {
      temperature,
      maxTokens,
      configuration: {
        baseURL: this.getHeliconeBaseURL(provider),
        defaultHeaders: this.getHeliconeHeaders(provider),
      },
    };
    
    switch (provider) {
      case "openai":
        return new ChatOpenAI({
          modelName: model,
          openAIApiKey: OPENAI_API_KEY,
          ...commonConfig,
        });
        
      case "anthropic":
        return new ChatAnthropic({
          modelName: model,
          anthropicApiKey: ANTHROPIC_API_KEY,
          ...commonConfig,
        });
        
      case "groq":
        return new ChatOpenAI({
          modelName: model,
          openAIApiKey: GROQ_API_KEY,
          configuration: {
            baseURL: "https://groq.helicone.ai/openai/v1",
            defaultHeaders: {
              "Helicone-Auth": `Bearer ${HELICONE_API_KEY}`,
              "Helicone-Target-Url": "https://api.groq.com",
            },
          },
          temperature,
          maxTokens,
        });
        
      case "openrouter":
        return new ChatOpenAI({
          modelName: model,
          openAIApiKey: OPENROUTER_API_KEY,
          configuration: {
            baseURL: "https://openrouter.helicone.ai/api/v1",
            defaultHeaders: {
              "Helicone-Auth": `Bearer ${HELICONE_API_KEY}`,
              "HTTP-Referer": "https://your-app.com",
              "X-Title": "CodingAgent",
            },
          },
          temperature,
          maxTokens,
        });
        
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }
  
  /**
   * Get Helicone base URL for provider
   */
  private getHeliconeBaseURL(provider: string): string {
    const urls = {
      openai: "https://oai.helicone.ai/v1",
      anthropic: "https://anthropic.helicone.ai/v1",
      groq: "https://groq.helicone.ai/openai/v1",
      openrouter: "https://openrouter.helicone.ai/api/v1",
    };
    
    return urls[provider as keyof typeof urls];
  }
  
  /**
   * Get Helicone headers for provider
   */
  private getHeliconeHeaders(provider: string): Record<string, string> {
    const headers: Record<string, string> = {
      "Helicone-Auth": `Bearer ${HELICONE_API_KEY}`,
    };
    
    // Add custom properties for tracking
    headers["Helicone-Property-Environment"] = process.env.NODE_ENV || "development";
    headers["Helicone-Property-Provider"] = provider;
    
    return headers;
  }
  
  /**
   * Get model info by preset name
   */
  getModelPreset(presetName: string): ModelConfig | null {
    const preset = MODEL_PRESETS[presetName as keyof typeof MODEL_PRESETS];
    if (!preset) return null;
    
    return {
      provider: preset.provider as any,
      model: preset.model,
    };
  }
  
  /**
   * List all available models
   */
  listModels() {
    return Object.entries(MODEL_PRESETS).map(([name, config]) => ({
      name,
      ...config,
    }));
  }
}

// Export singleton instance
export const modelManager = new ModelManager();
```

### Updated Agent State with Model Config

**File:** `src/lib/agent/state.ts`

```typescript
import { Annotation } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import type { ModelConfig } from "./model-manager";

export const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  
  // Model configuration - can change mid-conversation
  modelConfig: Annotation<ModelConfig>({
    reducer: (_, y) => y,
    default: () => ({ provider: "openai", model: "gpt-4o" }),
  }),
  
  currentFile: Annotation<string | null>({
    reducer: (_, y) => y,
  }),
  fileContent: Annotation<string | null>({
    reducer: (_, y) => y,
  }),
  sandboxId: Annotation<string | null>({
    reducer: (_, y) => y,
  }),
  sandboxType: Annotation<"daytona" | "e2b">({
    reducer: (_, y) => y,
  }),
  codeContext: Annotation<string[]>({
    reducer: (x, y) => [...x, ...y],
  }),
  awaitingHumanInput: Annotation<boolean>({
    reducer: (_, y) => y,
  }),
  useMorph: Annotation<boolean>({
    reducer: (_, y) => y,
  }),
  terminalOutput: Annotation<string[]>({
    reducer: (x, y) => [...x, ...y],
  }),
  
  // Track model usage for cost estimation
  modelUsageHistory: Annotation<Array<{
    provider: string;
    model: string;
    timestamp: number;
  }>>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),
});

export type AgentStateType = typeof AgentState.State;
```

### Updated Agent Graph with Dynamic Model Selection

**File:** `src/lib/agent/graph.ts`

```typescript
import { StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { interrupt, Command } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";
import { AgentState } from "./state";
import { tools } from "./tools";
import { modelManager } from "./model-manager";

// Tool execution node
const toolNode = new ToolNode(tools);

// Agent reasoning node with dynamic model selection
async function agentNode(state: typeof AgentState.State) {
  // Get model based on current config
  const model = modelManager.getModel(state.modelConfig);
  
  // Bind tools to the current model
  const modelWithTools = model.bindTools(tools);
  
  const systemPrompt = `You are an expert coding assistant with access to:
- A sandbox environment (${state.sandboxType}) with file operations
- Terminal command execution
- Web search via Tavily for documentation
- Semantic code search via Qdrant
- Current file context: ${state.currentFile || 'None'}

Current Model: ${state.modelConfig.provider}/${state.modelConfig.model}

Current file content:
${state.fileContent || 'No file currently open'}

Code context from vector search:
${state.codeContext.join('\n\n')}

Recent terminal output:
${state.terminalOutput.slice(-3).join('\n')}

Use tools strategically:
1. Search for documentation or examples when needed
2. Read files to understand context
3. Write files using Morph=${state.useMorph} for smart merging
4. Execute code to verify changes
5. Run terminal commands for package installation, git operations, etc.

Always consider the current file context when making changes.`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...state.messages,
  ];
  
  const response = await modelWithTools.invoke(messages);
  
  // Track model usage
  const usage = {
    provider: state.modelConfig.provider,
    model: state.modelConfig.model,
    timestamp: Date.now(),
  };
  
  return { 
    messages: [response],
    modelUsageHistory: [usage],
  };
}

// Human-in-the-loop review node
async function humanReviewNode(state: typeof AgentState.State): Promise<Command> {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  
  // Check if there are tool calls that modify code
  const hasCodeModification = lastMessage.tool_calls?.some(
    tc => ['write_file', 'execute_code', 'run_terminal_command'].includes(tc.name)
  );
  
  if (hasCodeModification) {
    // Interrupt for human review
    const approval = interrupt({
      type: "human_review",
      message: "Review the proposed changes",
      toolCalls: lastMessage.tool_calls,
      currentState: {
        file: state.currentFile,
        content: state.fileContent,
        model: `${state.modelConfig.provider}/${state.modelConfig.model}`,
      },
    });
    
    if (approval.action === "approved") {
      return new Command({ goto: "tools" });
    } else if (approval.action === "rejected") {
      return new Command({ goto: "agent" });
    } else if (approval.action === "edit") {
      return new Command({
        goto: "agent",
        update: {
          messages: [
            new HumanMessage(`Please apply these edits instead: ${approval.edits}`),
          ],
        },
      });
    } else if (approval.action === "change_model") {
      // User wants to switch model
      return new Command({
        goto: "agent",
        update: {
          modelConfig: approval.newModelConfig,
          messages: [
            new HumanMessage("Continue with the new model."),
          ],
        },
      });
    }
  }
  
  return new Command({ goto: "tools" });
}

// Routing logic
function shouldContinue(state: typeof AgentState.State) {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  
  if (lastMessage.tool_calls?.length) {
    return "review"; // Go to human review
  }
  return "__end__";
}

// Build the graph
const workflow = new StateGraph(AgentState)
  .addNode("agent", agentNode)
  .addNode("review", humanReviewNode)
  .addNode("tools", toolNode)
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("tools", "agent");

// Compile with checkpointer for persistence
const checkpointer = new MemorySaver();
export const agentGraph = workflow.compile({ checkpointer });
```

### API Endpoint for Model Management

**File:** `src/routes/api/models/+server.ts`

```typescript
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { modelManager, MODEL_PRESETS } from "$lib/agent/model-manager";

// List all available models
export const GET: RequestHandler = async () => {
  const models = modelManager.listModels();
  
  return json({
    models,
    presets: Object.keys(MODEL_PRESETS),
  });
};

// Switch model during conversation
export const POST: RequestHandler = async ({ request }) => {
  const { modelName, provider, customModel } = await request.json();
  
  let modelConfig;
  
  if (modelName) {
    // Use preset
    modelConfig = modelManager.getModelPreset(modelName);
    if (!modelConfig) {
      return json({ error: "Invalid model preset" }, { status: 400 });
    }
  } else if (provider && customModel) {
    // Use custom model
    modelConfig = { provider, model: customModel };
  } else {
    return json({ error: "Must provide modelName or provider+customModel" }, { status: 400 });
  }
  
  return json({
    success: true,
    modelConfig,
  });
};
```

### Updated Main Agent Endpoint with Model Switching

**File:** `src/routes/api/agent/+server.ts`

```typescript
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { agentGraph } from "$lib/agent/graph";
import { HumanMessage } from "@langchain/core/messages";
import { modelManager } from "$lib/agent/model-manager";

export const POST: RequestHandler = async ({ request }) => {
  const { 
    message, 
    threadId, 
    currentFile, 
    sandboxId, 
    sandboxType, 
    useMorph,
    modelName, // New: switch model
    modelConfig, // New: custom model config
  } = await request.json();
  
  const config = {
    configurable: { thread_id: threadId || "default" },
  };
  
  // Determine model configuration
  let finalModelConfig;
  if (modelName) {
    finalModelConfig = modelManager.getModelPreset(modelName);
  } else if (modelConfig) {
    finalModelConfig = modelConfig;
  } else {
    // Use default
    finalModelConfig = { provider: "openai", model: "gpt-4o" };
  }
  
  const initialState = {
    messages: [new HumanMessage(message)],
    modelConfig: finalModelConfig,
    currentFile: currentFile || null,
    sandboxId: sandboxId || null,
    sandboxType: sandboxType || "e2b",
    useMorph: useMorph || false,
    codeContext: [],
    terminalOutput: [],
    awaitingHumanInput: false,
  };
  
  try {
    const result = await agentGraph.invoke(initialState, config);
    
    return json({
      response: result.messages[result.messages.length - 1].content,
      state: {
        currentFile: result.currentFile,
        sandboxId: result.sandboxId,
        awaitingHumanInput: result.awaitingHumanInput,
        modelUsed: `${result.modelConfig.provider}/${result.modelConfig.model}`,
      },
      usage: result.modelUsageHistory,
    });
  } catch (error: any) {
    if (error.name === "GraphInterrupt") {
      return json({
        interrupt: true,
        data: error.value,
        threadId,
      });
    }
    
    throw error;
  }
};

// Resume after human review with optional model switch
export const PUT: RequestHandler = async ({ request }) => {
  const { threadId, approval, newModelName } = await request.json();
  
  const config = {
    configurable: { thread_id: threadId },
  };
  
  // Handle model switch if requested
  if (newModelName) {
    const newModelConfig = modelManager.getModelPreset(newModelName);
    if (newModelConfig) {
      approval.newModelConfig = newModelConfig;
    }
  }
  
  const result = await agentGraph.invoke(approval, config);
  
  return json({
    response: result.messages[result.messages.length - 1].content,
    state: {
      currentFile: result.currentFile,
      sandboxId: result.sandboxId,
      modelUsed: `${result.modelConfig.provider}/${result.modelConfig.model}`,
    },
  });
};
```

### Frontend Integration Example

**File:** `src/lib/components/ModelSelector.svelte`

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  
  export let currentModel: string = 'gpt-4o';
  export let onModelChange: (modelName: string) => void;
  
  let models: any[] = [];
  let isOpen = false;
  
  onMount(async () => {
    const response = await fetch('/api/models');
    const data = await response.json();
    models = data.models;
  });
  
  function selectModel(modelName: string) {
    currentModel = modelName;
    onModelChange(modelName);
    isOpen = false;
  }
</script>

<div class="model-selector">
  <button 
    class="model-button"
    on:click={() => isOpen = !isOpen}
  >
    <span class="model-icon">🤖</span>
    <span class="model-name">{currentModel}</span>
    <span class="chevron">{isOpen ? '▲' : '▼'}</span>
  </button>
  
  {#if isOpen}
    <div class="model-dropdown">
      <div class="model-category">
        <h4>Fast & Cheap (Groq)</h4>
        {#each models.filter(m => m.provider === 'groq') as model}
          <button 
            class="model-option"
            class:active={currentModel === model.name}
            on:click={() => selectModel(model.name)}
          >
            <span class="name">{model.name}</span>
            <span class="cost">${model.cost}/1K tokens</span>
          </button>
        {/each}
      </div>
      
      <div class="model-category">
        <h4>Most Capable (OpenAI)</h4>
        {#each models.filter(m => m.provider === 'openai') as model}
          <button 
            class="model-option"
            class:active={currentModel === model.name}
            on:click={() => selectModel(model.name)}
          >
            <span class="name">{model.name}</span>
            <span class="cost">${model.cost}/1K tokens</span>
          </button>
        {/each}
      </div>
      
      <div class="model-category">
        <h4>Best Reasoning (Anthropic)</h4>
        {#each models.filter(m => m.provider === 'anthropic') as model}
          <button 
            class="model-option"
            class:active={currentModel === model.name}
            on:click={() => selectModel(model.name)}
          >
            <span class="name">{model.name}</span>
            <span class="cost">${model.cost}/1K tokens</span>
          </button>
        {/each}
      </div>
      
      <div class="model-category">
        <h4>100+ Models (OpenRouter)</h4>
        {#each models.filter(m => m.provider === 'openrouter') as model}
          <button 
            class="model-option"
            class:active={currentModel === model.name}
            on:click={() => selectModel(model.name)}
          >
            <span class="name">{model.name}</span>
            <span class="cost">${model.cost}/1K tokens</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .model-selector {
    position: relative;
    display: inline-block;
  }
  
  .model-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s;
  }
  
  .model-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }
  
  .model-dropdown {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
    min-width: 300px;
    max-height: 500px;
    overflow-y: auto;
    z-index: 1000;
    padding: 0.5rem;
  }
  
  .model-category {
    padding: 0.5rem;
  }
  
  .model-category h4 {
    font-size: 0.75rem;
    text-transform: uppercase;
    color: #64748b;
    margin-bottom: 0.5rem;
    font-weight: 600;
  }
  
  .model-option {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }
  
  .model-option:hover {
    background: #f1f5f9;
  }
  
  .model-option.active {
    background: #e0e7ff;
    color: #667eea;
  }
  
  .model-option .name {
    font-weight: 500;
    font-size: 0.875rem;
  }
  
  .model-option .cost {
    font-size: 0.75rem;
    color: #64748b;
  }
</style>
```

### Usage Example

```typescript
// In your main chat component
let currentModel = 'gpt-4o';

async function sendMessage(message: string) {
  const response = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      threadId: chatThreadId,
      modelName: currentModel, // Dynamic model selection
      sandboxId: currentSandbox,
      sandboxType: 'e2b',
      useMorph: true,
    }),
  });
  
  const data = await response.json();
  
  // Show which model was used
  console.log('Model used:', data.state.modelUsed);
}

// Switch model mid-conversation
function handleModelChange(newModel: string) {
  currentModel = newModel;
  // Next message will use the new model
  // The conversation state persists!
}
```

## Key Features

**Unified API**: All providers accessed through Helicone gateway with OpenAI-compatible interface. **Zero Lock-in**: Switch between OpenAI, Anthropic, Groq, and OpenRouter without code changes. **Cost Tracking**: Helicone automatically tracks usage and costs across all providers. **Automatic Failover**: If one provider fails, Helicone can route to backup providers. **Response Caching**: 30-50% cache hit rates reduce costs dramatically. **Mid-Conversation Switching**: Change models during same chat session without losing context. **Load Balancing**: Intelligent routing based on latency and availability. **Rate Limiting**: Per-provider and per-user rate limits built-in.[4][5][6][2][7][8][1]

This implementation allows you to seamlessly switch between providers and models even during the same conversation, with all requests logged and tracked through Helicone for observability and cost management![2][8][1]

[1](https://www.helicone.ai/blog/introducing-ai-gateway)
[2](https://www.helicone.ai/blog/ptb-gateway-launch)
[3](https://www.promptfoo.dev/docs/providers/helicone/)
[4](https://www.helicone.ai/blog/how-ai-gateways-enhance-app-reliability)
[5](https://docs.helicone.ai/getting-started/integration-method/openrouter)
[6](https://docs.langchain.com/oss/javascript/langgraph/graph-api)
[7](https://www.youtube.com/watch?v=bV1K8B4m5PI)
[8](https://docs.helicone.ai/getting-started/integration-method/gateway)
[9](https://www.helicone.ai/blog/top-llm-gateways-comparison-2025)
[10](https://www.helicone.ai)
[11](https://github.com/Helicone/ai-gateway)
[12](https://www.helicone.ai/blog/llm-api-providers)
[13](https://github.com/Helicone/helicone)
[14](https://langchain-ai.github.io/langgraphjs/tutorials/quickstart/)
[15](https://www.helicone.ai/changelog)
[16](https://javascript-conference.com/blog/build-ai-agents-javascript-langgraph/)
[17](https://www.truefoundry.com/blog/best-llm-gateways)
[18](https://docs.helicone.ai/integrations/overview)
[19](https://forum.langchain.com/t/can-a-reasoning-agent-switch-underlying-models-during-execution/1087)
[20](https://dev.to/kuldeep_paul/5-best-llm-gateways-for-scaling-ai-applications-in-2025-1jmh)