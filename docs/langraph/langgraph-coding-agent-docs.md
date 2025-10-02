# LangGraph.js Coding Agent with Qdrant, Sandbox Runners, MCP, and Helicone

A comprehensive guide to building an intelligent coding agent using LangGraph.js with Qdrant vector database, Daytona/E2B sandbox code runners, MCP for documentation and web search, and Helicone AI gateway for multiple model access.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     LangGraph.js Coding Agent                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │   Human      │  │   Agent      │  │    Code Execution       │ │
│  │   in Loop    │  │   Memory     │  │    Sandbox (Daytona/   │ │
│  │   (Morph)    │  │   (Qdrant)   │  │    E2B)                │ │
│  └──────────────┘  └──────────────┘  └─────────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │             Helicone AI Gateway                             │ │
│  │   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐   │ │
│  │   │ OpenAI  │  │Anthropic│  │ Google  │  │    ...      │   │ │
│  │   │         │  │         │  │ Gemini  │  │  Other LLMs │   │ │
│  │   └─────────┘  └─────────┘  └─────────┘  └─────────────┘   │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    MCP Tools                                │ │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐    │ │
│  │   │  Filesystem │  │ Web Search  │  │  Documentation  │    │ │
│  │   │   Server    │  │   Tools     │  │     Access      │    │ │
│  │   └─────────────┘  └─────────────┘  └─────────────────┘    │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

### Dependencies Installation

```bash
# Core LangGraph.js dependencies
npm install @langchain/langgraph @langchain/core @langchain/openai @langchain/anthropic @langchain/community

# Qdrant client
npm install @qdrant/js-client-rest

# Sandbox runners
npm install @e2b/code-interpreter
npm install @daytona/sdk

# MCP server packages
npm install @modelcontextprotocol/server-filesystem
npm install @modelcontextprotocol/sdk

# Additional utilities
npm install uuid dotenv node-fetch
```

### Environment Variables

Create a `.env` file in your project root:

```bash
# Helicone Configuration
HELICONE_API_KEY=sk-helicone-xxxxx
HELICONE_CONTROL_PLANE_API_KEY=sk-helicone-xxxxx

# LLM Provider Keys
OPENAI_API_KEY=sk-xxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxx
GOOGLE_API_KEY=xxxxx

# Vector Database
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=xxxxx  # Optional for cloud

# Sandbox Runners
E2B_API_KEY=xxxxx
DAYTONA_API_KEY=xxxxx
DAYTONA_SERVER_URL=https://api.daytona.io

# MCP Configuration
MCP_SERVERS_PATH=./mcp-servers/
```

## Core Components

### 1. Helicone AI Gateway Setup

Configure multiple model access through Helicone:

```typescript
// src/models/helicone-gateway.ts
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { v4 as uuidv4 } from 'uuid';

export class HeliconeModelManager {
	private models: Map<string, any> = new Map();

	constructor() {
		this.initializeModels();
	}

	private initializeModels() {
		// OpenAI models through Helicone
		this.models.set(
			'gpt-4',
			new ChatOpenAI({
				modelName: 'gpt-4',
				temperature: 0.1,
				configuration: {
					baseURL: 'https://oai.helicone.ai/v1',
					defaultHeaders: {
						'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`,
						'Helicone-Cache-Enabled': 'true',
						'Helicone-Session-Id': uuidv4(),
						'Helicone-Session-Name': 'coding-agent'
					}
				}
			})
		);

		// Anthropic models through Helicone
		this.models.set(
			'claude-3',
			new ChatAnthropic({
				modelName: 'claude-3-opus-20240229',
				temperature: 0.1,
				anthropicApiKey: process.env.ANTHROPIC_API_KEY,
				clientOptions: {
					baseURL: 'https://anthropic.helicone.ai',
					defaultHeaders: {
						'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`,
						'Helicone-Cache-Enabled': 'true'
					}
				}
			})
		);
	}

	getModel(modelName: string) {
		const model = this.models.get(modelName);
		if (!model) {
			throw new Error(`Model ${modelName} not found`);
		}
		return model;
	}

	async switchModel(modelName: string) {
		return this.getModel(modelName);
	}
}
```

### 2. Qdrant Vector Database Integration

Setup vector database for context management:

```typescript
// src/memory/qdrant-manager.ts
import { QdrantClient } from '@qdrant/js-client-rest';

export interface CodeContext {
	id: string;
	fileName: string;
	filePath: string;
	content: string;
	language: string;
	lastModified: Date;
	metadata: Record<string, any>;
}

export class QdrantContextManager {
	private client: QdrantClient;
	private collectionName = 'coding_agent_context';

	constructor() {
		this.client = new QdrantClient({
			host: process.env.QDRANT_URL || 'localhost',
			port: 6333,
			apiKey: process.env.QDRANT_API_KEY
		});
	}

