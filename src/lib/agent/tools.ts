import { env } from '$env/dynamic/private';
import { mcpToolsService } from '$lib/services/mcp/mcp-tools.service';
import { sandboxManager } from '$lib/services/sandbox/sandbox-manager';
import { vectorDbService } from '$lib/services/vector-db.service';
import { logger } from '$lib/utils/logger.js';
import { tool } from '@langchain/core/tools';
import { tavily } from '@tavily/core';
import { z } from 'zod';

// Web Search Tool using Tavily (if configured)
export const webSearchTool = tool(
	(async (input: any) => {
		const { query } = input as { query: string };
		if (!env.TAVILY_API_KEY) {
			logger.warn('Tavily API key not configured, returning empty search result');
			return 'Web search is not configured. Please set TAVILY_API_KEY environment variable.';
		}

		try {
			// Use Tavily SDK directly
			const tvly = tavily({ apiKey: env.TAVILY_API_KEY });
			const results = await tvly.search(query, {
				maxResults: 5,
				searchDepth: 'advanced',
				includeAnswer: true
			});

			const resultData = {
				answer: results?.answer ?? null,
				results: results?.results ?? []
			};

			if (!resultData.answer && (!resultData.results || resultData.results.length === 0)) {
				return 'No web search results found for the query.';
			}

			return JSON.stringify(resultData, null, 2);
		} catch (error) {
			console.error('Web search tool error:', error);
			return (
				'Error performing web search: ' + (error instanceof Error ? error.message : String(error))
			);
		}
	}) as any,
	{
		name: 'web_search',
		description: 'Search the web for documentation, examples, and solutions.',
		schema: z.object({ query: z.string() })
	}
);

// Semantic code search backed by VectorDatabaseService
export const codeSearchTool = tool(
	(async (input: any) => {
		const { query, topK = 5 } = input as { query: string; topK?: number };
		try {
			const results = await vectorDbService.searchSimilarCode(query, 'global', { limit: topK });
			const formattedResults = (results || []).map((r) => ({
				filePath: r.document.filePath,
				relevance: r.score,
				snippet: r.document.content.substring(0, 800)
			}));

			// Ensure we always return a non-empty string for LLM compatibility
			if (formattedResults.length === 0) {
				return 'No relevant code snippets found for the query.';
			}

			return JSON.stringify(formattedResults, null, 2);
		} catch (error) {
			console.error('Code search tool error:', error);
			return (
				'Error searching codebase: ' + (error instanceof Error ? error.message : String(error))
			);
		}
	}) as any,
	{
		name: 'search_codebase',
		description:
			'Search the codebase using semantic similarity to find relevant code snippets and files.',
		schema: z.object({ query: z.string(), topK: z.number().optional() })
	}
);

// File read tool that delegates to sandbox manager
export const readFileTool = tool(
	(async (input: any) => {
		const { sandboxId, sandboxType, filePath } = input as {
			sandboxId: string;
			sandboxType?: string;
			filePath: string;
		};
		try {
			const provider = sandboxType as any;
			const file = await sandboxManager.readFile(sandboxId, filePath, { provider });
			if (!file?.content) {
				return `File "${filePath}" is empty or could not be read.`;
			}
			return file.content;
		} catch (error) {
			console.error('Read file tool error:', error);
			return `Error reading file "${filePath}": ${error instanceof Error ? error.message : String(error)}`;
		}
	}) as any,
	{
		name: 'read_file',
		description: 'Read the contents of a file from the sandbox.',
		schema: z.object({
			sandboxId: z.string(),
			sandboxType: z.string().optional(),
			filePath: z.string()
		})
	}
);

// File write tool
export const writeFileTool = tool(
	(async (input: any, config: any) => {
		const { sandboxId, sandboxType, filePath, content } = input as {
			sandboxId: string;
			sandboxType?: string;
			filePath: string;
			content: string;
		};
		try {
			const provider = sandboxType as any;

			// Extract userId and projectId from config if available
			const userId = config?.configurable?.userId;
			const projectId = config?.configurable?.projectId;

			const success = await sandboxManager.writeFile(sandboxId, filePath, content, {
				provider,
				userId,
				projectId
			});
			return JSON.stringify({
				success,
				message: success
					? `File "${filePath}" written successfully.`
					: `Failed to write file "${filePath}".`
			});
		} catch (error) {
			console.error('Write file tool error:', error);
			return JSON.stringify({
				success: false,
				error: error instanceof Error ? error.message : String(error),
				message: `Error writing file "${filePath}": ${error instanceof Error ? error.message : String(error)}`
			});
		}
	}) as any,
	{
		name: 'write_file',
		description: 'Write or update a file in the sandbox.',
		schema: z.object({
			sandboxId: z.string(),
			sandboxType: z.string().optional(),
			filePath: z.string(),
			content: z.string()
		})
	}
);

// Execute code / run command tool
export const executeCodeTool = tool(
	(async (input: any) => {
		const { sandboxId, sandboxType, command } = input as {
			sandboxId: string;
			sandboxType?: string;
			command: string;
		};
		try {
			const provider = sandboxType as any;
			const result = await sandboxManager.executeCommand(sandboxId, command, { provider });

			// Ensure result is always a string
			if (typeof result === 'string') {
				return result || 'Command executed successfully with no output.';
			}

			return JSON.stringify(result, null, 2);
		} catch (error) {
			console.error('Execute code tool error:', error);
			return JSON.stringify({
				success: false,
				output: '',
				error: error instanceof Error ? error.message : String(error)
			});
		}
	}) as any,
	{
		name: 'execute_code',
		description: 'Execute code or a command in the sandbox and return the output.',
		schema: z.object({
			sandboxId: z.string(),
			sandboxType: z.string().optional(),
			command: z.string()
		})
	}
);

// Get MCP tools (Context7 for documentation search, Memory for persistence)
const getMCPTools = () => {
	try {
		const mcpTools = [];

		// Add Context7 documentation search tool
		mcpTools.push(mcpToolsService.createContext7Tool());

		// Add Memory tool for knowledge persistence
		mcpTools.push(mcpToolsService.createMemoryTool());

		// Add any other connected MCP server tools
		const additionalTools = mcpToolsService.getAllLangChainTools();
		mcpTools.push(...additionalTools);

		return mcpTools;
	} catch (error) {
		logger.warn('Failed to load MCP tools, continuing without them', { error });
		return [];
	}
};

export const tools = [
	webSearchTool,
	codeSearchTool,
	readFileTool,
	writeFileTool,
	executeCodeTool,
	...getMCPTools()
];
