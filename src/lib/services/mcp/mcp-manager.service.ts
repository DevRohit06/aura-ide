import { logger } from '$lib/utils/logger';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { writable, type Writable } from 'svelte/store';

/**
 * MCP Server Configuration
 */
export interface MCPServerConfig {
	name: string;
	url?: string; // For remote servers
	command?: string; // For local servers
	args?: string[]; // For local servers
	env?: Record<string, string>; // Environment variables
	apiKey?: string;
	enabled: boolean;
	type: 'local' | 'remote';
	description?: string;
	capabilities?: string[];
}

/**
 * MCP Tool Definition
 */
export interface MCPTool {
	name: string;
	description: string;
	inputSchema: any;
	server: string;
}

/**
 * MCP Resource Definition
 */
export interface MCPResource {
	uri: string;
	name: string;
	description?: string;
	mimeType?: string;
	server: string;
}

/**
 * MCP Manager Service
 * Manages connections to multiple MCP servers (local and remote)
 */
class MCPManagerService {
	private clients = new Map<string, Client>();
	private configs = new Map<string, MCPServerConfig>();
	private tools = new Map<string, MCPTool[]>();
	private resources = new Map<string, MCPResource[]>();

	// Reactive stores
	public connectedServers: Writable<string[]> = writable([]);
	public availableTools: Writable<MCPTool[]> = writable([]);
	public availableResources: Writable<MCPResource[]> = writable([]);
	public isInitialized = false;

	constructor() {
		this.loadDefaultConfigs();
	}

	/**
	 * Load default MCP server configurations
	 */
	private loadDefaultConfigs() {
		// Context7 - Documentation search (already installed)
		this.configs.set('context7', {
			name: 'Context7',
			type: 'local',
			command: 'npx',
			args: ['-y', '@upstash/context7-mcp'],
			enabled: true,
			description: 'Documentation search across 200+ programming languages',
			capabilities: ['search_docs', 'get_documentation']
		});

		// Filesystem (official)
		// this.configs.set('filesystem', {
		// 	name: 'Filesystem',
		// 	type: 'local',
		// 	command: 'npx',
		// 	args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
		// 	enabled: true,
		// 	description: 'File system operations',
		// 	capabilities: ['read_file', 'write_file', 'list_directory']
		// });

		// Tavily Search
		this.configs.set('tavily-search', {
			name: 'Tavily Search',
			type: 'local',
			command: 'npx',
			args: ['-y', '@mcptools/mcp-tavily'],
			enabled: true,
			description: 'Advanced web search via Tavily API',
			capabilities: ['web_search', 'extract_content']
		});

		// GitHub (official - remote)
		this.configs.set('github', {
			name: 'GitHub',
			type: 'remote',
			url: 'https://github.com/mcp',
			enabled: false,
			description: 'GitHub repository management',
			capabilities: ['manage_repos', 'issues', 'pull_requests']
		});

		// Memory (official)
		this.configs.set('memory', {
			name: 'Memory',
			type: 'local',
			command: 'npx',
			args: ['-y', '@modelcontextprotocol/server-memory'],
			enabled: true,
			description: 'Knowledge graph memory system',
			capabilities: ['store_memory', 'retrieve_memory', 'search_memory']
		});
	}

	/**
	 * Initialize MCP servers
	 */
	async initialize(serverNames?: string[]) {
		logger.info('Initializing MCP servers...', { serverNames });

		try {
			const serversToInit = serverNames || Array.from(this.configs.keys());

			for (const serverName of serversToInit) {
				const config = this.configs.get(serverName);
				if (config && config.enabled) {
					await this.connectServer(serverName, config);
				}
			}

			this.isInitialized = true;
			this.updateStores();

			logger.info('MCP servers initialized', {
				connected: this.clients.size,
				tools: this.getTotalToolCount(),
				resources: this.getTotalResourceCount()
			});
		} catch (error) {
			logger.error('Failed to initialize MCP servers', { error });
			throw error;
		}
	}

	/**
	 * Connect to an MCP server
	 */
	private async connectServer(name: string, config: MCPServerConfig) {
		try {
			logger.info(`Connecting to MCP server: ${name}`, { type: config.type });

			let transport;
			if (config.type === 'remote' && config.url) {
				transport = new SSEClientTransport(new URL(config.url));
			} else if (config.type === 'local' && config.command) {
				transport = new StdioClientTransport({
					command: config.command,
					args: config.args || [],
					env: {
						...(process.env as Record<string, string>),
						...(config.env || {})
					}
				});
			} else {
				throw new Error(`Invalid configuration for server: ${name}`);
			}

			const client = new Client(
				{
					name: 'aura-ide',
					version: '1.0.0'
				},
				{
					capabilities: {
						tools: {},
						resources: {}
					}
				}
			);

			await client.connect(transport);
			this.clients.set(name, client);

			// Fetch available tools and resources
			await this.fetchServerCapabilities(name, client);

			logger.info(`Successfully connected to MCP server: ${name}`);
		} catch (error) {
			logger.error(`Failed to connect to MCP server: ${name}`, { error });
			throw error;
		}
	}

