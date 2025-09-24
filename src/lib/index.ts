// place files you want to import through the `$lib` alias in this folder.

// Tool Management Exports
export { chatToolIntegration } from './services/chat-tool-integration.service.js';
export {
	batchFileOperations,
	contextualFileOps,
	fileEditTool,
	initializeFileEditingContext
} from './services/file-edit-tool.service.js';
export { ToolManager, toolManager } from './services/tool-manager.service.js';

// Tool Call Store Exports
export {
	activeToolCalls,
	executionContext,
	hasActiveToolCalls,
	isExecutingAnyTool,
	toolCallActions,
	toolCallHistory,
	totalToolCalls
} from './stores/tool-calls.store.js';

// Tool Types
export type {
	FileEditToolParams,
	FileEditToolResult,
	ToolCall,
	ToolCallDisplayState,
	ToolCallExecutionContext,
	ToolCallResult,
	ToolDefinition
} from './types/tools.js';
