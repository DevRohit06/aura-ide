Perfect! I'll create comprehensive documentation for integrating MongoDB for chat history and memory in your LangGraph.js coding agent.[1][2][3]

## MongoDB Integration for Chat History & Memory

MongoDB provides two complementary memory systems for LangGraph: **short-term memory** (checkpointers for conversation threads) and **long-term memory** (cross-thread knowledge storage).[2][1]

### Installation

```bash
# MongoDB client and LangChain integrations
npm install mongodb
npm install @langchain/mongodb

# For TypeScript types
npm install -D @types/mongodb
```

### Environment Variables Update

```bash
# Add to .env
MONGODB_URI=mongodb://localhost:27017
# Or MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority

MONGODB_DB_NAME=coding_agent
```

### MongoDB Schema Design

**File:** `src/lib/db/schemas.ts`

```typescript
// Chat Sessions Collection
export interface ChatSession {
	_id: string; // thread_id
	userId: string;
	title: string;
	createdAt: Date;
	updatedAt: Date;
	metadata: {
		sandboxId?: string;
		sandboxType?: 'daytona' | 'e2b';
		currentFile?: string;
		modelUsed?: string;
		tags?: string[];
	};
	settings: {
		useMorph: boolean;
		modelConfig: {
			provider: string;
			model: string;
		};
	};
}

// Chat Messages Collection
export interface ChatMessage {
	_id: string;
	threadId: string;
	userId: string;
	role: 'user' | 'assistant' | 'system' | 'tool';
	content: string;
	timestamp: Date;
	metadata?: {
		toolCalls?: any[];
		modelUsed?: string;
		tokensUsed?: number;
		processingTime?: number;
	};
}

// LangGraph Checkpoints Collection (managed by LangGraph)
export interface Checkpoint {
	thread_id: string;
	checkpoint_ns: string;
	checkpoint_id: string;
	parent_checkpoint_id?: string;
	type: string;
	checkpoint: any; // Graph state snapshot
	metadata: any;
	created_at: Date;
}

// Long-term Memory Store Collection
export interface LongTermMemory {
	_id: string;
	userId: string;
	namespace: string; // e.g., "user_preferences", "code_patterns", "errors_encountered"
	key: string;
	value: any; // JSON document
	embedding?: number[]; // For vector search
	createdAt: Date;
	updatedAt: Date;
	expiresAt?: Date; // TTL for automatic cleanup
	metadata?: {
		source?: string;
		confidence?: number;
		usageCount?: number;
	};
}

// Agent Interactions Log
export interface AgentInteraction {
	_id: string;
	threadId: string;
	userId: string;
	interactionType: 'code_edit' | 'file_read' | 'command_execution' | 'search' | 'error';
	details: any;
	timestamp: Date;
	success: boolean;
	errorMessage?: string;
}
```

### MongoDB Connection Manager

**File:** `src/lib/db/mongodb.ts`

