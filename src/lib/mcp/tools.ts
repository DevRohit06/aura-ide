import { mcpClient } from '$lib/mcp/client';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

// MCP Documentation Search Tool
export const mcpDocsSearchTool = tool(
	async (input: any) => {
		const { query } = input;
		try {
			const results = await mcpClient.searchDocumentation(query);
			return {
				results: results || [],
				source: 'mcp-docs',
				query
			};
		} catch (error) {
			return {
				error: `Failed to search documentation: ${error instanceof Error ? error.message : String(error)}`,
				results: [],
				source: 'mcp-docs',
				query
			};
		}
	},
	{
		name: 'search_documentation',
		description: 'Search through project documentation and codebase docs using MCP servers.',
		schema: z.object({
			query: z.string().describe('The search query for documentation')
		})
	}
);

// MCP Web Search Tool
export const mcpWebSearchTool = tool(
	async (input: any) => {
		const { query } = input;
		try {
			const results = await mcpClient.searchWeb(query);
			return {
				results,
				source: 'mcp-web',
				query
			};
		} catch (error) {
			return {
				error: `Failed to search web: ${error instanceof Error ? error.message : String(error)}`,
				results: null,
				source: 'mcp-web',
				query
			};
		}
	},
	{
		name: 'web_search_mcp',
		description: 'Search the web using MCP web search servers for documentation and examples.',
		schema: z.object({
			query: z.string().describe('The web search query')
		})
	}
);

// MCP Git Tool
export const mcpGitTool = tool(
	async (input: any) => {
		const { command, args = [] } = input;
		try {
			const result = await mcpClient.callTool('git', command, { args });
			return {
				result,
				command,
				args,
				source: 'mcp-git'
			};
		} catch (error) {
			return {
				error: `Failed to execute git command: ${error instanceof Error ? error.message : String(error)}`,
				command,
				args,
				source: 'mcp-git'
			};
		}
	},
	{
		name: 'git_operations',
		description: 'Execute git operations using MCP git server.',
		schema: z.object({
			command: z.string().describe('The git command to execute'),
			args: z.array(z.string()).optional().describe('Arguments for the git command')
		})
	}
);

// MCP Resource Reader Tool
export const mcpResourceReaderTool = tool(
	async (input: any) => {
		const { server, uri } = input;
		try {
			const result = await mcpClient.readResource(server, uri);
			return {
				result,
				server,
				uri,
				source: 'mcp-resource'
			};
		} catch (error) {
			return {
				error: `Failed to read resource: ${error instanceof Error ? error.message : String(error)}`,
				server,
				uri,
				source: 'mcp-resource'
			};
		}
	},
	{
		name: 'read_resource',
		description: 'Read a specific resource from an MCP server.',
		schema: z.object({
			server: z.string().describe('The MCP server name'),
			uri: z.string().describe('The resource URI to read')
		})
	}
);

// Export all MCP tools
export const mcpTools = [mcpDocsSearchTool, mcpWebSearchTool, mcpGitTool, mcpResourceReaderTool];

// Initialize MCP client on module load
mcpClient.initializeAllServers().catch((error) => {
	console.error('Failed to initialize MCP servers:', error);
});
