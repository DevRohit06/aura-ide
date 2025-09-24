/**
 * File Operations API Client
 * Provides a clean interface for file operations that can be used throughout the frontend
 */

export interface FileOperationRequest {
	operation: 'create' | 'read' | 'update' | 'delete' | 'rename' | 'move' | 'list';
	projectId?: string;
	sandboxId?: string;
	path: string;
	content?: string;
	newPath?: string;
	metadata?: Record<string, any>;
}

export interface FileOperationResponse {
	success: boolean;
	message: string;
	data?: any;
	error?: string;
}

export class FileOperationsAPIClient {
	private baseUrl = '/api/files';

	/**
	 * Create a new file
	 */
	async createFile(options: {
		path: string;
		content: string;
		projectId?: string;
		sandboxId?: string;
		metadata?: Record<string, any>;
	}): Promise<FileOperationResponse> {
		return this.makeRequest({
			operation: 'create',
			...options
		});
	}

	/**
	 * Read file content
	 */
	async readFile(options: {
		path: string;
		projectId?: string;
		sandboxId?: string;
	}): Promise<FileOperationResponse> {
		return this.makeRequest({
			operation: 'read',
			...options
		});
	}

	/**
	 * Update file content
	 */
	async updateFile(options: {
		path: string;
		content: string;
		projectId?: string;
		sandboxId?: string;
		metadata?: Record<string, any>;
	}): Promise<FileOperationResponse> {
		return this.makeRequest({
			operation: 'update',
			...options
		});
	}

	/**
	 * Delete a file
	 */
	async deleteFile(options: {
		path: string;
		projectId?: string;
		sandboxId?: string;
	}): Promise<FileOperationResponse> {
		return this.makeRequest({
			operation: 'delete',
			...options
		});
	}

	/**
	 * Rename a file
	 */
	async renameFile(options: {
		path: string;
		newPath: string;
		projectId?: string;
		sandboxId?: string;
	}): Promise<FileOperationResponse> {
		return this.makeRequest({
			operation: 'rename',
			...options
		});
	}

	/**
	 * Move a file
	 */
	async moveFile(options: {
		path: string;
		newPath: string;
		projectId?: string;
		sandboxId?: string;
	}): Promise<FileOperationResponse> {
		return this.makeRequest({
			operation: 'move',
			...options
		});
	}

	/**
	 * List files in a directory
	 */
	async listFiles(options: {
		path: string;
		projectId?: string;
		sandboxId?: string;
	}): Promise<FileOperationResponse> {
		return this.makeRequest({
			operation: 'list',
			...options
		});
	}

	/**
	 * Save file (update if exists, create if not)
	 */
	async saveFile(options: {
		path: string;
		content: string;
		projectId?: string;
		sandboxId?: string;
		metadata?: Record<string, any>;
	}): Promise<FileOperationResponse> {
		return this.updateFile(options);
	}

	/**
	 * Make HTTP request to the API
	 */
	private async makeRequest(request: FileOperationRequest): Promise<FileOperationResponse> {
		try {
			console.log('🚀 Making API request:', {
				url: this.baseUrl,
				operation: request.operation,
				path: request.path,
				hasContent: !!request.content
			});

			const response = await fetch(this.baseUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(request)
			});

			console.log('📡 API Response status:', response.status, response.statusText);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				console.error('❌ API Error response:', errorData);
				throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
			}

			const responseData = await response.json();
			console.log('✅ API Response data:', responseData);
			return responseData;
		} catch (error) {
			console.error('❌ API Request failed:', error);
			return {
				success: false,
				message: 'Request failed',
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}
}

// Export singleton instance
export const fileOperationsAPI = new FileOperationsAPIClient();

// Export convenience functions
export const {
	createFile,
	readFile,
	updateFile,
	deleteFile,
	renameFile,
	moveFile,
	listFiles,
	saveFile
} = fileOperationsAPI;