```typescript
import { MongoClient, Db } from 'mongodb';
import { MONGODB_URI, MONGODB_DB_NAME } from '$env/static/private';

class MongoDBManager {
	private client: MongoClient | null = null;
	private db: Db | null = null;
	private static instance: MongoDBManager;

	private constructor() {}

	static getInstance(): MongoDBManager {
		if (!MongoDBManager.instance) {
			MongoDBManager.instance = new MongoDBManager();
		}
		return MongoDBManager.instance;
	}

	async connect(): Promise<Db> {
		if (this.db) {
			return this.db;
		}

		try {
			this.client = new MongoClient(MONGODB_URI, {
				maxPoolSize: 10,
				minPoolSize: 5,
				serverSelectionTimeoutMS: 5000
			});

			await this.client.connect();
			this.db = this.client.db(MONGODB_DB_NAME);

			// Create indexes
			await this.createIndexes();

			console.log('✅ Connected to MongoDB');
			return this.db;
		} catch (error) {
			console.error('❌ MongoDB connection error:', error);
			throw error;
		}
	}

	private async createIndexes() {
		if (!this.db) return;

		// Chat sessions indexes
		await this.db
			.collection('chat_sessions')
			.createIndexes([
				{ key: { userId: 1, createdAt: -1 } },
				{ key: { updatedAt: -1 } },
				{ key: { 'metadata.tags': 1 } }
			]);

		// Chat messages indexes
		await this.db
			.collection('chat_messages')
			.createIndexes([
				{ key: { threadId: 1, timestamp: 1 } },
				{ key: { userId: 1, timestamp: -1 } },
				{ key: { role: 1 } }
			]);

		// Checkpoints indexes
		await this.db
			.collection('checkpoints')
			.createIndexes([
				{ key: { thread_id: 1, checkpoint_ns: 1 } },
				{ key: { checkpoint_id: 1 }, unique: true },
				{ key: { parent_checkpoint_id: 1 } },
				{ key: { created_at: -1 } }
			]);

		// Long-term memory indexes
		await this.db.collection('long_term_memory').createIndexes([
			{ key: { userId: 1, namespace: 1, key: 1 }, unique: true },
			{ key: { expiresAt: 1 }, expireAfterSeconds: 0 }, // TTL index
			{ key: { 'metadata.usageCount': -1 } }
		]);

		// Agent interactions indexes
		await this.db
			.collection('agent_interactions')
			.createIndexes([
				{ key: { threadId: 1, timestamp: -1 } },
				{ key: { userId: 1, interactionType: 1 } },
				{ key: { timestamp: -1 } }
			]);
	}

	getDb(): Db {
		if (!this.db) {
			throw new Error('Database not connected. Call connect() first.');
		}
		return this.db;
	}

	async disconnect() {
		if (this.client) {
			await this.client.close();
			this.client = null;
			this.db = null;
			console.log('MongoDB disconnected');
		}
	}
}

export const mongoManager = MongoDBManager.getInstance();
export const getDatabase = () => mongoManager.getDb();
```

### MongoDB Checkpointer for LangGraph

**File:** `src/lib/agent/mongodb-checkpointer.ts`

```typescript
import { BaseCheckpointSaver, Checkpoint, CheckpointMetadata } from '@langchain/langgraph';
import { RunnableConfig } from '@langchain/core/runnables';
import { getDatabase } from '$lib/db/mongodb';
import type { Collection } from 'mongodb';

export class MongoDBSaver extends BaseCheckpointSaver {
	private collection: Collection;

	constructor(collectionName: string = 'checkpoints') {
		super();
		this.collection = getDatabase().collection(collectionName);
	}

	async getTuple(config: RunnableConfig): Promise<any> {
		const threadId = config.configurable?.thread_id;
		const checkpointNs = config.configurable?.checkpoint_ns || '';

		if (!threadId) {
			return undefined;
		}

		const doc = await this.collection.findOne(
			{ thread_id: threadId, checkpoint_ns: checkpointNs },
			{ sort: { created_at: -1 } }
		);

		if (!doc) {
			return undefined;
		}

		return {
			config: {
				configurable: {
					thread_id: doc.thread_id,
					checkpoint_ns: doc.checkpoint_ns,
					checkpoint_id: doc.checkpoint_id
				}
			},
			checkpoint: doc.checkpoint,
			metadata: doc.metadata,
			parentConfig: doc.parent_checkpoint_id
				? {
						configurable: {
							thread_id: doc.thread_id,
							checkpoint_ns: doc.checkpoint_ns,
							checkpoint_id: doc.parent_checkpoint_id
						}
					}
				: undefined
		};
	}

	async *list(config: RunnableConfig, limit?: number): AsyncGenerator<any> {
		const threadId = config.configurable?.thread_id;
		const checkpointNs = config.configurable?.checkpoint_ns || '';

		if (!threadId) {
			return;
		}

		const query = { thread_id: threadId, checkpoint_ns: checkpointNs };
		const cursor = this.collection
			.find(query)
			.sort({ created_at: -1 })
			.limit(limit || 10);

		for await (const doc of cursor) {
			yield {
				config: {
					configurable: {
						thread_id: doc.thread_id,
						checkpoint_ns: doc.checkpoint_ns,
						checkpoint_id: doc.checkpoint_id
					}
				},
				checkpoint: doc.checkpoint,
				metadata: doc.metadata,
				parentConfig: doc.parent_checkpoint_id
					? {
							configurable: {
								thread_id: doc.thread_id,
								checkpoint_ns: doc.checkpoint_ns,
								checkpoint_id: doc.parent_checkpoint_id
							}
						}
					: undefined
			};
		}
	}

	async put(
		config: RunnableConfig,
		checkpoint: Checkpoint,
		metadata: CheckpointMetadata
	): Promise<RunnableConfig> {
		const threadId = config.configurable?.thread_id;
		const checkpointNs = config.configurable?.checkpoint_ns || '';
		const checkpointId = checkpoint.id;

		if (!threadId) {
			throw new Error('thread_id is required in config.configurable');
		}

		await this.collection.insertOne({
			thread_id: threadId,
			checkpoint_ns: checkpointNs,
			checkpoint_id: checkpointId,
			parent_checkpoint_id: config.configurable?.checkpoint_id,
			type: checkpoint.type || 'checkpoint',
			checkpoint: checkpoint,
			metadata: metadata,
			created_at: new Date()
		});

		return {
			configurable: {
				thread_id: threadId,
				checkpoint_ns: checkpointNs,
				checkpoint_id: checkpointId
			}
		};
	}
}
```

