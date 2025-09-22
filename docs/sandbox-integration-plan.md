# Sandbox Integration Plan for Aura IDE

## Executive Summary

This plan outlines the integration of the existing sandbox implementation into the main Aura IDE project. The sandbox currently provides project initialization from StackBlitz templates, R2 storage integration, and basic sandbox execution capabilities via Daytona and E2B. This integration will enhance Aura IDE with complete project lifecycle management, cloud storage, and secure code execution environments.

## Current State Analysis

### Existing Sandbox Features

- ✅ **Project Templates**: Fetches from StackBlitz starters repository
- ✅ **Memory Storage**: In-memory data structures (needs database integration)
- ✅ **R2 Integration**: Cloudflare R2 cloud storage with mock fallback
- ✅ **Sandbox Support**: Daytona and E2B integration with mock fallback
- ✅ **GitHub Integration**: Real template downloading via Octokit
- ✅ **File Management**: Archive creation, compression, and extraction

### Current Aura IDE Features

- ✅ **Project Management**: Basic CRUD operations
- ✅ **File Editor**: CodeMirror 6-based code editor
- ✅ **Authentication**: Better Auth with MongoDB adapter
- ✅ **Dashboard**: Project overview and management
- ✅ **Project Setup**: Template-based project creation
- ⚠️ **Limited Sandbox**: Basic API structure without implementation

### Current Authentication & Project Flow

#### 1. Authentication Flow (Better Auth + MongoDB)

**Login Process:**
```typescript
// POST /api/auth/[...all] - Better Auth handles all auth endpoints
// Supports email/password and OAuth (Google, GitHub)

// User session creation:
1. User visits /auth/login
2. Enters credentials OR clicks OAuth provider
3. Better Auth validates and creates session
4. Session stored in MongoDB with auto-expiry (7 days)
5. User redirected to /dashboard

// Session management in hooks.server.ts:
export async function handle({ event, resolve }) {
  const session = await auth.api.getSession({
    headers: event.request.headers
  });
  
  if (session) {
    event.locals.session = session;
    event.locals.user = {
      id: session.user.id,
      email: session.user.email,
      username: session.user.name || session.user.email
    };
  }
  
  return svelteKitHandler({ event, resolve, auth, building });
}
```

**Authentication State Management:**
- Session available via `event.locals.session` on server
- Client-side auth state in `$lib/stores/auth`
- Auto-redirect to `/auth/login` if not authenticated

#### 2. Project Creation Flow

**Current Implementation:**
```typescript
// Route: /project-setup
// 3-step wizard: Name → Framework → Configuration

Step 1: Project Details
- Project name validation (2+ chars, alphanumeric + hyphens/underscores)
- Optional description
- Authentication check (redirect if not logged in)

Step 2: Framework Selection
- Fetches frameworks from API: GET /api/projects/frameworks
- Currently returns static frameworks (React, Vue, Angular, etc.)
- Framework selection auto-advances to next step

Step 3: Configuration
- TypeScript: boolean (default: true)
- ESLint: boolean (default: true)
- Prettier: boolean (default: true)
- TailwindCSS: boolean (default: true)
- Package Manager: npm|yarn|pnpm|bun (default: npm)
- Additional Dependencies: comma-separated string

// Final submission:
POST /api/projects
{
  "name": "My Project",
  "description": "Optional description",
  "framework": "react",
  "configuration": {
    "typescript": true,
    "eslint": true,
    "prettier": true,
    "tailwindcss": true,
    "packageManager": "npm",
    "additionalDependencies": ["lodash", "axios"]
  }
}

// Success response redirects to: /editor/{projectId}
```

#### 3. Post-Creation Flow

**Project Initialization:**
```typescript
// After project creation, user lands at /editor/{projectId}
// Project has status: 'initializing' | 'ready' | 'error'

// Current project loading flow:
1. Editor page loads project data from route loader
2. Shows loading state if project.status === 'initializing'
3. Displays error if project.status === 'error'
4. Renders full editor if project.status === 'ready'

// Editor components:
- Enhanced sidebar with file tree
- CodeMirror 6 editor with syntax highlighting
- File tabs for open files
- Breadcrumb navigation
- Terminal panel (TerminalManager)
- Chat sidebar for AI assistance
- Resizable panels with saved layout
```

**Current Data Storage:**
- Projects stored in MongoDB via Better Auth database
- File system uses dummy data (in-memory)
- No persistent file storage yet
- No actual sandbox execution

#### 4. Missing Integration Points

**Critical Gaps for Sandbox Integration:**

1. **API Endpoints Missing:**
   - `POST /api/projects` - Creates project but no template integration
   - `GET /api/projects/frameworks` - Returns static data, no StackBlitz sync
   - No `/api/templates/*` endpoints for browsing StackBlitz templates
   - No `/api/sandbox/*` endpoints for session management
   - No `/api/projects/{id}/storage` for R2 integration

2. **Template Integration Missing:**
   - Project setup shows frameworks but no real templates
   - No template preview or browsing capability
   - No StackBlitz template downloading during project creation
   - No template-based file initialization

3. **Storage Integration Missing:**
   - Files exist only in memory (dummy data)
   - No R2 cloud storage integration
   - No project backup/restore functionality
   - No file versioning or collaboration

4. **Sandbox Integration Missing:**
   - No sandbox session creation after project setup
   - No code execution capabilities in editor
   - No container provisioning with Daytona/E2B
   - No real-time collaboration features

5. **Data Persistence Missing:**
   - Project metadata in MongoDB but no file content
   - No template cache in database
   - No sandbox session tracking
   - No usage analytics or cost tracking
```

**Integration Opportunities:**

1. **Enhanced Project Creation:**
   - Replace static frameworks with StackBlitz templates
   - Add template preview and browsing
   - Auto-initialize files from selected template
   - Store project in R2 after creation

2. **Post-Creation Enhancements:**
   - Auto-create sandbox session for new projects
   - Enable code execution in editor
   - Add collaborative editing capabilities
   - Implement real-time file synchronization

3. **Database Schema Alignment:**
   - Extend existing projects collection with sandbox metadata
   - Add template management collections
   - Implement session tracking and analytics
   - Add storage metadata and versioning
```

## Integration Architecture

### Phase 1: Core Infrastructure Setup

#### 1.1 Database Schema Extensions

