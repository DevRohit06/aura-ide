import { logger } from '$lib/utils/logger.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface MCPServerConfig {
	name: string;
	command: string;
	args: string[];
	env?: Record<string, string>;
}

export interface MCPTool {
	name: string;
	description: string;
	inputSchema: any;
}

export interface MCPResource {
	uri: string;
	name: string;
	description?: string;
	mimeType?: string;
}

export class MCPClient {
	private clients: Map<string, Client> = new Map();
	private serverConfigs: Map<string, MCPServerConfig> = new Map();

	constructor() {
		this.initializeDefaultServers();
	}

	private initializeDefaultServers() {
		// Documentation server for filesystem access
		this.serverConfigs.set('docs', {
			name: 'docs',
			command: 'npx',
			args: ['-y', '@modelcontextprotocol/server-filesystem', '/mnt/64580CE4580CB738/aura/docs'],
			env: { NODE_ENV: 'production' }
		});

		// Web search server (if available)
		this.serverConfigs.set('web-search', {
			name: 'web-search',
			command: 'npx',
			args: ['-y', '@modelcontextprotocol/server-brave-search'],
			env: { BRAVE_API_KEY: process.env.BRAVE_API_KEY || '' }
		});

		// Git repository server
		this.serverConfigs.set('git', {
			name: 'git',
			command: 'npx',
			args: [
				'-y',
				'@modelcontextprotocol/server-git',
				'--repository',
				'/mnt/64580CE4580CB738/aura'
			],
			env: { NODE_ENV: 'production' }
		});
	}

	async connectServer(serverName: string): Promise<boolean> {
		try {
			const config = this.serverConfigs.get(serverName);
			if (!config) {
				logger.error(`MCP server config not found: ${serverName}`);
				return false;
			}

			logger.info(`Connecting to MCP server: ${serverName}`);

			const transport = new StdioClientTransport({
				command: config.command,
				args: config.args,
				env: Object.fromEntries(
					Object.entries({ ...process.env, ...config.env }).filter(
						([, value]) => value !== undefined
					)
				) as Record<string, string>
			});

			const client = new Client(
				{
					name: 'aura-coding-agent',
					version: '1.0.0'
				},
				{
					capabilities: {
						tools: {},
						resources: {},
						sampling: {}
					}
				}
			);

			await client.connect(transport);
			this.clients.set(serverName, client);

			logger.info(`✅ Successfully connected to MCP server: ${serverName}`);
			return true;
		} catch (error) {
			logger.error(`Failed to connect to MCP server ${serverName}:`, error);
			return false;
		}
	}

	async disconnectServer(serverName: string): Promise<void> {
		try {
			const client = this.clients.get(serverName);
			if (client) {
				await client.close();
				this.clients.delete(serverName);
				logger.info(`Disconnected from MCP server: ${serverName}`);
			}
		} catch (error) {
			logger.error(`Error disconnecting from MCP server ${serverName}:`, error);
		}
	}

	async listTools(serverName: string): Promise<MCPTool[]> {
		try {
			const client = this.clients.get(serverName);
			if (!client) {
				throw new Error(`MCP server not connected: ${serverName}`);
			}

			const response = (await client.request({ method: 'tools/list' }, {} as any)) as any;

			return response.tools || [];
		} catch (error) {
			logger.error(`Failed to list tools for server ${serverName}:`, error);
			return [];
		}
	}

	async callTool(serverName: string, toolName: string, args: any = {}): Promise<any> {
		try {
			const client = this.clients.get(serverName);
			if (!client) {
				throw new Error(`MCP server not connected: ${serverName}`);
			}

			logger.info(`Calling MCP tool: ${serverName}.${toolName}`, args);

			const response = (await client.request(
				{
					method: 'tools/call',
					params: {
						name: toolName,
						arguments: args
					}
				},
				{} as any
			)) as any;

			logger.info(`MCP tool call result: ${serverName}.${toolName}`, response);
			return response;
		} catch (error) {
			logger.error(`Failed to call MCP tool ${serverName}.${toolName}:`, error);
			throw error;
		}
	}