### Chat History Manager

**File:** `src/lib/db/chat-history.ts`

```typescript
import { MongoDBChatMessageHistory } from '@langchain/mongodb';
import { getDatabase } from './mongodb';
import type { ChatSession, ChatMessage } from './schemas';
import { ObjectId } from 'mongodb';

export class ChatHistoryManager {
	private db = getDatabase();

	// Create new chat session
	async createSession(
		userId: string,
		title: string = 'New Chat',
		settings?: Partial<ChatSession['settings']>
	): Promise<string> {
		const session: ChatSession = {
			_id: new ObjectId().toString(),
			userId,
			title,
			createdAt: new Date(),
			updatedAt: new Date(),
			metadata: {},
			settings: {
				useMorph: false,
				modelConfig: {
					provider: 'openai',
					model: 'gpt-4o'
				},
				...settings
			}
		};

		await this.db.collection('chat_sessions').insertOne(session);
		return session._id;
	}

	// Get session by ID
	async getSession(threadId: string): Promise<ChatSession | null> {
		return await this.db.collection<ChatSession>('chat_sessions').findOne({ _id: threadId });
	}

	// List user sessions
	async listSessions(userId: string, limit: number = 50): Promise<ChatSession[]> {
		return await this.db
			.collection<ChatSession>('chat_sessions')
			.find({ userId })
			.sort({ updatedAt: -1 })
			.limit(limit)
			.toArray();
	}

	// Update session
	async updateSession(threadId: string, updates: Partial<ChatSession>): Promise<void> {
		await this.db.collection('chat_sessions').updateOne(
			{ _id: threadId },
			{
				$set: {
					...updates,
					updatedAt: new Date()
				}
			}
		);
	}

	// Delete session and all messages
	async deleteSession(threadId: string): Promise<void> {
		await Promise.all([
			this.db.collection('chat_sessions').deleteOne({ _id: threadId }),
			this.db.collection('chat_messages').deleteMany({ threadId }),
			this.db.collection('checkpoints').deleteMany({ thread_id: threadId }),
			this.db.collection('agent_interactions').deleteMany({ threadId })
		]);
	}

	// Get chat messages for a session
	async getMessages(threadId: string, limit?: number): Promise<ChatMessage[]> {
		const query = this.db
			.collection<ChatMessage>('chat_messages')
			.find({ threadId })
			.sort({ timestamp: 1 });

		if (limit) {
			query.limit(limit);
		}

		return await query.toArray();
	}

	// Add message to session
	async addMessage(message: Omit<ChatMessage, '_id'>): Promise<string> {
		const messageId = new ObjectId().toString();
		const fullMessage: ChatMessage = {
			_id: messageId,
			...message,
			timestamp: new Date()
		};

		await this.db.collection('chat_messages').insertOne(fullMessage);

		// Update session's updatedAt
		await this.updateSession(message.threadId, {});

		return messageId;
	}

	// Get MongoDB chat message history for LangChain
	getChatMessageHistory(threadId: string): MongoDBChatMessageHistory {
		return new MongoDBChatMessageHistory({
			collection: this.db.collection('chat_messages'),
			sessionId: threadId
		});
	}

	// Search messages
	async searchMessages(userId: string, query: string, limit: number = 20): Promise<ChatMessage[]> {
		return await this.db
			.collection<ChatMessage>('chat_messages')
			.find({
				userId,
				$text: { $search: query }
			})
			.limit(limit)
			.toArray();
	}

	// Get session statistics
	async getSessionStats(threadId: string) {
		const [messageCount, interactions] = await Promise.all([
			this.db.collection('chat_messages').countDocuments({ threadId }),
			this.db
				.collection('agent_interactions')
				.aggregate([
					{ $match: { threadId } },
					{
						$group: {
							_id: '$interactionType',
							count: { $sum: 1 }
						}
					}
				])
				.toArray()
		]);

		return {
			messageCount,
			interactions: Object.fromEntries(interactions.map((i) => [i._id, i.count]))
		};
	}
}

export const chatHistory = new ChatHistoryManager();
```

