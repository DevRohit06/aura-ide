# Aura IDE Cloud MVP - Technical Documentation

## Architecture Overview

Aura IDE Cloud follows a modern, cloud-native architecture designed for scalability, performance, and maintainability. The system is built around a microservices approach with clear separation of concerns.

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Layer                             │
├─────────────────────────────────────────────────────────────┤
│  SvelteKit Frontend + CodeMirror + Shadcn-Svelte Components │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   Editor    │ │  AI Chat    │ │  Project    │           │
│  │ Component   │ │ Interface   │ │ Management  │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Gateway Layer                        │
├─────────────────────────────────────────────────────────────┤
│              Node.js Express API Server                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │    Auth     │ │  Projects   │ │    AI       │           │
│  │   Service   │ │   Service   │ │  Service    │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  External Services                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │  Helicone   │ │   Qdrant    │ │     E2B     │           │
│  │ AI Gateway  │ │   Vector    │ │   Sandbox   │           │
│  │             │ │  Database   │ │             │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ PostgreSQL  │ │    Redis    │ │   File      │           │
│  │  Database   │ │    Cache    │ │  Storage    │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend Technologies

#### SvelteKit Framework
- **Version:** SvelteKit 2.0+
- **Purpose:** Modern web framework for building the user interface
- **Key Features:**
  - Server-side rendering (SSR) for SEO and performance
  - File-based routing system
  - Built-in TypeScript support
  - Excellent performance with small bundle sizes

#### CodeMirror Integration
- **Version:** CodeMirror 6
- **Purpose:** Advanced code editor functionality
- **Configuration:**
```typescript
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';

const editor = new EditorView({
  extensions: [
    basicSetup,
    javascript(),
    python(),
    oneDark,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        // Handle document changes for AI context
        handleCodeChange(update.state.doc.toString());
      }
    })
  ],
  parent: document.getElementById('editor')
});
```

#### Shadcn-Svelte Components
- **Purpose:** Consistent, accessible UI component library
- **Key Components:**
  - Button, Input, Dialog components
  - Data tables for project management
  - Toast notifications for user feedback
  - Loading spinners and progress indicators

#### Tailwind CSS
- **Version:** 3.0+
- **Configuration:** Custom design system with brand colors
- **Responsive Design:** Mobile-first approach with breakpoints

### Backend Technologies

#### Node.js API Server
- **Runtime:** Node.js 18+ with ES modules
- **Framework:** Express.js with TypeScript
- **API Design:** RESTful endpoints with OpenAPI documentation

**Example API Structure:**
```typescript
// API Routes Structure
/api/v1/
├── auth/
│   ├── login
│   ├── register
│   └── refresh
├── projects/
│   ├── create
│   ├── list
│   ├── :id/files
│   └── :id/context
├── ai/
│   ├── complete
│   ├── chat
│   └── analyze
└── sandbox/
    ├── execute
    └── status
```

#### Authentication System
- **JWT Tokens:** For stateless authentication
- **OAuth Integration:** Google, GitHub providers
- **Security Features:**
  - Rate limiting per user
  - Session management
  - Password hashing with bcrypt

```typescript
interface AuthConfig {
  jwtSecret: string;
  tokenExpiry: string;
  refreshTokenExpiry: string;
  oauthProviders: {
    google: {
      clientId: string;
      clientSecret: string;
    };
    github: {
      clientId: string;
      clientSecret: string;
    };
  };
}
```

### AI Integration

#### Helicone AI Gateway
- **Purpose:** Multi-model AI access with cost optimization
- **Configuration:**
```typescript
const heliconeConfig = {
  baseURL: process.env.HELICONE_API_URL,
  apiKey: process.env.HELICONE_API_KEY,
  models: {
    primary: 'openai/gpt-4-turbo',
    fallback: 'anthropic/claude-3-sonnet',
    cost_optimized: 'openai/gpt-3.5-turbo'
  },
  caching: {
    enabled: true,
    ttl: 3600 // 1 hour
  }
};
```

**Key Features:**
- Automatic failover between AI providers
- Cost tracking and optimization
- Response caching for common queries
- Rate limiting protection

#### Context Management
- **Vector Embeddings:** For code semantic search
- **Context Window:** Intelligent code context selection
- **Relevance Scoring:** Ranking system for code suggestions

### Vector Database (Qdrant)

