import { logger } from '$lib/utils/logger.js';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { Command, interrupt, MemorySaver, StateGraph } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { modelManager } from './model-manager';
import { AgentState } from './state';
import { tools } from './tools';

// (No static model here) models will be selected dynamically by the ModelManager

// Simple tool node that exposes the tools
const toolNode = new ToolNode(tools as any);

// Wrapper to preserve tool execution results
async function toolsNode(state: typeof AgentState.State) {
	logger.info('Tools node executing tool calls...');

	try {
		// Execute tools using the ToolNode
		const result = await toolNode.invoke(state as any);

		// Log tool execution results for debugging
		if (result.messages && Array.isArray(result.messages)) {
			const toolMessages = result.messages.filter((msg: any) => msg.tool_call_id);
			logger.info(`Tool execution completed. ${toolMessages.length} tool messages generated.`);

			// Sanitize tool_call_id to ensure compatibility with all LLM providers
			// Anthropic requires IDs to match ^[a-zA-Z0-9_-]+$
			toolMessages.forEach((msg: any) => {
				if (msg.tool_call_id) {
					// Replace invalid characters with underscores
					msg.tool_call_id = msg.tool_call_id.replace(/[^a-zA-Z0-9_-]/g, '_');
				}

				// Ensure content is always a non-empty string
				if (!msg.content || (Array.isArray(msg.content) && msg.content.length === 0)) {
					msg.content = 'Tool execution completed with no output.';
				} else if (typeof msg.content !== 'string') {
					msg.content = JSON.stringify(msg.content);
				}
			});

			// Log tool results for debugging
			toolMessages.forEach((msg: any, index: number) => {
				logger.info(`Tool result ${index + 1}:`, {
					tool_call_id: msg.tool_call_id,
					content_type: typeof msg.content,
					content_preview:
						typeof msg.content === 'string'
							? msg.content.slice(0, 100) + (msg.content.length > 100 ? '...' : '')
							: JSON.stringify(msg.content).slice(0, 100) + '...'
				});
			});
		}

		return result;
	} catch (error) {
		logger.error('Tool execution error:', error);
		// Return error message as tool result
		return {
			messages: [
				{
					content: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
					tool_call_id: 'error',
					type: 'tool'
				}
			]
		};
	}
}

async function agentNode(state: typeof AgentState.State) {
	const systemPrompt = `You are an expert coding assistant with access to sandboxes, semantic search and web search. Current file: ${state.currentFile || 'None'}\n\nCurrent Sandbox: ${state.sandboxId ? `ID: ${state.sandboxId}, Type: ${state.sandboxType || 'unknown'}` : 'None'}\n\nCurrent Model: ${state.modelConfig?.provider || 'openai'}/${state.modelConfig?.model || 'gpt-4o'}`;

	const messages = [new HumanMessage(systemPrompt), ...(state.messages || [])];

	logger.info('Agent node invoking model with messages, last message length:', messages.length);
	logger.info('Agent is using model config:', state.modelConfig);
	try {
		// Resolve model from state.modelConfig or fallback to default
		const modelConfig = (state as any).modelConfig;
		const runtimeModel = modelManager.getModel(modelConfig as any);

		// Bind tools where supported
		const boundModel = (runtimeModel as any).bindTools
			? (runtimeModel as any).bindTools(tools)
			: runtimeModel;

		const response = (await (boundModel as any).invoke)
			? await (boundModel as any).invoke(messages)
			: await (boundModel as any).call(messages);

		logger.info(
			'Model response type:',
			typeof response,
			'has tool_calls:',
			!!(response as any)?.tool_calls,
			'tool_calls type:',
			typeof (response as any)?.tool_calls
		);

		// Ensure response is a proper AIMessage
		let aiMessage: AIMessage;
		if (response instanceof AIMessage) {
			aiMessage = response;
		} else if (typeof response === 'object' && response.content) {
			// Create AIMessage from response object
			aiMessage = new AIMessage({
				content: response.content,
				tool_calls: (response as any).tool_calls || [],
				additional_kwargs: (response as any).additional_kwargs || {}
			});
		} else {
			// Fallback for unexpected response format
			aiMessage = new AIMessage('I received an unexpected response format from the model.');
		}

		// Sanitize tool_call IDs to ensure compatibility with all LLM providers
		// Anthropic requires IDs to match ^[a-zA-Z0-9_-]+$
		if ((aiMessage as any).tool_calls && Array.isArray((aiMessage as any).tool_calls)) {
			(aiMessage as any).tool_calls = (aiMessage as any).tool_calls.map((tc: any) => {
				if (tc && tc.id) {
					return {
						...tc,
						id: tc.id.replace(/[^a-zA-Z0-9_-]/g, '_')
					};
				}
				return tc;
			});
		}

		// Also sanitize in additional_kwargs if present
		if (
			aiMessage.additional_kwargs?.tool_calls &&
			Array.isArray(aiMessage.additional_kwargs.tool_calls)
		) {
			aiMessage.additional_kwargs.tool_calls = aiMessage.additional_kwargs.tool_calls.map(
				(tc: any) => {
					if (tc && tc.id) {
						return {
							...tc,
							id: tc.id.replace(/[^a-zA-Z0-9_-]/g, '_')
						};
					}
					return tc;
				}
			);
		}

		// Track usage for auditing
		const usage = [
			{ provider: modelConfig.provider, model: modelConfig.model, timestamp: Date.now() }
		];

		return { messages: [aiMessage], modelUsageHistory: usage } as any;
	} catch (error) {
		logger.error('Agent node model invocation error:', error);
		// Return a fallback response
		const fallbackResponse = new AIMessage(
			'I encountered an error while processing your request. Please try again.'
		);
		return { messages: [fallbackResponse], modelUsageHistory: [] } as any;
	}
}

