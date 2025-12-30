import { env } from '$env/dynamic/private';
import { sandboxManager } from '$lib/services/sandbox/sandbox-manager';
import { vectorDbService } from '$lib/services/vector-db.service';
import { logger } from '$lib/utils/logger.js';
import { tavily } from '@tavily/core';
import { tool } from 'ai';
import { z } from 'zod';

// Web Search Tool
export const webSearchTool = tool({
	description: 'Search the web for documentation, examples, and solutions.',
	inputSchema: z.object({
		query: z.string().describe('The search query')
	}),
	execute: async ({ query }) => {
		if (!env.TAVILY_API_KEY) {
			logger.warn('Tavily API key not configured, returning empty search result');
			return 'Web search is not configured. Please set TAVILY_API_KEY environment variable.';
		}

		try {
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
	}
});

// Semantic Code Search Tool
export const codeSearchTool = tool({
	description:
		'Search the codebase using semantic similarity to find relevant code snippets and files.',
	inputSchema: z.object({
		query: z.string().describe('The search query'),
		topK: z.number().optional().describe('Number of results to return (default: 5)')
	}),
	execute: async ({ query, topK = 5 }) => {
		try {
			const results = await vectorDbService.searchSimilarCode(query, 'global', { limit: topK });
			const formattedResults = (results || []).map((r) => ({
				filePath: r.document.filePath,
				relevance: r.score,
				snippet: r.document.content.substring(0, 800)
			}));

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
	}
});

// Read File Tool
export const readFileTool = tool({
	description: 'Read the contents of a file from the sandbox.',
	inputSchema: z.object({
		sandboxId: z.string().describe('The ID of the sandbox'),
		sandboxType: z.string().optional().describe('The type of sandbox (e.g., "daytona")'),
		filePath: z.string().describe('The path to the file to read')
	}),
	execute: async ({ sandboxId, sandboxType, filePath }) => {
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
	}
});

// Write File Tool
export const writeFileTool = tool({
	description:
		'Write or update a file in the sandbox. IMPORTANT: You MUST provide the complete file content in the "content" parameter.',
	inputSchema: z.object({
		sandboxId: z
			.string()
			.describe('The ID of the sandbox where the file should be written (required)'),
		sandboxType: z.string().optional().describe('The type of sandbox (e.g., "daytona")'),
		filePath: z
			.string()
			.describe(
				'The path to the file relative to the sandbox root (required, e.g., "app/page.tsx")'
			),
		content: z
			.string()
			.describe(
				'The COMPLETE content of the file as a string (required). This should be the full file content you want to write.'
			)
	}),
	execute: async ({ sandboxId, sandboxType, filePath, content }) => {
		if (!sandboxId) return JSON.stringify({ success: false, error: 'Missing sandboxId' });
		if (!filePath) return JSON.stringify({ success: false, error: 'Missing filePath' });
		if (content === undefined || content === null)
			return JSON.stringify({ success: false, error: 'Missing content' });

		try {
			const provider = sandboxType as any;
			// Note: userId/projectId configuration is handled by the caller or context if needed,
			// but here we just pass the args. If we need context in tools, we might need a richer setup,
			// but for now we follow the existing pattern which didn't seem to pass user/project ID consistently
			// other than via "config" which isn't standard in basic tool execution without binding.
			// The original tool tried to read from `config.configurable`, which AI SDK tools don't receive directly.
			// We will assume basic write works for now.

			const success = await sandboxManager.writeFile(sandboxId, filePath, content, {
				provider
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
	}
});

// Execute Code Tool
export const executeCodeTool = tool({
	description: 'Execute code or a command in the sandbox and return the output.',
	inputSchema: z.object({
		sandboxId: z.string().describe('The ID of the sandbox'),
		sandboxType: z.string().optional().describe('The type of sandbox (e.g., "daytona")'),
		command: z.string().describe('The command to execute in the sandbox')
	}),
	execute: async ({ sandboxId, sandboxType, command }) => {
		try {
			const provider = sandboxType as any;
			const result = await sandboxManager.executeCommand(sandboxId, command, { provider });

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
	}
});

// Map of all tools
export const aiSdkTools = {
	web_search: webSearchTool,
	search_codebase: codeSearchTool,
	read_file: readFileTool,
	write_file: writeFileTool,
	execute_code: executeCodeTool
};
