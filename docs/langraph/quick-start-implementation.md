# LangGraph.js Coding Agent - Quick Start Implementation

This is a simplified implementation example to get you started quickly with the LangGraph.js coding agent.

## Installation

```bash
npm init -y
npm install @langchain/langgraph @langchain/core @langchain/openai @langchain/anthropic
npm install @qdrant/js-client-rest @e2b/code-interpreter uuid dotenv
npm install @modelcontextprotocol/sdk @modelcontextprotocol/server-filesystem
```

## Basic Setup

### 1. Environment Configuration (.env)

```env
# Helicone AI Gateway
HELICONE_API_KEY=sk-helicone-your-api-key

# LLM Provider Keys
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key

# Qdrant Vector Database
QDRANT_URL=http://localhost:6333

# E2B Sandbox
E2B_API_KEY=your-e2b-api-key

# Morph (Optional)
MORPH_API_KEY=your-morph-api-key
```

### 2. Quick Start Implementation (app.ts)

````typescript
import dotenv from 'dotenv';
import { StateGraph, MessagesAnnotation } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { QdrantClient } from '@qdrant/js-client-rest';
import { CodeInterpreter } from '@e2b/code-interpreter';

dotenv.config();

// Simple state interface extending MessagesAnnotation
const AgentState = MessagesAnnotation.spec({
	currentTask: {
		reducer: (x: string, y: string) => y || x,
		default: () => ''
	},
	codeGenerated: {
		reducer: (x: boolean, y: boolean) => (y !== undefined ? y : x),
		default: () => false
	}
});

class SimpleCodingAgent {
	private model: ChatOpenAI;
	private qdrant: QdrantClient;
	private sandbox: CodeInterpreter | null = null;

	constructor() {
		// Initialize Helicone-enabled model
		this.model = new ChatOpenAI({
			modelName: 'gpt-4',
			temperature: 0.1,
			configuration: {
				baseURL: 'https://oai.helicone.ai/v1',
				defaultHeaders: {
					'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`,
					'Helicone-Cache-Enabled': 'true'
				}
			}
		});

		// Initialize Qdrant client
		this.qdrant = new QdrantClient({
			host: 'localhost',
			port: 6333
		});
	}

	async initialize() {
		// Initialize E2B sandbox
		this.sandbox = await CodeInterpreter.create({
			apiKey: process.env.E2B_API_KEY
		});

		// Setup Qdrant collection
		try {
			await this.qdrant.createCollection('agent_context', {
				vectors: { size: 1536, distance: 'Cosine' }
			});
		} catch (error) {
			// Collection might already exist
		}
	}

	// Agent workflow nodes
	private async analyzeTask(state: typeof AgentState.State) {
		const lastMessage = state.messages[state.messages.length - 1] as HumanMessage;

		const prompt = `Analyze this coding request and create a plan:
    "${lastMessage.content}"
    
    Provide a brief analysis of what needs to be done.`;

		const response = await this.model.invoke([{ role: 'user', content: prompt }]);

		return {
			...state,
			messages: [...state.messages, response],
			currentTask: lastMessage.content
		};
	}

	private async generateCode(state: typeof AgentState.State) {
		const prompt = `Based on the task: "${state.currentTask}"
    
    Generate the appropriate code solution. Include:
    1. The main code
    2. Any necessary imports
    3. Brief explanation
    
    Provide clean, working code.`;

		const response = await this.model.invoke([{ role: 'user', content: prompt }]);

		return {
			...state,
			messages: [...state.messages, response],
			codeGenerated: true
		};
	}

	private async executeCode(state: typeof AgentState.State) {
		const lastMessage = state.messages[state.messages.length - 1];
		const codeContent = lastMessage.content;

		if (!this.sandbox) {
			return {
				...state,
				messages: [...state.messages, new AIMessage('Sandbox not available')]
			};
		}

		try {
			// Extract code from the message (simplified extraction)
			const codeMatch = codeContent.match(/```(?:python|javascript|typescript)?\n([\s\S]*?)```/);
			const code = codeMatch ? codeMatch[1] : codeContent;

			const execution = await this.sandbox.notebook.execCell(code);

			const resultMessage = `Code execution result:
      Output: ${execution.text || 'No output'}
      ${execution.error ? `Error: ${execution.error}` : ''}`;

			return {
				...state,
				messages: [...state.messages, new AIMessage(resultMessage)]
			};
		} catch (error) {
			return {
				...state,
				messages: [...state.messages, new AIMessage(`Execution failed: ${error.message}`)]
			};
		}
	}