// Basic human-review node which just forwards to tools for now
async function humanReviewNode(state: typeof AgentState.State) {
	// If agent last message contains tool calls or mentions write/execute, conditionally flag for review
	const last = (state.messages || []).slice(-1)[0] as AIMessage | undefined;
	const toolCalls = (last as any)?.tool_calls;

	// Handle different tool call formats from different providers
	let toolCallsArray: any[] = [];
	if (toolCalls) {
		if (Array.isArray(toolCalls)) {
			toolCallsArray = toolCalls;
		} else if (typeof toolCalls === 'object' && toolCalls.tools && Array.isArray(toolCalls.tools)) {
			// Some providers might nest tools under a 'tools' property
			toolCallsArray = toolCalls.tools;
		} else if (typeof toolCalls === 'object') {
			// Try to convert object to array if it has the right structure
			toolCallsArray = [toolCalls];
		}
	}

	// Ensure toolCallsArray is always an array
	if (!Array.isArray(toolCallsArray)) {
		toolCallsArray = [];
	}

	logger.info(
		'Human review node - toolCalls type:',
		typeof toolCalls,
		'isArray:',
		Array.isArray(toolCalls),
		'normalized length:',
		toolCallsArray?.length || 0
	);

	const sensitive = new Set([
		'write_file',
		'edit_file',
		'execute_code',
		'run_terminal_command',
		'delete_file',
		'clone_project'
	]);

	if (toolCallsArray && toolCallsArray.length) {
		// Filter out any null/undefined items
		const validToolCalls = toolCallsArray.filter((tc: any) => tc != null);

		// If any tool call is in the sensitive list, request human review
		if (validToolCalls.some((tc: any) => tc?.name && sensitive.has(tc.name))) {
			// Log the raw tool call structure for debugging
			logger.info('Raw tool calls before sanitization:', JSON.stringify(validToolCalls, null, 2));

			logger.info(
				'Requesting human review for tool calls:',
				validToolCalls.map((tc) => ({
					name: tc?.name,
					// LangChain should normalize to 'args', but we check fallbacks
					args: tc?.args || tc?.arguments || tc?.input || {},
					hasArgs: !!tc?.args,
					hasArguments: !!tc?.arguments,
					hasInput: !!tc?.input
				}))
			);

			// Sanitize tool calls to only include serializable properties
			// LangChain normalizes to "args", but we support fallbacks for safety
			const sanitizedToolCalls = validToolCalls.map((tc) => ({
				name: tc?.name || '',
				args: tc?.args || tc?.arguments || tc?.input || {},
				id: tc?.id || '',
				type: tc?.type || 'tool_call'
			}));

			// Use LangGraph's interrupt() function for proper human-in-the-loop
			const humanDecision = interrupt({
				reason: 'human_review',
				toolCalls: sanitizedToolCalls,
				stateSnapshot: {
					currentFile: state.currentFile,
					sandboxId: state.sandboxId,
					sandboxType: state.sandboxType
				}
			});

			// Process human decision
			// humanDecision should be: { action: 'approve' | 'reject' | 'modify', edits?: [...] }
			if (humanDecision?.action === 'approve' || humanDecision?.action === 'modify') {
				return new Command({ goto: 'tools' });
			} else {
				// Rejected - end the workflow
				return new Command({ goto: '__end__' });
			}
		}

		// Otherwise it's safe to run tools automatically
		return new Command({ goto: 'tools' });
	}

	return new Command({ goto: '__end__' }) as any;
}
function shouldContinue(state: typeof AgentState.State) {
	const last = (state.messages || []).slice(-1)[0] as AIMessage | undefined;
	if (last && (last as any)?.tool_calls) {
		const toolCalls = (last as any)?.tool_calls;

		// Handle different tool call formats from different providers
		let toolCallsArray: any[] = [];
		if (toolCalls) {
			if (Array.isArray(toolCalls)) {
				toolCallsArray = toolCalls;
			} else if (
				typeof toolCalls === 'object' &&
				toolCalls.tools &&
				Array.isArray(toolCalls.tools)
			) {
				// Some providers might nest tools under a 'tools' property
				toolCallsArray = toolCalls.tools;
			} else if (typeof toolCalls === 'object') {
				// Try to convert object to array if it has the right structure
				toolCallsArray = [toolCalls];
			}
		}

		// Ensure toolCallsArray is always an array
		if (!Array.isArray(toolCallsArray)) {
			toolCallsArray = [];
		}

		logger.info(
			'Should continue - toolCalls type:',
			typeof toolCalls,
			'isArray:',
			Array.isArray(toolCalls),
			'normalized length:',
			toolCallsArray?.length || 0
		);
		if (toolCallsArray && toolCallsArray.length > 0) return 'review';
	}
	return '__end__';
}