### Long-term Memory Store

**File:** `src/lib/db/memory-store.ts`

```typescript
import { getDatabase } from './mongodb';
import type { LongTermMemory } from './schemas';
import { OpenAIEmbeddings } from '@langchain/openai';

export class LongTermMemoryStore {
	private db = getDatabase();
	private embeddings = new OpenAIEmbeddings({ model: 'text-embedding-3-small' });

	// Store a memory
	async put(
		userId: string,
		namespace: string,
		key: string,
		value: any,
		options?: {
			ttlDays?: number;
			metadata?: any;
			generateEmbedding?: boolean;
		}
	): Promise<void> {
		const memory: LongTermMemory = {
			_id: `${userId}:${namespace}:${key}`,
			userId,
			namespace,
			key,
			value,
			createdAt: new Date(),
			updatedAt: new Date(),
			metadata: options?.metadata
		};

		// Generate embedding for semantic search
		if (options?.generateEmbedding) {
			const text = typeof value === 'string' ? value : JSON.stringify(value);
			memory.embedding = await this.embeddings.embedQuery(text);
		}

		// Set expiration
		if (options?.ttlDays) {
			memory.expiresAt = new Date(Date.now() + options.ttlDays * 24 * 60 * 60 * 1000);
		}

		await this.db
			.collection('long_term_memory')
			.updateOne(
				{ _id: memory._id },
				{ $set: memory, $inc: { 'metadata.usageCount': 1 } },
				{ upsert: true }
			);
	}

	// Retrieve a memory
	async get(userId: string, namespace: string, key: string): Promise<any> {
		const memory = await this.db.collection<LongTermMemory>('long_term_memory').findOne({
			_id: `${userId}:${namespace}:${key}`
		});

		if (!memory) return null;

		// Increment usage count
		await this.db
			.collection('long_term_memory')
			.updateOne({ _id: memory._id }, { $inc: { 'metadata.usageCount': 1 } });

		return memory.value;
	}

	// Search memories by namespace
	async search(userId: string, namespace: string, filter?: any): Promise<LongTermMemory[]> {
		const query = { userId, namespace, ...filter };
		return await this.db.collection<LongTermMemory>('long_term_memory').find(query).toArray();
	}

	// Semantic search using embeddings
	async semanticSearch(
		userId: string,
		namespace: string,
		query: string,
		limit: number = 5
	): Promise<LongTermMemory[]> {
		// Generate query embedding
		const queryEmbedding = await this.embeddings.embedQuery(query);

		// Use MongoDB Atlas Vector Search (if available)
		// This requires Atlas with vector search index configured
		const pipeline = [
			{
				$search: {
					index: 'memory_vector_index',
					knnBeta: {
						vector: queryEmbedding,
						path: 'embedding',
						k: limit,
						filter: { userId, namespace }
					}
				}
			},
			{ $limit: limit }
		];

		return await this.db
			.collection<LongTermMemory>('long_term_memory')
			.aggregate(pipeline)
			.toArray();
	}

	// Delete a memory
	async delete(userId: string, namespace: string, key: string): Promise<void> {
		await this.db.collection('long_term_memory').deleteOne({
			_id: `${userId}:${namespace}:${key}`
		});
	}

	// Store user preferences
	async storeUserPreference(userId: string, key: string, value: any) {
		return this.put(userId, 'user_preferences', key, value, { ttlDays: 365 });
	}

	// Get user preferences
	async getUserPreference(userId: string, key: string) {
		return this.get(userId, 'user_preferences', key);
	}

	// Store learned code patterns
	async storeCodePattern(userId: string, pattern: any) {
		const key = `pattern_${Date.now()}`;
		return this.put(userId, 'code_patterns', key, pattern, {
			generateEmbedding: true,
			metadata: { type: 'code_pattern' }
		});
	}

	// Find similar code patterns
	async findSimilarPatterns(userId: string, query: string, limit: number = 3) {
		return this.semanticSearch(userId, 'code_patterns', query, limit);
	}
}

export const memoryStore = new LongTermMemoryStore();
```

