import { env } from '$env/dynamic/private';
import { sandboxManager } from '$lib/services/sandbox/sandbox-manager';
import { vectorDbService } from '$lib/services/vector-db.service';
import { logger } from '$lib/utils/logger.js';
import { tool } from '@langchain/core/tools';
import { TavilySearch } from '@langchain/tavily';
import { z } from 'zod';

// Web Search Tool using Tavily (if configured)
export const webSearchTool = tool(
	(async (input: any) => {
		const { query } = input as { query: string };
		if (!env.TAVILY_API_KEY) {
			logger.warn('Tavily API key not configured, returning empty search result');
			return { answer: null, results: [] };
		}
		const maxResults = 5;
		const tavily = new TavilySearch({ tavilyApiKey: env.TAVILY_API_KEY, maxResults });
		try {
			let results: any;
			if (typeof (tavily as any).run === 'function') {
				results = await (tavily as any).run(query);
			} else if (typeof (tavily as any).search === 'function') {
				results = await (tavily as any).search(query);
			} else {
				results = await (tavily as any)(query);
			}
			return {
				answer: results?.answer ?? null,
				results: results?.results ?? results ?? []
			};
		} catch (error) {
			console.error('Web search tool error:', error);
			return { answer: null, results: [] };
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
			return (results || []).map((r) => ({
				filePath: r.document.filePath,
				relevance: r.score,
				snippet: r.document.content.substring(0, 800)
			}));
		} catch (error) {
			console.error('Code search tool error:', error);
			return [];
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
			return file?.content ?? null;
		} catch (error) {
			console.error('Read file tool error:', error);
			return null;
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
	(async (input: any) => {
		const { sandboxId, sandboxType, filePath, content } = input as {
			sandboxId: string;
			sandboxType?: string;
			filePath: string;
			content: string;
		};
		try {
			const provider = sandboxType as any;
			const success = await sandboxManager.writeFile(sandboxId, filePath, content, { provider });
			return { success };
		} catch (error) {
			console.error('Write file tool error:', error);
			return { success: false, error: error instanceof Error ? error.message : String(error) };
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
			return result;
		} catch (error) {
			console.error('Execute code tool error:', error);
			return {
				success: false,
				output: '',
				error: error instanceof Error ? error.message : String(error)
			};
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

export const tools = [
	webSearchTool,
	codeSearchTool,
	readFileTool,
	writeFileTool,
	executeCodeTool
	// ...mcpTools // Temporarily disabled
];
