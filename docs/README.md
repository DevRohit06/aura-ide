# Aura Sandbox Execution System Documentation

## Overview

Welcome to the comprehensive documentation for the Aura Sandbox Execution System. This system provides a unified interface for managing isolated development environments using E2B and Daytona as execution providers with R2 storage for persistent file management.

## Documentation Structure

### 📚 API Documentation

- **[OpenAPI Specification](api/openapi.yaml)** - Complete API specification in OpenAPI 3.0 format
- **[API Usage Guide](api/usage-guide.md)** - Comprehensive examples and best practices for using the API

### 👨‍💻 Developer Documentation

- **[Sandbox Adapter Interface](developers/sandbox-adapter-interface.md)** - Complete guide for implementing custom sandbox adapters

### 🚀 Deployment & Configuration

- **[Configuration Guide](deployment/configuration-guide.md)** - Environment setup and configuration management
- **[Deployment Guide](deployment/deployment-guide.md)** - Production deployment instructions and best practices

### 🔧 Troubleshooting

- **[Error Resolution Guide](troubleshooting/error-resolution-guide.md)** - Common issues and their solutions

## Quick Start

### For API Users

1. **Authentication**: Obtain an access token

   ```bash
   curl -X POST https://api.aura-ide.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "user@example.com", "password": "password"}'
   ```

2. **Create a Session**: Start a new sandbox environment

   ```bash
   curl -X POST https://api.aura-ide.com/api/sessions \
     -H "Authorization: Bearer $ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "projectConfig": {
         "framework": "react",
         "templateUrl": "https://github.com/facebook/create-react-app.git"
       }
     }'
   ```

3. **Upload Files**: Add your project files

   ```bash
   curl -X POST https://api.aura-ide.com/api/sessions/$SESSION_ID/files \
     -H "Authorization: Bearer $ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "files": [{
         "name": "App.js",
         "content": "import React from \"react\";\n\nfunction App() {\n  return <div>Hello World!</div>;\n}\n\nexport default App;",
         "path": "/workspace/src/App.js"
       }]
     }'
   ```

4. **Execute Commands**: Run build and development commands
   ```bash
   curl -X POST https://api.aura-ide.com/api/sessions/$SESSION_ID/execute \
     -H "Authorization: Bearer $ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "command": "npm start",
       "workingDirectory": "/workspace"
     }'
   ```

### For Developers

1. **Install Dependencies**

   ```bash
   npm install @aura-ide/sdk
   ```

2. **Initialize Client**

   ```typescript
   import { AuraSandboxClient } from '@aura-ide/sdk';

   const client = new AuraSandboxClient({
   	apiUrl: 'https://api.aura-ide.com',
   	accessToken: 'your-access-token'
   });
   ```

3. **Create and Manage Sessions**

   ```typescript
   // Create session
   const session = await client.sessions.create({
   	projectConfig: {
   		framework: 'react',
   		templateUrl: 'https://github.com/facebook/create-react-app.git'
   	}
   });

   // Execute commands
   const result = await client.commands.execute(session.id, 'npm install');

   // Get preview URL
   const preview = await client.preview.getUrl(session.id, 3000);
   ```

## Architecture Overview

The Aura Sandbox Execution System consists of several key components:

```mermaid
graph TB
    subgraph "Client Applications"
        WEB[Web IDE]
        API[API Clients]
        SDK[SDKs]
    end

    subgraph "API Layer"
        REST[REST API]
        WS[WebSocket API]
        AUTH[Authentication]
    end

    subgraph "Core Services"
        SM[Session Manager]
        FS[File Sync Service]
        PS[Project Service]
        TS[Terminal Service]
    end

    subgraph "Sandbox Adapters"
        E2B[E2B Adapter]
        DT[Daytona Adapter]
        CUSTOM[Custom Adapters]
    end

    subgraph "Storage & External"
        R2[Cloudflare R2]
        DB[(PostgreSQL)]
        REDIS[(Redis)]
    end

    WEB --> REST
    API --> REST
    SDK --> REST
    REST --> AUTH
    WS --> AUTH

    REST --> SM
    REST --> FS
    REST --> PS
    WS --> TS

    SM --> E2B
    SM --> DT
    SM --> CUSTOM

    FS --> R2
    SM --> DB
    TS --> REDIS
```

## Key Features

### 🏗️ Multi-Provider Support

- **Daytona Integration**: Full-featured development environments with git integration
- **Extensible Architecture**: Easy to add new sandbox providers

### 📁 Persistent File Management

- **R2 Storage**: Reliable file persistence across sessions
- **Real-time Sync**: Automatic synchronization between sandbox and storage
- **Version Control**: File versioning and conflict resolution

### 🖥️ Terminal Access

- **WebSocket Terminals**: Real-time terminal access via WebSocket connections
- **Multiple Sessions**: Support for multiple concurrent terminal sessions
- **Command Execution**: Both interactive and batch command execution