#### Setup and Configuration
```yaml
# Qdrant Docker configuration
version: '3.8'
services:
  qdrant:
    image: qdrant/qdrant:v1.7.0
    container_name: Aura IDE_qdrant
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - ./qdrant_storage:/qdrant/storage
    environment:
      - QDRANT__SERVICE__HTTP_PORT=6333
      - QDRANT__SERVICE__GRPC_PORT=6334
```

#### Code Indexing Strategy
```typescript
interface CodeEmbedding {
  id: string;
  vector: number[];
  payload: {
    filename: string;
    function_name?: string;
    class_name?: string;
    language: string;
    code_snippet: string;
    line_start: number;
    line_end: number;
    project_id: string;
  };
}

class CodeIndexer {
  async indexFile(projectId: string, filename: string, content: string) {
    const chunks = this.splitIntoChunks(content);
    const embeddings = await this.generateEmbeddings(chunks);

    for (const [index, chunk] of chunks.entries()) {
      await this.qdrantClient.upsert('code_embeddings', {
        points: [{
          id: `${projectId}_${filename}_${index}`,
          vector: embeddings[index],
          payload: {
            filename,
            language: this.detectLanguage(filename),
            code_snippet: chunk.content,
            line_start: chunk.lineStart,
            line_end: chunk.lineEnd,
            project_id: projectId
          }
        }]
      });
    }
  }
}
```

### Sandbox Integration (E2B)

#### Secure Code Execution
```typescript
import { Sandbox } from '@e2b/sdk';

class CodeExecutor {
  private sandbox: Sandbox;

  async initialize() {
    this.sandbox = await Sandbox.create({
      template: 'base',
      timeoutMs: 30000 // 30 seconds
    });
  }

  async executeCode(code: string, language: string): Promise<ExecutionResult> {
    try {
      const result = await this.sandbox.runCode(language, code);
      return {
        success: true,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    } finally {
      // Clean up sandbox state
      await this.sandbox.reset();
    }
  }
}
```

#### Security Measures
- **Process Isolation:** Each execution in separate container
- **Resource Limits:** CPU, memory, and time constraints
- **Network Restrictions:** Limited external access
- **File System Isolation:** Temporary file access only

### Database Design

#### PostgreSQL Schema
```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    subscription_tier VARCHAR(50) DEFAULT 'free'
);

-- Projects table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    language VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Project files table
CREATE TABLE project_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    filename VARCHAR(500) NOT NULL,
    content TEXT,
    size_bytes INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- AI interactions table
CREATE TABLE ai_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    project_id UUID REFERENCES projects(id),
    request_type VARCHAR(50), -- 'completion', 'chat', 'analysis'
    request_data JSONB,
    response_data JSONB,
    cost_cents INTEGER,
    latency_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Usage analytics table
CREATE TABLE usage_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    event_type VARCHAR(100),
    event_data JSONB,
    session_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Redis Caching Strategy
```typescript
interface CacheConfig {
  // AI response caching
  aiResponses: {
    ttl: 3600; // 1 hour
    keyPattern: 'ai:response:{hash}';
  };

  // User sessions
  sessions: {
    ttl: 86400; // 24 hours
    keyPattern: 'session:{userId}';
  };

  // Project context
  projectContext: {
    ttl: 1800; // 30 minutes
    keyPattern: 'context:{projectId}';
  };
}
```

## API Documentation

### Authentication Endpoints

#### POST /api/v1/auth/register
```typescript
interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