	async initialize() {
		try {
			// Check if collection exists
			const collections = await this.client.getCollections();
			const exists = collections.collections.some((c) => c.name === this.collectionName);

			if (!exists) {
				await this.client.createCollection(this.collectionName, {
					vectors: {
						size: 1536, // OpenAI embedding dimension
						distance: 'Cosine'
					}
				});
			}
		} catch (error) {
			console.error('Failed to initialize Qdrant collection:', error);
			throw error;
		}
	}

	async storeContext(context: CodeContext, embedding: number[]) {
		await this.client.upsert(this.collectionName, {
			wait: true,
			points: [
				{
					id: context.id,
					vector: embedding,
					payload: {
						fileName: context.fileName,
						filePath: context.filePath,
						content: context.content,
						language: context.language,
						lastModified: context.lastModified.toISOString(),
						...context.metadata
					}
				}
			]
		});
	}

	async searchContext(queryEmbedding: number[], limit: number = 5) {
		const searchResult = await this.client.search(this.collectionName, {
			vector: queryEmbedding,
			limit,
			with_payload: true
		});

		return searchResult.map((result) => ({
			id: result.id,
			score: result.score,
			context: result.payload as CodeContext
		}));
	}

	async updateFileContext(filePath: string, content: string, embedding: number[]) {
		const id = Buffer.from(filePath).toString('base64');

		const context: CodeContext = {
			id,
			fileName: filePath.split('/').pop() || '',
			filePath,
			content,
			language: this.detectLanguage(filePath),
			lastModified: new Date(),
			metadata: { isCurrentFile: true }
		};

		await this.storeContext(context, embedding);
	}

	private detectLanguage(filePath: string): string {
		const ext = filePath.split('.').pop()?.toLowerCase();
		const langMap: Record<string, string> = {
			ts: 'typescript',
			js: 'javascript',
			py: 'python',
			java: 'java',
			cpp: 'cpp',
			c: 'c',
			rs: 'rust',
			go: 'go'
		};
		return langMap[ext || ''] || 'text';
	}
}
```

### 3. Sandbox Code Runners Integration

#### E2B Integration

```typescript
// src/sandbox/e2b-runner.ts
import { CodeInterpreter } from '@e2b/code-interpreter';

export class E2BSandboxRunner {
	private sandbox: CodeInterpreter | null = null;

	async initialize() {
		this.sandbox = await CodeInterpreter.create({
			apiKey: process.env.E2B_API_KEY
		});
	}

	async executeCode(code: string, language: string = 'python') {
		if (!this.sandbox) {
			await this.initialize();
		}

		try {
			const execution = await this.sandbox!.notebook.execCell(code);

			return {
				success: true,
				output: execution.text,
				error: execution.error,
				logs: execution.logs
			};
		} catch (error) {
			return {
				success: false,
				output: '',
				error: error.message,
				logs: []
			};
		}
	}

	async runTerminalCommand(command: string) {
		if (!this.sandbox) {
			await this.initialize();
		}

		try {
			const result = await this.sandbox!.process.start({
				cmd: command.split(' ')
			});

			await result.wait();

			return {
				success: result.exitCode === 0,
				output: result.stdout,
				error: result.stderr,
				exitCode: result.exitCode
			};
		} catch (error) {
			return {
				success: false,
				output: '',
				error: error.message,
				exitCode: -1
			};
		}
	}

	async uploadFile(filePath: string, content: string) {
		if (!this.sandbox) {
			await this.initialize();
		}

		await this.sandbox!.files.write(filePath, content);
	}

	async downloadFile(filePath: string): Promise<string> {
		if (!this.sandbox) {
			await this.initialize();
		}

		return await this.sandbox!.files.read(filePath);
	}

	async cleanup() {
		if (this.sandbox) {
			await this.sandbox.close();
			this.sandbox = null;
		}
	}
}
```

#### Daytona Integration

```typescript
// src/sandbox/daytona-runner.ts
import { DaytonaSDK } from '@daytona/sdk';

export class DaytonaSandboxRunner {
	private client: DaytonaSDK;
	private workspaceId: string | null = null;

	constructor() {
		this.client = new DaytonaSDK({
			apiKey: process.env.DAYTONA_API_KEY,
			serverUrl: process.env.DAYTONA_SERVER_URL
		});
	}

	async initialize() {
		try {
			// Create a new workspace
			const workspace = await this.client.workspaces.create({
				name: `coding-agent-${Date.now()}`,
				template: 'node-typescript'
			});

			this.workspaceId = workspace.id;

			// Wait for workspace to be ready
			await this.waitForWorkspaceReady();

			return workspace;
		} catch (error) {
			console.error('Failed to initialize Daytona workspace:', error);
			throw error;
		}
	}

