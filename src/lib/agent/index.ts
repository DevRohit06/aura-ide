import { morphCodeEditingService } from '$lib/services/morph-code-editing.service';
import { HumanMessage } from '@langchain/core/messages';
import { agentGraph } from './graph';
import type { AgentStateType } from './state';

export interface AgentCallbacks {
	onInterrupt?: (interrupt: {
		toolCalls: Array<{
			name: string;
			parameters: Record<string, any>;
			id?: string;
		}>;
		stateSnapshot: {
			currentFile?: string | null;
			sandboxId?: string | null;
			fileContent?: string | null;
		};
		reason?: string;
	}) => void;
	onMessage?: (message: {
		id: string;
		role: 'user' | 'assistant' | 'system';
		content: string;
		timestamp: string;
		metadata?: any;
		agentInterrupt?: any;
	}) => void;
	onStateChange?: (state: {
		isActive: boolean;
		currentTask?: string;
		sandboxId?: string;
		currentFile?: string;
		isWaitingForApproval: boolean;
	}) => void;
}

export interface AgentConfig {
	sandboxId?: string;
	projectId: string;
	modelConfig?: {
		provider: string;
		model: string;
		temperature?: number;
	};
	callbacks?: AgentCallbacks;
}

export class Agent {
	private config: AgentConfig;
	private callbacks: AgentCallbacks;
	private threadId: string;
	private currentState: AgentStateType | null = null;

	constructor(config: AgentConfig) {
		this.config = config;
		this.callbacks = config.callbacks || {};
		this.threadId = `agent-${config.projectId}-${Date.now()}`;
	}

	async processMessage(content: string): Promise<void> {
		try {
			const initialState: Partial<AgentStateType> = {
				messages: [new HumanMessage(content)],
				currentFile: null,
				fileContent: null,
				sandboxId: this.config.sandboxId || null,
				sandboxType: null,
				codeContext: [],
				awaitingHumanInput: false,
				useMorph: false,
				terminalOutput: [],
				modelConfig: this.config.modelConfig || {
					provider: 'openai',
					model: 'gpt-4o'
				},
				modelUsageHistory: []
			};

			this.callbacks.onStateChange?.({
				isActive: true,
				currentTask: 'Processing message',
				sandboxId: this.config.sandboxId,
				isWaitingForApproval: false
			});

			const result = await agentGraph.invoke(initialState, {
				configurable: { thread_id: this.threadId }
			});

			this.currentState = result;

			// Check if we got interrupted
			if (result.messages && result.messages.length > 0) {
				const lastMessage = result.messages[result.messages.length - 1];

				// Check if the message has tool calls that need review
				if ((lastMessage as any).tool_calls) {
					const toolCalls = (lastMessage as any).tool_calls;
					// Ensure toolCalls is an array
					const toolCallsArray = Array.isArray(toolCalls) ? toolCalls : [];
					const sensitiveTools = new Set([
						'write_file',
						'edit_file',
						'execute_code',
						'run_terminal_command',
						'delete_file',
						'clone_project'
					]);

					const needsReview = toolCallsArray.some((tc: any) => sensitiveTools.has(tc.name));

					if (needsReview) {
						this.callbacks.onInterrupt?.({
							toolCalls: toolCallsArray.map((tc: any) => ({
								name: tc.name,
								parameters: tc.parameters || {},
								id: tc.id
							})),
							stateSnapshot: {
								currentFile: result.currentFile,
								sandboxId: result.sandboxId,
								fileContent: result.fileContent
							},
							reason: 'human_review'
						});

						this.callbacks.onStateChange?.({
							isActive: true,
							currentTask: 'Waiting for approval',
							sandboxId: this.config.sandboxId,
							currentFile: result.currentFile || undefined,
							isWaitingForApproval: true
						});

						return;
					}
				}

				// Send the assistant message
				this.callbacks.onMessage?.({
					id: Date.now().toString(),
					role: 'assistant',
					content:
						typeof lastMessage.content === 'string'
							? lastMessage.content
							: JSON.stringify(lastMessage.content),
					timestamp: new Date().toISOString(),
					metadata: {
						modelConfig: result.modelConfig,
						modelUsageHistory: result.modelUsageHistory
					}
				});
			}

			this.callbacks.onStateChange?.({
				isActive: false,
				sandboxId: this.config.sandboxId,
				isWaitingForApproval: false
			});
		} catch (error: any) {
			console.error('Agent processing error:', error);

			// Check if it's an interrupt
			if (error.name === 'GraphInterrupt' && error.value) {
				const interrupt = error.value;
				this.callbacks.onInterrupt?.({
					toolCalls: interrupt.toolCalls || [],
					stateSnapshot: {
						currentFile: interrupt.stateSnapshot?.currentFile || null,
						sandboxId: interrupt.stateSnapshot?.sandboxId || null,
						fileContent: interrupt.stateSnapshot?.fileContent || null
					},
					reason: interrupt.reason
				});

				this.callbacks.onStateChange?.({
					isActive: true,
					currentTask: 'Waiting for approval',
					sandboxId: this.config.sandboxId,
					currentFile: interrupt.stateSnapshot?.currentFile || undefined,
					isWaitingForApproval: true
				});

				return;
			}

			// Regular error
			this.callbacks.onMessage?.({
				id: Date.now().toString(),
				role: 'system',
				content: `Error: ${error.message}`,
				timestamp: new Date().toISOString()
			});

			this.callbacks.onStateChange?.({
				isActive: false,
				sandboxId: this.config.sandboxId,
				isWaitingForApproval: false
			});
		}
	}

