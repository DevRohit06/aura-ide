/**
 * File Edit Tool Integration
 * Provides easy-to-use functions for AI agents to edit files
 */

import { executionContext, toolCallActions } from '$lib/stores/tool-calls.store.js';
import { get } from 'svelte/store';

export interface FileEditOptions {
	projectId?: string;
	sandboxId?: string;
	reason?: string;
}

/**
 * AI-friendly file editing functions
 */
export const fileEditTool = {
	/**
	 * Create a new file
	 */
	async createFile(
		filePath: string,
		content: string,
		options: FileEditOptions = {}
	): Promise<void> {
		const context = get(executionContext);

		await toolCallActions.executeToolCall(
			'edit_file',
			{
				operation: 'create',
				filePath,
				content,
				projectId: options.projectId || context?.projectId,
				reason: options.reason || `Creating file ${filePath}`
			},
			{
				projectId: options.projectId,
				sandboxId: options.sandboxId
			}
		);
	},

	/**
	 * Update an existing file
	 */
	async updateFile(
		filePath: string,
		content: string,
		options: FileEditOptions = {}
	): Promise<void> {
		const context = get(executionContext);

		await toolCallActions.executeToolCall(
			'edit_file',
			{
				operation: 'update',
				filePath,
				content,
				projectId: options.projectId || context?.projectId,
				reason: options.reason || `Updating file ${filePath}`
			},
			{
				projectId: options.projectId,
				sandboxId: options.sandboxId
			}
		);
	},

	/**
	 * Delete a file
	 */
	async deleteFile(filePath: string, options: FileEditOptions = {}): Promise<void> {
		const context = get(executionContext);

		await toolCallActions.executeToolCall(
			'edit_file',
			{
				operation: 'delete',
				filePath,
				projectId: options.projectId || context?.projectId,
				reason: options.reason || `Deleting file ${filePath}`
			},
			{
				projectId: options.projectId,
				sandboxId: options.sandboxId
			}
		);
	},

	/**
	 * Read a file
	 */
	async readFile(filePath: string, options: FileEditOptions = {}): Promise<void> {
		const context = get(executionContext);

		await toolCallActions.executeToolCall(
			'read_file',
			{
				filePath,
				projectId: options.projectId || context?.projectId
			},
			{
				projectId: options.projectId,
				sandboxId: options.sandboxId
			}
		);
	},

	/**
	 * List files in a directory
	 */
	async listFiles(directoryPath: string = '', options: FileEditOptions = {}): Promise<void> {
		const context = get(executionContext);

		await toolCallActions.executeToolCall(
			'list_files',
			{
				directoryPath,
				projectId: options.projectId || context?.projectId
			},
			{
				projectId: options.projectId,
				sandboxId: options.sandboxId
			}
		);
	}
};

/**
 * Batch file operations
 */
export const batchFileOperations = {
	/**
	 * Create multiple files at once
	 */
	async createFiles(
		files: Array<{ path: string; content: string }>,
		options: FileEditOptions = {}
	): Promise<void> {
		for (const file of files) {
			await fileEditTool.createFile(file.path, file.content, {
				...options,
				reason: options.reason || `Batch creating ${files.length} files`
			});
		}
	},

	/**
	 * Update multiple files at once
	 */
	async updateFiles(
		files: Array<{ path: string; content: string }>,
		options: FileEditOptions = {}
	): Promise<void> {
		for (const file of files) {
			await fileEditTool.updateFile(file.path, file.content, {
				...options,
				reason: options.reason || `Batch updating ${files.length} files`
			});
		}
	},

	/**
	 * Delete multiple files at once
	 */
	async deleteFiles(filePaths: string[], options: FileEditOptions = {}): Promise<void> {
		for (const filePath of filePaths) {
			await fileEditTool.deleteFile(filePath, {
				...options,
				reason: options.reason || `Batch deleting ${filePaths.length} files`
			});
		}
	}
};

/**
 * Initialize file editing context for a project
 */
export function initializeFileEditingContext(projectId: string, sandboxId?: string) {
	toolCallActions.setExecutionContext({
		projectId,
		sandboxId,
		userId: 'current_user' // This should be replaced with actual user ID
	});
}

/**
 * Context-aware file operations that don't require projectId
 */
export const contextualFileOps = {
	async create(filePath: string, content: string, reason?: string) {
		await fileEditTool.createFile(filePath, content, { reason });
	},

	async update(filePath: string, content: string, reason?: string) {
		await fileEditTool.updateFile(filePath, content, { reason });
	},

	async delete(filePath: string, reason?: string) {
		await fileEditTool.deleteFile(filePath, { reason });
	},

	async read(filePath: string) {
		await fileEditTool.readFile(filePath);
	},

	async list(directoryPath?: string) {
		await fileEditTool.listFiles(directoryPath);
	}
};