	async executeCode(code: string, language: string = 'typescript') {
		if (!this.workspaceId) {
			await this.initialize();
		}

		try {
			const result = await this.client.process.execute(this.workspaceId!, {
				code,
				language,
				timeout: 30000
			});

			return {
				success: result.exitCode === 0,
				output: result.stdout,
				error: result.stderr,
				exitCode: result.exitCode
			};
		} catch (error) {
			return {
				success: false,
				output: '',
				error: error.message,
				exitCode: -1
			};
		}
	}

	async runTerminalCommand(command: string) {
		if (!this.workspaceId) {
			await this.initialize();
		}

		try {
			const result = await this.client.process.run(this.workspaceId!, {
				command,
				workingDir: '/workspace',
				timeout: 60000
			});

			return {
				success: result.exitCode === 0,
				output: result.output,
				error: result.error,
				exitCode: result.exitCode
			};
		} catch (error) {
			return {
				success: false,
				output: '',
				error: error.message,
				exitCode: -1
			};
		}
	}

	async uploadFile(filePath: string, content: string) {
		if (!this.workspaceId) {
			await this.initialize();
		}

		await this.client.files.write(this.workspaceId!, filePath, content);
	}

	async downloadFile(filePath: string): Promise<string> {
		if (!this.workspaceId) {
			await this.initialize();
		}

		return await this.client.files.read(this.workspaceId!, filePath);
	}

	private async waitForWorkspaceReady() {
		let attempts = 0;
		const maxAttempts = 30;

		while (attempts < maxAttempts) {
			try {
				const workspace = await this.client.workspaces.get(this.workspaceId!);
				if (workspace.status === 'running') {
					return;
				}
				await new Promise((resolve) => setTimeout(resolve, 2000));
				attempts++;
			} catch (error) {
				attempts++;
				if (attempts >= maxAttempts) {
					throw new Error('Workspace failed to become ready');
				}
			}
		}
	}

	async cleanup() {
		if (this.workspaceId) {
			await this.client.workspaces.delete(this.workspaceId);
			this.workspaceId = null;
		}
	}
}
```

### 4. MCP Integration for Documentation and Web Search

```typescript
// src/mcp/mcp-manager.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export class MCPToolManager {
	private clients: Map<string, Client> = new Map();

	async initializeServers() {
		// Initialize Filesystem Server
		await this.initializeFilesystemServer();

		// Initialize Web Search Server
		await this.initializeWebSearchServer();

		// Initialize Documentation Server
		await this.initializeDocsServer();
	}

	private async initializeFilesystemServer() {
		const transport = new StdioClientTransport({
			command: 'npx',
			args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()]
		});

		const client = new Client(
			{
				name: 'coding-agent',
				version: '1.0.0'
			},
			{
				capabilities: {
					tools: {}
				}
			}
		);

		await client.connect(transport);
		this.clients.set('filesystem', client);
	}

	private async initializeWebSearchServer() {
		const transport = new StdioClientTransport({
			command: 'npx',
			args: ['-y', '@modelcontextprotocol/server-brave-search'],
			env: {
				...process.env,
				BRAVE_API_KEY: process.env.BRAVE_API_KEY
			}
		});

		const client = new Client(
			{
				name: 'coding-agent',
				version: '1.0.0'
			},
			{
				capabilities: {
					tools: {}
				}
			}
		);

		await client.connect(transport);
		this.clients.set('web-search', client);
	}

	private async initializeDocsServer() {
		// Custom documentation server for accessing project docs
		const transport = new StdioClientTransport({
			command: 'node',
			args: ['./src/mcp/docs-server.js']
		});

		const client = new Client(
			{
				name: 'coding-agent',
				version: '1.0.0'
			},
			{
				capabilities: {
					tools: {}
				}
			}
		);

		await client.connect(transport);
		this.clients.set('docs', client);
	}

	async callTool(server: string, toolName: string, args: any) {
		const client = this.clients.get(server);
		if (!client) {
			throw new Error(`MCP server ${server} not found`);
		}

		const result = await client.callTool({
			name: toolName,
			arguments: args
		});

		return result;
	}

	async listTools(server?: string) {
		if (server) {
			const client = this.clients.get(server);
			if (client) {
				return await client.listTools();
			}
			return { tools: [] };
		}

		const allTools = [];
		for (const [serverName, client] of this.clients) {
			const tools = await client.listTools();
			allTools.push({
				server: serverName,
				tools: tools.tools
			});
		}
		return allTools;
	}
}
```

### 5. Human-in-the-Loop with Morph Integration

```typescript
// src/human-loop/morph-integration.ts
import { OpenAI } from 'openai';

export class MorphHumanLoop {
	private morphClient: OpenAI;
	private pendingEdits: Map<string, any> = new Map();

	constructor() {
		this.morphClient = new OpenAI({
			apiKey: process.env.MORPH_API_KEY,
			baseURL: 'https://api.morphllm.com/v1'
		});
	}

