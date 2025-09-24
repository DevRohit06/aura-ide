/**
 * File Operations Tool Service
 * Provides tools for editing files stored in R2 storage
 */

import { r2StorageService } from '$lib/services/r2-storage.service.js';

export interface FileEditOperation {
	id: string;
	type: 'create' | 'update' | 'delete';
	filePath: string;
	content?: string;
	projectId: string;
	timestamp: Date;
}

export interface ToolCallResult {
	success: boolean;
	message: string;
	data?: any;
	error?: string;
}

export class FileOperationsToolService {
	/**
	 * Create a new file in R2 storage
	 */
	async createFile(
		projectId: string,
		filePath: string,
		content: string,
		metadata?: Record<string, string>
	): Promise<ToolCallResult> {
		try {
			const key = `projects/${projectId}/${filePath}`;

			// Check if file already exists
			const exists = await r2StorageService.fileExists(key);
			if (exists) {
				return {
					success: false,
					message: `File ${filePath} already exists`,
					error: 'File already exists'
				};
			}

			await r2StorageService.uploadFile(key, content, {
				contentType: this.getContentType(filePath),
				metadata: {
					...metadata,
					createdAt: new Date().toISOString(),
					operation: 'create'
				}
			});

			return {
				success: true,
				message: `Successfully created file ${filePath}`,
				data: {
					filePath,
					size: Buffer.byteLength(content, 'utf8')
				}
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
	 * Update an existing file in R2 storage
	 */
	async updateFile(
		projectId: string,
		filePath: string,
		content: string,
		metadata?: Record<string, string>
	): Promise<ToolCallResult> {
		try {
			const key = `projects/${projectId}/${filePath}`;

			// Check if file exists
			const exists = await r2StorageService.fileExists(key);
			if (!exists) {
				return {
					success: false,
					message: `File ${filePath} does not exist`,
					error: 'File not found'
				};
			}

			await r2StorageService.uploadFile(key, content, {
				contentType: this.getContentType(filePath),
				metadata: {
					...metadata,
					updatedAt: new Date().toISOString(),
					operation: 'update'
				}
			});

			return {
				success: true,
				message: `Successfully updated file ${filePath}`,
				data: {
					filePath,
					size: Buffer.byteLength(content, 'utf8')
				}
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
	 * Delete a file from R2 storage
	 */
	async deleteFile(projectId: string, filePath: string): Promise<ToolCallResult> {
		try {
			const key = `projects/${projectId}/${filePath}`;

			// Check if file exists
			const exists = await r2StorageService.fileExists(key);
			if (!exists) {
				return {
					success: false,
					message: `File ${filePath} does not exist`,
					error: 'File not found'
				};
			}

			const deleted = await r2StorageService.deleteFile(key);
			if (!deleted) {
				return {
					success: false,
					message: `Failed to delete file ${filePath}`,
					error: 'Delete operation failed'
				};
			}

			return {
				success: true,
				message: `Successfully deleted file ${filePath}`,
				data: { filePath }
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
	 * Read a file from R2 storage
	 */
	async readFile(projectId: string, filePath: string): Promise<ToolCallResult> {
		try {
			const key = `projects/${projectId}/${filePath}`;
			const content = await r2StorageService.downloadFile(key);

			if (!content) {
				return {
					success: false,
					message: `File ${filePath} not found`,
					error: 'File not found'
				};
			}

			const textContent = content.toString('utf8');
			return {
				success: true,
				message: `Successfully read file ${filePath}`,
				data: {
					filePath,
					content: textContent,
					size: content.length
				}
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
	 * List files in a directory
	 */
	async listFiles(projectId: string, directoryPath?: string): Promise<ToolCallResult> {
		try {
			const prefix = directoryPath
				? `projects/${projectId}/${directoryPath}/`
				: `projects/${projectId}/`;

			const result = await r2StorageService.listFiles({ prefix });

			const files = result.objects.map((obj) => ({
				path: obj.key.replace(`projects/${projectId}/`, ''),
				size: obj.size,
				lastModified: obj.lastModified,
				etag: obj.etag
			}));

			return {
				success: true,
				message: `Found ${files.length} files`,
				data: { files }
			};
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