```typescript
// MongoDB Collections Schema Definitions

// Project Templates Collection
interface ProjectTemplate {
  _id: ObjectId;
  name: string;
  type: string;
  description?: string;
  source_url?: string;
  stackblitz_path: string;
  category: string;
  tags: string[];
  is_active: boolean;
  popularity_score: number;
  file_count: number;
  dependencies: TemplateDependency[];
  preview_url?: string;
  created_at: Date;
  updated_at: Date;
}

// Project Storage Collection
interface ProjectStorage {
  _id: ObjectId;
  project_id: string; // Reference to projects collection
  storage_provider: 'r2' | 'local' | 's3';
  storage_key: string;
  bucket_name?: string;
  file_count: number;
  total_size_bytes: number;
  archive_format: string;
  compression_ratio?: number;
  upload_status: 'pending' | 'uploading' | 'completed' | 'failed';
  last_sync_at?: Date;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

// Sandbox Sessions Collection
interface SandboxSession {
  _id: ObjectId;
  project_id?: string; // Reference to projects collection
  user_id: string; // Reference to users collection
  provider: 'daytona' | 'e2b' | 'local';
  provider_session_id?: string;
  environment_type?: string;
  status: 'initializing' | 'running' | 'stopped' | 'error' | 'timeout';
  start_time: Date;
  last_activity: Date;
  auto_stop_time?: Date;
  stop_time?: Date;
  resource_limits: Record<string, any>;
  network_info: Record<string, any>;
  error_message?: string;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

// Code Executions Collection
interface CodeExecution {
  _id: ObjectId;
  sandbox_session_id: string; // Reference to sandbox_sessions collection
  user_id: string; // Reference to users collection
  language: string;
  code: string;
  input_data?: string;
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  execution_time_ms?: number;
  memory_used_mb?: number;
  cpu_time_ms?: number;
  success: boolean;
  error_type?: 'syntax' | 'runtime' | 'timeout' | 'memory';
  file_changes?: any[]; // JSON array of file modifications
  dependencies_used?: string[];
  executed_at: Date;
}

// Template Dependencies Collection (for normalization)
interface TemplateDependency {
  _id: ObjectId;
  template_id: string; // Reference to project_templates collection
  dependency_name: string;
  dependency_version: string;
  dependency_type: 'runtime' | 'dev' | 'peer';
  is_optional: boolean;
  created_at: Date;
}

// Sandbox File Changes Collection (for detailed tracking)
interface SandboxFileChange {
  _id: ObjectId;
  sandbox_session_id: string; // Reference to sandbox_sessions collection
  file_path: string;
  operation: 'create' | 'update' | 'delete' | 'rename';
  old_content?: string;
  new_content?: string;
  old_path?: string;
  change_size_bytes?: number;
  created_at: Date;
}

// Template Cache Collection (for performance)
interface TemplateCache {
  _id: ObjectId;
  template_id: string; // Reference to project_templates collection
  cache_key: string;
  cached_data: Record<string, any>;
  expires_at: Date;
  created_at: Date;
}

// Sandbox Usage Analytics Collection
interface SandboxUsageAnalytics {
  _id: ObjectId;
  user_id: string; // Reference to users collection
  sandbox_session_id?: string; // Reference to sandbox_sessions collection
  provider: 'daytona' | 'e2b' | 'local';
  event_type: string;
  event_data: Record<string, any>;
  resource_usage: Record<string, any>;
  cost_cents: number;
  created_at: Date;
}
```

```typescript
// MongoDB Indexes for Optimal Performance
const mongoIndexes = {
  // Project Templates indexes
  project_templates: [
    { type: 1 },
    { category: 1 },
    { is_active: 1 },
    { popularity_score: -1 },
    { name: "text", description: "text" } // Text search
  ],
  
  // Project Storage indexes
  project_storage: [
    { project_id: 1 },
    { storage_provider: 1 },
    { upload_status: 1 }
  ],
  
  // Sandbox Sessions indexes
  sandbox_sessions: [
    { user_id: 1 },
    { project_id: 1 },
    { provider: 1 },
    { status: 1 },
    { last_activity: 1 },
    { auto_stop_time: 1 }
  ],
  
  // Code Executions indexes
  code_executions: [
    { sandbox_session_id: 1 },
    { user_id: 1 },
    { language: 1 },
    { executed_at: -1 },
    { success: 1 }
  ],
  
  // Template Dependencies indexes
  template_dependencies: [
    { template_id: 1 },
    { dependency_name: 1 }
  ],
  
  // Template Cache indexes with TTL
  template_cache: [
    { template_id: 1 },
    { expires_at: 1, expireAfterSeconds: 0 } // TTL index
  ],
  
  // Analytics indexes
  sandbox_usage_analytics: [
    { user_id: 1 },
    { provider: 1 },
    { event_type: 1 },
    { created_at: -1 }
  ]
};
```

#### 1.2 Environment Configuration

```typescript
// src/lib/config/sandbox.ts
export interface SandboxConfig {
	database: {
		mongodb: {
			uri: string;
			dbName: string;
			options: {
				maxPoolSize: number;
				minPoolSize: number;
				maxIdleTimeMS: number;
			};
		};
	};
	providers: {
		daytona: {
			enabled: boolean;
			apiKey: string;
			defaultTimeout: number;
			maxSessions: number;
		};
		e2b: {
			enabled: boolean;
			apiKey: string;
			defaultTimeout: number;
			maxSessions: number;
		};
	};
	storage: {
		r2: {
			enabled: boolean;
			accountId: string;
			accessKeyId: string;
			secretAccessKey: string;
			bucketName: string;
			endpoint: string;
		};
	};
	github: {
		token: string;
		cacheTtl: number;
	};
	auth: {
		betterAuth: {
			secret: string;
			sessionExpiry: number;
		};
	};
}

// Environment variables for .env
/*
# Database
DATABASE_URL=mongodb://localhost:27017/aura-dev
MONGODB_DB_NAME=aura-dev

# Authentication  
BETTER_AUTH_SECRET=your-secret-key-here
GOOGLE_CLIENT_ID=your-google-client-id
GITHUB_CLIENT_ID=your-github-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_SECRET=your-github-client-secret

# Sandbox Providers
DAYTONA_API_KEY=your-daytona-api-key
E2B_API_KEY=your-e2b-api-key

# R2 Storage
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=your-bucket-name
R2_ACCOUNT_ID=your-account-id
R2_ENDPOINT=your-r2-endpoint

# GitHub Integration
GITHUB_TOKEN=your-github-token

# AI Services
HELICONE_API_KEY=your-helicone-key
OPENAI_API_KEY=your-openai-key
*/
```