	async suggestEdit(filePath: string, originalContent: string, editDescription: string) {
		// Generate edit suggestion using AI
		const suggestion = await this.generateEditSuggestion(originalContent, editDescription);

		// Store pending edit
		const editId = `edit_${Date.now()}`;
		this.pendingEdits.set(editId, {
			filePath,
			originalContent,
			suggestion,
			editDescription,
			timestamp: new Date()
		});

		return {
			editId,
			suggestion,
			preview: await this.generatePreview(originalContent, suggestion)
		};
	}

	async applyEdit(editId: string, userApproval: boolean, userModifications?: string) {
		const edit = this.pendingEdits.get(editId);
		if (!edit) {
			throw new Error(`Edit ${editId} not found`);
		}

		if (!userApproval) {
			this.pendingEdits.delete(editId);
			return { success: false, message: 'Edit rejected by user' };
		}

		let finalEdit = edit.suggestion;
		if (userModifications) {
			finalEdit = userModifications;
		}

		try {
			// Apply edit using Morph's fast apply
			const result = await this.morphClient.chat.completions.create({
				model: 'morph-v3-large',
				messages: [
					{
						role: 'user',
						content: `Apply this edit to the original file:\n\n\`\`\`\n${edit.originalContent}\n\`\`\`\n\n${finalEdit}`
					}
				]
			});

			const appliedContent = result.choices[0].message.content;

			this.pendingEdits.delete(editId);

			return {
				success: true,
				content: appliedContent,
				filePath: edit.filePath
			};
		} catch (error) {
			return {
				success: false,
				message: `Failed to apply edit: ${error.message}`
			};
		}
	}

	async replaceFileContent(filePath: string, newContent: string) {
		// For cases where we want to replace entire file content
		return {
			success: true,
			content: newContent,
			filePath,
			type: 'full_replace'
		};
	}

	private async generateEditSuggestion(originalContent: string, editDescription: string) {
		// Generate edit suggestion based on description
		const response = await this.morphClient.chat.completions.create({
			model: 'gpt-4',
			messages: [
				{
					role: 'user',
					content: `Generate an edit snippet for the following request:\n\nOriginal content:\n\`\`\`\n${originalContent}\n\`\`\`\n\nEdit request: ${editDescription}\n\nProvide only the edit snippet, not the full file.`
				}
			]
		});

		return response.choices[0].message.content;
	}

	private async generatePreview(originalContent: string, editSuggestion: string) {
		// Generate a preview of what the edit would look like
		const response = await this.morphClient.chat.completions.create({
			model: 'morph-v3-large',
			messages: [
				{
					role: 'user',
					content: `Show me a preview of applying this edit:\n\n\`\`\`\n${originalContent}\n\`\`\`\n\n${editSuggestion}`
				}
			]
		});

		return response.choices[0].message.content;
	}
}
```

### 6. Main LangGraph Agent Implementation

```typescript
// src/agent/coding-agent.ts
import { StateGraph, MessagesAnnotation } from '@langchain/langgraph';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { MemorySaver } from '@langchain/langgraph';

import { HeliconeModelManager } from '../models/helicone-gateway.js';
import { QdrantContextManager } from '../memory/qdrant-manager.js';
import { E2BSandboxRunner } from '../sandbox/e2b-runner.js';
import { DaytonaSandboxRunner } from '../sandbox/daytona-runner.js';
import { MCPToolManager } from '../mcp/mcp-manager.js';
import { MorphHumanLoop } from '../human-loop/morph-integration.js';

export interface CodingAgentState extends typeof MessagesAnnotation.State {
  currentFiles: string[];
  contextEmbedding?: number[];
  pendingEdits: string[];
  sandboxType: 'e2b' | 'daytona';
  humanApprovalRequired: boolean;
}

export class CodingAgent {
  private modelManager: HeliconeModelManager;
  private contextManager: QdrantContextManager;
  private e2bRunner: E2BSandboxRunner;
  private daytonaRunner: DaytonaSandboxRunner;
  private mcpManager: MCPToolManager;
  private morphLoop: MorphHumanLoop;
  private workflow: StateGraph<CodingAgentState>;
  private app: any;

  constructor() {
    this.modelManager = new HeliconeModelManager();
    this.contextManager = new QdrantContextManager();
    this.e2bRunner = new E2BSandboxRunner();
    this.daytonaRunner = new DaytonaSandboxRunner();
    this.mcpManager = new MCPToolManager();
    this.morphLoop = new MorphHumanLoop();

    this.setupWorkflow();
  }