### Updated Agent Graph with MongoDB

**File:** `src/lib/agent/graph.ts` (updated)

```typescript
import { StateGraph } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { interrupt, Command } from '@langchain/langgraph';
import { AgentState } from './state';
import { tools } from './tools';
import { modelManager } from './model-manager';
import { MongoDBSaver } from './mongodb-checkpointer';
import { memoryStore } from '$lib/db/memory-store';
import { chatHistory } from '$lib/db/chat-history';

// Tool execution node
const toolNode = new ToolNode(tools);

// Agent reasoning node with memory integration
async function agentNode(state: typeof AgentState.State) {
	const model = modelManager.getModel(state.modelConfig);
	const modelWithTools = model.bindTools(tools);

	// Retrieve relevant long-term memories
	const userId = state.messages[0]?.additional_kwargs?.userId || 'default';
	const userPreferences = await memoryStore.getUserPreference(userId, 'coding_style');
	const similarPatterns = state.currentFile
		? await memoryStore.findSimilarPatterns(userId, state.fileContent || '', 3)
		: [];

	const systemPrompt = `You are an expert coding assistant with access to:
- A sandbox environment (${state.sandboxType}) with file operations
- Terminal command execution
- Web search via Tavily for documentation
- Semantic code search via Qdrant
- Current file context: ${state.currentFile || 'None'}
- Model: ${state.modelConfig.provider}/${state.modelConfig.model}

User Preferences: ${JSON.stringify(userPreferences) || 'None'}

Similar Code Patterns from past sessions:
${similarPatterns.map((p, i) => `${i + 1}. ${JSON.stringify(p.value)}`).join('\n')}

Current file content:
${state.fileContent || 'No file currently open'}

Code context from vector search:
${state.codeContext.join('\n\n')}

Recent terminal output:
${state.terminalOutput.slice(-3).join('\n')}

Use tools strategically and remember to learn from user interactions.`;

	const messages = [{ role: 'system', content: systemPrompt }, ...state.messages];

	const response = await modelWithTools.invoke(messages);

	// Log interaction
	const threadId = state.messages[0]?.additional_kwargs?.threadId;
	if (threadId) {
		await chatHistory.addMessage({
			threadId,
			userId,
			role: 'assistant',
			content: response.content as string,
			metadata: {
				modelUsed: `${state.modelConfig.provider}/${state.modelConfig.model}`,
				toolCalls: response.tool_calls
			}
		});
	}

	const usage = {
		provider: state.modelConfig.provider,
		model: state.modelConfig.model,
		timestamp: Date.now()
	};

	return {
		messages: [response],
		modelUsageHistory: [usage]
	};
}

// Human review node (same as before)
async function humanReviewNode(state: typeof AgentState.State): Promise<Command> {
	const lastMessage = state.messages[state.messages.length - 1] as AIMessage;

	const hasCodeModification = lastMessage.tool_calls?.some((tc) =>
		['write_file', 'execute_code', 'run_terminal_command'].includes(tc.name)
	);

	if (hasCodeModification) {
		const approval = interrupt({
			type: 'human_review',
			message: 'Review the proposed changes',
			toolCalls: lastMessage.tool_calls,
			currentState: {
				file: state.currentFile,
				content: state.fileContent,
				model: `${state.modelConfig.provider}/${state.modelConfig.model}`
			}
		});

		if (approval.action === 'approved') {
			return new Command({ goto: 'tools' });
		} else if (approval.action === 'rejected') {
			return new Command({ goto: 'agent' });
		} else if (approval.action === 'edit') {
			return new Command({
				goto: 'agent',
				update: {
					messages: [new HumanMessage(`Please apply these edits instead: ${approval.edits}`)]
				}
			});
		}
	}

	return new Command({ goto: 'tools' });
}

function shouldContinue(state: typeof AgentState.State) {
	const lastMessage = state.messages[state.messages.length - 1] as AIMessage;

	if (lastMessage.tool_calls?.length) {
		return 'review';
	}
	return '__end__';
}

// Build the graph with MongoDB checkpointer
const workflow = new StateGraph(AgentState)
	.addNode('agent', agentNode)
	.addNode('review', humanReviewNode)
	.addNode('tools', toolNode)
	.addEdge('__start__', 'agent')
	.addConditionalEdges('agent', shouldContinue)
	.addEdge('tools', 'agent');

// Compile with MongoDB checkpointer
const checkpointer = new MongoDBSaver('checkpoints');
export const agentGraph = workflow.compile({ checkpointer });
```