interface RegisterResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  token: string;
  refreshToken: string;
}
```

#### POST /api/v1/auth/login
```typescript
interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  user: UserProfile;
  token: string;
  refreshToken: string;
  expiresIn: number;
}
```

### Project Management Endpoints

#### GET /api/v1/projects
```typescript
interface ProjectListResponse {
  projects: Array<{
    id: string;
    name: string;
    description: string;
    language: string;
    fileCount: number;
    lastModified: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}
```

#### POST /api/v1/projects
```typescript
interface CreateProjectRequest {
  name: string;
  description?: string;
  language: 'javascript' | 'python' | 'typescript' | 'html' | 'css';
  template?: string;
}
```

### AI Integration Endpoints

#### POST /api/v1/ai/complete
```typescript
interface CodeCompletionRequest {
  projectId: string;
  code: string;
  language: string;
  cursorPosition: number;
  contextWindow?: number; // lines of context
}

interface CodeCompletionResponse {
  suggestions: Array<{
    text: string;
    confidence: number;
    type: 'completion' | 'suggestion' | 'fix';
  }>;
  contextUsed: string[];
  latency: number;
  cost: number;
}
```

#### POST /api/v1/ai/chat
```typescript
interface AIChatRequest {
  projectId: string;
  message: string;
  context?: {
    selectedCode?: string;
    currentFile?: string;
  };
}

interface AIChatResponse {
  response: string;
  suggestions?: Array<{
    action: string;
    code?: string;
    description: string;
  }>;
  references: string[]; // referenced files/functions
}
```

### Sandbox Execution Endpoints

#### POST /api/v1/sandbox/execute
```typescript
interface ExecuteCodeRequest {
  code: string;
  language: 'javascript' | 'python' | 'typescript';
  environment?: 'node' | 'browser' | 'python3';
  timeout?: number; // max 30 seconds
}

interface ExecuteCodeResponse {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode?: number;
  executionTime: number;
  error?: string;
}
```

## Security Implementation

### Authentication & Authorization
```typescript
// JWT middleware implementation
const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET!, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Rate limiting configuration
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});
```

### Data Validation
```typescript
import { z } from 'zod';

const ProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  language: z.enum(['javascript', 'python', 'typescript', 'html', 'css']),
});

const CodeExecutionSchema = z.object({
  code: z.string().max(10000), // 10KB limit
  language: z.enum(['javascript', 'python', 'typescript']),
  timeout: z.number().min(1).max(30).optional(),
});
```

### Security Headers
```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", process.env.API_BASE_URL],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

## Performance Optimization

### Frontend Optimization
```typescript
// Code splitting for better performance
const AIChatComponent = lazy(() => import('./components/AIChat.svelte'));
const SandboxComponent = lazy(() => import('./components/Sandbox.svelte'));

// Service worker for caching
const CACHE_NAME = 'Aura IDE-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});
```

### Backend Optimization
```typescript
// Connection pooling for PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // maximum number of clients
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Response compression
app.use(compression({
  filter: shouldCompress,
  threshold: 1024
}));

function shouldCompress(req, res) {
  if (req.headers['x-no-compression']) {
    return false;
  }
  return compression.filter(req, res);
}
```

### Caching Strategy
```typescript
class CacheManager {
  private redis: Redis;

  async cacheAIResponse(key: string, response: any, ttl: number = 3600) {
    await this.redis.setex(key, ttl, JSON.stringify(response));
  }

  async getCachedAIResponse(key: string): Promise<any | null> {
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  generateCacheKey(request: any): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(request))
      .digest('hex');
  }
}
```

## Monitoring & Analytics

### Application Monitoring
```typescript
// Custom metrics collection
class MetricsCollector {
  private metrics: Map<string, number> = new Map();

  recordAPICall(endpoint: string, duration: number, status: number) {
    const key = `api_${endpoint}_${status}`;
    this.metrics.set(key, (this.metrics.get(key) || 0) + 1);
    this.metrics.set(`${key}_duration`, duration);
  }

  recordAIUsage(model: string, tokens: number, cost: number) {
    this.metrics.set(`ai_${model}_tokens`,
      (this.metrics.get(`ai_${model}_tokens`) || 0) + tokens);
    this.metrics.set(`ai_${model}_cost`,
      (this.metrics.get(`ai_${model}_cost`) || 0) + cost);
  }
}
```

### Error Handling
```typescript
// Global error handler
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  const errorId = generateErrorId();

  logger.error({
    errorId,
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    userId: req.user?.id
  });

  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({
      error: 'Internal server error',
      errorId
    });
  } else {
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});
```

## Deployment Guide

### Docker Configuration
```dockerfile
# Frontend Dockerfile
FROM node:18-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```dockerfile
# Backend Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Environment Configuration
```bash
# Production environment variables
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost:5432/Aura IDE
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
HELICONE_API_KEY=your-helicone-key
QDRANT_URL=http://localhost:6333
E2B_API_KEY=your-e2b-key
```

### CI/CD Pipeline
```yaml
# GitHub Actions workflow
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to production
        run: |
          docker build -t Aura IDE-frontend ./frontend
          docker build -t Aura IDE-backend ./backend
          # Deploy to cloud provider
```

This technical documentation provides comprehensive implementation details for building Aura IDE Cloud MVP with modern best practices, security considerations, and scalability in mind.