  private setupWorkflow() {
    const StateAnnotation = MessagesAnnotation.spec({
      currentFiles: {
        reducer: (x: string[], y: string[]) => [...(x || []), ...y],
        default: () => [],
      },
      contextEmbedding: {
        reducer: (x: number[] | undefined, y: number[] | undefined) => y || x,
        default: () => undefined,
      },
      pendingEdits: {
        reducer: (x: string[], y: string[]) => [...(x || []), ...y],
        default: () => [],
      },
      sandboxType: {
        reducer: (x: 'e2b' | 'daytona', y: 'e2b' | 'daytona') => y || x,
        default: () => 'e2b' as const,
      },
      humanApprovalRequired: {
        reducer: (x: boolean, y: boolean) => y !== undefined ? y : x,
        default: () => false,
      },
    });

    this.workflow = new StateGraph(StateAnnotation)
      .addNode('analyze_request', this.analyzeRequest.bind(this))
      .addNode('search_context', this.searchContext.bind(this))
      .addNode('generate_code', this.generateCode.bind(this))
      .addNode('execute_code', this.executeCode.bind(this))
      .addNode('human_review', this.humanReview.bind(this))
      .addNode('apply_changes', this.applyChanges.bind(this))
      .addEdge('__start__', 'analyze_request')
      .addConditionalEdges(
        'analyze_request',
        this.shouldSearchContext.bind(this),
        {
          'search': 'search_context',
          'generate': 'generate_code',
        }
      )
      .addEdge('search_context', 'generate_code')
      .addEdge('generate_code', 'execute_code')
      .addConditionalEdges(
        'execute_code',
        this.shouldRequireHumanReview.bind(this),
        {
          'review': 'human_review',
          'apply': 'apply_changes',
        }
      )
      .addEdge('human_review', 'apply_changes')
      .addEdge('apply_changes', '__end__');
  }

  async initialize() {
    await this.contextManager.initialize();
    await this.mcpManager.initializeServers();

    const checkpointer = new MemorySaver();
    this.app = this.workflow.compile({ checkpointer });
  }

  private async analyzeRequest(state: CodingAgentState) {
    const lastMessage = state.messages[state.messages.length - 1] as HumanMessage;
    const model = this.modelManager.getModel('gpt-4');

    const analysisPrompt = `
Analyze this coding request and determine what actions are needed:
"${lastMessage.content}"

Consider:
1. Does this require searching existing code context?
2. What files might be involved?
3. Is this a code generation, modification, or execution task?
4. What programming language is involved?

Respond with a JSON object containing your analysis.
    `;

    const response = await model.invoke([{ role: 'user', content: analysisPrompt }]);

    let analysis;
    try {
      analysis = JSON.parse(response.content);
    } catch {
      analysis = {
        requiresContext: true,
        files: [],
        task: 'generate',
        language: 'typescript',
      };
    }

    return {
      ...state,
      messages: [...state.messages, response],
      currentFiles: analysis.files || [],
    };
  }

  private shouldSearchContext(state: CodingAgentState): string {
    // Simple logic - can be enhanced
    const lastMessage = state.messages[state.messages.length - 1];
    if (lastMessage.content && typeof lastMessage.content === 'string') {
      if (lastMessage.content.toLowerCase().includes('file') ||
          lastMessage.content.toLowerCase().includes('existing')) {
        return 'search';
      }
    }
    return 'generate';
  }

  private async searchContext(state: CodingAgentState) {
    const lastMessage = state.messages[state.messages.length - 1] as HumanMessage;

    // Generate embedding for search query
    const model = this.modelManager.getModel('gpt-4');
    const embedding = await this.generateEmbedding(lastMessage.content.toString());

    // Search for relevant context
    const searchResults = await this.contextManager.searchContext(embedding, 5);

    const contextMessage = `Found relevant context:\n${
      searchResults.map(r =>
        `File: ${r.context.fileName}\nContent: ${r.context.content.substring(0, 500)}...\n---`
      ).join('\n')
    }`;

    return {
      ...state,
      messages: [...state.messages, new AIMessage(contextMessage)],
      contextEmbedding: embedding,
    };
  }

  private async generateCode(state: CodingAgentState) {
    const model = this.modelManager.getModel('gpt-4');

    const context = state.messages.slice(-3).map(m => m.content).join('\n');

    const codePrompt = `
Based on the following context and request, generate the appropriate code:

Context: ${context}

Current files: ${state.currentFiles.join(', ')}

Please provide:
1. The code solution
2. Explanation of changes
3. Files that need to be created/modified
4. Any dependencies or setup required

Format your response as a JSON object with these fields.
    `;

    const response = await model.invoke([{ role: 'user', content: codePrompt }]);

    return {
      ...state,
      messages: [...state.messages, response],
    };
  }

