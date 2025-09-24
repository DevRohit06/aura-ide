# R2 File Creation Integration

# R2 File Creation Integration with Metadata & Real-time Updates

This document explains the enhanced R2 file creation system in Aura IDE, which allows files to be created and stored directly in Cloudflare R2 cloud storage with automatic metadata tracking and real-time WebSocket notifications.

## Overview

The enhanced chat completion API now supports direct R2 file operations with comprehensive metadata management and real-time collaboration features. Files are automatically tracked in project metadata and changes are broadcast via WebSocket for live updates.

## Key Features

- **Direct R2 Integration**: Files are created directly in Cloudflare R2 storage
- **Automatic Metadata Tracking**: Each project maintains a `_metadata.json` file tracking all files
- **Real-time WebSocket Notifications**: File operations trigger live updates for collaborative editing
- **Automatic Compression**: Files larger than 1KB are automatically compressed
- **Content Type Detection**: Automatic MIME type detection based on file extensions
- **Version Control**: Support for file versions with `@version` syntax
- **Project Statistics**: Automatic calculation of file counts and storage usage

## Architecture

### Metadata Structure

Each project automatically maintains a `_metadata.json` file with the following structure:

```json
{
	"projectId": "my-project",
	"files": [
		{
			"path": "src/App.svelte",
			"key": "projects/my-project/src/App.svelte",
			"size": 2048,
			"lastModified": "2025-09-24T10:30:00.000Z",
			"version": "latest",
			"etag": "\"abc123...\""
		}
	],
	"totalSize": 2048,
	"fileCount": 1,
	"createdAt": "2025-09-24T10:00:00.000Z",
	"updatedAt": "2025-09-24T10:30:00.000Z"
}
```

### WebSocket Events

File operations trigger real-time WebSocket notifications:

```typescript
// File creation event
{
  type: 'file_created',
  data: {
    sandboxId: 'my-project',
    path: 'src/App.svelte',
    content: '<script>...', // Preview of content
    isDirectory: false,
    size: 2048,
    lastModified: '2025-09-24T10:30:00.000Z'
  },
  timestamp: 1727171400000
}
```

## API Endpoints

### 1. Chat Completion API with R2 Tools

**Endpoint**: `POST /api/chat/completion`

Enhanced to support direct R2 file operations with metadata tracking and WebSocket notifications.

**Request Example**:

```json
{
	"threadId": "thread_123",
	"content": "Create a registration form HTML file",
	"projectId": "my-project-123",
	"enableTools": true
}
```

**Response includes**:

```json
{
  "content": "I've created the registration form HTML file for you.",
  "toolsUsed": true,
  "toolResults": [...],
  "r2StorageUsed": true,
  "projectId": "my-project-123"
}
```

### 2. Direct R2 Test API

**Endpoint**: `POST /api/r2-test`

Direct R2 file creation for testing purposes.

**Endpoint**: `GET /api/r2-test?projectId=xxx&fileName=xxx`

Read file directly from R2 for testing.

### 3. Project Metadata API

**Endpoint**: `GET /api/r2-project?projectId=xxx`

Retrieve project metadata and file listing.

**Response**:

```json
{
  "success": true,
  "data": {
    "projectId": "my-project",
    "metadata": { ... },
    "files": [ ... ],
    "fileCount": 5,
    "totalSize": 15360
  }
}
```

**Endpoint**: `POST /api/r2-project`

Project maintenance operations.

**Actions**:

- `rebuild_metadata`: Rebuild metadata from existing files
- `cleanup_old_versions`: Remove old file versions

## File Storage Structure

Files are stored in R2 with the following key structure:

```
projects/{projectId}/{filePath}
projects/{projectId}/_metadata.json
```

**Examples**:

- `projects/my-app/src/components/Button.svelte`
- `projects/website/public/index.html`
- `projects/my-app/_metadata.json`

## Real-time Collaboration

### WebSocket Integration

The system integrates with the existing WebSocket service to provide real-time updates:

1. **File Creation**: Triggers `file_created` event
2. **File Modification**: Triggers `file_modified` event
3. **File Deletion**: Triggers `file_deleted` event
4. **Metadata Updates**: Automatic synchronization across clients

### Client Integration

Components can subscribe to WebSocket events:

```svelte
<script>
	import { webSocketService } from '$lib/services/websocket.service';

	// Subscribe to file events
	webSocketService.subscribe('file_created', (event) => {
		console.log('File created:', event.data);
		// Update UI in real-time
	});
</script>
```