### 🌐 Live Previews

- **Instant Previews**: Automatic preview URL generation for running applications
- **Health Monitoring**: Application health checks and status monitoring
- **Port Management**: Dynamic port allocation and exposure

### 🔧 Project Templates

- **Framework Support**: Built-in support for React, Vue, Angular, Node.js, Python, and more
- **Custom Templates**: Support for custom project templates via Git repositories
- **Sparse Checkout**: Efficient cloning with sparse checkout for large repositories

## API Endpoints Overview

### Session Management

- `POST /api/sessions` - Create new session
- `GET /api/sessions/:id` - Get session information
- `DELETE /api/sessions/:id` - Delete session

### File Operations

- `GET /api/sessions/:id/files` - List files
- `POST /api/sessions/:id/files` - Upload files
- `GET /api/sessions/:id/files/:path` - Download file
- `PUT /api/sessions/:id/files/:path` - Update file
- `DELETE /api/sessions/:id/files/:path` - Delete file

### Command Execution

- `POST /api/sessions/:id/execute` - Execute command

### Terminal Access

- `GET /api/sessions/:id/terminal` - WebSocket terminal connection

### Preview URLs

- `GET /api/sessions/:id/preview` - Get preview URL

### File Synchronization

- `GET /api/sessions/:id/sync` - WebSocket file sync connection

## Configuration

### Environment Variables

```bash
# Core Configuration
NODE_ENV=production
PORT=5173
DATABASE_URL=postgresql://user:pass@localhost:5432/aura
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-jwt-secret
SESSION_SECRET=your-session-secret

# Sandbox Providers
E2B_API_KEY=your-e2b-api-key
DAYTONA_API_KEY=your-daytona-api-key

# Storage
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=aura-sandbox-storage
R2_ENDPOINT=https://your-account.r2.cloudflarestorage.com
```

### Framework Templates

The system supports various project frameworks out of the box:

| Framework      | Template Repository         | Default Port |
| -------------- | --------------------------- | ------------ |
| React          | `facebook/create-react-app` | 3000         |
| Next.js        | `vercel/next.js`            | 3000         |
| Vue.js         | `vuejs/vue`                 | 8080         |
| Angular        | `angular/angular-cli`       | 4200         |
| Node.js        | `expressjs/express`         | 3000         |
| Python/Flask   | `pallets/flask`             | 5000         |
| Python/FastAPI | `tiangolo/fastapi`          | 8000         |

## Error Handling

The API uses standard HTTP status codes and provides detailed error information:

```json
{
	"error": "SANDBOX_CREATION_FAILED",
	"message": "Failed to create sandbox: Resource limit exceeded",
	"details": {
		"provider": "e2b",
		"resourceType": "cpu",
		"limit": "4 cores",
		"requested": "8 cores"
	},
	"timestamp": "2024-01-15T10:30:00Z",
	"requestId": "req-abc123"
}
```

Common error codes:

- `SANDBOX_NOT_FOUND` - Sandbox or session not found
- `SANDBOX_CREATION_FAILED` - Failed to create sandbox
- `EXECUTION_TIMEOUT` - Command execution timed out
- `FILE_NOT_FOUND` - Requested file not found
- `SYNC_FAILED` - File synchronization failed
- `RATE_LIMIT_EXCEEDED` - API rate limit exceeded

## Security

### Authentication & Authorization

- JWT-based authentication with refresh tokens
- Role-based access control (RBAC)
- API key authentication for service-to-service communication

### Data Protection

- All data encrypted in transit (TLS 1.3)
- File encryption at rest in R2 storage
- Secure sandbox isolation

### Rate Limiting

- API rate limiting to prevent abuse
- Per-user resource quotas
- Sandbox resource limits

## Monitoring & Observability

### Metrics

- Prometheus metrics for monitoring
- Grafana dashboards for visualization
- Custom alerts for critical issues

### Logging

- Structured JSON logging
- Centralized log aggregation
- Request tracing and correlation IDs

### Health Checks

- Application health endpoints
- Sandbox health monitoring
- Dependency health checks

## Support & Contributing

### Getting Help

- 📖 Check this documentation first
- 🐛 Report bugs via GitHub Issues
- 💬 Join our Discord community
- 📧 Email support: support@aura-ide.com

### Contributing

- 🔀 Fork the repository
- 🌟 Create feature branches
- ✅ Add tests for new features
- 📝 Update documentation
- 🚀 Submit pull requests

### Development Setup

```bash
# Clone repository
git clone https://github.com/aura-ide/aura.git
cd aura

# Install dependencies
npm install

# Set up environment
cp .env.example .env.development

# Start development services
docker-compose -f docker-compose.dev.yml up -d

# Run application
npm run dev
```

## License

This project is licensed under the MIT License. See the [LICENSE](../LICENSE) file for details.

---

For more detailed information, please refer to the specific documentation sections linked above.