### Phase 2: Service Layer Implementation

#### 2.1 Template Service Integration

```typescript
// src/lib/services/TemplateService.ts
import { MongoClient, ObjectId, Db } from 'mongodb';
import type { ProjectTemplate, TemplateDependency } from '@/types/sandbox';

export class TemplateService {
  private static db: Db | null = null;

  static async getDb(): Promise<Db> {
    if (!this.db) {
      const client = new MongoClient(process.env.DATABASE_URL!);
      await client.connect();
      this.db = client.db();
    }
    return this.db;
  }

  async getAvailableTemplates(filters?: {
    category?: string;
    type?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<ProjectTemplate[]> {
    const db = await TemplateService.getDb();
    const collection = db.collection<ProjectTemplate>('project_templates');
    
    // Build query
    const query: any = { is_active: true };
    
    if (filters?.category) {
      query.category = filters.category;
    }
    
    if (filters?.type) {
      query.type = filters.type;
    }
    
    if (filters?.search) {
      query.$text = { $search: filters.search };
    }

    // Aggregation pipeline to include dependencies
    const pipeline: any[] = [
      { $match: query },
      {
        $lookup: {
          from: 'template_dependencies',
          localField: '_id',
          foreignField: 'template_id',
          as: 'dependencies'
        }
      },
      { $sort: { popularity_score: -1 } }
    ];

    if (filters?.limit) {
      pipeline.push({ $limit: filters.limit });
    }

    if (filters?.offset) {
      pipeline.push({ $skip: filters.offset });
    }

    return collection.aggregate(pipeline).toArray();
  }

  async downloadTemplate(templateId: string): Promise<TemplateFiles> {
    // Implementation for downloading from StackBlitz
    const template = await this.getTemplateById(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Use existing sandbox implementation to fetch from StackBlitz
    return this.fetchFromStackBlitz(template.stackblitz_path);
  }

  async cacheTemplate(templateId: string): Promise<void> {
    const db = await TemplateService.getDb();
    const cacheCollection = db.collection('template_cache');
    
    const templateData = await this.downloadTemplate(templateId);
    
    await cacheCollection.replaceOne(
      { template_id: templateId },
      {
        template_id: templateId,
        cache_key: `template_${templateId}_${Date.now()}`,
        cached_data: templateData,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        created_at: new Date()
      },
      { upsert: true }
    );
  }

  async syncTemplatesFromStackBlitz(): Promise<void> {
    // Implementation for syncing templates from StackBlitz starters
    const stackblitzTemplates = await this.fetchStackBlitzStarters();
    const db = await TemplateService.getDb();
    const collection = db.collection<ProjectTemplate>('project_templates');

    for (const template of stackblitzTemplates) {
      await collection.replaceOne(
        { stackblitz_path: template.stackblitz_path },
        {
          ...template,
          updated_at: new Date()
        },
        { upsert: true }
      );
    }
  }

  private async getTemplateById(id: string): Promise<ProjectTemplate | null> {
    const db = await TemplateService.getDb();
    return db.collection<ProjectTemplate>('project_templates')
      .findOne({ _id: new ObjectId(id) });
  }

  private async fetchFromStackBlitz(path: string): Promise<TemplateFiles> {
    // Implementation using existing sandbox code
    throw new Error('To be implemented with StackBlitz integration');
  }

  private async fetchStackBlitzStarters(): Promise<ProjectTemplate[]> {
    // Implementation for fetching StackBlitz starters
    throw new Error('To be implemented with StackBlitz API');
  }
}
```

#### 2.2 Storage Service Implementation

```typescript
// src/lib/services/StorageService.ts
import { MongoClient, ObjectId, Db } from 'mongodb';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import type { ProjectStorage } from '@/types/sandbox';

export class StorageService {
  private static db: Db | null = null;
  private static s3Client: S3Client | null = null;

  static async getDb(): Promise<Db> {
    if (!this.db) {
      const client = new MongoClient(process.env.DATABASE_URL!);
      await client.connect();
      this.db = client.db();
    }
    return this.db;
  }

  static getS3Client(): S3Client {
    if (!this.s3Client) {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: process.env.R2_ENDPOINT,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
      });
    }
    return this.s3Client;
  }

  async uploadProject(projectId: string, files: ProjectFile[]): Promise<StorageResult> {
    const db = await StorageService.getDb();
    const collection = db.collection<ProjectStorage>('project_storage');
    
    // Create archive from files
    const archive = await this.createArchive(files);
    const storageKey = `projects/${projectId}/${Date.now()}.zip`;
    
    // Upload to R2
    const s3 = StorageService.getS3Client();
    await s3.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: storageKey,
      Body: archive.buffer,
      ContentType: 'application/zip'
    }));

    // Update MongoDB record
    const storageRecord = await collection.findOneAndUpdate(
      { project_id: projectId },
      {
        $set: {
          storage_provider: 'r2' as const,
          storage_key: storageKey,
          bucket_name: process.env.R2_BUCKET_NAME,
          file_count: files.length,
          total_size_bytes: archive.size,
          archive_format: 'zip',
          compression_ratio: archive.compressionRatio,
          upload_status: 'completed' as const,
          last_sync_at: new Date(),
          updated_at: new Date()
        },
        $setOnInsert: {
          created_at: new Date(),
          metadata: {}
        }
      },
      { upsert: true, returnDocument: 'after' }
    );

    return {
      success: true,
      storageKey,
      fileCount: files.length,
      totalSize: archive.size
    };
  }

  async downloadProject(projectId: string): Promise<ProjectFile[]> {
    const db = await StorageService.getDb();
    const storageRecord = await db.collection<ProjectStorage>('project_storage')
      .findOne({ project_id: projectId });

    if (!storageRecord) {
      throw new Error(`No storage record found for project ${projectId}`);
    }

    // Download from R2
    const s3 = StorageService.getS3Client();
    const response = await s3.send(new GetObjectCommand({
      Bucket: storageRecord.bucket_name || process.env.R2_BUCKET_NAME,
      Key: storageRecord.storage_key
    }));

    // Extract files from archive
    const archiveBuffer = await this.streamToBuffer(response.Body);
    return this.extractArchive(archiveBuffer);
  }

  async deleteProject(projectId: string): Promise<void> {
    const db = await StorageService.getDb();
    const storageRecord = await db.collection<ProjectStorage>('project_storage')
      .findOne({ project_id: projectId });

    if (storageRecord) {
      // Delete from R2
      const s3 = StorageService.getS3Client();
      await s3.send(new DeleteObjectCommand({
        Bucket: storageRecord.bucket_name || process.env.R2_BUCKET_NAME,
        Key: storageRecord.storage_key
      }));

      // Remove MongoDB record
      await db.collection('project_storage').deleteOne({ project_id: projectId });
    }
  }

  async getProjectSize(projectId: string): Promise<number> {
    const db = await StorageService.getDb();
    const storageRecord = await db.collection<ProjectStorage>('project_storage')
      .findOne({ project_id: projectId });

    return storageRecord?.total_size_bytes || 0;
  }

  async generateSignedUrl(projectId: string, operation: 'read' | 'write'): Promise<string> {
    // Implementation for generating pre-signed URLs
    const storageRecord = await this.getStorageRecord(projectId);
    // Use AWS SDK to generate signed URL
    throw new Error('To be implemented with AWS SDK signed URL generation');
  }

  private async createArchive(files: ProjectFile[]): Promise<{ buffer: Buffer; size: number; compressionRatio: number }> {
    // Implementation for creating ZIP archive
    throw new Error('To be implemented with archive creation');
  }

  private async extractArchive(buffer: Buffer): Promise<ProjectFile[]> {
    // Implementation for extracting ZIP archive
    throw new Error('To be implemented with archive extraction');
  }

  private async streamToBuffer(stream: any): Promise<Buffer> {
    // Implementation for converting stream to buffer
    throw new Error('To be implemented with stream conversion');
  }

  private async getStorageRecord(projectId: string): Promise<ProjectStorage | null> {
    const db = await StorageService.getDb();
    return db.collection<ProjectStorage>('project_storage')
      .findOne({ project_id: projectId });
  }
}

interface StorageResult {
  success: boolean;
  storageKey: string;
  fileCount: number;
  totalSize: number;
}

interface ProjectFile {
  path: string;
  content: string;
  size: number;
}
```