  private async executeCode(state: CodingAgentState) {
    const lastMessage = state.messages[state.messages.length - 1];
    let codeToExecute: any;

    try {
      codeToExecute = JSON.parse(lastMessage.content.toString());
    } catch {
      return {
        ...state,
        messages: [...state.messages, new AIMessage('Failed to parse generated code')],
      };
    }

    const sandboxRunner = state.sandboxType === 'e2b' ? this.e2bRunner : this.daytonaRunner;

    let results = [];

    if (codeToExecute.code) {
      const result = await sandboxRunner.executeCode(codeToExecute.code, codeToExecute.language);
      results.push(`Execution result: ${result.success ? 'Success' : 'Failed'}`);
      if (result.output) results.push(`Output: ${result.output}`);
      if (result.error) results.push(`Error: ${result.error}`);
    }

    if (codeToExecute.commands) {
      for (const command of codeToExecute.commands) {
        const result = await sandboxRunner.runTerminalCommand(command);
        results.push(`Command "${command}": ${result.success ? 'Success' : 'Failed'}`);
        if (result.output) results.push(`Output: ${result.output}`);
      }
    }

    const executionMessage = results.join('\n');

    return {
      ...state,
      messages: [...state.messages, new AIMessage(executionMessage)],
      humanApprovalRequired: codeToExecute.requiresApproval || false,
    };
  }

  private shouldRequireHumanReview(state: CodingAgentState): string {
    if (state.humanApprovalRequired) {
      return 'review';
    }
    return 'apply';
  }

  private async humanReview(state: CodingAgentState) {
    const lastMessage = state.messages[state.messages.length - 1];

    // This would integrate with your UI to show pending changes to user
    console.log('Human review required for:', lastMessage.content);

    // For demo purposes, we'll auto-approve
    // In practice, this would wait for human input
    const approved = true;

    const reviewMessage = approved ?
      'Changes approved by human reviewer' :
      'Changes rejected by human reviewer';

    return {
      ...state,
      messages: [...state.messages, new AIMessage(reviewMessage)],
    };
  }

