# Aura IDE Cloud MVP - Implementation Guide

## Development Setup Guide

### Prerequisites

- Node.js 18.0 or higher
- npm or yarn package manager
- Docker and Docker Compose
- Git version control

### Local Development Environment Setup

#### 1. Clone and Initialize Project

```bash
# Create main project directory
mkdir Aura IDE-cloud-mvp
cd Aura IDE-cloud-mvp

# Initialize git repository
git init
git remote add origin [your-repo-url]

# Create project structure
mkdir -p {frontend,backend,docs,scripts,docker}
```

#### 2. Frontend Setup (SvelteKit)

```bash
cd frontend

# Initialize SvelteKit project
npm create svelte@latest . -- --template skeleton --types typescript
npm install

# Install essential dependencies
npm install -D tailwindcss postcss autoprefixer @tailwindcss/forms
npm install @codemirror/view @codemirror/state @codemirror/basic-setup
npm install @codemirror/lang-javascript @codemirror/lang-python
npm install @codemirror/lang-html @codemirror/lang-css
npm install @codemirror/theme-one-dark
npm install lucide-svelte axios
npm install @auth/sveltekit @auth/core

# Install Shadcn-Svelte
npx shadcn-svelte@latest init
npx shadcn-svelte@latest add button input dialog textarea card
```

#### 3. Backend Setup (Node.js/Express)

```bash
cd ../backend

# Initialize Node.js project
npm init -y
npm install express cors helmet compression morgan
npm install jsonwebtoken bcryptjs joi
npm install pg redis ioredis
npm install @qdrant/js-client-rest
npm install axios dotenv
npm install -D @types/node @types/express typescript ts-node nodemon
npm install -D @types/jsonwebtoken @types/bcryptjs
```

#### 4. Database Setup Scripts

```bash
# Create database initialization script
cat > scripts/init-db.sql << 'EOF'
-- Create main database
CREATE DATABASE Aura IDE_cloud;

-- Connect to the database
\c Aura IDE_cloud;

-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    subscription_tier VARCHAR(50) DEFAULT 'free',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Projects table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    language VARCHAR(50) DEFAULT 'javascript',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Project files table
CREATE TABLE project_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    filename VARCHAR(500) NOT NULL,
    content TEXT DEFAULT '',
    size_bytes INTEGER DEFAULT 0,
    mime_type VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(project_id, filename)
);

-- AI interactions table
CREATE TABLE ai_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    project_id UUID REFERENCES projects(id),
    interaction_type VARCHAR(50) NOT NULL, -- 'completion', 'chat', 'analysis'
    request_data JSONB NOT NULL,
    response_data JSONB,
    model_used VARCHAR(100),
    tokens_used INTEGER,
    cost_cents INTEGER,
    latency_ms INTEGER,
    success BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Usage analytics table
CREATE TABLE usage_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    session_id VARCHAR(255),
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_project_files_project_id ON project_files(project_id);
CREATE INDEX idx_ai_interactions_user_id ON ai_interactions(user_id);
CREATE INDEX idx_ai_interactions_created_at ON ai_interactions(created_at);
CREATE INDEX idx_usage_analytics_user_id ON usage_analytics(user_id);
CREATE INDEX idx_usage_analytics_event_type ON usage_analytics(event_type);
EOF
```

#### 5. Docker Compose Configuration

```yaml
# docker/docker-compose.dev.yml
version: '3.8'

services:
  postgres:
    image: postgres:15
    container_name: Aura IDE_postgres
    environment:
      POSTGRES_DB: Aura IDE_cloud
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ../scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql

  redis:
    image: redis:7-alpine
    container_name: Aura IDE_redis
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data

  qdrant:
    image: qdrant/qdrant:v1.7.0
    container_name: Aura IDE_qdrant
    ports:
      - '6333:6333'
      - '6334:6334'
    volumes:
      - qdrant_data:/qdrant/storage
    environment:
      - QDRANT__SERVICE__HTTP_PORT=6333
      - QDRANT__SERVICE__GRPC_PORT=6334

volumes:
  postgres_data:
  redis_data:
  qdrant_data:
```