const workflow = new StateGraph(AgentState)
	.addNode('agent', agentNode)
	.addNode('review', humanReviewNode)
	.addNode('tools', toolsNode)
	.addEdge('__start__', 'agent')
	.addConditionalEdges('agent', shouldContinue)
	.addEdge('tools', 'agent');

const checkpointer = new MemorySaver();
// Checkpointer is REQUIRED for interrupt() to work
export const agentGraph = workflow.compile({ checkpointer } as any);

/**
 * Helper for quick testing: run the agent node with an injectable mock model.
 * Returns the raw model response object so tests can assert on tool calls or content.
 */
export async function runAgentTest(input: {
	message: string;
	mockModel?: any;
	stateOverrides?: any;
}) {
	const { message, mockModel, stateOverrides } = input;
	const testState = {
		messages: [new HumanMessage(message)],
		currentFile: stateOverrides?.currentFile ?? null,
		sandboxId: stateOverrides?.sandboxId ?? null,
		sandboxType: stateOverrides?.sandboxType ?? null,
		useMorph: stateOverrides?.useMorph ?? false,
		codeContext: stateOverrides?.codeContext ?? [],
		terminalOutput: stateOverrides?.terminalOutput ?? [],
		awaitingHumanInput: false
	};
	// allow injecting a modelConfig for tests
	if (stateOverrides?.modelConfig) (testState as any).modelConfig = stateOverrides.modelConfig;

	// If a mock model is provided, call the agentNode logic with it
	if (mockModel) {
		const systemPrompt = `You are an expert coding assistant (test mode). Current file: ${testState.currentFile || 'None'}\n\nCurrent Sandbox: ${testState.sandboxId ? `ID: ${testState.sandboxId}, Type: ${testState.sandboxType || 'unknown'}` : 'None'}`;
		const messages = [new HumanMessage(systemPrompt), ...(testState.messages || [])];
		const response = await (async () => {
			if (typeof mockModel.invoke === 'function') return await mockModel.invoke(messages);
			if (typeof mockModel.call === 'function') return await mockModel.call(messages);
			// support simple function model
			if (typeof mockModel === 'function') return await mockModel(messages);
			throw new Error('mockModel does not implement an invocation method');
		})();

		return { response, state: testState };
	}

	// Fallback: run the compiled graph (this will call the real model)
	return await (agentGraph.invoke ? agentGraph.invoke(testState as any) : { messages: [] });
}
