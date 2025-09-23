# Aura IDE Cloud MVP - API Specification

## API Overview

Aura IDE Cloud MVP provides a RESTful API for managing projects, AI interactions, and code execution. The API is designed to be fast, secure, and scalable.

**Base URL:** `https://api.Aura IDE.cloud/v1`
**Development URL:** `http://localhost:3001/api/v1`

## Authentication

All API endpoints (except authentication endpoints) require a valid JWT token in the Authorization header.

### Request Format

```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Error Response Format

```json
{
	"error": {
		"code": "ERROR_CODE",
		"message": "Human readable error message",
		"details": "Additional error details",
		"timestamp": "2025-08-24T10:33:00Z"
	}
}
```

## Authentication Endpoints

### POST /auth/register

Register a new user account.

**Request Body:**

```json
{
	"email": "user@example.com",
	"password": "securePassword123",
	"firstName": "John",
	"lastName": "Doe"
}
```

**Response (201 Created):**

```json
{
	"user": {
		"id": "550e8400-e29b-41d4-a716-446655440000",
		"email": "user@example.com",
		"firstName": "John",
		"lastName": "Doe",
		"subscriptionTier": "free",
		"createdAt": "2025-08-24T10:33:00Z"
	},
	"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
	"refreshToken": "refresh_token_here",
	"expiresIn": 604800
}
```

**Error Responses:**

- `400 Bad Request` - Invalid input data
- `409 Conflict` - Email already exists

### POST /auth/login

Authenticate user and receive access token.

**Request Body:**

```json
{
	"email": "user@example.com",
	"password": "securePassword123"
}
```

**Response (200 OK):**

```json
{
	"user": {
		"id": "550e8400-e29b-41d4-a716-446655440000",
		"email": "user@example.com",
		"firstName": "John",
		"lastName": "Doe",
		"subscriptionTier": "free"
	},
	"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
	"refreshToken": "refresh_token_here",
	"expiresIn": 604800
}
```

**Error Responses:**

- `400 Bad Request` - Invalid input data
- `401 Unauthorized` - Invalid credentials

### POST /auth/refresh

Refresh expired access token using refresh token.

**Request Body:**

```json
{
	"refreshToken": "refresh_token_here"
}
```

**Response (200 OK):**

```json
{
	"token": "new_jwt_token_here",
	"expiresIn": 604800
}
```

### POST /auth/logout

Invalidate current session and refresh token.

**Request Body:**

```json
{
	"refreshToken": "refresh_token_here"
}
```

**Response (200 OK):**

```json
{
	"message": "Successfully logged out"
}
```

## Project Management Endpoints

### GET /projects

Retrieve user's projects with pagination.

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `search` (optional): Search term for project names
- `language` (optional): Filter by programming language

**Response (200 OK):**

```json
{
	"projects": [
		{
			"id": "proj_550e8400-e29b-41d4-a716-446655440000",
			"name": "My Web App",
			"description": "A sample web application",
			"language": "javascript",
			"fileCount": 15,
			"sizeBytes": 102400,
			"lastModified": "2025-08-24T09:15:30Z",
			"createdAt": "2025-08-20T14:20:00Z"
		}
	],
	"pagination": {
		"page": 1,
		"limit": 20,
		"total": 5,
		"totalPages": 1
	}
}
```

### POST /projects

Create a new project.

**Request Body:**

```json
{
	"name": "My New Project",
	"description": "Project description",
	"language": "javascript",
	"template": "vanilla-js"
}
```

**Response (201 Created):**

```json
{
	"project": {
		"id": "proj_550e8400-e29b-41d4-a716-446655440000",
		"name": "My New Project",
		"description": "Project description",
		"language": "javascript",
		"settings": {},
		"createdAt": "2025-08-24T10:33:00Z",
		"updatedAt": "2025-08-24T10:33:00Z"
	}
}
```

### GET /projects/{projectId}

Retrieve project details.

**Response (200 OK):**

```json
{
	"project": {
		"id": "proj_550e8400-e29b-41d4-a716-446655440000",
		"name": "My Web App",
		"description": "A sample web application",
		"language": "javascript",
		"settings": {
			"theme": "dark",
			"autoSave": true
		},
		"createdAt": "2025-08-20T14:20:00Z",
		"updatedAt": "2025-08-24T09:15:30Z"
	}
}
```

### PUT /projects/{projectId}

Update project details.

**Request Body:**

```json
{
	"name": "Updated Project Name",
	"description": "Updated description",
	"settings": {
		"theme": "light",
		"autoSave": false
	}
}
```

**Response (200 OK):**

```json
{
	"project": {
		"id": "proj_550e8400-e29b-41d4-a716-446655440000",
		"name": "Updated Project Name",
		"description": "Updated description",
		"language": "javascript",
		"settings": {
			"theme": "light",
			"autoSave": false
		},
		"updatedAt": "2025-08-24T10:33:00Z"
	}
}
```

### DELETE /projects/{projectId}

Delete a project and all its files.

**Response (204 No Content)**

## File Management Endpoints

### GET /projects/{projectId}/files

Retrieve project files.

**Query Parameters:**

- `path` (optional): Filter by file path
- `type` (optional): Filter by file type

**Response (200 OK):**

```json
{
	"files": [
		{
			"id": "file_550e8400-e29b-41d4-a716-446655440000",
			"filename": "index.js",
			"path": "/src/index.js",
			"sizeBytes": 2048,
			"mimeType": "application/javascript",
			"createdAt": "2025-08-20T14:20:00Z",
			"updatedAt": "2025-08-24T09:15:30Z"
		},
		{
			"id": "file_660e8400-e29b-41d4-a716-446655440001",
			"filename": "package.json",
			"path": "/package.json",
			"sizeBytes": 512,
			"mimeType": "application/json",
			"createdAt": "2025-08-20T14:20:00Z",
			"updatedAt": "2025-08-21T11:30:15Z"
		}
	]
}
```

### GET /projects/{projectId}/files/{fileId}

Retrieve file content.

**Response (200 OK):**

```json
{
	"file": {
		"id": "file_550e8400-e29b-41d4-a716-446655440000",
		"filename": "index.js",
		"path": "/src/index.js",
		"content": "console.log('Hello, World!');",
		"sizeBytes": 2048,
		"mimeType": "application/javascript",
		"createdAt": "2025-08-20T14:20:00Z",
		"updatedAt": "2025-08-24T09:15:30Z"
	}
}
```

### POST /projects/{projectId}/files

Create a new file.

**Request Body:**

```json
{
	"filename": "new-file.js",
	"path": "/src/components/new-file.js",
	"content": "// New file content",
	"mimeType": "application/javascript"
}
```

**Response (201 Created):**

```json
{
	"file": {
		"id": "file_770e8400-e29b-41d4-a716-446655440002",
		"filename": "new-file.js",
		"path": "/src/components/new-file.js",
		"content": "// New file content",
		"sizeBytes": 19,
		"mimeType": "application/javascript",
		"createdAt": "2025-08-24T10:33:00Z",
		"updatedAt": "2025-08-24T10:33:00Z"
	}
}
```

### PUT /projects/{projectId}/files/{fileId}

Update file content.

**Request Body:**

```json
{
	"content": "console.log('Updated content');",
	"filename": "updated-index.js"
}
```

**Response (200 OK):**

```json
{
	"file": {
		"id": "file_550e8400-e29b-41d4-a716-446655440000",
		"filename": "updated-index.js",
		"path": "/src/updated-index.js",
		"content": "console.log('Updated content');",
		"sizeBytes": 31,
		"mimeType": "application/javascript",
		"updatedAt": "2025-08-24T10:33:00Z"
	}
}
```

### DELETE /projects/{projectId}/files/{fileId}

Delete a file.

**Response (204 No Content)**

## AI Integration Endpoints

### POST /ai/complete

Get AI code completion suggestions.

**Request Body:**

```json
{
	"projectId": "proj_550e8400-e29b-41d4-a716-446655440000",
	"code": "function calculateSum(a, b) {\n  return",
	"language": "javascript",
	"cursorPosition": 32,
	"contextWindow": 50,
	"maxSuggestions": 3
}
```

**Response (200 OK):**

```json
{
	"suggestions": [
		{
			"text": " a + b;",
			"confidence": 0.95,
			"type": "completion",
			"startOffset": 32,
			"endOffset": 32
		},
		{
			"text": " a + b;\n}",
			"confidence": 0.87,
			"type": "completion",
			"startOffset": 32,
			"endOffset": 32
		}
	],
	"contextUsed": ["/src/utils.js", "/src/math-helpers.js"],
	"metadata": {
		"model": "openai/gpt-4-turbo",
		"latency": 850,
		"tokensUsed": 150,
		"costCents": 5
	}
}
```

### POST /ai/chat

Interactive AI chat for code assistance.

**Request Body:**

```json
{
	"projectId": "proj_550e8400-e29b-41d4-a716-446655440000",
	"message": "How can I optimize this function for better performance?",
	"context": {
		"selectedCode": "function slowFunction(arr) {\n  for(let i = 0; i < arr.length; i++) {\n    for(let j = 0; j < arr.length; j++) {\n      console.log(arr[i] + arr[j]);\n    }\n  }\n}",
		"currentFile": "/src/performance.js",
		"language": "javascript"
	}
}
```

**Response (200 OK):**

```json
{
	"response": "I can help you optimize this function. The main issue is the nested loop creating O(n²) complexity. Here are some optimizations:\n\n1. If you're just logging all combinations, consider if you really need all of them\n2. Use more efficient data structures\n3. Consider memoization if there are repeated calculations",
	"suggestions": [
		{
			"action": "optimize_code",
			"code": "function optimizedFunction(arr) {\n  const cache = new Map();\n  arr.forEach((item1, i) => {\n    arr.slice(i).forEach(item2 => {\n      const sum = item1 + item2;\n      if (!cache.has(sum)) {\n        console.log(sum);\n        cache.set(sum, true);\n      }\n    });\n  });\n}",
			"description": "Optimized version with reduced complexity and memoization"
		},
		{
			"action": "add_documentation",
			"code": "/**\n * Calculates and logs unique sums from array combinations\n * Time complexity: O(n²) but with early termination\n * Space complexity: O(k) where k is unique sums\n */",
			"description": "Add documentation explaining the optimization"
		}
	],
	"references": ["/src/utils.js: optimizationHelpers", "/src/performance.js: performanceMetrics"],
	"metadata": {
		"model": "openai/gpt-4-turbo",
		"latency": 1250,
		"tokensUsed": 420,
		"costCents": 12
	}
}
```

### POST /ai/analyze

Analyze code for issues, suggestions, and improvements.

**Request Body:**

```json
{
	"projectId": "proj_550e8400-e29b-41d4-a716-446655440000",
	"fileId": "file_550e8400-e29b-41d4-a716-446655440000",
	"analysisType": "full",
	"focus": ["performance", "security", "maintainability"]
}
```

**Response (200 OK):**

```json
{
	"analysis": {
		"score": 8.2,
		"issues": [
			{
				"type": "performance",
				"severity": "medium",
				"line": 15,
				"message": "Consider using const instead of let for variables that don't change",
				"suggestion": "const result = calculate();"
			},
			{
				"type": "security",
				"severity": "high",
				"line": 28,
				"message": "Potential XSS vulnerability: user input not sanitized",
				"suggestion": "Use DOMPurify or similar library to sanitize HTML"
			}
		],
		"improvements": [
			{
				"category": "maintainability",
				"description": "Consider extracting the validation logic into a separate function",
				"lineStart": 45,
				"lineEnd": 62
			}
		],
		"metrics": {
			"complexity": 7,
			"maintainabilityIndex": 68,
			"linesOfCode": 150,
			"testCoverage": null
		}
	},
	"metadata": {
		"analysisTime": 2100,
		"model": "openai/gpt-4-turbo",
		"costCents": 18
	}
}
```

## Sandbox Execution Endpoints

### POST /sandbox/execute

Execute code in a secure sandbox environment.

**Request Body:**

```json
{
	"code": "console.log('Hello, World!');\nconst result = 2 + 2;\nconsole.log('Result:', result);",
	"language": "javascript",
	"environment": "node",
	"timeout": 10000,
	"input": "",
	"dependencies": ["lodash"]
}
```

**Response (200 OK):**

```json
{
	"execution": {
		"success": true,
		"stdout": "Hello, World!\nResult: 4\n",
		"stderr": "",
		"exitCode": 0,
		"executionTime": 342,
		"memoryUsed": 15728640,
		"cpuTime": 120
	},
	"sandbox": {
		"id": "sandbox_abc123",
		"environment": "node:18",
		"timeoutReached": false
	}
}
```

**Error Response (400 Bad Request):**

```json
{
	"execution": {
		"success": false,
		"stdout": "",
		"stderr": "SyntaxError: Unexpected token ';'\n    at Module._compile (internal/modules/cjs/loader.js:723:23)",
		"exitCode": 1,
		"executionTime": 89,
		"error": "Code execution failed"
	}
}
```

### POST /sandbox/test

Execute code with test cases.

**Request Body:**

```json
{
	"code": "function add(a, b) {\n  return a + b;\n}",
	"language": "javascript",
	"tests": [
		{
			"name": "adds 1 + 2 to equal 3",
			"code": "console.assert(add(1, 2) === 3, 'Test failed');"
		},
		{
			"name": "adds negative numbers",
			"code": "console.assert(add(-1, -2) === -3, 'Test failed');"
		}
	]
}
```

**Response (200 OK):**

```json
{
	"testResults": [
		{
			"name": "adds 1 + 2 to equal 3",
			"passed": true,
			"output": "",
			"executionTime": 12
		},
		{
			"name": "adds negative numbers",
			"passed": true,
			"output": "",
			"executionTime": 8
		}
	],
	"summary": {
		"total": 2,
		"passed": 2,
		"failed": 0,
		"totalTime": 20
	}
}
```

## Analytics and Usage Endpoints

### GET /analytics/usage

Get user usage analytics.

**Query Parameters:**

- `period` (optional): Time period - "day", "week", "month" (default: "week")
- `startDate` (optional): Start date in ISO format
- `endDate` (optional): End date in ISO format

**Response (200 OK):**

```json
{
	"usage": {
		"period": "week",
		"startDate": "2025-08-17T00:00:00Z",
		"endDate": "2025-08-24T23:59:59Z",
		"metrics": {
			"aiInteractions": {
				"total": 145,
				"completions": 89,
				"chats": 41,
				"analysis": 15
			},
			"codeExecutions": 67,
			"projectsCreated": 3,
			"filesCreated": 28,
			"activeTime": 18720,
			"costCents": 850
		},
		"dailyBreakdown": [
			{
				"date": "2025-08-18",
				"aiInteractions": 23,
				"codeExecutions": 12,
				"activeTime": 3600,
				"costCents": 145
			}
		]
	},
	"limits": {
		"aiInteractionsPerMonth": 1000,
		"codeExecutionsPerMonth": 500,
		"costCentsPerMonth": 2000
	}
}
```

### GET /analytics/costs

Get detailed cost breakdown.

**Query Parameters:**

- `period` (optional): "day", "week", "month"
- `groupBy` (optional): "model", "feature", "day"

**Response (200 OK):**

```json
{
	"costs": {
		"total": 850,
		"breakdown": {
			"ai_completions": 420,
			"ai_chat": 315,
			"ai_analysis": 95,
			"sandbox_execution": 20
		},
		"byModel": {
			"openai/gpt-4-turbo": 680,
			"openai/gpt-3.5-turbo": 150,
			"anthropic/claude-3-sonnet": 20
		}
	}
}
```

## WebSocket Events

The API supports real-time updates via WebSocket connections.

**Connection URL:** `wss://api.Aura IDE.cloud/ws`