#### 2.3 Sandbox Service Implementation

```typescript
// src/lib/services/SandboxService.ts
import { MongoClient, ObjectId, Db } from 'mongodb';
import type { SandboxSession, CodeExecution, SandboxFileChange } from '@/types/sandbox';

export class SandboxService {
  private static db: Db | null = null;

  static async getDb(): Promise<Db> {
    if (!this.db) {
      const client = new MongoClient(process.env.DATABASE_URL!);
      await client.connect();
      this.db = client.db();
    }
    return this.db;
  }

  async createSession(projectId: string, provider: SandboxProvider, options?: {
    environmentType?: string;
    autoStopMinutes?: number;
  }): Promise<SandboxSession> {
    const db = await SandboxService.getDb();
    const collection = db.collection<SandboxSession>('sandbox_sessions');

    // Create session with provider
    const providerSessionId = await this.createProviderSession(provider, {
      projectId,
      environmentType: options?.environmentType
    });

    const sessionData = {
      project_id: projectId,
      user_id: this.getCurrentUserId(), // Implementation needed
      provider,
      provider_session_id: providerSessionId,
      environment_type: options?.environmentType,
      status: 'initializing' as const,
      start_time: new Date(),
      last_activity: new Date(),
      auto_stop_time: options?.autoStopMinutes 
        ? new Date(Date.now() + options.autoStopMinutes * 60 * 1000) 
        : undefined,
      resource_limits: this.getDefaultResourceLimits(provider),
      network_info: {},
      metadata: {},
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await collection.insertOne(sessionData);
    
    return {
      _id: result.insertedId,
      ...sessionData
    };
  }

  async executeCode(sessionId: string, code: string, language: string, options?: {
    input?: string;
    timeout?: number;
  }): Promise<ExecutionResult> {
    const session = await this.getSession(sessionId);
    if (!session || session.status !== 'running') {
      throw new Error('Session not available for code execution');
    }

    // Execute code via provider
    const executionResult = await this.executeViaProvider(session, {
      code,
      language,
      input: options?.input,
      timeout: options?.timeout || 30000
    });

    // Record execution in MongoDB
    await this.recordExecution(session, {
      language,
      code,
      input_data: options?.input,
      ...executionResult
    });

    // Update session activity
    await this.updateSessionActivity(sessionId);

    return executionResult;
  }

  async uploadFiles(sessionId: string, files: ProjectFile[]): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Upload files to provider
    await this.uploadFilesToProvider(session, files);

    // Record file changes
    for (const file of files) {
      await this.recordFileChange(sessionId, {
        file_path: file.path,
        operation: 'create',
        new_content: file.content,
        change_size_bytes: file.content.length
      });
    }

    await this.updateSessionActivity(sessionId);
  }

  async stopSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return;
    }

    // Stop provider session
    if (session.provider_session_id) {
      await this.stopProviderSession(session.provider, session.provider_session_id);
    }

    // Update MongoDB record
    const db = await SandboxService.getDb();
    await db.collection<SandboxSession>('sandbox_sessions').updateOne(
      { _id: new ObjectId(sessionId) },
      {
        $set: {
          status: 'stopped',
          stop_time: new Date(),
          updated_at: new Date()
        }
      }
    );

    // Record analytics
    await this.recordAnalytics(session, 'session_end');
  }

  async getSessionStatus(sessionId: string): Promise<SessionStatus> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Get status from provider
    const providerStatus = session.provider_session_id
      ? await this.getProviderStatus(session.provider, session.provider_session_id)
      : null;

    return {
      id: sessionId,
      status: session.status,
      provider: session.provider,
      startTime: session.start_time,
      lastActivity: session.last_activity,
      resourceUsage: providerStatus?.resourceUsage,
      networkInfo: session.network_info
    };
  }

  async listActiveSessions(userId: string): Promise<SandboxSession[]> {
    const db = await SandboxService.getDb();
    return db.collection<SandboxSession>('sandbox_sessions')
      .find({
        user_id: userId,
        status: { $in: ['initializing', 'running'] }
      })
      .sort({ last_activity: -1 })
      .toArray();
  }

  // Cleanup expired sessions
  async cleanupExpiredSessions(): Promise<void> {
    const db = await SandboxService.getDb();
    const now = new Date();
    
    const expiredSessions = await db.collection<SandboxSession>('sandbox_sessions')
      .find({
        status: { $in: ['running', 'initializing'] },
        auto_stop_time: { $lte: now }
      })
      .toArray();

    for (const session of expiredSessions) {
      await this.stopSession(session._id.toString());
    }
  }

  private async getSession(sessionId: string): Promise<SandboxSession | null> {
    const db = await SandboxService.getDb();
    return db.collection<SandboxSession>('sandbox_sessions')
      .findOne({ _id: new ObjectId(sessionId) });
  }

  private async recordExecution(session: SandboxSession, execution: Partial<CodeExecution>): Promise<void> {
    const db = await SandboxService.getDb();
    await db.collection<CodeExecution>('code_executions').insertOne({
      sandbox_session_id: session._id.toString(),
      user_id: session.user_id,
      executed_at: new Date(),
      ...execution
    } as CodeExecution);
  }

  private async recordFileChange(sessionId: string, change: Partial<SandboxFileChange>): Promise<void> {
    const db = await SandboxService.getDb();
    await db.collection<SandboxFileChange>('sandbox_file_changes').insertOne({
      sandbox_session_id: sessionId,
      created_at: new Date(),
      ...change
    } as SandboxFileChange);
  }

  private async updateSessionActivity(sessionId: string): Promise<void> {
    const db = await SandboxService.getDb();
    await db.collection<SandboxSession>('sandbox_sessions').updateOne(
      { _id: new ObjectId(sessionId) },
      {
        $set: {
          last_activity: new Date(),
          updated_at: new Date()
        }
      }
    );
  }

  private async recordAnalytics(session: SandboxSession, eventType: string): Promise<void> {
    const db = await SandboxService.getDb();
    await db.collection('sandbox_usage_analytics').insertOne({
      user_id: session.user_id,
      sandbox_session_id: session._id.toString(),
      provider: session.provider,
      event_type: eventType,
      event_data: {},
      resource_usage: {},
      cost_cents: 0, // Calculate based on usage
      created_at: new Date()
    });
  }

  // Provider-specific implementations
  private async createProviderSession(provider: SandboxProvider, options: any): Promise<string> {
    // Implementation for creating sessions with Daytona/E2B
    throw new Error('To be implemented with provider APIs');
  }

  private async executeViaProvider(session: SandboxSession, execution: any): Promise<ExecutionResult> {
    // Implementation for code execution via providers
    throw new Error('To be implemented with provider APIs');
  }

  private async uploadFilesToProvider(session: SandboxSession, files: ProjectFile[]): Promise<void> {
    // Implementation for file uploads to providers
    throw new Error('To be implemented with provider APIs');
  }

  private async stopProviderSession(provider: SandboxProvider, sessionId: string): Promise<void> {
    // Implementation for stopping provider sessions
    throw new Error('To be implemented with provider APIs');
  }

  private async getProviderStatus(provider: SandboxProvider, sessionId: string): Promise<any> {
    // Implementation for getting provider status
    throw new Error('To be implemented with provider APIs');
  }

  private getDefaultResourceLimits(provider: SandboxProvider): Record<string, any> {
    return {
      cpu: '1000m',
      memory: '1Gi',
      disk: '5Gi',
      timeout: 3600 // 1 hour
    };
  }

  private getCurrentUserId(): string {
    // Implementation needed to get current user ID
    throw new Error('To be implemented with authentication context');
  }
}

type SandboxProvider = 'daytona' | 'e2b' | 'local';

interface ExecutionResult {
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  execution_time_ms?: number;
  memory_used_mb?: number;
  success: boolean;
  error_message?: string;
}

interface SessionStatus {
  id: string;
  status: string;
  provider: string;
  startTime: Date;
  lastActivity: Date;
  resourceUsage?: any;
  networkInfo?: any;
}
```