### SvelteKit API Routes for Chat Management

**File:** `src/routes/api/chat/sessions/+server.ts`

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { chatHistory } from '$lib/db/chat-history';

// List user sessions
export const GET: RequestHandler = async ({ url, locals }) => {
	const userId = locals.user?.id || 'default';
	const limit = parseInt(url.searchParams.get('limit') || '50');

	const sessions = await chatHistory.listSessions(userId, limit);

	return json({ sessions });
};

// Create new session
export const POST: RequestHandler = async ({ request, locals }) => {
	const userId = locals.user?.id || 'default';
	const { title, settings } = await request.json();

	const threadId = await chatHistory.createSession(userId, title, settings);

	return json({ threadId });
};
```

**File:** `src/routes/api/chat/sessions/[threadId]/+server.ts`

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { chatHistory } from '$lib/db/chat-history';

// Get session details
export const GET: RequestHandler = async ({ params }) => {
	const { threadId } = params;

	const [session, messages, stats] = await Promise.all([
		chatHistory.getSession(threadId),
		chatHistory.getMessages(threadId),
		chatHistory.getSessionStats(threadId)
	]);

	return json({ session, messages, stats });
};

// Update session
export const PATCH: RequestHandler = async ({ params, request }) => {
	const { threadId } = params;
	const updates = await request.json();

	await chatHistory.updateSession(threadId, updates);

	return json({ success: true });
};

// Delete session
export const DELETE: RequestHandler = async ({ params }) => {
	const { threadId } = params;

	await chatHistory.deleteSession(threadId);

	return json({ success: true });
};
```

**File:** `src/routes/api/chat/messages/+server.ts`

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { chatHistory } from '$lib/db/chat-history';

// Search messages
export const GET: RequestHandler = async ({ url, locals }) => {
	const userId = locals.user?.id || 'default';
	const query = url.searchParams.get('q') || '';
	const limit = parseInt(url.searchParams.get('limit') || '20');

	const messages = await chatHistory.searchMessages(userId, query, limit);

	return json({ messages });
};
```

### Updated Main Agent Endpoint

**File:** `src/routes/api/agent/+server.ts` (updated)

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { agentGraph } from '$lib/agent/graph';
import { HumanMessage } from '@langchain/core/messages';
import { modelManager } from '$lib/agent/model-manager';
import { chatHistory } from '$lib/db/chat-history';
import { memoryStore } from '$lib/db/memory-store';

export const POST: RequestHandler = async ({ request, locals }) => {
	const userId = locals.user?.id || 'default';
	const {
		message,
		threadId,
		currentFile,
		sandboxId,
		sandboxType,
		useMorph,
		modelName,
		modelConfig
	} = await request.json();

	// Ensure session exists
	let finalThreadId = threadId;
	if (!finalThreadId) {
		finalThreadId = await chatHistory.createSession(userId, 'New Chat');
	}

	// Log user message
	await chatHistory.addMessage({
		threadId: finalThreadId,
		userId,
		role: 'user',
		content: message
	});

	const config = {
		configurable: { thread_id: finalThreadId }
	};

	let finalModelConfig;
	if (modelName) {
		finalModelConfig = modelManager.getModelPreset(modelName);
	} else if (modelConfig) {
		finalModelConfig = modelConfig;
	} else {
		finalModelConfig = { provider: 'openai', model: 'gpt-4o' };
	}

	const userMessage = new HumanMessage({
		content: message,
		additional_kwargs: { userId, threadId: finalThreadId }
	});

	const initialState = {
		messages: [userMessage],
		modelConfig: finalModelConfig,
		currentFile: currentFile || null,
		sandboxId: sandboxId || null,
		sandboxType: sandboxType || 'e2b',
		useMorph: useMorph || false,
		codeContext: [],
		terminalOutput: [],
		awaitingHumanInput: false
	};

	try {
		const result = await agentGraph.invoke(initialState, config);

		// Learn from successful interaction
		if (currentFile && result.fileContent) {
			await memoryStore.storeCodePattern(userId, {
				file: currentFile,
				change: message,
				result: result.fileContent
			});
		}

		return json({
			response: result.messages[result.messages.length - 1].content,
			threadId: finalThreadId,
			state: {
				currentFile: result.currentFile,
				sandboxId: result.sandboxId,
				awaitingHumanInput: result.awaitingHumanInput,
				modelUsed: `${result.modelConfig.provider}/${result.modelConfig.model}`
			},
			usage: result.modelUsageHistory
		});
	} catch (error: any) {
		if (error.name === 'GraphInterrupt') {
			return json({
				interrupt: true,
				data: error.value,
				threadId: finalThreadId
			});
		}

		throw error;
	}
};
```