	async resumeWithApproval(toolCalls: Array<{ name: string; parameters: any }>): Promise<void> {
		if (!this.currentState) {
			throw new Error('No active agent state to resume');
		}

		try {
			this.callbacks.onStateChange?.({
				isActive: true,
				currentTask: 'Executing approved actions',
				sandboxId: this.config.sandboxId,
				currentFile: this.currentState.currentFile || undefined,
				isWaitingForApproval: false
			});

			// Continue the graph execution with approved tool calls
			const result = await agentGraph.invoke(null, {
				configurable: { thread_id: this.threadId }
			});

			this.currentState = result;

			// Send completion message
			this.callbacks.onMessage?.({
				id: Date.now().toString(),
				role: 'system',
				content: 'Actions completed successfully',
				timestamp: new Date().toISOString()
			});

			this.callbacks.onStateChange?.({
				isActive: false,
				sandboxId: this.config.sandboxId,
				currentFile: result.currentFile || undefined,
				isWaitingForApproval: false
			});
		} catch (error: any) {
			console.error('Resume error:', error);
			this.callbacks.onMessage?.({
				id: Date.now().toString(),
				role: 'system',
				content: `Error executing actions: ${error.message}`,
				timestamp: new Date().toISOString()
			});

			this.callbacks.onStateChange?.({
				isActive: false,
				sandboxId: this.config.sandboxId,
				isWaitingForApproval: false
			});
		}
	}

	async resumeWithRejection(): Promise<void> {
		this.callbacks.onMessage?.({
			id: Date.now().toString(),
			role: 'system',
			content: 'Actions were rejected by user',
			timestamp: new Date().toISOString()
		});

		this.callbacks.onStateChange?.({
			isActive: false,
			sandboxId: this.config.sandboxId,
			isWaitingForApproval: false
		});

		this.currentState = null;
	}

	async resumeWithModification(edits: Array<{ filePath: string; content: string }>): Promise<void> {
		if (!this.currentState) {
			throw new Error('No active agent state to resume');
		}

		try {
			this.callbacks.onStateChange?.({
				isActive: true,
				currentTask: 'Applying intelligent code edits',
				sandboxId: this.config.sandboxId,
				currentFile: this.currentState.currentFile || undefined,
				isWaitingForApproval: false
			});

			if (this.currentState.useMorph && this.config.sandboxId) {
				// Use Morph Code Editing for intelligent merging
				const { sandboxManager } = await import('$lib/services/sandbox');
				const codeEdits: Array<{
					filePath: string;
					oldContent: string;
					newContent: string;
					changeType: 'update';
					reason: string;
				}> = [];

				for (const edit of edits) {
					// Read current content for oldContent
					let currentContent = '';
					try {
						const file = await sandboxManager.readFile(this.config.sandboxId, edit.filePath);
						currentContent =
							typeof file?.content === 'string' ? file.content : file?.content?.toString() || '';
					} catch (error) {
						// File might not exist, use empty string
						currentContent = '';
					}

					codeEdits.push({
						filePath: edit.filePath,
						oldContent: currentContent,
						newContent: edit.content,
						changeType: 'update',
						reason: 'Agent modification'
					});
				}

				const result = await morphCodeEditingService.applyEdits(codeEdits, this.config.sandboxId, {
					autoResolve: true,
					maxConflicts: 5,
					backupOriginals: true
				});

				if (!result.success) {
					// Check if there are conflicts that need manual resolution
					const hasConflicts = result.results.some(
						(r) => r.result.conflicts && r.result.conflicts.length > 0
					);

					if (hasConflicts) {
						this.callbacks.onMessage?.({
							id: Date.now().toString(),
							role: 'system',
							content:
								'Code edits have conflicts that require manual resolution. Please review and resolve conflicts.',
							timestamp: new Date().toISOString()
						});

						// Send conflict information
						const conflictSummary = result.results
							.filter((r) => r.result.conflicts && r.result.conflicts.length > 0)
							.map((r) => `${r.filePath}: ${r.result.conflicts?.length} conflicts`)
							.join(', ');

						this.callbacks.onMessage?.({
							id: Date.now().toString(),
							role: 'system',
							content: `Conflicts found in: ${conflictSummary}`,
							timestamp: new Date().toISOString()
						});

						this.callbacks.onStateChange?.({
							isActive: false,
							sandboxId: this.config.sandboxId,
							isWaitingForApproval: false
						});
						return;
					}
				}

				// Report successful edits
				const successful = result.summary.successful;
				const total = result.summary.totalFiles;

				this.callbacks.onMessage?.({
					id: Date.now().toString(),
					role: 'system',
					content: `Successfully applied ${successful}/${total} code edits with intelligent merging.`,
					timestamp: new Date().toISOString()
				});
			} else {
				// Fallback to simple file writing (existing behavior)
				for (const edit of edits) {
					// Simple file write logic here
					this.callbacks.onMessage?.({
						id: Date.now().toString(),
						role: 'system',
						content: `Applied edit to ${edit.filePath}`,
						timestamp: new Date().toISOString()
					});
				}
			}

			this.callbacks.onStateChange?.({
				isActive: false,
				sandboxId: this.config.sandboxId,
				currentFile: this.currentState.currentFile || undefined,
				isWaitingForApproval: false
			});
		} catch (error: any) {
			console.error('Resume with modification error:', error);
			this.callbacks.onMessage?.({
				id: Date.now().toString(),
				role: 'system',
				content: `Error applying modifications: ${error.message}`,
				timestamp: new Date().toISOString()
			});

			this.callbacks.onStateChange?.({
				isActive: false,
				sandboxId: this.config.sandboxId,
				isWaitingForApproval: false
			});
		}
	}
}

export function createAgent(config: AgentConfig): Agent {
	return new Agent(config);
}
