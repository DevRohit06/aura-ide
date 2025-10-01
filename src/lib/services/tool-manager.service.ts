/**
 * Tool Manager Service
 * Handles registration and execution of AI tools
 */

import { telemetryService } from '$lib/services/telemetry.client';
import type {
	FileEditToolParams,
	FileEditToolResult,
	ToolCall,
	ToolCallExecutionContext,
	ToolCallResult,
	ToolDefinition
} from '$lib/types/tools.js';
import { writable } from 'svelte/store';

class ToolManager {
	private tools = new Map<string, ToolDefinition>();
	public activeCalls = writable<Map<string, ToolCall>>(new Map());

	constructor() {
		this.registerDefaultTools();
	}

	/**
	 * Register a new tool
	 */
	registerTool(tool: ToolDefinition) {
		this.tools.set(tool.name, tool);
	}

	/**
	 * Get all registered tools
	 */
	getTools(): ToolDefinition[] {
		return Array.from(this.tools.values());
	}

	/**
	 * Get tool definitions for AI model
	 */
	getToolDefinitionsForModel() {
		return this.getTools().map((tool) => ({
			type: 'function',
			function: {
				name: tool.name,
				description: tool.description,
				parameters: tool.parameters
			}
		}));
	}

	/**
	 * Execute a tool call
	 */
	async executeToolCall(
		toolCall: Omit<ToolCall, 'id' | 'timestamp' | 'status'>,
		context: ToolCallExecutionContext
	): Promise<ToolCallResult> {
		const callId = this.generateCallId();
		const startTime = Date.now();

		const call: ToolCall = {
			...toolCall,
			id: callId,
			timestamp: new Date(),
			status: 'pending'
		};

		// Update store
		this.activeCalls.update((calls) => {
			calls.set(callId, call);
			return calls;
		});

		try {
			// Telemetry: start event
			void telemetryService.trackToolCallStart(callId, toolCall, context);

			// Update status to executing
			this.updateCallStatus(callId, 'executing');

			const tool = this.tools.get(toolCall.name);
			if (!tool) {
				throw new Error(`Tool '${toolCall.name}' not found`);
			}

			const result = await tool.handler(toolCall.parameters, context);
			const duration = Date.now() - startTime;

			// Telemetry: end event (capture usage if present)
			void telemetryService.trackToolCallEnd(callId, toolCall, context, result, duration);

			// Update status to success
			this.updateCallStatus(callId, 'success', result, undefined, duration);

			return result;
		} catch (error) {
			const duration = Date.now() - startTime;
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';

			// Telemetry: end event with error
			void telemetryService.trackToolCallEnd(
				callId,
				toolCall,
				context,
				{ success: false, error: errorMessage },
				duration
			);

			// Update status to error
			this.updateCallStatus(callId, 'error', undefined, errorMessage, duration);

			return {
				success: false,
				message: 'Tool execution failed',
				error: errorMessage
			};
		}
	}

	/**
	 * Update tool call status
	 */
	private updateCallStatus(
		callId: string,
		status: ToolCall['status'],
		result?: any,
		error?: string,
		duration?: number
	) {
		this.activeCalls.update((calls) => {
			const call = calls.get(callId);
			if (call) {
				call.status = status;
				if (result) call.result = result;
				if (error) call.error = error;
				if (duration) call.duration = duration;
			}
			return calls;
		});
	}

	/**
	 * Remove completed tool call from active calls
	 */
	removeCall(callId: string) {
		this.activeCalls.update((calls) => {
			calls.delete(callId);
			return calls;
		});
	}

