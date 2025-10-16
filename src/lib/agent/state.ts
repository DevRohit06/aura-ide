import type { BaseMessage } from '@langchain/core/messages';
import { Annotation } from '@langchain/langgraph';

/**
 * Agent state definition used by the LangGraph workflow.
 * Kept intentionally small and serializable so it can be persisted.
 */
export const AgentState = Annotation.Root({
	messages: Annotation<BaseMessage[]>({
		reducer: (x = [], y = []) => x.concat(y)
	}),
	currentFile: Annotation<string | null>({
		reducer: (_prev, y) => y ?? null
	}),
	fileContent: Annotation<string | null>({
		reducer: (_prev, y) => y ?? null
	}),
	sandboxId: Annotation<string | null>({
		reducer: (_prev, y) => y ?? null
	}),
	sandboxType: Annotation<'daytona' | 'e2b' | null>({
		reducer: (_prev, y) => y ?? null
	}),
	userId: Annotation<string | null>({
		reducer: (_prev, y) => y ?? null
	}),
	projectId: Annotation<string | null>({
		reducer: (_prev, y) => y ?? null
	}),
	codeContext: Annotation<string[]>({
		reducer: (x = [], y = []) => [...x, ...y]
	}),
	awaitingHumanInput: Annotation<boolean>({
		reducer: (_prev, y) => Boolean(y)
	}),
	useMorph: Annotation<boolean>({
		reducer: (_prev, y) => Boolean(y)
	}),
	terminalOutput: Annotation<string[]>({
		reducer: (x = [], y = []) => [...x, ...y]
	}),
	// Current model configuration (supports switching mid-conversation)
	modelConfig: Annotation<{
		provider: string;
		model: string;
		temperature?: number;
	}>({
		reducer: (_prev, y) => y ?? { provider: 'openai', model: 'gpt-4o' }
	}),
	// Track usage / model switches for auditing and cost estimation
	modelUsageHistory: Annotation<Array<{ provider: string; model: string; timestamp: number }>>({
		reducer: (x = [], y = []) => [...x, ...y],
		default: () => []
	})
});

export type AgentStateType = typeof AgentState.State;