### Environment Configuration

#### Backend Environment Setup

```bash
# backend/.env.development
NODE_ENV=development
PORT=3001

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/Aura IDE_cloud
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d

# AI Services
HELICONE_API_KEY=your-helicone-api-key
HELICONE_BASE_URL=http://localhost:8080
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key

# Vector Database
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=

# Code Execution
E2B_API_KEY=your-e2b-api-key

# Logging
LOG_LEVEL=debug
```

#### Frontend Environment Setup

```bash
# frontend/.env.development
VITE_API_BASE_URL=http://localhost:3001
VITE_APP_NAME=Aura IDE Cloud
VITE_ENVIRONMENT=development
```

## Core Implementation

### 1. SvelteKit Frontend Structure

#### App Structure

```
frontend/src/
├── app.d.ts
├── app.html
├── lib/
│   ├── components/
│   │   ├── ui/           # Shadcn-Svelte components
│   │   ├── Editor.svelte
│   │   ├── AIChat.svelte
│   │   ├── ProjectSidebar.svelte
│   │   └── FileTree.svelte
│   ├── stores/
│   │   ├── auth.ts
│   │   ├── projects.ts
│   │   └── editor.ts
│   ├── services/
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   └── websocket.ts
│   └── utils/
│       ├── constants.ts
│       └── helpers.ts
├── routes/
│   ├── +layout.svelte
│   ├── +page.svelte
│   ├── auth/
│   │   ├── login/+page.svelte
│   │   └── register/+page.svelte
│   ├── dashboard/
│   │   └── +page.svelte
│   └── editor/
│       └── [projectId]/+page.svelte
└── styles/
    └── globals.css
```

#### Core Editor Component

```typescript
<!-- lib/components/Editor.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { EditorView, basicSetup } from 'codemirror';
  import { javascript } from '@codemirror/lang-javascript';
  import { python } from '@codemirror/lang-python';
  import { oneDark } from '@codemirror/theme-one-dark';
  import { currentProject, currentFile } from '$lib/stores/editor';
  import { requestAICompletion } from '$lib/services/api';

  export let projectId: string;
  export let initialContent = '';

  let editorContainer: HTMLElement;
  let editor: EditorView;
  let isAIThinking = false;

  const languageMap = {
    javascript: javascript(),
    python: python(),
    typescript: javascript(),
  };

  onMount(() => {
    initializeEditor();
  });

  function initializeEditor() {
    editor = new EditorView({
      doc: initialContent,
      extensions: [
        basicSetup,
        getLanguageExtension(),
        oneDark,
        EditorView.updateListener.of(handleEditorChange),
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-scroller': { fontSize: '14px' },
          '.cm-focused': { outline: 'none' }
        })
      ],
      parent: editorContainer
    });
  }

  function getLanguageExtension() {
    const language = $currentProject?.language || 'javascript';
    return languageMap[language] || javascript();
  }

  async function handleEditorChange(update) {
    if (update.docChanged) {
      const content = editor.state.doc.toString();

      // Auto-save debounced
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        saveFileContent(content);
      }, 1000);

      // AI completion on specific triggers
      const cursor = editor.state.selection.main.head;
      const line = editor.state.doc.lineAt(cursor);

      if (shouldTriggerAI(line.text, cursor)) {
        await requestAICompletion({
          projectId,
          code: content,
          cursorPosition: cursor,
          language: $currentProject?.language
        });
      }
    }
  }

  function shouldTriggerAI(lineText: string, cursor: number): boolean {
    // Trigger AI on specific patterns
    return lineText.endsWith('//') ||
           lineText.endsWith('#') ||
           lineText.includes('TODO');
  }

  async function saveFileContent(content: string) {
    if (!$currentFile) return;

    try {
      await fetch(`/api/v1/projects/${projectId}/files/${$currentFile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  }

  onDestroy(() => {
    if (editor) {
      editor.destroy();
    }
  });