	/**
	 * Generate unique call ID
	 */
	private generateCallId(): string {
		return `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Register default tools
	 */
	private registerDefaultTools() {
		// File Edit Tool
		this.registerTool({
			name: 'edit_file',
			description:
				'Create, update, or delete files in the project. Use this to modify project files based on user requests.',
			parameters: {
				type: 'object',
				properties: {
					operation: {
						type: 'string',
						description: 'The operation to perform',
						enum: ['create', 'update', 'delete', 'read']
					},
					filePath: {
						type: 'string',
						description: 'The path to the file (relative to project root)'
					},
					content: {
						type: 'string',
						description: 'The file content (required for create/update operations)'
					},
					projectId: {
						type: 'string',
						description: 'The project ID'
					},
					reason: {
						type: 'string',
						description: 'Brief explanation of why this change is being made'
					}
				},
				required: ['operation', 'filePath', 'projectId']
			},
			handler: this.handleFileEdit.bind(this)
		});

		// Read File Tool
		this.registerTool({
			name: 'read_file',
			description: 'Read the contents of a file in the project.',
			parameters: {
				type: 'object',
				properties: {
					filePath: {
						type: 'string',
						description: 'The path to the file (relative to project root)'
					},
					projectId: {
						type: 'string',
						description: 'The project ID'
					}
				},
				required: ['filePath', 'projectId']
			},
			handler: this.handleFileRead.bind(this)
		});

		// List Files Tool
		this.registerTool({
			name: 'list_files',
			description: 'List files and directories in a project directory.',
			parameters: {
				type: 'object',
				properties: {
					directoryPath: {
						type: 'string',
						description: 'The directory path to list (relative to project root, empty for root)'
					},
					projectId: {
						type: 'string',
						description: 'The project ID'
					}
				},
				required: ['projectId']
			},
			handler: this.handleListFiles.bind(this)
		});

		// Web Search Tool (calls server-side Tavily endpoint)
		this.registerTool({
			name: 'web_search',
			description:
				'Perform a web search using the configured web search provider (Tavily). Returns summarized search results and top links.',
			parameters: {
				type: 'object',
				properties: {
					query: { type: 'string', description: 'Natural language search query' },
					maxResults: { type: 'number', description: 'Number of top results to return' },
					projectId: { type: 'string', description: 'Optional project id to associate the search' }
				},
				required: ['query']
			},
			handler: async (params: any, _context: any) => {
				try {
					const q = String(params.query);
					const max = Number(params.maxResults || 3);
					const res = await fetch('/api/tools/web-search', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ query: q, maxResults: max })
					});

					if (!res.ok) {
						const err = await res.json();
						return { success: false, message: err.message || 'Search failed' };
					}

					const payload = await res.json();
					return { success: true, message: 'Search completed', data: payload.data };
				} catch (error) {
					return {
						success: false,
						message: error instanceof Error ? error.message : 'Unknown error'
					};
				}
			}
		});

		// Fetch Files Tool (batch read)
		this.registerTool({
			name: 'fetch_files',
			description:
				'Fetch contents of multiple files in a project or sandbox in a single request. Returns a map of path->content.',
			parameters: {
				type: 'object',
				properties: {
					paths: {
						type: 'string',
						description: 'Comma-separated list or JSON array of file paths to fetch'
					},
					sandboxId: {
						type: 'string',
						description: 'Optional sandbox id to read directly from runtime'
					},
					projectId: {
						type: 'string',
						description: 'Optional project id to fallback to persisted storage'
					}
				},
				required: ['paths']
			},
			handler: async (params: any, _context: any) => {
				try {
					let paths: string[] = [];
					if (Array.isArray(params.paths)) paths = params.paths;
					else if (typeof params.paths === 'string') {
						try {
							paths = JSON.parse(params.paths);
							if (!Array.isArray(paths))
								paths = params.paths.split(',').map((p: string) => p.trim());
						} catch (e) {
							paths = params.paths.split(',').map((p: string) => p.trim());
						}
					}
					const sandboxId = params.sandboxId;
					const projectId = params.projectId;

					const res = await fetch('/api/tools/fetch-files', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ paths, sandboxId, projectId })
					});

					if (!res.ok) {
						const err = await res.json();
						return { success: false, message: err.message || 'Fetch files failed' };
					}

					const payload = await res.json();
					return { success: true, message: 'Files fetched', data: payload.data };
				} catch (error) {
					return {
						success: false,
						message: error instanceof Error ? error.message : 'Unknown error'
					};
				}
			}
		});

		// Summarize Files Tool
		this.registerTool({
			name: 'summarize_files',
			description:
				'Summarize multiple files using server-side LLM. Returns a map of path->summary+excerpt.',
			parameters: {
				type: 'object',
				properties: {
					paths: {
						type: 'string',
						description: 'Comma-separated list or JSON array of file paths to summarize'
					},
					sandboxId: {
						type: 'string',
						description: 'Optional sandbox id to read directly from runtime'
					},
					projectId: {
						type: 'string',
						description: 'Optional project id to fallback to persisted storage'
					},
					maxExcerpt: {
						type: 'string',
						description: 'Max characters to include in excerpt (number)'
					}
				},
				required: ['paths']
			},
			handler: async (params: any, _context: any) => {
				try {
					let paths: string[] = [];
					if (Array.isArray(params.paths)) paths = params.paths;
					else if (typeof params.paths === 'string') {
						try {
							paths = JSON.parse(params.paths);
							if (!Array.isArray(paths))
								paths = params.paths.split(',').map((p: string) => p.trim());
						} catch (e) {
							paths = params.paths.split(',').map((p: string) => p.trim());
						}
					}
					const sandboxId = params.sandboxId;
					const projectId = params.projectId;
					const maxExcerpt = Number(params.maxExcerpt || 4000);

					const res = await fetch('/api/tools/summarize-files', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ paths, sandboxId, projectId, maxExcerpt })
					});

					if (!res.ok) {
						const err = await res.json();
						return { success: false, message: err.message || 'Summarize failed' };
					}

					const payload = await res.json();
					return { success: true, message: 'Summaries generated', data: payload.data };
				} catch (error) {
					return {
						success: false,
						message: error instanceof Error ? error.message : 'Unknown error'
					};
				}
			}
		});
	}

	/**
	 * Handle file edit operations
	 */
	private async handleFileEdit(
		params: FileEditToolParams,
		context: ToolCallExecutionContext
	): Promise<FileEditToolResult> {
		try {
			const response = await fetch('/api/files', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					operation: params.operation,
					path: params.filePath,
					content: params.content,
					projectId: params.projectId,
					sandboxId: context.sandboxId,
					metadata: {
						reason: params.reason,
						modifiedBy: 'ai_agent',
						modifiedAt: new Date().toISOString()
					}
				})
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'File operation failed');
			}

			const result = await response.json();

			const returnPayload: any = {
				success: true,
				message: `File ${params.operation} operation completed successfully`,
				data: {
					filePath: params.filePath,
					content: params.operation === 'read' ? result.data?.content : params.content,
					size: result.data?.size,
					lastModified: result.data?.lastModified,
					metadata: result.data?.metadata,
					previousContent: result.data?.previousContent
				}
			};

			return returnPayload as any;
		} catch (error) {
			return {
				success: false,
				message: `Failed to ${params.operation} file`,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Handle file read operations
	 */
	private async handleFileRead(
		params: { filePath: string; projectId: string },
		context: ToolCallExecutionContext
	): Promise<ToolCallResult> {
		return this.handleFileEdit(
			{
				operation: 'read',
				filePath: params.filePath,
				projectId: params.projectId
			},
			context
		);
	}

	/**
	 * Handle list files operations
	 */
	private async handleListFiles(
		params: { directoryPath?: string; projectId: string },
		context: ToolCallExecutionContext
	): Promise<ToolCallResult> {
		try {
			const response = await fetch('/api/files', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					operation: 'list',
					path: params.directoryPath || '',
					projectId: params.projectId,
					sandboxId: context.sandboxId
				})
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'List files operation failed');
			}

			const result = await response.json();

			return {
				success: true,
				message: 'Files listed successfully',
				data: result.data
			};
		} catch (error) {
			return {
				success: false,
				message: 'Failed to list files',
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}
}

// Export singleton instance
export const toolManager = new ToolManager();
export { ToolManager };
