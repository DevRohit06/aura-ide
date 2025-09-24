import type { AnyWebSocketMessage, FileSystemMessage } from '$lib/services/websocket.service';
import { writable } from 'svelte/store';
import { currentProjectId } from './current-project.store';
import { fileActions } from './files.store';

// WebSocket connection state
export interface WebSocketState {
	isConnected: boolean;
	isConnecting: boolean;
	connectionId: string | null;
	lastMessage: AnyWebSocketMessage | null;
	error: string | null;
	reconnectAttempts: number;
}

// WebSocket store
export const webSocketStore = writable<WebSocketState>({
	isConnected: false,
	isConnecting: false,
	connectionId: null,
	lastMessage: null,
	error: null,
	reconnectAttempts: 0
});

// WebSocket actions
export const webSocketActions = {
	// Connect to WebSocket server
	connect: async (projectId?: string) => {
		// Only connect on client side
		if (typeof window === 'undefined') {
			console.warn('WebSocket connection attempted on server side, skipping');
			return;
		}

		webSocketStore.update((state) => ({ ...state, isConnecting: true, error: null }));

		try {
			// Get current project ID if not provided
			if (!projectId) {
				projectId =
					(await new Promise<string | null>((resolve) => {
						currentProjectId.subscribe((id) => resolve(id));
					})) || undefined;
			}

			// Create WebSocket connection
			const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
			const wsUrl = `${protocol}//${window.location.host}/api/ws${projectId ? `?projectId=${projectId}` : ''}`;

			const ws = new WebSocket(wsUrl);

			ws.onopen = () => {
				console.log('WebSocket connected');
				webSocketStore.update((state) => ({
					...state,
					isConnected: true,
					isConnecting: false,
					reconnectAttempts: 0
				}));
			};

			ws.onmessage = (event) => {
				try {
					const message: AnyWebSocketMessage = JSON.parse(event.data);

					// Update last message
					webSocketStore.update((state) => ({ ...state, lastMessage: message }));

					// Handle file system messages
					if (message.type.startsWith('file_') || message.type.startsWith('directory_')) {
						handleFileSystemMessage(message as FileSystemMessage);
					}
				} catch (error) {
					console.error('Error parsing WebSocket message:', error);
				}
			};

			ws.onclose = (event) => {
				console.log('WebSocket disconnected:', event.code, event.reason);
				webSocketStore.update((state) => ({
					...state,
					isConnected: false,
					isConnecting: false,
					connectionId: null
				}));

				// Auto-reconnect logic
				webSocketStore.update((state) => {
					if (state.reconnectAttempts < 5) {
						setTimeout(
							() => {
								webSocketActions.connect(projectId);
							},
							1000 * Math.pow(2, state.reconnectAttempts)
						);
						return { ...state, reconnectAttempts: state.reconnectAttempts + 1 };
					}
					return state;
				});
			};

			ws.onerror = (error) => {
				console.error('WebSocket error:', error);
				webSocketStore.update((state) => ({
					...state,
					error: 'WebSocket connection error',
					isConnecting: false
				}));
			};
		} catch (error) {
			console.error('Failed to connect to WebSocket:', error);
			webSocketStore.update((state) => ({
				...state,
				error: 'Failed to connect to WebSocket',
				isConnecting: false
			}));
		}
	},

	// Disconnect from WebSocket server
	disconnect: () => {
		// Note: In a real implementation, you'd close the WebSocket connection
		webSocketStore.update((state) => ({
			...state,
			isConnected: false,
			isConnecting: false,
			connectionId: null
		}));
	},

	// Send a message through WebSocket
	send: async (message: Omit<AnyWebSocketMessage, 'timestamp'>) => {
		// Note: In a real implementation, you'd send the message through the WebSocket
		console.log('WebSocket message sent:', message);
	}
};