### Phase 3: API Endpoints Implementation

#### 3.1 Template Management APIs

```typescript
// Missing APIs to implement:

// GET /api/templates - List available project templates
// GET /api/templates/{id} - Get specific template details
// POST /api/templates/sync - Sync templates from StackBlitz
// GET /api/templates/categories - Get template categories

interface TemplateListResponse {
	templates: ProjectTemplate[];
	categories: string[];
	total: number;
}

interface ProjectTemplate {
	id: string;
	name: string;
	type: string;
	description: string;
	category: string;
	tags: string[];
	preview_url?: string;
	stackblitz_path: string;
	file_count: number;
	dependencies: string[];
}
```

#### 3.2 Enhanced Project Management APIs

```typescript
// Enhanced existing APIs:

// POST /api/projects - Enhanced with template integration
interface CreateProjectRequest {
	name: string;
	description?: string;
	template_id: string; // Link to template
	configuration: {
		typescript: boolean;
		eslint: boolean;
		prettier: boolean;
		tailwindcss: boolean;
		packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
		additionalDependencies: string[];
	};
	sandbox_provider?: 'daytona' | 'e2b';
	auto_start_sandbox?: boolean;
}

// GET /api/projects/{id}/storage - Get project storage info
// POST /api/projects/{id}/upload - Upload project to cloud storage
// POST /api/projects/{id}/download - Download project from cloud storage
// DELETE /api/projects/{id}/storage - Remove from cloud storage
```

#### 3.3 Sandbox Management APIs

```typescript
// New sandbox APIs to implement:

// POST /api/sandbox/sessions - Create new sandbox session
interface CreateSandboxRequest {
	project_id: string;
	provider: 'daytona' | 'e2b';
	environment_type?: string;
	auto_stop_minutes?: number;
}

// GET /api/sandbox/sessions - List user's sandbox sessions
// GET /api/sandbox/sessions/{id} - Get sandbox session details
// POST /api/sandbox/sessions/{id}/execute - Execute code in sandbox
// POST /api/sandbox/sessions/{id}/upload - Upload files to sandbox
// DELETE /api/sandbox/sessions/{id} - Stop and cleanup sandbox session

// POST /api/sandbox/execute - Quick code execution (temporary sandbox)
interface QuickExecuteRequest {
	code: string;
	language: string;
	files?: { [filename: string]: string };
	dependencies?: string[];
	timeout?: number;
}
```

#### 3.4 File Management Enhancement APIs