  private async applyChanges(state: CodingAgentState) {
    const lastMessage = state.messages[state.messages.length - 1];

    // Apply file changes through MCP filesystem tools
    try {
      const filesystemResult = await this.mcpManager.callTool(
        'filesystem',
        'write_file',
        {
          path: 'output.js',
          content: 'console.log("Hello from coding agent!");',
        }
      );

      const finalMessage = 'Changes applied successfully to files.';

      return {
        ...state,
        messages: [...state.messages, new AIMessage(finalMessage)],
      };
    } catch (error) {
      return {
        ...state,
        messages: [...state.messages, new AIMessage(`Failed to apply changes: ${error.message}`)],
      };
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    // Use OpenAI embeddings through Helicone
    const model = this.modelManager.getModel('gpt-4');
    // This is a simplified version - you'd use actual embedding models
    return new Array(1536).fill(0).map(() => Math.random());
  }

  async runAgent(input: string, threadId: string = 'default') {
    const result = await this.app.invoke(
      { messages: [new HumanMessage(input)] },
      { configurable: { thread_id: threadId } }
    );

    return result;
  }

  async cleanup() {
    await this.e2bRunner.cleanup();
    await this.daytonaRunner.cleanup();
  }
}
```

## Usage Examples

### Basic Agent Usage

```typescript
// src/examples/basic-usage.ts
import { CodingAgent } from '../agent/coding-agent.js';

async function main() {
	const agent = new CodingAgent();
	await agent.initialize();

	try {
		const result = await agent.runAgent(
			'Create a TypeScript function that calculates the factorial of a number and includes unit tests',
			'session-1'
		);

		console.log('Agent response:', result.messages[result.messages.length - 1].content);
	} finally {
		await agent.cleanup();
	}
}

main().catch(console.error);
```

### File Context Management

```typescript
// src/examples/context-management.ts
import { CodingAgent } from '../agent/coding-agent.js';
import { QdrantContextManager } from '../memory/qdrant-manager.js';
import fs from 'fs';

async function addFileContext() {
	const contextManager = new QdrantContextManager();
	await contextManager.initialize();

	// Add current file to context
	const filePath = 'src/utils/helpers.ts';
	const content = fs.readFileSync(filePath, 'utf8');
	const embedding = new Array(1536).fill(0).map(() => Math.random()); // Replace with real embedding

	await contextManager.updateFileContext(filePath, content, embedding);

	const agent = new CodingAgent();
	await agent.initialize();

	const result = await agent.runAgent(
		'Modify the helpers.ts file to add a new utility function for date formatting',
		'context-session'
	);

	console.log(result);
}

addFileContext().catch(console.error);
```

## Configuration

### Advanced Configuration

```typescript
// src/config/agent-config.ts
export interface AgentConfig {
	models: {
		primary: string;
		fallback: string[];
	};
	sandbox: {
		type: 'e2b' | 'daytona';
		timeout: number;
	};
	context: {
		maxResults: number;
		similarityThreshold: number;
	};
	humanLoop: {
		required: boolean;
		timeout: number;
	};
}

export const defaultConfig: AgentConfig = {
	models: {
		primary: 'gpt-4',
		fallback: ['claude-3', 'gpt-3.5']
	},
	sandbox: {
		type: 'e2b',
		timeout: 30000
	},
	context: {
		maxResults: 5,
		similarityThreshold: 0.7
	},
	humanLoop: {
		required: false,
		timeout: 300000 // 5 minutes
	}
};
```

## Deployment

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY src/ src/
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# Start Qdrant
RUN docker pull qdrant/qdrant

# Expose port
EXPOSE 3000

CMD ["npm", "start"]
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'
services:
  qdrant:
    image: qdrant/qdrant
    ports:
      - '6333:6333'
      - '6334:6334'
    volumes:
      - ./qdrant_storage:/qdrant/storage

  coding-agent:
    build: .
    ports:
      - '3000:3000'
    environment:
      - QDRANT_URL=http://qdrant:6333
      - HELICONE_API_KEY=${HELICONE_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - E2B_API_KEY=${E2B_API_KEY}
    depends_on:
      - qdrant
    volumes:
      - ./workspace:/app/workspace
```

## Best Practices

### Error Handling

```typescript
// src/utils/error-handling.ts
export class AgentError extends Error {
	constructor(
		message: string,
		public code: string,
		public recoverable: boolean = false
	) {
		super(message);
		this.name = 'AgentError';
	}
}

export async function withRetry<T>(
	fn: () => Promise<T>,
	maxAttempts: number = 3,
	delay: number = 1000
): Promise<T> {
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await fn();
		} catch (error) {
			if (attempt === maxAttempts || !(error instanceof AgentError) || !error.recoverable) {
				throw error;
			}
			await new Promise((resolve) => setTimeout(resolve, delay * attempt));
		}
	}
	throw new Error('Retry logic failed');
}
```

### Security Considerations

1. **Sandbox Isolation**: Always run code in isolated environments
2. **API Key Management**: Use environment variables and secret management
3. **Input Validation**: Sanitize all inputs before processing
4. **File Access**: Limit filesystem access through MCP configuration
5. **Rate Limiting**: Implement proper rate limiting for all APIs

### Performance Optimization

1. **Context Caching**: Cache frequently used context in Qdrant
2. **Model Switching**: Use faster models for simple tasks
3. **Parallel Execution**: Run multiple sandbox operations concurrently
4. **Connection Pooling**: Reuse connections to external services

## Troubleshooting

### Common Issues

1. **Qdrant Connection Errors**
   - Check if Qdrant server is running
   - Verify connection URL and credentials

2. **Sandbox Timeout Issues**
   - Increase timeout values in configuration
   - Check sandbox resource limits

3. **MCP Server Failures**
   - Verify MCP server installations
   - Check environment variables and paths

4. **Helicone Rate Limits**
   - Implement exponential backoff
   - Use appropriate rate limiting

### Debugging

Enable debug logging:

```typescript
// Set environment variable
process.env.DEBUG = 'coding-agent:*';

// Or use winston logger
import winston from 'winston';

const logger = winston.createLogger({
	level: 'debug',
	format: winston.format.simple(),
	transports: [new winston.transports.Console()]
});
```

## Next Steps

1. **Extend Tool Integration**: Add more MCP servers for additional capabilities
2. **Custom Models**: Integrate domain-specific fine-tuned models
3. **Workflow Optimization**: Implement more sophisticated routing logic
4. **UI Development**: Build a web interface for human-in-the-loop interactions
5. **Monitoring**: Add comprehensive logging and monitoring
6. **Testing**: Implement comprehensive test suites for all components

This comprehensive guide provides a solid foundation for building sophisticated coding agents with LangGraph.js and the specified integrations.

## 4. Langraph Integration & Provider Adapters

Langraph in this repository provides a graph-based orchestration layer for composing LLM nodes, transforms, and sandbox runners into reusable workflows. The implementation is intentionally modular so that LLM provider adapters can be plugged in or swapped out without changing the orchestration code.

Key implementation files

- `src/lib/types/langraph.ts` — Domain types (Graph, Node, Edge, ModelDetail, ExecutionResult).
- `src/lib/services/langraph/models.loader.ts` — Loads model metadata from `src/lib/data/models.json` and exposes model lookups + endpoint selection.
- `src/lib/services/langraph/providers/*` — Provider adapter implementations and `provider.factory.ts` (registry).
- `src/lib/services/langraph/langraph.service.ts` — Graph repository, create/get/execute graph API.
- `src/routes/api/langraph/**` — HTTP endpoints for listing models, creating graphs, and executing graphs.

Provider adapters (current set)

- openai — Uses `LLMService` to call OpenAI (via Helicone when configured).
- anthropic — Uses `LLMService` to call Anthropic (via Helicone when configured).
- vertex — Mapped through `LLMService` (Vertex model ids forwarded to normalization layer).
- bedrock — Forwarded to `LLMService` (Bedrock-hosted model ids are forwarded and normalized).
- openrouter — Adapter created and registered; uses `LLMService` for execution.
- groq — Adapter created and registered; uses `LLMService` for execution.
- mock — Deterministic mock provider for local development and tests.

Environment variables required for provider adapters

- General / Helicone
  - HELICONE_API_KEY
  - HELICONE_CONTROL_PLANE_API_KEY (optional)

- OpenAI
  - OPENAI_API_KEY

- Anthropic
  - ANTHROPIC_API_KEY

- Google / Vertex
  - GOOGLE_API_KEY or GOOGLE_APPLICATION_CREDENTIALS (depending on SDK usage)

- AWS / Bedrock (if calling Bedrock SDK directly)
  - AWS_ACCESS_KEY_ID
  - AWS_SECRET_ACCESS_KEY
  - AWS_REGION

- OpenRouter
  - OPENROUTER_API_KEY

- Groq
  - GROQ_API_KEY

Note: The current Langraph adapters delegate to `LLMService`, which centralizes Helicone headers and provider selection. If `LLMService` cannot be constructed due to missing environment variables, provider adapters that call it will also fail — this is intentional so that credentials are discovered early.

How providers are registered

Provider adapters are registered in `src/lib/services/langraph/providers/provider.factory.ts`. The factory automatically registers the built-in adapters at startup. You can register a custom provider at runtime as follows:

```ts
import { ProviderFactory } from '$lib/services/langraph/providers/provider.factory';
import { MyDirectProvider } from '$lib/services/langraph/providers/my-direct.provider';

ProviderFactory.register('my-provider', new MyDirectProvider());
```

Implementing a direct SDK-based adapter (recommended when you want low-level control)

The repository ships with adapter classes that currently delegate to `LLMService`. For direct, SDK-based calls you should implement the `Provider` interface. Example pattern (Bedrock SDK pseudocode):

```ts
// src/lib/services/langraph/providers/bedrock.direct.provider.ts
import type { Provider, ProviderGenerateOptions } from './provider.interface';
import { BedrockClient, InvokeModelCommand } from '@aws-sdk/client-bedrock';

export class BedrockDirectProvider implements Provider {
	name = 'bedrock';

	private client = new BedrockClient({ region: process.env.AWS_REGION });

	async generate(opts: ProviderGenerateOptions) {
		const modelId = opts.endpoint?.endpoint?.providerModelId || opts.model.id;

		const payload = typeof opts.input === 'string' ? opts.input : JSON.stringify(opts.input);

		const cmd = new InvokeModelCommand({ ModelId: modelId, Input: payload /* map params */ });
		const resp = await this.client.send(cmd);

		// Extract text from provider response and return normalized object
		return { provider: this.name, modelId, text: resp?.Body || '', meta: resp };
	}
}
```

Steps to enable a direct SDK adapter

1. Add the provider SDK dependency (e.g. `npm i @aws-sdk/client-bedrock` or `npm i @google-cloud/aiplatform`).
2. Implement a `Provider` adapter under `src/lib/services/langraph/providers/`, following the `Provider` interface (method: `generate(options)`).
3. Register the adapter in `ProviderFactory.register('bedrock', new BedrockDirectProvider())` or swap the existing registration.
4. Ensure required environment variables / credentials are available in the runtime environment.

Using models.json for multi-model support

`src/lib/data/models.json` is the single source of truth for model metadata in this repository. Each model entry includes `id`, `endpoints` (with provider keys), pricing, and providerModelId fields. Langraph uses `ModelsLoader` to resolve which adapter and providerModelId to use for a given LLM node.

Example LLM node referencing a model endpoint (graph JSON):

```json
{
	"id": "llm-1",
	"type": "llm",
	"modelId": "claude-opus-4-1",
	"config": {
		"provider": "anthropic",
		"params": { "temperature": 0 }
	}
}
```

Testing & telemetry

- Unit tests should mock `LLMService` and verify that provider adapters call into it correctly or that direct SDK-based adapters call the provider SDK as expected.
- The `LLMService` already wires Helicone headers for observability. When implementing direct SDK adapters, mirror the observability headers and metadata that the Helicone gateway provides if you want consistent metrics.

Security & safety notes

- Avoid evaluating arbitrary code (no eval for transform/node code). The provided transforms are intentionally small and declarative.
- Credentials must be stored securely (use a secrets manager in production). Avoid checking API keys into source control.

Migration notes

- Swapping the in-memory `GraphRepository` for a persistent store is straightforward: implement the repository methods using your DB driver (e.g., Mongo, Postgres) and update `LangraphService` to use the new repository.
