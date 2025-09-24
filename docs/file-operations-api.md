# File Operations API - Agent Tool Documentation

## Overview

The File Operations API provides a comprehensive interface for managing files across multiple storage backends (database, R2 cloud storage, and sandbox environments). This API can be used by both the frontend application and AI agents as a tool for file manipulation.

## API Endpoint

**POST** `/api/files`

## Authentication

All requests require user authentication. Include session cookies or authentication headers with your requests.

## Request Format

```json
{
  "operation": "create" | "read" | "update" | "delete" | "rename" | "move" | "list",
  "projectId": "optional-project-id",
  "sandboxId": "optional-sandbox-id",
  "path": "/path/to/file",
  "content": "file content (for create/update operations)",
  "newPath": "/new/path (for rename/move operations)",
  "metadata": {
    "optional": "metadata"
  }
}
```

## Response Format

```json
{
  "success": true | false,
  "message": "Operation status message",
  "data": {}, // Operation-specific data
  "error": "Error message (if success: false)"
}
```

## Operations

### 1. Create File

Creates a new file in database, R2 storage (if projectId provided), and sandbox (if sandboxId provided).

```json
{
	"operation": "create",
	"path": "/src/components/NewComponent.tsx",
	"content": "import React from 'react';\n\nexport default function NewComponent() {\n  return <div>Hello World</div>;\n}",
	"projectId": "project-123",
	"sandboxId": "sandbox-456",
	"metadata": {
		"author": "AI Agent",
		"purpose": "Generated component"
	}
}
```

### 2. Read File

Reads file content from the most current source (sandbox > R2 > database).

```json
{
	"operation": "read",
	"path": "/src/components/ExistingComponent.tsx",
	"projectId": "project-123",
	"sandboxId": "sandbox-456"
}
```

**Response:**

```json
{
	"success": true,
	"message": "File read successfully",
	"data": {
		"content": "file content here...",
		"source": "sandbox" // Indicates where the file was read from
	}
}
```

### 3. Update File

Updates existing file content across all storage backends.

```json
{
	"operation": "update",
	"path": "/src/components/ExistingComponent.tsx",
	"content": "// Updated content here...",
	"projectId": "project-123",
	"sandboxId": "sandbox-456",
	"metadata": {
		"lastModifiedBy": "AI Agent"
	}
}
```

### 4. Delete File

Removes file from all storage backends.

```json
{
	"operation": "delete",
	"path": "/src/components/OldComponent.tsx",
	"projectId": "project-123",
	"sandboxId": "sandbox-456"
}
```

### 5. Rename File

Renames a file (creates new file with new name, then deletes old file).

```json
{
	"operation": "rename",
	"path": "/src/components/OldName.tsx",
	"newPath": "/src/components/NewName.tsx",
	"projectId": "project-123",
	"sandboxId": "sandbox-456"
}
```

### 6. Move File

Moves a file to a different directory (same as rename but typically across directories).

```json
{
	"operation": "move",
	"path": "/src/components/Component.tsx",
	"newPath": "/src/ui/Component.tsx",
	"projectId": "project-123",
	"sandboxId": "sandbox-456"
}
```

### 7. List Files

Lists files in a directory from all available sources.

```json
{
	"operation": "list",
	"path": "/src/components",
	"projectId": "project-123",
	"sandboxId": "sandbox-456"
}
```

**Response:**

```json
{
	"success": true,
	"message": "Files listed successfully",
	"data": {
		"sandbox": [
			/* files from sandbox */
		],
		"r2": [
			/* files from R2 */
		],
		"database": [
			/* files from database */
		]
	}
}
```

## Frontend Client Usage

For frontend applications, use the provided client service:

```typescript
import { fileOperationsAPI } from '$lib/services/file-operations-api.service';

// Create a file
const result = await fileOperationsAPI.createFile({
	path: '/src/NewFile.ts',
	content: 'console.log("Hello World");',
	projectId: 'my-project',
	sandboxId: 'my-sandbox'
});

// Save file (create if not exists, update if exists)
await fileOperationsAPI.saveFile({
	path: '/src/ExistingFile.ts',
	content: 'updated content',
	projectId: 'my-project'
});

// Batch operations
const results = await fileOperationsAPI.batchOperations([
	{ operation: 'create', path: '/file1.js', content: 'content1' },
	{ operation: 'create', path: '/file2.js', content: 'content2' }
]);
```

## Error Handling

The API provides detailed error information for debugging:

- **400 Bad Request**: Invalid request format or missing required fields
- **401 Unauthorized**: Authentication required
- **500 Internal Server Error**: Server-side error occurred

Errors include specific error codes in the `error` field:

- `UNAUTHORIZED`: Authentication failed
- `INVALID_REQUEST`: Malformed request
- `INVALID_OPERATION`: Unknown operation type
- `FILE_NOT_FOUND`: Requested file doesn't exist
- `UNKNOWN_ERROR`: Unexpected server error

## Storage Backend Details

### Database

- Primary storage for file metadata and content
- Always attempted for all operations
- Provides file history and versioning

### R2 Cloud Storage

- Used when `projectId` is provided
- Provides scalable file storage
- Supports metadata and versioning

### Sandbox Environment

- Used when `sandboxId` is provided
- Provides real-time code execution environment
- Most current version of files during development

## Best Practices for Agents

1. **Always specify both projectId and sandboxId** when available for consistency
2. **Use the `saveFile` method** for general file operations (handles create/update automatically)
3. **Handle errors gracefully** - operations may partially succeed across different backends
4. **Check the response data** for backend-specific results
5. **Use batch operations** for multiple related file changes to improve performance
6. **Include meaningful metadata** to track AI-generated changes

## Example Agent Implementation

```javascript
// Agent tool function example
async function editFile(options) {
	const { path, content, projectId, sandboxId, operation = 'update' } = options;

	try {
		const response = await fetch('/api/files', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
				// Include authentication headers
			},
			body: JSON.stringify({
				operation,
				path,
				content,
				projectId,
				sandboxId,
				metadata: {
					modifiedBy: 'AI Agent',
					timestamp: new Date().toISOString()
				}
			})
		});

		const result = await response.json();

		if (!result.success) {
			throw new Error(result.error || 'Operation failed');
		}

		return result;
	} catch (error) {
		console.error('File operation failed:', error);
		throw error;
	}
}
```

This API provides a unified interface for file operations that maintains consistency across all storage backends while providing detailed feedback about the success of each operation.