	// Conditional edge function
	private shouldExecute(state: typeof AgentState.State): string {
		if (state.codeGenerated) {
			return 'execute';
		}
		return '__end__';
	}

	async createWorkflow() {
		const workflow = new StateGraph(AgentState)
			.addNode('analyze', this.analyzeTask.bind(this))
			.addNode('generate', this.generateCode.bind(this))
			.addNode('execute', this.executeCode.bind(this))
			.addEdge('__start__', 'analyze')
			.addEdge('analyze', 'generate')
			.addConditionalEdges('generate', this.shouldExecute.bind(this), {
				execute: 'execute',
				__end__: '__end__'
			})
			.addEdge('execute', '__end__');

		return workflow.compile();
	}

	async cleanup() {
		if (this.sandbox) {
			await this.sandbox.close();
		}
	}
}

// Usage example
async function main() {
	const agent = new SimpleCodingAgent();
	await agent.initialize();

	const app = await agent.createWorkflow();

	try {
		// Example 1: Simple calculation
		console.log('=== Example 1: Math Calculation ===');
		const result1 = await app.invoke({
			messages: [
				new HumanMessage(
					'Create a Python function to calculate fibonacci numbers and test it with n=10'
				)
			]
		});

		console.log('Final response:', result1.messages[result1.messages.length - 1].content);

		// Example 2: Data analysis
		console.log('\n=== Example 2: Data Analysis ===');
		const result2 = await app.invoke({
			messages: [
				new HumanMessage(
					'Create a Python script to analyze a list of numbers [1,5,3,8,2,9,4] and show mean, median, and standard deviation'
				)
			]
		});

		console.log('Final response:', result2.messages[result2.messages.length - 1].content);
	} finally {
		await agent.cleanup();
	}
}

// Enhanced version with MCP integration
class EnhancedCodingAgent extends SimpleCodingAgent {
	private mcpTools: Map<string, any> = new Map();

	async initializeMCP() {
		// Simulate MCP filesystem tool
		this.mcpTools.set('filesystem', {
			readFile: async (path: string) => {
				// In real implementation, this would use MCP filesystem server
				return `// Content of ${path}`;
			},
			writeFile: async (path: string, content: string) => {
				console.log(`Writing to ${path}: ${content.substring(0, 100)}...`);
				return true;
			},
			searchFiles: async (pattern: string) => {
				return [`example1.${pattern}`, `example2.${pattern}`];
			}
		});

		this.mcpTools.set('websearch', {
			search: async (query: string) => {
				// In real implementation, this would use web search MCP server
				return [
					{
						title: `Result for ${query}`,
						url: 'https://example.com',
						snippet: `Information about ${query}`
					}
				];
			}
		});
	}

	private async searchDocumentation(state: typeof AgentState.State) {
		const task = state.currentTask;

		// Use MCP web search tool
		const searchTool = this.mcpTools.get('websearch');
		const searchResults = await searchTool.search(task);

		const contextMessage = `Found documentation:
    ${searchResults.map((r: any) => `- ${r.title}: ${r.snippet}`).join('\n')}`;

		return {
			...state,
			messages: [...state.messages, new AIMessage(contextMessage)]
		};
	}

	private async saveToFile(state: typeof AgentState.State) {
		const lastMessage = state.messages[state.messages.length - 1];
		const codeContent = lastMessage.content;

		// Extract code and save using MCP filesystem tool
		const codeMatch = codeContent.match(/```(?:python|javascript|typescript)?\n([\s\S]*?)```/);
		if (codeMatch) {
			const code = codeMatch[1];
			const filename = `generated_code_${Date.now()}.py`;

			const filesystemTool = this.mcpTools.get('filesystem');
			await filesystemTool.writeFile(filename, code);

			return {
				...state,
				messages: [...state.messages, new AIMessage(`Code saved to ${filename}`)]
			};
		}

		return state;
	}

	async createEnhancedWorkflow() {
		await this.initializeMCP();

		const workflow = new StateGraph(AgentState)
			.addNode('analyze', this.analyzeTask.bind(this))
			.addNode('search_docs', this.searchDocumentation.bind(this))
			.addNode('generate', this.generateCode.bind(this))
			.addNode('execute', this.executeCode.bind(this))
			.addNode('save', this.saveToFile.bind(this))
			.addEdge('__start__', 'analyze')
			.addEdge('analyze', 'search_docs')
			.addEdge('search_docs', 'generate')
			.addEdge('generate', 'execute')
			.addEdge('execute', 'save')
			.addEdge('save', '__end__');

		return workflow.compile();
	}
}

