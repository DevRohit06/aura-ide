/**
 * Tool calling types for AI agents
 */

export interface ToolCall {
	id: string;
	name: string;
	parameters: Record<string, any>;
	timestamp: Date;
	status: 'pending' | 'executing' | 'success' | 'error';
	result?: any;
	error?: string;
	duration?: number;
}

export interface ToolCallExecutionContext {
	projectId?: string;
	sandboxId?: string;
	userId: string;
	sessionId?: string;
}

export interface ToolDefinition {
	name: string;
	description: string;
	parameters: {
		type: 'object';
		properties: Record<
			string,
			{
				type: string;
				description: string;
				required?: boolean;
				enum?: string[];
			}
		>;
		required: string[];
	};
	handler: (params: any, context: ToolCallExecutionContext) => Promise<ToolCallResult>;
}

export interface ToolCallResult {
	success: boolean;
	message: string;
	data?: any;
	error?: string;
	metadata?: Record<string, any>;
}

export interface FileEditToolParams {
	operation: 'create' | 'update' | 'delete' | 'read';
	filePath: string;
	content?: string;
	projectId: string;
	reason?: string;
}

export interface FileEditToolResult extends ToolCallResult {
	data?: {
		filePath: string;
		content?: string;
		size?: number;
		lastModified?: string;
		metadata?: Record<string, any>;
	};
}

export interface ToolCallDisplayState {
	isExecuting: boolean;
	hasError: boolean;
	isSuccess: boolean;
	showDetails: boolean;
}
