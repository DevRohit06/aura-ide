/**
 * File Operations Tool Service
 * Provides tools for editing files across all storage backends (sandbox, R2, database)
 */

import { FileOperationsAPIClient } from '$lib/services/file-operations-api.service.js';
import { SandboxManager } from '$lib/services/sandbox/sandbox-manager';
import type { SandboxProvider } from '$lib/types/sandbox';

export interface FileEditOperation {
	id: string;
	type: 'create' | 'update' | 'delete';
	filePath: string;
	content?: string;
	projectId?: string;
	sandboxId?: string;
	timestamp: Date;
}

export interface ToolCallResult {
	success: boolean;
	message: string;
	data?: any;
	error?: string;
}

export class FileOperationsToolService {
	private fileOpsClient: FileOperationsAPIClient;
	private sandboxManager: SandboxManager;

	constructor() {
		this.fileOpsClient = new FileOperationsAPIClient();
		this.sandboxManager = SandboxManager.getInstance();
	}

	async initialize() {
		await this.sandboxManager.initialize();
	}

	/**
	 * Create a new file across all storage backends
	 */
	async createFile(
		filePath: string,
		content: string,
		options?: {
			projectId?: string;
			sandboxId?: string;
			metadata?: Record<string, string>;
		}
	): Promise<ToolCallResult> {
		try {
			// Use unified FileOperations API which handles database, R2, and sandbox
			const result = await this.fileOpsClient.createFile({
				path: filePath,
				content,
				projectId: options?.projectId,
				sandboxId: options?.sandboxId,
				metadata: {
					...options?.metadata,
					createdAt: new Date().toISOString(),
					operation: 'create',
					createdBy: 'file-operations-tool'
				}
			});

			return {
				success: result.success,
				message: result.message,
				data: result.data,
				error: result.error
			};
		} catch (error) {
			console.error('Failed to create file:', error);
			return {
				success: false,
				message: `Failed to create file ${filePath}`,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Update an existing file across all storage backends
	 */
	async updateFile(
		filePath: string,
		content: string,
		options?: {
			projectId?: string;
			sandboxId?: string;
			metadata?: Record<string, string>;
		}
	): Promise<ToolCallResult> {
		try {
			// Use unified FileOperations API
			const result = await this.fileOpsClient.updateFile({
				path: filePath,
				content,
				projectId: options?.projectId,
				sandboxId: options?.sandboxId,
				metadata: {
					...options?.metadata,
					updatedAt: new Date().toISOString(),
					operation: 'update',
					updatedBy: 'file-operations-tool'
				}
			});

			return {
				success: result.success,
				message: result.message,
				data: result.data,
				error: result.error
			};
		} catch (error) {
			console.error('Failed to update file:', error);
			return {
				success: false,
				message: `Failed to update file ${filePath}`,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Delete a file from all storage backends
	 */
	async deleteFile(
		filePath: string,
		options?: {
			projectId?: string;
			sandboxId?: string;
		}
	): Promise<ToolCallResult> {
		try {
			// Use unified FileOperations API
			const result = await this.fileOpsClient.deleteFile({
				path: filePath,
				projectId: options?.projectId,
				sandboxId: options?.sandboxId
			});

			return {
				success: result.success,
				message: result.message,
				data: result.data,
				error: result.error
			};
		} catch (error) {
			console.error('Failed to delete file:', error);
			return {
				success: false,
				message: `Failed to delete file ${filePath}`,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Read a file from the most current source (sandbox > R2 > database)
	 */
	async readFile(
		filePath: string,
		options?: {
			projectId?: string;
			sandboxId?: string;
		}
	): Promise<ToolCallResult> {
		try {
			// Use unified FileOperations API
			const result = await this.fileOpsClient.readFile({
				path: filePath,
				projectId: options?.projectId,
				sandboxId: options?.sandboxId
			});

			return {
				success: result.success,
				message: result.message,
				data: result.data,
				error: result.error
			};
		} catch (error) {
			console.error('Failed to read file:', error);
			return {
				success: false,
				message: `Failed to read file ${filePath}`,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * List files in a directory from sandbox
	 */
	async listFiles(
		directoryPath?: string,
		options?: {
			projectId?: string;
			sandboxId?: string;
			recursive?: boolean;
			maxDepth?: number;
		}
	): Promise<ToolCallResult> {
		try {
			if (options?.sandboxId) {
				// List from sandbox using SandboxManager
				const files = await this.sandboxManager.listFiles(
					options.sandboxId,
					directoryPath || '/workspace',
					{
						recursive: options.recursive,
						maxDepth: options.maxDepth
					}
				);

				const fileData = files.map((file) => ({
					path: file.path,
					type: file.type,
					size: file.size,
					modified: file.modified
				}));

				return {
					success: true,
					message: `Found ${files.length} files`,
					data: { files: fileData }
				};
			} else {
				// For project-only listing, we'd need to implement this in FileOperations API
				// For now, return empty result
				return {
					success: true,
					message: 'File listing from storage not yet implemented',
					data: { files: [] }
				};
			}
		} catch (error) {
			console.error('Failed to list files:', error);
			return {
				success: false,
				message: 'Failed to list files',
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Execute a command in sandbox
	 */
	async executeCommand(
		command: string,
		options?: {
			sandboxId?: string;
			workingDir?: string;
			timeout?: number;
			provider?: SandboxProvider;
		}
	): Promise<ToolCallResult> {
		try {
			if (!options?.sandboxId) {
				return {
					success: false,
					message: 'Sandbox ID required for command execution',
					error: 'Missing sandbox ID'
				};
			}

			const result = await this.sandboxManager.executeCommand(options.sandboxId, command, {
				workingDir: options.workingDir || '/workspace',
				timeout: options.timeout || 30000
			});

			return {
				success: result.success,
				message: result.success ? 'Command executed successfully' : 'Command execution failed',
				data: {
					output: result.output,
					exitCode: result.exitCode,
					duration: result.duration
				},
				error: result.error
			};
		} catch (error) {
			console.error('Failed to execute command:', error);
			return {
				success: false,
				message: 'Failed to execute command',
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Get content type based on file extension
	 */
	private getContentType(filePath: string): string {
		const ext = filePath.split('.').pop()?.toLowerCase();
		const contentTypes: Record<string, string> = {
			js: 'application/javascript',
			ts: 'application/typescript',
			json: 'application/json',
			html: 'text/html',
			css: 'text/css',
			md: 'text/markdown',
			txt: 'text/plain',
			py: 'text/x-python',
			rs: 'text/rust',
			go: 'text/go',
			java: 'text/java',
			cpp: 'text/cpp',
			c: 'text/c',
			php: 'text/php',
			rb: 'text/ruby',
			sh: 'text/shell',
			yml: 'text/yaml',
			yaml: 'text/yaml',
			xml: 'text/xml',
			sql: 'text/sql'
		};

		return contentTypes[ext || ''] || 'text/plain';
	}
}

// Singleton instance
export const fileOperationsToolService = new FileOperationsToolService();