```typescript
// Enhanced file management APIs:

// POST /api/projects/{id}/files/batch - Batch file operations
interface BatchFileOperation {
	operations: Array<{
		type: 'create' | 'update' | 'delete' | 'move';
		path: string;
		content?: string;
		new_path?: string;
	}>;
}

// GET /api/projects/{id}/files/tree - Get file tree structure
// POST /api/projects/{id}/files/sync-sandbox - Sync files with sandbox
// GET /api/projects/{id}/files/diff - Get file differences
```

### Phase 4: Frontend Integration

#### 4.1 Template Selection Enhancement

```svelte
<!-- Enhanced project-setup page -->
<script lang="ts">
	// Add template browsing capabilities
	let selectedTemplate = $state<ProjectTemplate | null>(null);
	let templateCategories = $state<string[]>([]);
	let filteredTemplates = $state<ProjectTemplate[]>([]);

	async function loadTemplates() {
		const response = await fetch('/api/templates');
		const data = await response.json();
		templates = data.templates;
		templateCategories = data.categories;
	}

	function selectTemplate(template: ProjectTemplate) {
		selectedTemplate = template;
		framework = template.type;
		// Auto-configure based on template
		configureFromTemplate(template);
	}
</script>
```

#### 4.2 Enhanced Editor with Sandbox Integration

```svelte
<!-- Enhanced editor page -->
<script lang="ts">
	// Add sandbox management
	let activeSandbox = $state<SandboxSession | null>(null);
	let sandboxStatus = $state<'disconnected' | 'connecting' | 'connected'>('disconnected');

	async function startSandbox() {
		const response = await fetch('/api/sandbox/sessions', {
			method: 'POST',
			body: JSON.stringify({
				project_id: projectId,
				provider: 'e2b',
				auto_stop_minutes: 30
			})
		});
		activeSandbox = await response.json();
		sandboxStatus = 'connected';
	}

	async function executeCode(code: string) {
		if (!activeSandbox) return;

		const response = await fetch(`/api/sandbox/sessions/${activeSandbox.id}/execute`, {
			method: 'POST',
			body: JSON.stringify({ code, language: 'javascript' })
		});
		return await response.json();
	}
</script>
```

#### 4.3 New Sandbox Management Dashboard

```svelte
<!-- New sandbox management component -->
<SandboxDashboard>
	<SandboxSessionList />
	<QuickExecutionPanel />
	<ResourceUsageMetrics />
	<SandboxLogs />
</SandboxDashboard>
```

### Phase 5: Advanced Features

#### 5.1 Real-time Collaboration

```typescript
// WebSocket integration for sandbox collaboration
interface SandboxCollaborationEvent {
	type: 'code_execution' | 'file_change' | 'cursor_position';
	user_id: string;
	data: any;
	timestamp: Date;
}
```

#### 5.2 Advanced Analytics

```typescript
// Analytics for sandbox usage
interface SandboxAnalytics {
	execution_count: number;
	total_execution_time: number;
	memory_usage: number[];
	error_rate: number;
	popular_languages: { [language: string]: number };
	cost_tracking: {
		daytona_hours: number;
		e2b_executions: number;
		storage_usage: number;
	};
}
```

#### 5.3 Performance Optimizations

```typescript
// Template caching strategy
class TemplateCacheService {
	async preloadPopularTemplates(): Promise<void>;
	async invalidateCache(templateId: string): Promise<void>;
	async getCachedTemplate(templateId: string): Promise<TemplateFiles | null>;
}

// Sandbox pooling for faster startup
class SandboxPoolService {
	async preWarmSandboxes(count: number): Promise<void>;
	async getSandboxFromPool(type: string): Promise<SandboxSession>;
	async returnSandboxToPool(session: SandboxSession): Promise<void>;
}
```

## Implementation Phases & Timeline

### Phase 1: Foundation (Week 1-2)

- [ ] MongoDB collections and indexes setup
- [ ] Environment configuration setup
- [ ] Basic service layer structure
- [ ] Template service integration

### Phase 2: Core APIs (Week 3-4)

- [ ] Template management endpoints
- [ ] Enhanced project creation with templates
- [ ] Storage service implementation
- [ ] Basic sandbox session management

### Phase 3: Frontend Integration (Week 5-6)

- [ ] Enhanced project setup with template selection
- [ ] Template browsing interface
- [ ] Basic sandbox integration in editor
- [ ] File upload/download functionality

### Phase 4: Advanced Sandbox Features (Week 7-8)

- [ ] Code execution integration
- [ ] Real-time sandbox status updates
- [ ] Sandbox management dashboard
- [ ] Performance optimizations

### Phase 5: Polish & Production (Week 9-10)

- [ ] Error handling improvements
- [ ] Security audits
- [ ] Performance testing
- [ ] Documentation and deployment

## Missing APIs & Services Analysis

### Critical Missing Components:

1. **Template Management System**
   - No template browsing/selection in current setup
   - Missing template caching and synchronization
   - No template metadata management

2. **Storage Integration**
   - Current implementation uses mock R2 service
   - Missing proper file versioning
   - No storage quota management

3. **Sandbox Session Management**
   - Basic API structure exists but lacks implementation
   - Missing session lifecycle management
   - No resource usage tracking

4. **File Synchronization**
   - No real-time file sync between editor and sandbox
   - Missing conflict resolution
   - No collaborative editing support

5. **Analytics & Monitoring**
   - No usage analytics
   - Missing cost tracking
   - No performance monitoring

### New APIs to Implement:

```typescript
// Template APIs (Priority: High)
GET / api / templates;
GET / api / templates / { id };
POST / api / templates / sync;
GET / api / templates / categories;

// Enhanced Project APIs (Priority: High)
POST / api / projects / { id } / upload - storage;
GET / api / projects / { id } / storage - info;
POST / api / projects / { id } / sync - sandbox;

// Sandbox Management APIs (Priority: Critical)
POST / api / sandbox / sessions;
GET / api / sandbox / sessions;
GET / api / sandbox / sessions / { id };
POST / api / sandbox / sessions / { id } / execute;
POST / api / sandbox / sessions / { id } / upload;
DELETE / api / sandbox / sessions / { id };

// File Management APIs (Priority: Medium)
POST / api / projects / { id } / files / batch;
GET / api / projects / { id } / files / tree;
POST / api / projects / { id } / files / sync;

// Analytics APIs (Priority: Low)
GET / api / analytics / sandbox - usage;
GET / api / analytics / costs;
GET / api / analytics / performance;
```