</script>

<div class="editor-container h-full w-full">
  <div bind:this={editorContainer} class="h-full"></div>

  {#if isAIThinking}
    <div class="ai-indicator">
      <span>AI is thinking...</span>
    </div>
  {/if}
</div>

<style>
  .editor-container {
    position: relative;
  }

  .ai-indicator {
    position: absolute;
    bottom: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
  }
</style>
```

### 2. Backend API Implementation

#### Express Server Setup

```typescript
// backend/src/index.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';

import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import { rateLimiter } from './middleware/rateLimiter';

import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import aiRoutes from './routes/ai';
import sandboxRoutes from './routes/sandbox';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(
	cors({
		origin: process.env.FRONTEND_URL || 'http://localhost:5173',
		credentials: true
	})
);
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(rateLimiter);

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/projects', authMiddleware, projectRoutes);
app.use('/api/v1/ai', authMiddleware, aiRoutes);
app.use('/api/v1/sandbox', authMiddleware, sandboxRoutes);

// Health check
app.get('/health', (req, res) => {
	res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
```

#### Authentication Service

```typescript
// backend/src/services/AuthService.ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { User, CreateUserData, LoginData } from '../types/User';

export class AuthService {
	private db: Pool;

	constructor(db: Pool) {
		this.db = db;
	}

	async register(userData: CreateUserData): Promise<{ user: User; token: string }> {
		const { email, password, firstName, lastName } = userData;

		// Check if user exists
		const existingUser = await this.db.query('SELECT id FROM users WHERE email = $1', [email]);

		if (existingUser.rows.length > 0) {
			throw new Error('User already exists');
		}

		// Hash password
		const saltRounds = 12;
		const passwordHash = await bcrypt.hash(password, saltRounds);

		// Create user
		const result = await this.db.query(
			`INSERT INTO users (email, password_hash, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, first_name, last_name, subscription_tier, created_at`,
			[email, passwordHash, firstName, lastName]
		);

		const user = result.rows[0];
		const token = this.generateToken(user.id);

		return { user, token };
	}

	async login(loginData: LoginData): Promise<{ user: User; token: string }> {
		const { email, password } = loginData;

		const result = await this.db.query('SELECT * FROM users WHERE email = $1', [email]);

		if (result.rows.length === 0) {
			throw new Error('Invalid credentials');
		}

		const user = result.rows[0];
		const isValidPassword = await bcrypt.compare(password, user.password_hash);

		if (!isValidPassword) {
			throw new Error('Invalid credentials');
		}

		const token = this.generateToken(user.id);

		// Remove sensitive data
		delete user.password_hash;

		return { user, token };
	}

	private generateToken(userId: string): string {
		return jwt.sign({ userId }, process.env.JWT_SECRET!, {
			expiresIn: process.env.JWT_EXPIRES_IN || '7d'
		});
	}

	verifyToken(token: string): { userId: string } {
		try {
			return jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
		} catch (error) {
			throw new Error('Invalid token');
		}
	}
}
```

#### AI Service Integration

```typescript
// backend/src/services/AIService.ts
import axios from 'axios';
import { QdrantClient } from '@qdrant/js-client-rest';
import { CodeCompletionRequest, CodeCompletionResponse } from '../types/AI';

export class AIService {
	private heliconeClient: axios.AxiosInstance;
	private qdrantClient: QdrantClient;

	constructor() {
		this.heliconeClient = axios.create({
			baseURL: process.env.HELICONE_BASE_URL,
			headers: {
				Authorization: `Bearer ${process.env.HELICONE_API_KEY}`,
				'Content-Type': 'application/json'
			}
		});

		this.qdrantClient = new QdrantClient({
			url: process.env.QDRANT_URL
		});
	}

	async getCodeCompletion(request: CodeCompletionRequest): Promise<CodeCompletionResponse> {
		const startTime = Date.now();

		try {
			// Get relevant context from vector database
			const context = await this.getRelevantContext(
				request.projectId,
				request.code,
				request.cursorPosition
			);

			// Prepare prompt with context
			const prompt = this.buildCompletionPrompt(request, context);

			// Call AI model through Helicone
			const response = await this.heliconeClient.post('/ai', {
				model: 'openai/gpt-4-turbo',
				messages: [
					{
						role: 'system',
						content:
							'You are an expert code completion assistant. Provide concise, accurate code suggestions.'
					},
					{
						role: 'user',
						content: prompt
					}
				],
				max_tokens: 500,
				temperature: 0.3
			});

			const completion = response.data.choices[0].message.content;
			const latency = Date.now() - startTime;

			// Parse and format suggestions
			const suggestions = this.parseCompletionResponse(completion);

			return {
				suggestions,
				contextUsed: context.map((c) => c.filename),
				latency,
				cost: this.calculateCost(response.data.usage)
			};
		} catch (error) {
			console.error('AI completion error:', error);
			throw new Error('Failed to get AI completion');
		}
	}

	private async getRelevantContext(
		projectId: string,
		code: string,
		cursorPosition: number
	): Promise<any[]> {
		try {
			// Generate embedding for current code context
			const embedding = await this.generateEmbedding(code);

			// Search for similar code in vector database
			const searchResult = await this.qdrantClient.search('code_embeddings', {
				vector: embedding,
				filter: {
					must: [{ key: 'project_id', match: { value: projectId } }]
				},
				limit: 5,
				with_payload: true
			});

			return searchResult.map((result) => result.payload);
		} catch (error) {
			console.error('Context retrieval error:', error);
			return [];
		}
	}

	private buildCompletionPrompt(request: CodeCompletionRequest, context: any[]): string {
		let prompt = `Language: ${request.language}\n\n`;

		if (context.length > 0) {
			prompt += 'Relevant code context:\n';
			context.forEach((ctx) => {
				prompt += `File: ${ctx.filename}\n${ctx.code_snippet}\n\n`;
			});
		}

		prompt += `Current code:\n${request.code}\n\n`;
		prompt += `Cursor position: ${request.cursorPosition}\n\n`;
		prompt += 'Please provide code completion suggestions:';

		return prompt;
	}

	private parseCompletionResponse(completion: string): any[] {
		// Parse AI response and extract suggestions
		const suggestions = [];
		const lines = completion.split('\n');

		lines.forEach((line) => {
			if (line.trim()) {
				suggestions.push({
					text: line.trim(),
					confidence: 0.8, // Default confidence
					type: 'completion'
				});
			}
		});

		return suggestions.slice(0, 3); // Limit to top 3 suggestions
	}

	private async generateEmbedding(text: string): Promise<number[]> {
		try {
			const response = await this.heliconeClient.post('/ai', {
				model: 'openai/text-embedding-ada-002',
				input: text
			});

			return response.data.data[0].embedding;
		} catch (error) {
			console.error('Embedding generation error:', error);
			throw error;
		}
	}

	private calculateCost(usage: any): number {
		// Calculate cost based on token usage
		// OpenAI GPT-4-turbo pricing: $0.01 per 1K prompt tokens, $0.03 per 1K completion tokens
		const promptCost = (usage.prompt_tokens / 1000) * 0.01;
		const completionCost = (usage.completion_tokens / 1000) * 0.03;

		return Math.round((promptCost + completionCost) * 100); // Return cost in cents
	}
}
```

#### Sandbox Service Integration

```typescript
// backend/src/services/SandboxService.ts
import { Sandbox } from '@e2b/sdk';
import { ExecuteCodeRequest, ExecuteCodeResponse } from '../types/Sandbox';

export class SandboxService {
	private sandboxes: Map<string, Sandbox> = new Map();

	async executeCode(request: ExecuteCodeRequest): Promise<ExecuteCodeResponse> {
		const startTime = Date.now();

		try {
			// Get or create sandbox for user
			const sandbox = await this.getSandbox(request.language);

			// Execute code with timeout
			const result = await Promise.race([
				sandbox.runCode(request.language, request.code),
				this.timeoutPromise(request.timeout || 30000)
			]);

			const executionTime = Date.now() - startTime;

			return {
				success: true,
				stdout: result.stdout || '',
				stderr: result.stderr || '',
				exitCode: result.exitCode,
				executionTime
			};
		} catch (error) {
			return {
				success: false,
				stdout: '',
				stderr: error.message,
				executionTime: Date.now() - startTime,
				error: error.message
			};
		}
	}

	private async getSandbox(language: string): Promise<Sandbox> {
		const sandboxKey = `sandbox_${language}`;

		if (!this.sandboxes.has(sandboxKey)) {
			const sandbox = await Sandbox.create({
				template: this.getTemplateForLanguage(language),
				timeoutMs: 60000
			});

			this.sandboxes.set(sandboxKey, sandbox);

			// Clean up sandbox after 5 minutes of inactivity
			setTimeout(
				() => {
					this.cleanupSandbox(sandboxKey);
				},
				5 * 60 * 1000
			);
		}

		return this.sandboxes.get(sandboxKey)!;
	}

	private getTemplateForLanguage(language: string): string {
		const templates = {
			javascript: 'node',
			python: 'python',
			typescript: 'node'
		};

		return templates[language] || 'base';
	}

	private timeoutPromise(ms: number): Promise<never> {
		return new Promise((_, reject) => {
			setTimeout(() => reject(new Error('Execution timeout')), ms);
		});
	}

	private async cleanupSandbox(sandboxKey: string) {
		const sandbox = this.sandboxes.get(sandboxKey);
		if (sandbox) {
			await sandbox.close();
			this.sandboxes.delete(sandboxKey);
		}
	}
}
```

### 3. Development Scripts

#### Package.json Scripts

```json
{
	"scripts": {
		"dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\" \"npm run dev:services\"",
		"dev:backend": "cd backend && npm run dev",
		"dev:frontend": "cd frontend && npm run dev",
		"dev:services": "docker-compose -f docker/docker-compose.dev.yml up -d",
		"build": "npm run build:backend && npm run build:frontend",
		"build:backend": "cd backend && npm run build",
		"build:frontend": "cd frontend && npm run build",
		"test": "npm run test:backend && npm run test:frontend",
		"test:backend": "cd backend && npm test",
		"test:frontend": "cd frontend && npm test",
		"setup": "npm run setup:deps && npm run setup:db",
		"setup:deps": "cd backend && npm install && cd ../frontend && npm install",
		"setup:db": "docker-compose -f docker/docker-compose.dev.yml up -d postgres && sleep 5 && npm run db:migrate",
		"db:migrate": "cd backend && npm run db:migrate"
	}
}
```

#### Development Helper Scripts

```bash
#!/bin/bash
# scripts/dev-setup.sh

echo "Setting up Aura IDE Cloud development environment..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed. Aborting." >&2; exit 1; }

# Install dependencies
echo "Installing dependencies..."
cd backend && npm install
cd ../frontend && npm install

# Start services
echo "Starting development services..."
docker-compose -f docker/docker-compose.dev.yml up -d

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 10

# Run database migrations
echo "Running database migrations..."
cd backend && npm run db:migrate

echo "Development environment is ready!"
echo "Run 'npm run dev' to start the development servers."
```

This implementation guide provides a comprehensive starting point for building Aura IDE Cloud MVP with all the specified technologies and features integrated properly.