	async listResources(serverName: string): Promise<MCPResource[]> {
		try {
			const client = this.clients.get(serverName);
			if (!client) {
				throw new Error(`MCP server not connected: ${serverName}`);
			}

			const response = (await client.request({ method: 'resources/list' }, {} as any)) as any;

			return response.resources || [];
		} catch (error) {
			logger.error(`Failed to list resources for server ${serverName}:`, error);
			return [];
		}
	}

	async readResource(serverName: string, uri: string): Promise<any> {
		try {
			const client = this.clients.get(serverName);
			if (!client) {
				throw new Error(`MCP server not connected: ${serverName}`);
			}

			logger.info(`Reading MCP resource: ${serverName}:${uri}`);

			const response = (await client.request(
				{
					method: 'resources/read',
					params: { uri }
				},
				{} as any
			)) as any;

			return response;
		} catch (error) {
			logger.error(`Failed to read MCP resource ${serverName}:${uri}:`, error);
			throw error;
		}
	}

	async searchDocumentation(query: string): Promise<string[]> {
		try {
			// Try to connect to docs server if not already connected
			if (!this.clients.has('docs')) {
				await this.connectServer('docs');
			}

			// Use filesystem server to search documentation
			const tools = await this.listTools('docs');

			// Look for a search or read tool
			const searchTool = tools.find(
				(t) => t.name.includes('search') || t.name.includes('read') || t.name.includes('list')
			);

			if (searchTool) {
				const result = await this.callTool('docs', searchTool.name, { query });
				return this.extractTextContent(result);
			}

			// Fallback: list resources and read relevant ones
			const resources = await this.listResources('docs');
			const relevantResources = resources.filter(
				(r) =>
					r.name.toLowerCase().includes(query.toLowerCase()) ||
					(r.description && r.description.toLowerCase().includes(query.toLowerCase()))
			);

			const results: string[] = [];
			for (const resource of relevantResources.slice(0, 3)) {
				try {
					const content = await this.readResource('docs', resource.uri);
					results.push(...this.extractTextContent(content));
				} catch (error) {
					logger.warn(`Failed to read resource ${resource.uri}:`, error);
				}
			}

			return results;
		} catch (error) {
			logger.error('Failed to search documentation:', error);
			return [];
		}
	}

	async searchWeb(query: string): Promise<any> {
		try {
			// Try to connect to web search server if not already connected
			if (!this.clients.has('web-search')) {
				const connected = await this.connectServer('web-search');
				if (!connected) {
					throw new Error('Web search server not available');
				}
			}

			const tools = await this.listTools('web-search');
			const searchTool = tools.find((t) => t.name.includes('search'));

			if (searchTool) {
				return await this.callTool('web-search', searchTool.name, { query });
			}

			throw new Error('No search tool available on web-search server');
		} catch (error) {
			logger.error('Failed to search web:', error);
			throw error;
		}
	}

	private extractTextContent(result: any): string[] {
		const contents: string[] = [];

		if (result.content) {
			if (Array.isArray(result.content)) {
				result.content.forEach((item: any) => {
					if (item.type === 'text' && item.text) {
						contents.push(item.text);
					}
				});
			} else if (typeof result.content === 'string') {
				contents.push(result.content);
			}
		}

		return contents;
	}

	async getConnectedServers(): Promise<string[]> {
		return Array.from(this.clients.keys());
	}

	async initializeAllServers(): Promise<void> {
		logger.info('Initializing all MCP servers...');

		for (const serverName of this.serverConfigs.keys()) {
			try {
				await this.connectServer(serverName);
			} catch (error) {
				logger.warn(`Failed to initialize MCP server ${serverName}:`, error);
			}
		}

		logger.info(
			`MCP initialization complete. Connected servers: ${Array.from(this.clients.keys()).join(', ')}`
		);
	}

	async shutdown(): Promise<void> {
		logger.info('Shutting down MCP client...');

		for (const serverName of this.clients.keys()) {
			await this.disconnectServer(serverName);
		}

		logger.info('MCP client shutdown complete');
	}
}

// Global MCP client instance
export const mcpClient = new MCPClient();