## Security Considerations

### 1. Sandbox Isolation

- Implement proper resource limits
- Network isolation for sandbox environments
- Secure file upload/download mechanisms

### 2. API Security

- Rate limiting for sandbox operations
- Authentication for all sandbox endpoints
- Input validation and sanitization

### 3. Storage Security

- Encrypted storage for sensitive project files
- Proper access controls for cloud storage
- Secure signed URL generation

## Monitoring & Observability

### 1. Metrics to Track

- Sandbox creation/destruction rates
- Code execution success/failure rates
- Storage usage and costs
- User engagement with sandbox features

### 2. Alerting

- Failed sandbox starts
- High resource usage
- Storage quota exceeded
- Unusual activity patterns

## Success Metrics

### Technical Metrics

- Sandbox startup time < 30 seconds
- Code execution latency < 2 seconds
- File upload/download success rate > 99%
- System uptime > 99.9%

### User Experience Metrics

- Project creation completion rate
- Sandbox usage frequency
- User retention after first sandbox use
- Time from project creation to first execution

## Implementation Roadmap

### Phase 1: Database Integration & Template Enhancement (Week 1-2)

**Priority 1: Complete Project Creation API**
```typescript
// Implement missing API endpoints in src/routes/api/

// 1. Enhanced project creation with template integration
// src/routes/api/projects/+server.ts
export async function POST({ request, locals }: RequestEvent) {
  const session = locals.session;
  if (!session) return new Response('Unauthorized', { status: 401 });
  
  const { name, framework, configuration } = await request.json();
  
  // 1. Fetch template from StackBlitz
  const template = await TemplateService.getTemplate(framework);
  
  // 2. Create project in MongoDB
  const project = await ProjectService.create({
    name,
    description,
    userId: session.user.id,
    templateId: framework,
    configuration,
    status: 'initializing'
  });
  
  // 3. Initialize R2 storage
  await StorageService.initializeProject(project.id, template.files);
  
  // 4. Create sandbox session
  const sandboxSession = await SandboxService.createSession({
    projectId: project.id,
    template: framework,
    configuration
  });
  
  // 5. Update project status
  await ProjectService.update(project.id, { 
    status: 'ready',
    sandboxSessionId: sandboxSession.id 
  });
  
  return Response.json({ projectId: project.id });
}

// 2. Template browsing and preview
// src/routes/api/templates/+server.ts
export async function GET() {
  const templates = await TemplateService.listAvailable();
  return Response.json(templates);
}

// src/routes/api/templates/[templateId]/+server.ts
export async function GET({ params }: RequestEvent) {
  const template = await TemplateService.getTemplate(params.templateId);
  const preview = await TemplateService.getPreview(params.templateId);
  return Response.json({ template, preview });
}
```

**Priority 2: File Storage Integration**
```typescript
// Implement file operations with R2 backend
// src/routes/api/projects/[projectId]/files/+server.ts

export async function GET({ params, locals }: RequestEvent) {
  const session = locals.session;
  if (!session) return new Response('Unauthorized', { status: 401 });
  
  // Verify project ownership
  const project = await ProjectService.findById(params.projectId);
  if (project.userId !== session.user.id) {
    return new Response('Forbidden', { status: 403 });
  }
  
  // Get files from R2 storage
  const files = await StorageService.listFiles(params.projectId);
  return Response.json(files);
}

export async function POST({ params, request, locals }: RequestEvent) {
  const session = locals.session;
  const { path, content, language } = await request.json();
  
  // Create/update file in R2
  const file = await StorageService.saveFile(params.projectId, {
    path,
    content,
    language,
    updatedBy: session.user.id
  });
  
  // Update project metadata in MongoDB
  await ProjectService.updateLastModified(params.projectId);
  
  return Response.json(file);
}
```

**Priority 3: Enhanced Project Setup Flow**
```typescript
// Update project setup to use real templates
// src/routes/project-setup/+page.server.ts

export async function load(): Promise<PageServerLoad> {
  // Fetch real templates from StackBlitz instead of static data
  const frameworks = await TemplateService.listAvailable();
  
  return {
    frameworks: frameworks.map(f => ({
      id: f.id,
      name: f.name,
      description: f.description,
      features: f.features,
      preview: f.previewUrl
    }))
  };
}
```

### Phase 2: Sandbox Session Management (Week 3-4)

**Priority 1: Sandbox Session Creation**
```typescript
// Integrate sandbox creation into project flow
// src/routes/api/sandbox/sessions/+server.ts

export async function POST({ request, locals }: RequestEvent) {
  const { projectId, provider = 'daytona' } = await request.json();
  const session = locals.session;
  
  // Verify project ownership
  const project = await ProjectService.findById(projectId);
  if (project.userId !== session.user.id) {
    return new Response('Forbidden', { status: 403 });
  }
  
  // Create sandbox session
  const sandboxSession = await SandboxService.createSession({
    projectId,
    provider,
    template: project.templateId,
    configuration: project.configuration
  });
  
  // Update project with sandbox session ID
  await ProjectService.update(projectId, {
    sandboxSessionId: sandboxSession.id,
    sandboxProvider: provider
  });
  
  return Response.json(sandboxSession);
}

// Get sandbox session status
export async function GET({ url, locals }: RequestEvent) {
  const projectId = url.searchParams.get('projectId');
  const project = await ProjectService.findById(projectId);
  
  if (project.sandboxSessionId) {
    const session = await SandboxService.getSession(project.sandboxSessionId);
    return Response.json(session);
  }
  
  return Response.json({ status: 'not_created' });
}
```

**Priority 2: Real-time Editor Integration**
```typescript
// Update editor to connect with sandbox
// src/routes/editor/[projectId]/+page.svelte

<script lang="ts">
  let { data } = $props();
  let { project, files } = data;
  
  // Initialize sandbox connection
  let sandboxSession = $state(null);
  
  onMount(async () => {
    if (project.sandboxSessionId) {
      sandboxSession = await SandboxService.connectToSession(project.sandboxSessionId);
    } else {
      // Create new sandbox session
      const response = await fetch('/api/sandbox/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id })
      });
      sandboxSession = await response.json();
    }
  });
  
  // File save with R2 sync
  async function saveFile(file: File) {
    // Save to R2 storage
    await fetch(`/api/projects/${project.id}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: file.path,
        content: file.content,
        language: file.language
      })
    });
    
    // Sync with sandbox if available
    if (sandboxSession?.status === 'running') {
      await SandboxService.syncFile(sandboxSession.id, file);
    }
  }
  
  // Code execution
  async function executeCode(code: string, language: string) {
    if (!sandboxSession) return;
    
    const result = await SandboxService.executeCode(sandboxSession.id, {
      code,
      language,
      workingDirectory: '/project'
    });
    
    return result;
  }