### Initialize MongoDB on Server Start

**File:** `src/hooks.server.ts`

```typescript
import { mongoManager } from '$lib/db/mongodb';

// Connect to MongoDB on server start
mongoManager.connect().catch(console.error);

// Handle shutdown gracefully
process.on('SIGINT', async () => {
	await mongoManager.disconnect();
	process.exit(0);
});

process.on('SIGTERM', async () => {
	await mongoManager.disconnect();
	process.exit(0);
});
```

### Key Features

**Short-term Memory**: Thread-scoped conversation state persisted in MongoDB using LangGraph checkpointers. **Long-term Memory**: Cross-thread knowledge storage with vector embeddings for semantic retrieval. **Chat History**: Complete conversation logs with search and retrieval capabilities. **User Preferences**: Persistent user settings and coding styles that inform agent behavior. **Pattern Learning**: Agent remembers successful code patterns across sessions. **TTL Support**: Automatic cleanup of stale data using MongoDB TTL indexes. **Vector Search**: Semantic memory retrieval using Atlas Vector Search (requires Atlas configuration). **Session Management**: Full CRUD operations for chat sessions with metadata tracking.[4][5][3][6][7][1][2]

This implementation provides production-ready memory persistence for your coding agent with both short-term (within conversation) and long-term (across conversations) memory capabilities![7][1][2]

[1](https://www.mongodb.com/docs/atlas/ai-integrations/langgraph-js/)
[2](https://www.mongodb.com/company/blog/product-release-announcements/powering-long-term-memory-for-agents-langgraph)
[3](https://js.langchain.com/docs/integrations/memory/mongodb)
[4](https://python.langchain.com/docs/integrations/memory/mongodb_chat_message_history/)
[5](https://langchain-ai.github.io/langgraph/how-tos/memory/add-memory/)
[6](https://www.mongodb.com/docs/atlas/ai-integrations/langgraph/build-agents/)
[7](https://dev.to/mongodb/langgraph-with-mongodb-building-conversational-long-term-memory-for-intelligent-ai-agents-2pcn)
[8](https://www.mongodb.com/docs/atlas/ai-integrations/langgraph/)
[9](https://github.com/langchain-ai/langgraphjs/issues/1666)
[10](https://pypi.org/project/langgraph-checkpoint-mongodb/)
[11](https://docs.langchain.com/oss/python/langgraph/add-memory)
[12](https://www.youtube.com/watch?v=OjGsw5IeR-g)
[13](https://stackoverflow.com/questions/78426461/nosql-database-mongodb-checkpointer-classes-in-langgraph)
[14](https://python.langchain.com/api_reference/community/chat_message_histories/langchain_community.chat_message_histories.mongodb.MongoDBChatMessageHistory.html)
[15](https://github.com/langchain-ai/langgraph/discussions/943)
[16](https://www.youtube.com/watch?v=qXDrWKVSx1w)
[17](https://api.python.langchain.com/en/latest/chat_message_histories/langchain_mongodb.chat_message_histories.MongoDBChatMessageHistory.html)
[18](https://langchain-ai.github.io/langgraph/concepts/persistence/)
[19](https://www.youtube.com/watch?v=0AYzyQ5qKBM)
[20](https://www.mongodb.com/docs/atlas/ai-integrations/langchain/)
