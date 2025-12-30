# 📡 API Reference

> **⚠️ EXPERIMENTAL** - APIs are subject to change. Please check for updates.

This document provides a complete reference for all Aura IDE API endpoints.

---

## Overview

| Base URL | Description |
|----------|-------------|
| `/api/agent` | AI agent endpoints |
| `/api/auth` | Authentication |
| `/api/chat` | Chat management |
| `/api/projects` | Project CRUD |
| `/api/sandbox` | Sandbox operations |
| `/api/vector-db` | Semantic search |

---

## Authentication

All authenticated endpoints require a session cookie set by Better Auth.

### Login

```
POST /api/auth/sign-in
```

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "user": {
    "id": "user123",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "session": {
    "id": "session123",
    "expiresAt": "2024-01-01T00:00:00Z"
  }
}
```

### OAuth

```
GET /api/auth/callback/google
GET /api/auth/callback/github
```

Redirects to OAuth provider for authentication.

---

## Agent API

### Stream Agent Response

```
POST /api/agent/stream
```

Streams AI responses with tool calling support.

**Request:**
```json
{
  "message": "Add a new login component",
  "threadId": "thread123",         // Optional - creates new if not provided
  "projectId": "project123",       // Required
  "currentFile": "/src/app.ts",    // Optional - provides context
  "sandboxId": "sandbox123",       // Optional - for file operations
  "sandboxType": "daytona",        // Optional
  "modelName": "gpt-4o"            // Optional - defaults to gpt-4o
}
```

**Response:**
Server-Sent Events (SSE) stream with:
- Text chunks
- Tool call notifications
- Tool results
- Completion signal

**Headers:**
- `X-Thread-Id`: The thread ID used/created

---

## Chat API

### List Threads

```
GET /api/chat/threads?projectId={projectId}
```

**Response:**
```json
{
  "threads": [
    {
      "id": "thread123",
      "title": "Chat about login",
      "projectId": "project123",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Create Thread

```
POST /api/chat/threads
```

**Request:**
```json
{
  "projectId": "project123",
  "title": "New Chat"
}
```

### Get Thread

```
GET /api/chat/threads/{threadId}
```

### Delete Thread

```
DELETE /api/chat/threads/{threadId}
```

### Get Messages

```
GET /api/chat/threads/{threadId}/messages?limit=50
```

**Response:**
```json
{
  "messages": [
    {
      "id": "msg123",
      "threadId": "thread123",
      "role": "user",
      "content": "Hello",
      "timestamp": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

## Projects API

### List Projects

```
GET /api/projects?limit=50&offset=0
```

**Response:**
```json
{
  "projects": [
    {
      "id": "project123",
      "name": "My App",
      "description": "A cool app",
      "sandboxId": "sandbox123",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 1
}
```

### Create Project

```
POST /api/projects
```

**Request:**
```json
{
  "name": "My New App",
  "description": "Description here",
  "templateId": "react-ts"  // Optional
}
```

### Get Project

```
GET /api/projects/{projectId}
```

### Update Project

```
PUT /api/projects/{projectId}
```

**Request:**
```json
{
  "name": "Updated Name",
  "description": "Updated description"
}
```

### Delete Project

```
DELETE /api/projects/{projectId}
```

---

## Sandbox API

### Create Sandbox

```
POST /api/sandbox/create
```

**Request:**
```json
{
  "projectId": "project123",
  "templateId": "react-ts"
}
```

**Response:**
```json
{
  "sandboxId": "sandbox123",
  "status": "running",
  "previewUrl": "https://sandbox123.daytona.io"
}
```

### Get Sandbox Status

```
GET /api/sandbox/{sandboxId}/status
```

**Response:**
```json
{
  "status": "running",
  "previewUrl": "https://sandbox123.daytona.io",
  "health": "healthy"
}
```

### List Files

```
GET /api/sandbox/{sandboxId}/files?path=/src
```

**Response:**
```json
{
  "files": [
    {
      "name": "app.ts",
      "path": "/src/app.ts",
      "type": "file",
      "size": 1024
    },
    {
      "name": "components",
      "path": "/src/components",
      "type": "directory"
    }
  ]
}
```

### Read File

```
GET /api/sandbox/{sandboxId}/files/{path}
```

**Response:**
```json
{
  "content": "console.log('Hello');",
  "path": "/src/app.ts",
  "encoding": "utf-8"
}
```

### Write File

```
POST /api/sandbox/{sandboxId}/files
```

**Request:**
```json
{
  "path": "/src/app.ts",
  "content": "console.log('Updated');"
}
```

### Delete File

```
DELETE /api/sandbox/{sandboxId}/files/{path}
```

### Execute Command

```
POST /api/sandbox/{sandboxId}/execute
```

**Request:**
```json
{
  "command": "npm install lodash",
  "cwd": "/home/daytona"
}
```

**Response:**
```json
{
  "stdout": "added 1 package...",
  "stderr": "",
  "exitCode": 0
}
```

---

## Vector DB API

### Search Codebase

```
POST /api/vector-db/search
```

**Request:**
```json
{
  "query": "function that handles authentication",
  "projectId": "project123",
  "limit": 10
}
```

**Response:**
```json
{
  "results": [
    {
      "filePath": "/src/auth.ts",
      "content": "export function authenticate...",
      "score": 0.92,
      "lineStart": 10,
      "lineEnd": 25
    }
  ]
}
```

### Index Project

```
POST /api/vector-db/index
```

**Request:**
```json
{
  "projectId": "project123",
  "sandboxId": "sandbox123"
}
```

### Get Index Status

```
GET /api/vector-db/status/{projectId}
```

---

## Health Check

```
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "services": {
    "database": "connected",
    "qdrant": "connected"
  }
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message here",
  "code": "ERROR_CODE",
  "details": {}  // Optional additional info
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Not authenticated |
| `FORBIDDEN` | 403 | No permission |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limiting

- **AI endpoints**: Rate limited via Helicone
- **Other endpoints**: No explicit rate limiting (MVP)

---

## Websocket Endpoints (Coming Soon)

> These are planned for real-time features

- `/ws/terminal` - Terminal streaming
- `/ws/files` - File change notifications
- `/ws/collaboration` - Real-time collaboration

---

<div align="center">
  <p><strong>🚧 APIs are being refined 🚧</strong></p>
</div>