</script>
```

### Phase 3: Advanced Features & Optimization (Week 5-6)

**Priority 1: Collaboration Features**
```typescript
// Real-time collaboration via WebSocket
// src/routes/api/projects/[projectId]/collaborate/+server.ts

export async function GET({ params, locals }: RequestEvent) {
  const projectId = params.projectId;
  const userId = locals.session?.user.id;
  
  // Upgrade to WebSocket for real-time collaboration
  const { socket, response } = Deno.upgradeWebSocket(request);
  
  socket.onopen = () => {
    CollaborationService.joinProject(projectId, userId, socket);
  };
  
  socket.onmessage = async (event) => {
    const message = JSON.parse(event.data);
    await CollaborationService.handleMessage(projectId, userId, message);
  };
  
  return response;
}
```

**Priority 2: Performance Optimization**
```typescript
// Implement caching and optimization
// src/lib/services/CacheService.ts

export class CacheService {
  // Template caching
  static async getCachedTemplate(templateId: string): Promise<Template | null> {
    const cached = await redis.get(`template:${templateId}`);
    if (cached) return JSON.parse(cached);
    
    const template = await TemplateService.fetchFromStackBlitz(templateId);
    await redis.setex(`template:${templateId}`, 3600, JSON.stringify(template));
    return template;
  }
  
  // Project file caching
  static async getCachedFiles(projectId: string): Promise<File[]> {
    const cacheKey = `project:files:${projectId}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) return JSON.parse(cached);
    
    const files = await StorageService.listFiles(projectId);
    await redis.setex(cacheKey, 300, JSON.stringify(files)); // 5 min cache
    return files;
  }
}
```

### Phase 4: Production Readiness (Week 7-8)

**Priority 1: Error Handling & Monitoring**
```typescript
// Comprehensive error handling
// src/lib/utils/errorHandler.ts

export class ErrorHandler {
  static async handleSandboxError(error: SandboxError, context: any) {
    // Log to monitoring service
    await MonitoringService.logError({
      type: 'sandbox_error',
      error: error.message,
      context,
      timestamp: new Date()
    });
    
    // Attempt recovery
    if (error.type === 'session_expired') {
      return await SandboxService.recreateSession(context.projectId);
    }
    
    throw error;
  }
  
  static async handleStorageError(error: StorageError, context: any) {
    // Implement retry logic for R2 operations
    if (error.retryable && context.retryCount < 3) {
      await new Promise(resolve => setTimeout(resolve, 1000 * context.retryCount));
      return await StorageService.retry(context.operation, context.retryCount + 1);
    }
    
    throw error;
  }
}
```

**Priority 2: Security & Access Control**
```typescript
// Enhanced security measures
// src/lib/middleware/auth.ts

export async function validateProjectAccess(
  projectId: string, 
  userId: string, 
  requiredPermission: 'read' | 'write' | 'execute'
): Promise<boolean> {
  const project = await ProjectService.findById(projectId);
  
  // Owner access
  if (project.userId === userId) return true;
  
  // Shared project access
  const collaboration = await CollaborationService.getAccess(projectId, userId);
  if (collaboration && hasPermission(collaboration.role, requiredPermission)) {
    return true;
  }
  
  return false;
}

// Rate limiting for sandbox operations
export const sandboxRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each user to 100 sandbox operations per windowMs
  message: 'Too many sandbox requests, please try again later.'
});
```

## User Journey Integration Points

### Complete Flow: Login → Dashboard → Project Creation → Editor

#### 1. Authentication Entry Point
```typescript
// src/routes/auth/login/+page.svelte
// User logs in via Better Auth (email/password or OAuth)
// Session created in MongoDB with 7-day expiry
// Redirect to /dashboard with session cookie
```

#### 2. Dashboard Integration
```typescript
// src/routes/(dashboard)/+layout.server.ts
export async function load({ locals }: LayoutServerLoad) {
  if (!locals.session) {
    throw redirect(302, '/auth/login');
  }
  
  // Load user's projects with sandbox status
  const projects = await ProjectService.findByUserId(locals.user.id);
  const projectsWithStatus = await Promise.all(
    projects.map(async (project) => ({
      ...project,
      sandboxStatus: project.sandboxSessionId 
        ? await SandboxService.getSessionStatus(project.sandboxSessionId)
        : 'not_created'
    }))
  );
  
  return { user: locals.user, projects: projectsWithStatus };
}
```

#### 3. Project Creation Integration Points
```typescript
// src/routes/project-setup/+page.svelte
// Step 1: Project name/description validation
// Step 2: Template selection (fetch from StackBlitz API)
// Step 3: Configuration options (TypeScript, tools, etc.)
// Final submission creates project + initializes sandbox + R2 storage
```

#### 4. Editor Launch Integration
```typescript
// src/routes/editor/[projectId]/+layout.server.ts
export async function load({ params, locals }: LayoutServerLoad) {
  const project = await ProjectService.findById(params.projectId);
  
  // Verify access
  if (project.userId !== locals.user.id) {
    throw error(403, 'Access denied');
  }
  
  // Load project files from R2
  const files = await StorageService.listFiles(params.projectId);
  
  // Check sandbox session status
  let sandboxSession = null;
  if (project.sandboxSessionId) {
    sandboxSession = await SandboxService.getSession(project.sandboxSessionId);
  }
  
  return { project, files, sandboxSession };
}
```

## Conclusion

This integration plan transforms Aura IDE from a basic project management tool into a complete cloud development environment. The phased approach ensures minimal disruption while delivering incremental value. The sandbox integration will enable users to:

1. **Create projects faster** with real templates from StackBlitz
2. **Work anywhere** with cloud storage and persistent sandboxes
3. **Execute code safely** in isolated environments
4. **Collaborate effectively** with real-time sandbox sharing
5. **Scale seamlessly** with managed cloud infrastructure

The implementation prioritizes core functionality first, then builds advanced features. This approach ensures a solid foundation while delivering immediate user value through the documented user flow integration points.