// Handle file system messages and update the files store
function handleFileSystemMessage(message: FileSystemMessage) {
	const { type, data } = message;

	switch (type) {
		case 'file_created':
			// Add new file to the store
			fileActions.addFile({
				id: generateFileId(data.path),
				name: getFileName(data.path),
				path: data.path,
				content: data.content || '',
				parentId: getParentId(data.path),
				type: 'file',
				createdAt: new Date(),
				modifiedAt: new Date(),
				size: data.size || 0,
				permissions: {
					read: true,
					write: true,
					execute: false,
					delete: true,
					share: true,
					owner: 'system',
					collaborators: []
				},
				language: getLanguageFromPath(data.path),
				encoding: 'utf-8',
				mimeType: getMimeType(data.path),
				isDirty: false,
				isReadOnly: false,
				metadata: {
					extension: getExtension(data.path),
					lineCount: data.content ? data.content.split('\n').length : 0,
					characterCount: data.content ? data.content.length : 0,
					wordCount: data.content
						? data.content.split(/\s+/).filter((word) => word.length > 0).length
						: 0,
					lastCursor: null,
					bookmarks: [],
					breakpoints: [],
					folds: [],
					searchHistory: []
				}
			} as any); // Type assertion needed due to complex File type
			break;

		case 'file_modified':
			// Update existing file content
			const modifiedFileId = generateFileId(data.path);
			fileActions.updateFileContent(modifiedFileId, data.content || '');
			fileActions.updateFile(modifiedFileId, {
				modifiedAt: new Date(data.lastModified || Date.now()),
				size: data.size || 0
			});
			break;

		case 'file_deleted':
			// Remove file from the store
			const deletedFileId = generateFileId(data.path);
			fileActions.removeFile(deletedFileId);
			break;

		case 'directory_created':
			// Add new directory to the store
			fileActions.addFile({
				id: generateFileId(data.path),
				name: getFileName(data.path),
				path: data.path,
				content: '',
				parentId: getParentId(data.path),
				type: 'directory',
				createdAt: new Date(),
				modifiedAt: new Date(),
				size: 0,
				permissions: {
					read: true,
					write: true,
					execute: true,
					delete: true,
					share: true,
					owner: 'system',
					collaborators: []
				}
			} as any);
			break;

		case 'directory_deleted':
			// Remove directory from the store
			const deletedDirId = generateFileId(data.path);
			fileActions.removeFile(deletedDirId);
			break;
	}
}

// Utility functions for file operations
function generateFileId(path: string): string {
	return btoa(path)
		.replace(/[^a-zA-Z0-9]/g, '')
		.substring(0, 16);
}

function getFileName(path: string): string {
	return path.split('/').pop() || path;
}

function getParentId(path: string): string | null {
	const parts = path.split('/');
	parts.pop(); // Remove the current file/directory name
	return parts.length > 0 ? generateFileId(parts.join('/')) : null;
}

function getExtension(path: string): string {
	const name = getFileName(path);
	const dotIndex = name.lastIndexOf('.');
	return dotIndex > 0 ? name.substring(dotIndex + 1) : '';
}

function getLanguageFromPath(path: string): string {
	const ext = getExtension(path).toLowerCase();
	const languageMap: Record<string, string> = {
		js: 'javascript',
		jsx: 'javascript',
		ts: 'typescript',
		tsx: 'typescript',
		py: 'python',
		java: 'java',
		cpp: 'cpp',
		c: 'c',
		cs: 'csharp',
		php: 'php',
		rb: 'ruby',
		go: 'go',
		rs: 'rust',
		sh: 'shell',
		html: 'html',
		css: 'css',
		scss: 'scss',
		less: 'less',
		json: 'json',
		xml: 'xml',
		yaml: 'yaml',
		yml: 'yaml',
		md: 'markdown',
		txt: 'plaintext'
	};
	return languageMap[ext] || 'plaintext';
}

function getMimeType(path: string): string {
	const ext = getExtension(path).toLowerCase();
	const mimeMap: Record<string, string> = {
		js: 'application/javascript',
		jsx: 'application/javascript',
		ts: 'application/typescript',
		tsx: 'application/typescript',
		py: 'text/x-python',
		java: 'text/x-java-source',
		cpp: 'text/x-c++src',
		c: 'text/x-csrc',
		cs: 'text/x-csharp',
		php: 'application/x-php',
		rb: 'text/x-ruby',
		go: 'text/x-go',
		rs: 'text/x-rust',
		sh: 'application/x-shellscript',
		html: 'text/html',
		css: 'text/css',
		scss: 'text/x-scss',
		less: 'text/x-less',
		json: 'application/json',
		xml: 'application/xml',
		yaml: 'application/x-yaml',
		yml: 'application/x-yaml',
		md: 'text/markdown',
		txt: 'text/plain'
	};
	return mimeMap[ext] || 'text/plain';
}