	/**
	 * Fetch server capabilities (tools and resources)
	 */
	private async fetchServerCapabilities(serverName: string, client: Client) {
		try {
			// Fetch tools
			const toolsResponse = await client.listTools();
			if (toolsResponse.tools && Array.isArray(toolsResponse.tools)) {
				const tools: MCPTool[] = toolsResponse.tools.map((tool: any) => ({
					name: tool.name,
					description: tool.description || '',
					inputSchema: tool.inputSchema || {},
					server: serverName
				}));
				this.tools.set(serverName, tools);
				logger.info(`Fetched ${tools.length} tools from ${serverName}`);
			}

			// Fetch resources
			try {
				const resourcesResponse = await client.listResources();
				if (resourcesResponse.resources && Array.isArray(resourcesResponse.resources)) {
					const resources: MCPResource[] = resourcesResponse.resources.map((resource: any) => ({
						uri: resource.uri,
						name: resource.name,
						description: resource.description,
						mimeType: resource.mimeType,
						server: serverName
					}));
					this.resources.set(serverName, resources);
					logger.info(`Fetched ${resources.length} resources from ${serverName}`);
				}
			} catch (error) {
				// Some servers may not support resources
				logger.debug(`Server ${serverName} does not support resources`);
			}
		} catch (error) {
			logger.error(`Failed to fetch capabilities from ${serverName}`, { error });
		}
	}

	/**
	 * Call a tool on an MCP server
	 */
	async callTool(serverName: string, toolName: string, args: any): Promise<any> {
		const client = this.clients.get(serverName);
		if (!client) {
			throw new Error(`MCP server not connected: ${serverName}`);
		}

		try {
			logger.info(`Calling MCP tool: ${toolName} on ${serverName}`, { args });

			const result = await client.callTool({
				name: toolName,
				arguments: args
			});

			logger.info(`MCP tool call successful: ${toolName}`);
			return result;
		} catch (error) {
			logger.error(`MCP tool call failed: ${toolName}`, { error });
			throw error;
		}
	}

	/**
	 * Read a resource from an MCP server
	 */
	async readResource(serverName: string, uri: string): Promise<any> {
		const client = this.clients.get(serverName);
		if (!client) {
			throw new Error(`MCP server not connected: ${serverName}`);
		}

		try {
			logger.info(`Reading MCP resource: ${uri} from ${serverName}`);

			const result = await client.readResource({ uri });

			logger.info(`MCP resource read successful: ${uri}`);
			return result;
		} catch (error) {
			logger.error(`MCP resource read failed: ${uri}`, { error });
			throw error;
		}
	}

	/**
	 * Get all available tools across all connected servers
	 */
	getAllTools(): MCPTool[] {
		const allTools: MCPTool[] = [];
		for (const tools of this.tools.values()) {
			allTools.push(...tools);
		}
		return allTools;
	}

	/**
	 * Get tools for a specific server
	 */
	getToolsForServer(serverName: string): MCPTool[] {
		return this.tools.get(serverName) || [];
	}

	/**
	 * Get all available resources across all connected servers
	 */
	getAllResources(): MCPResource[] {
		const allResources: MCPResource[] = [];
		for (const resources of this.resources.values()) {
			allResources.push(...resources);
		}
		return allResources;
	}

	/**
	 * Add or update a server configuration
	 */
	addServerConfig(name: string, config: MCPServerConfig) {
		this.configs.set(name, config);
		logger.info(`Added MCP server config: ${name}`);
	}

	/**
	 * Enable a server
	 */
	async enableServer(name: string) {
		const config = this.configs.get(name);
		if (!config) {
			throw new Error(`Server config not found: ${name}`);
		}

		config.enabled = true;
		await this.connectServer(name, config);
		this.updateStores();
	}

	/**
	 * Disable a server
	 */
	async disableServer(name: string) {
		const config = this.configs.get(name);
		if (config) {
			config.enabled = false;
		}

		const client = this.clients.get(name);
		if (client) {
			await client.close();
			this.clients.delete(name);
		}

		this.tools.delete(name);
		this.resources.delete(name);
		this.updateStores();
	}

	/**
	 * Get all server configurations
	 */
	getAllConfigs(): MCPServerConfig[] {
		return Array.from(this.configs.values());
	}

	/**
	 * Get connected server names
	 */
	getConnectedServers(): string[] {
		return Array.from(this.clients.keys());
	}

	/**
	 * Check if a server is connected
	 */
	isServerConnected(name: string): boolean {
		return this.clients.has(name);
	}

	/**
	 * Update reactive stores
	 */
	private updateStores() {
		this.connectedServers.set(this.getConnectedServers());
		this.availableTools.set(this.getAllTools());
		this.availableResources.set(this.getAllResources());
	}

	/**
	 * Get total tool count
	 */
	private getTotalToolCount(): number {
		return this.getAllTools().length;
	}

	/**
	 * Get total resource count
	 */
	private getTotalResourceCount(): number {
		return this.getAllResources().length;
	}

	/**
	 * Disconnect all servers
	 */
	async disconnectAll() {
		logger.info('Disconnecting all MCP servers...');

		for (const [name, client] of this.clients.entries()) {
			try {
				await client.close();
				logger.info(`Disconnected MCP server: ${name}`);
			} catch (error) {
				logger.error(`Failed to disconnect MCP server: ${name}`, { error });
			}
		}

		this.clients.clear();
		this.tools.clear();
		this.resources.clear();
		this.updateStores();

		logger.info('All MCP servers disconnected');
	}

	/**
	 * Get statistics
	 */
	getStats() {
		return {
			totalServers: this.configs.size,
			connectedServers: this.clients.size,
			enabledServers: Array.from(this.configs.values()).filter((c) => c.enabled).length,
			totalTools: this.getTotalToolCount(),
			totalResources: this.getTotalResourceCount()
		};
	}
}

// Singleton instance
export const mcpManager = new MCPManagerService();