// Run enhanced example
async function enhancedExample() {
	const agent = new EnhancedCodingAgent();
	await agent.initialize();

	const app = await agent.createEnhancedWorkflow();

	try {
		console.log('=== Enhanced Agent with MCP Integration ===');
		const result = await app.invoke({
			messages: [
				new HumanMessage(
					'Create a TypeScript class for managing a todo list with add, remove, and list methods'
				)
			]
		});

		// Print all messages to see the full workflow
		result.messages.forEach((msg: any, index: number) => {
			console.log(`\n--- Step ${index + 1} ---`);
			console.log(`${msg.constructor.name}: ${msg.content}`);
		});
	} finally {
		await agent.cleanup();
	}
}

// Human-in-the-loop example
class HumanLoopAgent extends EnhancedCodingAgent {
	private pendingReviews: Map<string, any> = new Map();

	private async requestHumanReview(state: typeof AgentState.State) {
		const lastMessage = state.messages[state.messages.length - 1];

		// In a real implementation, this would integrate with Morph or similar UI
		console.log('\n🔍 HUMAN REVIEW REQUIRED:');
		console.log('Generated code:', lastMessage.content);
		console.log('\nOptions: [approve/modify/reject]');

		// For demo purposes, auto-approve after showing the request
		const reviewId = `review_${Date.now()}`;
		this.pendingReviews.set(reviewId, {
			content: lastMessage.content,
			approved: true, // In reality, this would come from user input
			modifications: null
		});

		const reviewResult = this.pendingReviews.get(reviewId);
		const statusMessage = reviewResult.approved
			? '✅ Code approved by human reviewer'
			: '❌ Code rejected by human reviewer';

		return {
			...state,
			messages: [...state.messages, new AIMessage(statusMessage)]
		};
	}

	async createHumanLoopWorkflow() {
		await this.initializeMCP();

		const workflow = new StateGraph(AgentState)
			.addNode('analyze', this.analyzeTask.bind(this))
			.addNode('generate', this.generateCode.bind(this))
			.addNode('human_review', this.requestHumanReview.bind(this))
			.addNode('execute', this.executeCode.bind(this))
			.addEdge('__start__', 'analyze')
			.addEdge('analyze', 'generate')
			.addEdge('generate', 'human_review')
			.addEdge('human_review', 'execute')
			.addEdge('execute', '__end__');

		return workflow.compile();
	}
}

// Choose which example to run
if (require.main === module) {
	// Run basic example
	// main().catch(console.error);

	// Run enhanced example with MCP
	// enhancedExample().catch(console.error);

	// Run human-in-the-loop example
	(async () => {
		const agent = new HumanLoopAgent();
		await agent.initialize();
		const app = await agent.createHumanLoopWorkflow();

		try {
			const result = await app.invoke({
				messages: [
					new HumanMessage(
						'Write a Python function to sort a list of dictionaries by a specific key'
					)
				]
			});

			result.messages.forEach((msg: any, index: number) => {
				console.log(`\n--- Step ${index + 1} ---`);
				console.log(`${msg.constructor.name}: ${msg.content}`);
			});
		} finally {
			await agent.cleanup();
		}
	})().catch(console.error);
}

export { SimpleCodingAgent, EnhancedCodingAgent, HumanLoopAgent };
````

## Package.json

```json
{
	"name": "langgraph-coding-agent",
	"version": "1.0.0",
	"type": "module",
	"scripts": {
		"start": "tsx app.ts",
		"dev": "tsx --watch app.ts",
		"build": "tsc"
	},
	"dependencies": {
		"@langchain/langgraph": "^0.2.0",
		"@langchain/core": "^0.3.0",
		"@langchain/openai": "^0.3.0",
		"@langchain/anthropic": "^0.3.0",
		"@qdrant/js-client-rest": "^1.9.0",
		"@e2b/code-interpreter": "^0.0.5",
		"@modelcontextprotocol/sdk": "^0.1.0",
		"uuid": "^10.0.0",
		"dotenv": "^16.4.0"
	},
	"devDependencies": {
		"@types/node": "^20.0.0",
		"@types/uuid": "^10.0.0",
		"tsx": "^4.0.0",
		"typescript": "^5.0.0"
	}
}
```

## Running the Agent

1. **Start Qdrant** (in separate terminal):

```bash
docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant
```

2. **Run the agent**:

```bash
npm start
```

## Next Steps

This quick start demonstrates the basic structure. To build the full implementation:

1. **Add proper error handling and retries**
2. **Implement real MCP server connections**
3. **Add Morph integration for human feedback**
4. **Enhance context management with embeddings**
5. **Add support for multiple file operations**
6. **Implement proper logging and monitoring**

The complete implementation is available in the main documentation file.
