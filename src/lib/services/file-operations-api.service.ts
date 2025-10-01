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
		const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

		console.log('🚀 [FileOpsAPI] Starting API request', {
			requestId,
			url: this.baseUrl,
			operation: request.operation,
			path: request.path,
			projectId: request.projectId,
			sandboxId: request.sandboxId,
			hasContent: !!request.content,
			contentLength: request.content?.length || 0,
			metadata: request.metadata,
			timestamp: new Date().toISOString()
		});

		try {
			const startTime = Date.now();

			console.log('📡 [FileOpsAPI] Making HTTP request', {
				requestId,
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				bodySize: JSON.stringify(request).length
			});

			const response = await fetch(this.baseUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(request)
			});

			const requestTime = Date.now() - startTime;

			console.log('📡 [FileOpsAPI] HTTP response received', {
				requestId,
				status: response.status,
				statusText: response.statusText,
				ok: response.ok,
				headers: Object.fromEntries(response.headers.entries()),
				requestTime,
				timestamp: new Date().toISOString()
			});

			if (!response.ok) {
				let errorData;
				try {
					errorData = await response.json();
					console.error('❌ [FileOpsAPI] Error response body', {
						requestId,
						errorData,
						status: response.status
					});
				} catch (jsonError) {
					console.error('❌ [FileOpsAPI] Failed to parse error response', {
						requestId,
						jsonError: jsonError instanceof Error ? jsonError.message : String(jsonError),
						status: response.status
					});
					errorData = {};
				}

				throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
			}

			const responseData = await response.json();

			console.log('✅ [FileOpsAPI] Successful response received', {
				requestId,
				success: responseData.success,
				message: responseData.message,
				hasData: !!responseData.data,
				dataKeys: responseData.data ? Object.keys(responseData.data) : [],
				error: responseData.error,
				totalTime: Date.now() - startTime,
				timestamp: new Date().toISOString()
			});

			return responseData;
		} catch (error) {
			console.error('❌ [FileOpsAPI] Request failed with exception', {
				requestId,
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				request: {
					operation: request.operation,
					path: request.path,
					projectId: request.projectId,
					sandboxId: request.sandboxId
				},
				timestamp: new Date().toISOString()
			});

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
