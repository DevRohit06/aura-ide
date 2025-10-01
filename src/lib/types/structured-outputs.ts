import { z } from 'zod';

// Base response schema
export const BaseResponseSchema = z.object({
	success: z.boolean(),
	message: z.string().optional(),
	timestamp: z.string().datetime().optional()
});

// Tool call schema
export const ToolCallSchema = z.object({
	toolName: z.string(),
	parameters: z.record(z.any()),
	reasoning: z.string().optional()
});

// Analysis response schema
export const AnalysisResponseSchema = z.object({
	needsTools: z.boolean(),
	toolCalls: z.array(ToolCallSchema).default([]),
	reasoning: z.string(),
	directResponse: z.string().optional(),
	confidence: z.number().min(0).max(1).optional(),
	codebaseContext: z
		.object({
			relevantFiles: z.array(z.string()).optional(),
			suggestedActions: z.array(z.string()).optional()
		})
		.optional()
});

// Code generation response schema
export const CodeGenerationResponseSchema = z.object({
	code: z.string(),
	language: z.string(),
	explanation: z.string(),
	dependencies: z.array(z.string()).optional(),
	testing: z
		.object({
			testCases: z.array(z.string()).optional(),
			mockData: z.record(z.any()).optional()
		})
		.optional(),
	documentation: z.string().optional()
});

// File operation response schema
export const FileOperationResponseSchema = z.object({
	operation: z.enum(['create', 'update', 'delete', 'read']),
	filePath: z.string(),
	success: z.boolean(),
	changes: z
		.object({
			linesAdded: z.number().optional(),
			linesRemoved: z.number().optional(),
			functionsModified: z.array(z.string()).optional()
		})
		.optional(),
	backupPath: z.string().optional()
});

// Codebase search response schema
export const CodebaseSearchResponseSchema = z.object({
	query: z.string(),
	results: z.array(
		z.object({
			filePath: z.string(),
			relevance: z.number(),
			snippet: z.string(),
			lineNumbers: z.array(z.number()).optional(),
			matchType: z.enum(['exact', 'semantic', 'fuzzy'])
		})
	),
	suggestions: z.array(z.string()).optional(),
	totalResults: z.number()
});

// Chat response schema
export const ChatResponseSchema = z.object({
	content: z.string(),
	type: z.enum(['text', 'code', 'analysis', 'suggestion']),
	metadata: z.object({
		model: z.string(),
		provider: z.string(),
		tokens: z.number(),
		latency: z.number(),
		temperature: z.number().optional(),
		cacheHit: z.boolean().optional()
	}),
	context: z
		.object({
			filesReferenced: z.array(z.string()).optional(),
			toolsUsed: z.array(z.string()).optional(),
			codebaseKnowledge: z.boolean().default(false)
		})
		.optional(),
	followUpSuggestions: z.array(z.string()).optional()
});

// MCP tool response schema
export const MCPToolResponseSchema = z.object({
	toolId: z.string(),
	serverName: z.string(),
	result: z.record(z.any()),
	success: z.boolean(),
	executionTime: z.number(),
	error: z.string().optional()
});

// Workflow state schema
export const WorkflowStateSchema = z.object({
	step: z.string(),
	progress: z.number().min(0).max(1),
	status: z.enum(['pending', 'running', 'completed', 'failed']),
	result: z.record(z.any()).optional(),
	error: z.string().optional(),
	nextSteps: z.array(z.string()).optional()
});

// Export all schemas as a map for easy access
export const STRUCTURED_OUTPUT_SCHEMAS = {
	analysis: AnalysisResponseSchema,
	codeGeneration: CodeGenerationResponseSchema,
	fileOperation: FileOperationResponseSchema,
	codebaseSearch: CodebaseSearchResponseSchema,
	chat: ChatResponseSchema,
	mcpTool: MCPToolResponseSchema,
	workflow: WorkflowStateSchema
} as const;

export type AnalysisResponse = z.infer<typeof AnalysisResponseSchema>;
export type CodeGenerationResponse = z.infer<typeof CodeGenerationResponseSchema>;
export type FileOperationResponse = z.infer<typeof FileOperationResponseSchema>;
export type CodebaseSearchResponse = z.infer<typeof CodebaseSearchResponseSchema>;
export type ChatResponse = z.infer<typeof ChatResponseSchema>;
export type MCPToolResponse = z.infer<typeof MCPToolResponseSchema>;
export type WorkflowState = z.infer<typeof WorkflowStateSchema>;

export function validateStructuredOutput<T extends keyof typeof STRUCTURED_OUTPUT_SCHEMAS>(
	schemaName: T,
	data: unknown
):
	| { success: true; data: z.infer<(typeof STRUCTURED_OUTPUT_SCHEMAS)[T]> }
	| { success: false; error: string } {
	try {
		const schema = STRUCTURED_OUTPUT_SCHEMAS[schemaName];
		const result = schema.parse(data);
		return { success: true, data: result };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return {
				success: false,
				error: `Validation failed: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
			};
		}
		return { success: false, error: 'Unknown validation error' };
	}
}