## Supported File Types

The system automatically detects content types for:

- **Web Files**: `.html`, `.css`, `.js`, `.ts`
- **Config Files**: `.json`, `.md`, `.txt`
- **Images**: `.svg`, `.png`, `.jpg`, `.gif`
- **Data Files**: `.xml`, `.yaml`, `.yml`
- **Default**: `text/plain` for unknown extensions

## Enhanced Features

### 1. Automatic Metadata Management

- **File Tracking**: Every file operation updates the project metadata
- **Statistics**: Automatic calculation of file counts and total sizes
- **Timestamps**: Creation and modification timestamps
- **Versioning**: Support for multiple file versions

### 2. Real-time Synchronization

- **Live Updates**: File changes appear instantly across all connected clients
- **Conflict Prevention**: Metadata ensures consistency
- **Collaborative Editing**: Multiple users can work on the same project

### 3. Compression Optimization

Files larger than 1KB are automatically compressed:

```typescript
// Automatic compression for large files
compress: content.length > 1024;
```

### 4. Error Resilience

- **Graceful Degradation**: WebSocket failures don't break file operations
- **Metadata Recovery**: Can rebuild metadata from existing files
- **Version Cleanup**: Automatic removal of old versions

## Testing

### Comprehensive Test Suite

Run the enhanced test script:

```bash
./test-r2-files.sh
```

This script tests:

1. Direct R2 file creation with metadata tracking
2. Project metadata retrieval and verification
3. File reading from R2 storage
4. Chat completion API with tool usage and WebSocket notifications
5. Metadata updates after file operations
6. Metadata rebuild functionality

### Manual Testing

**Create File with Metadata Tracking**:

```bash
curl -X POST "http://localhost:5173/api/r2-test" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "test-project",
    "fileName": "index.html",
    "content": "<!DOCTYPE html><html><body><h1>Hello World</h1></body></html>"
  }'
```

**Check Project Metadata**:

```bash
curl -X GET "http://localhost:5173/api/r2-project?projectId=test-project"
```

**Rebuild Metadata**:

```bash
curl -X POST "http://localhost:5173/api/r2-project" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "test-project",
    "action": "rebuild_metadata"
  }'
```

## Configuration

Ensure R2 configuration is set in environment variables:

```bash
# R2 Storage Configuration
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=your-bucket-name
R2_ENDPOINT=https://your-account.r2.cloudflarestorage.com
```

## Benefits

1. **Complete File Tracking**: Never lose track of project files
2. **Real-time Collaboration**: See changes as they happen
3. **Cloud-Native Storage**: Scalable, reliable file storage
4. **Automatic Optimization**: Compression and content type detection
5. **Rich Metadata**: Comprehensive project statistics and history
6. **Resilient Architecture**: Graceful handling of network issues

## Troubleshooting

### Common Issues

1. **Metadata Not Updating**: Use `rebuild_metadata` action to reconstruct
2. **WebSocket Not Working**: Check WebSocket service connection
3. **File Not Found**: Verify project ID and file path
4. **Storage Quota**: Monitor R2 usage and clean up old versions

### Debug Information

Enable detailed logging by checking:

- R2 upload responses for metadata information
- WebSocket event logs for real-time notifications
- Project metadata for file tracking accuracy

## Future Enhancements

- **File Sharing**: Public URLs for file sharing
- **Advanced Search**: Full-text search across project files
- **Backup Integration**: Automated project backups
- **Audit Logging**: Complete history of file operations
- **Collaborative Locking**: File locking for conflict prevention

## Overview

The enhanced chat completion API now supports direct R2 file operations, bypassing potential file system access issues and providing cloud-native file storage with automatic versioning and compression.

## Key Features

- **Direct R2 Integration**: Files are created directly in Cloudflare R2 storage
- **Automatic Compression**: Files larger than 1KB are automatically compressed
- **Metadata Tracking**: Rich metadata including creation time, project ID, user ID
- **Versioning Support**: Support for file versions with `@version` syntax
- **Content Type Detection**: Automatic MIME type detection based on file extensions
- **Fallback Database Storage**: Files are also indexed in the database for search

## API Endpoints

### 1. Chat Completion API with R2 Tools

**Endpoint**: `POST /api/chat/completion`

Enhanced to support direct R2 file operations when `projectId` is provided.

**Request Example**:

```json
{
	"threadId": "thread_123",
	"content": "Create a registration form HTML file",
	"projectId": "my-project-123",
	"enableTools": true
}
```

**Tool Commands Supported**:

- `EDIT_FILE: filename.ext` - Create a new file
- `READ_FILE: filename.ext` - Read existing file
- `LIST_FILES: directory/` - List directory contents

### 2. Direct R2 Test API

**Endpoint**: `POST /api/r2-test`

Direct R2 file creation for testing purposes.

**Request Example**:

```json
{
	"projectId": "test-project",
	"fileName": "test.html",
	"content": "<!DOCTYPE html><html>...</html>"
}
```

**GET**: `GET /api/r2-test?projectId=xxx&fileName=xxx`

Read file directly from R2 for testing.

## File Storage Structure

Files are stored in R2 with the following key structure:

```
projects/{projectId}/{filePath}
```

**Examples**:

- `projects/my-app/src/components/Button.svelte`
- `projects/website/public/index.html`
- `projects/api-server/package.json`

## Supported File Types

The system automatically detects content types for:

- **Web Files**: `.html`, `.css`, `.js`, `.ts`
- **Config Files**: `.json`, `.md`, `.txt`
- **Images**: `.svg`, `.png`, `.jpg`, `.gif`
- **Default**: `text/plain` for unknown extensions

## Enhanced Features

### 1. Automatic Compression

Files larger than 1KB are automatically compressed using gzip:

```typescript
// Automatic compression for large files
compress: content.length > 1024;
```

### 2. Rich Metadata

Each file includes comprehensive metadata:

```json
{
	"createdAt": "2025-09-23T12:34:56.789Z",
	"size": "1234",
	"projectId": "my-project",
	"originalPath": "src/App.svelte",
	"r2Key": "projects/my-project/src/App.svelte",
	"modifiedBy": "ai_agent"
}
```

### 3. Tool Command Parsing

The system supports multiple formats for file operations:

**Structured Commands**:

```
EDIT_FILE: src/components/Button.svelte
<template>
  <button class="btn">{label}</button>
</template>
```

**Natural Language**:

```
Create a new file called package.json with the following content:
{
  "name": "my-app",
  "version": "1.0.0"
}
```

## Error Handling

The system includes comprehensive error handling:

1. **Authentication**: Validates user session
2. **Validation**: Checks required fields (projectId, filePath, content)
3. **R2 Errors**: Handles network timeouts, access issues
4. **Fallback**: Continues operation even if database indexing fails

## Testing

### Manual Testing

Use the provided test script:

```bash
./test-r2-files.sh
```

This script tests:

1. Direct R2 file creation
2. File reading verification
3. Chat completion API with tools

### API Testing

**Create File via Chat**:

```bash
curl -X POST "http://localhost:5173/api/chat/completion" \
  -H "Content-Type: application/json" \
  -d '{
    "threadId": "test-123",
    "content": "EDIT_FILE: index.html\n<!DOCTYPE html><html><body><h1>Hello World</h1></body></html>",
    "projectId": "test-project",
    "enableTools": true
  }'
```

**Direct R2 Test**:

```bash
curl -X POST "http://localhost:5173/api/r2-test" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "test-project",
    "fileName": "test.txt",
    "content": "Hello R2!"
  }'
```

## Configuration

Ensure R2 configuration is set in environment variables:

```bash
# R2 Storage Configuration
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=your-bucket-name
R2_ENDPOINT=https://your-account.r2.cloudflarestorage.com
```

## Benefits

1. **Cloud-Native**: Files stored in scalable cloud storage
2. **No File System Issues**: Bypasses local file system limitations
3. **Automatic Backups**: Built-in redundancy and versioning
4. **Global Access**: Files accessible from anywhere
5. **Compression**: Automatic optimization for storage efficiency
6. **Metadata**: Rich tracking for project management

## Troubleshooting

### Common Issues

1. **Authentication Errors**: Ensure valid session
2. **Missing projectId**: Required for R2 operations
3. **R2 Configuration**: Verify environment variables
4. **Network Timeouts**: Check R2 endpoint connectivity

### Debug Information

Enable detailed logging by checking console output for:

- R2 upload progress
- File creation metadata
- Error details and stack traces

## Future Enhancements

- File versioning with rollback capability
- Bulk file operations
- Real-time collaboration on files
- Advanced search and indexing
- Integration with git workflows
