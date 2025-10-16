import { logger } from '$lib/utils/logger';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { mcpManager, type MCPTool } from './mcp-manager.service';

/**
 * MCP Tools Service
 * Converts MCP tools to LangChain-compatible tools
 */
class MCPToolsService {
	/**
	 * Convert MCP tool schema to Zod schema
	 */
	private convertSchemaToZod(inputSchema: any): z.ZodType<any> {
		try {
			if (!inputSchema || !inputSchema.properties) {
				return z.object({});
			}

			const shape: Record<string, z.ZodType<any>> = {};

			for (const [key, value] of Object.entries(inputSchema.properties)) {
				const prop = value as any;

				// Handle different types
				switch (prop.type) {
					case 'string':
						shape[key] = z.string().describe(prop.description || '');
						break;
					case 'number':
					case 'integer':
						shape[key] = z.number().describe(prop.description || '');
						break;
					case 'boolean':
						shape[key] = z.boolean().describe(prop.description || '');
						break;
					case 'array':
						shape[key] = z.array(z.any()).describe(prop.description || '');
						break;
					case 'object':
						shape[key] = z
							.object({})
							.passthrough()
							.describe(prop.description || '');
						break;
					default:
						shape[key] = z.any().describe(prop.description || '');
				}

				// Make optional if not required
				if (!inputSchema.required?.includes(key)) {
					shape[key] = shape[key].optional();
				}
			}

			return z.object(shape);
		} catch (error) {
			logger.error('Failed to convert schema to Zod', { error, inputSchema });
			return z.object({});
		}
	}

	/**
	 * Convert MCP tool to LangChain tool
	 */
	convertMCPToolToLangChain(mcpTool: MCPTool) {
		const zodSchema = this.convertSchemaToZod(mcpTool.inputSchema);

		return tool(
			async (input: any) => {
				try {
					logger.info(`Executing MCP tool: ${mcpTool.name}`, { server: mcpTool.server });

					const result = await mcpManager.callTool(mcpTool.server, mcpTool.name, input);

					// Extract content from result
					if (result.content && Array.isArray(result.content)) {
						const textContent = result.content
							.filter((c: any) => c.type === 'text')
							.map((c: any) => c.text)
							.join('\n');
						return textContent || JSON.stringify(result);
					}

					return JSON.stringify(result);
				} catch (error) {
					logger.error(`MCP tool execution failed: ${mcpTool.name}`, { error });
					return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
				}
			},
			{
				name: `mcp_${mcpTool.server}_${mcpTool.name}`,
				description: `[MCP:${mcpTool.server}] ${mcpTool.description}`,
				schema: zodSchema
			}
		);
	}

	/**
	 * Get all MCP tools as LangChain tools
	 */
	getAllLangChainTools() {
		const mcpTools = mcpManager.getAllTools();
		return mcpTools.map((tool) => this.convertMCPToolToLangChain(tool));
	}

	/**
	 * Get MCP tools for a specific server as LangChain tools
	 */
	getLangChainToolsForServer(serverName: string) {
		const mcpTools = mcpManager.getToolsForServer(serverName);
		return mcpTools.map((tool) => this.convertMCPToolToLangChain(tool));
	}

	/**
	 * Search documentation using Context7 (if available)
	 */
	async searchDocumentation(query: string, language?: string): Promise<string> {
		try {
			if (!mcpManager.isServerConnected('context7')) {
				return 'Context7 documentation search is not available. Please enable the Context7 MCP server.';
			}

			const result = await mcpManager.callTool('context7', 'search_docs', {
				query,
				language
			});

			return JSON.stringify(result);
		} catch (error) {
			logger.error('Documentation search failed', { error });
			return `Error searching documentation: ${error instanceof Error ? error.message : 'Unknown error'}`;
		}
	}

	/**
	 * Create Context7 documentation search tool
	 */
	createContext7Tool() {
		return tool(
			async (input: any) => {
				return await this.searchDocumentation(input.query, input.language);
			},
			{
				name: 'search_documentation',
				description:
					'Search programming documentation across 200+ languages using Context7. Use this to find API documentation, code examples, and programming guides.',
				schema: z.object({
					query: z.string().describe('The search query for documentation'),
					language: z
						.string()
						.optional()
						.describe('Optional programming language to filter results')
				})
			}
		);
	}

	/**
	 * Create memory storage tool
	 */
	createMemoryTool() {
		return tool(
			async (input: any) => {
				try {
					if (!mcpManager.isServerConnected('memory')) {
						return 'Memory server is not available. Please enable the Memory MCP server.';
					}

					const { action, key, value, query } = input;

					switch (action) {
						case 'store':
							if (!key || !value) {
								return 'Error: key and value are required for store action';
							}
							return await mcpManager.callTool('memory', 'store_memory', { key, value });

						case 'retrieve':
							if (!key) {
								return 'Error: key is required for retrieve action';
							}
							return await mcpManager.callTool('memory', 'retrieve_memory', { key });

						case 'search':
							if (!query) {
								return 'Error: query is required for search action';
							}
							return await mcpManager.callTool('memory', 'search_memory', { query });

						default:
							return `Error: Unknown action: ${action}`;
					}
				} catch (error) {
					logger.error('Memory tool execution failed', { error });
					return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
				}
			},
			{
				name: 'memory_operations',
				description:
					'Store, retrieve, and search memories using the knowledge graph memory system. Actions: store, retrieve, search.',
				schema: z.object({
					action: z.enum(['store', 'retrieve', 'search']).describe('The action to perform'),
					key: z.string().optional().describe('Key for store/retrieve operations'),
					value: z.any().optional().describe('Value to store'),
					query: z.string().optional().describe('Search query for search operation')
				})
			}
		);
	}
}

// Singleton instance
export const mcpToolsService = new MCPToolsService();