### Authentication

Send authentication message immediately after connection:

```json
{
	"type": "auth",
	"token": "jwt_token_here"
}
```

### Events

#### AI Completion Progress

```json
{
	"type": "ai_completion_progress",
	"data": {
		"requestId": "req_abc123",
		"status": "processing",
		"progress": 65
	}
}
```

#### Code Execution Status

```json
{
	"type": "code_execution",
	"data": {
		"sandboxId": "sandbox_abc123",
		"status": "completed",
		"result": {
			"success": true,
			"stdout": "Hello, World!"
		}
	}
}
```

#### Project File Changes

```json
{
	"type": "file_changed",
	"data": {
		"projectId": "proj_550e8400-e29b-41d4-a716-446655440000",
		"fileId": "file_550e8400-e29b-41d4-a716-446655440000",
		"filename": "index.js",
		"changeType": "updated"
	}
}
```

## Rate Limiting

API endpoints have rate limits to ensure fair usage:

- **Authentication endpoints:** 10 requests per minute per IP
- **AI endpoints:** 100 requests per hour per user
- **Sandbox execution:** 50 executions per hour per user
- **File operations:** 1000 requests per hour per user
- **General API:** 2000 requests per hour per user

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1692874800
```

## Error Codes

| Code                       | Description                      |
| -------------------------- | -------------------------------- |
| `INVALID_TOKEN`            | JWT token is invalid or expired  |
| `INSUFFICIENT_PERMISSIONS` | User lacks required permissions  |
| `RESOURCE_NOT_FOUND`       | Requested resource doesn't exist |
| `VALIDATION_ERROR`         | Request data validation failed   |
| `RATE_LIMIT_EXCEEDED`      | Rate limit exceeded              |
| `AI_SERVICE_ERROR`         | AI service unavailable or error  |
| `SANDBOX_ERROR`            | Code execution sandbox error     |
| `STORAGE_ERROR`            | File storage operation failed    |
| `INTERNAL_ERROR`           | Internal server error            |

## SDKs and Libraries

### JavaScript/TypeScript SDK

```typescript
import { Aura IDEClient } from '@Aura IDE/client';

const client = new Aura IDEClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.Aura IDE.cloud/v1'
});

// Get code completion
const completion = await client.ai.complete({
  projectId: 'proj_123',
  code: 'function add(',
  language: 'javascript',
  cursorPosition: 12
});

// Execute code
const result = await client.sandbox.execute({
  code: 'console.log("Hello, World!");',
  language: 'javascript'
});
```

### Python SDK

```python
from Aura IDE import Aura IDEClient

client = Aura IDEClient(
    api_key='your-api-key',
    base_url='https://api.Aura IDE.cloud/v1'
)

# Get code completion
completion = client.ai.complete(
    project_id='proj_123',
    code='def add(',
    language='python',
    cursor_position=8
)

# Execute code
result = client.sandbox.execute(
    code='print("Hello, World!")',
    language='python'
)
```

This API specification provides comprehensive documentation for all Aura IDE Cloud MVP endpoints, enabling developers to integrate with the platform effectively.
