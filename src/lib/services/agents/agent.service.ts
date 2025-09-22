// services/agents/agent.service.ts
import { env } from '$env/dynamic/private';
import { MemorySaver } from '@langchain/langgraph';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { TavilySearch } from '@langchain/tavily';
import { LLMService } from '../llm/llm.service';
import { SessionManager } from '../memory/session.manager';

export interface AgentConfig {
	model: string;
	provider?: 'openai' | 'anthropic';
	temperature?: number;
	tools?: any[];
	systemMessage?: string;
	memoryType: 'conversation' | 'summary' | 'entity';
}

export interface AgentSession {
	id: string;
	name?: string;
	path?: string;
	metadata: Record<string, any>;
	createdAt: Date;
	lastActiveAt: Date;
}

export class AgentService {
	private llmService: LLMService;
	private sessionManager: SessionManager;
	private agents: Map<string, { agent: any; config: AgentConfig; createdAt: Date }> = new Map();
	private checkpointer: MemorySaver;

	constructor() {
		this.llmService = new LLMService();
		this.sessionManager = new SessionManager({
			persistMemory: true,
			memoryTypes: ['conversation'],
			storageBackend: 'memory'
		});
		this.checkpointer = new MemorySaver();
	}

	createAgent(config: AgentConfig): string {
		const agentId = this.generateAgentId();

		// Create LLM instance
		const llm = this.createLLMForAgent(config);

		// Get default tools (Tavily if available)
		const defaultTools: any[] = [];
		if (env.TAVILY_API_KEY) {
			defaultTools.push(
				new TavilySearch({
					maxResults: 3,
					tavilyApiKey: env.TAVILY_API_KEY
				})
			);
		}
		const tools = config.tools || defaultTools;

		// Create React agent with tools and memory
		const agent = createReactAgent({
			llm,
			tools,
			checkpointer: this.checkpointer,
			messageModifier: config.systemMessage
		});

		this.agents.set(agentId, {
			agent,
			config,
			createdAt: new Date()
		});

		return agentId;
	}

	async invokeAgent(
		agentId: string,
		messages: any[],
		sessionOptions?: {
			sessionId?: string;
			sessionName?: string;
			sessionPath?: string;
		}
	) {
		const agentData = this.agents.get(agentId);
		if (!agentData) {
			throw new Error(`Agent ${agentId} not found`);
		}

		// Create or get session
		const session = await this.sessionManager.getOrCreateSession(sessionOptions?.sessionId, {
			name: sessionOptions?.sessionName,
			path: sessionOptions?.sessionPath,
			agentId
		});

		// Add Helicone session tracking
		const heliconeHeaders = {
			'Helicone-Session-Id': session.id,
			'Helicone-Session-Name': session.name || 'default',
			'Helicone-Session-Path': session.path || '/',
			'Helicone-User-Id': session.metadata.userId
		};

		try {
			const result = await agentData.agent.invoke(
				{ messages },
				{
					configurable: { thread_id: session.id },
					metadata: { helicone: heliconeHeaders }
				}
			);

			// Update session metrics
			await this.sessionManager.updateSessionMetrics(session.id, {
				messageCount: 1
			});

			return result;
		} catch (error) {
			console.error(`Agent invocation error for session ${session.id}:`, error);
			throw error;
		}
	}

	private createLLMForAgent(config: AgentConfig) {
		// Use the LLM service's public method to create configured instance
		return this.llmService.createLLMInstanceForAgent(config.model, config.temperature);
	}

	private generateAgentId(): string {
		return `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}
}
