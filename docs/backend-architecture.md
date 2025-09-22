# Aura IDE Backend Architecture

## Overview

This document outlines the complete backend architecture for Aura IDE, including authentication, project initialization, session management, and the framework selection workflow. The backend is built on SvelteKit with a focus on providing a seamless developer experience.

> **📋 Current Implementation Status**: See [`project-creation-flow.md`](./project-creation-flow.md) for detailed documentation of the current project creation implementation, including issues and recommended fixes.

## Architecture Components

### 1. Authentication System 🔐

#### Auth Flow

```
1. User Registration/Login
2. JWT Token Generation
3. Session Management
4. User Profile & Preferences
5. Project Access Control
```

#### Auth Endpoints

- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User authentication
- `POST /api/auth/logout` - Session termination
- `GET /api/auth/profile` - User profile data
- `PUT /api/auth/profile` - Update user profile
- `POST /api/auth/refresh` - Token refresh

### 2. Project Initialization Workflow 🚀

#### Framework Selection Flow

```
1. User creates new project
2. Framework selection (React, Next.js, Svelte, Vue, Angular)
3. UI component library selection (shadcn, Radix, Nuxt UI, etc.)
4. Project configuration & setup
5. E2B session creation
6. Environment initialization
7. Editor session establishment
```

#### Project Setup Endpoints

- `POST /api/projects/create` - Initialize new project
- `GET /api/projects/frameworks` - Available frameworks
- `GET /api/projects/ui-libraries` - Available UI libraries
- `POST /api/projects/{id}/setup` - Configure project
- `GET /api/projects/{id}/status` - Setup progress
- `POST /api/projects/{id}/session` - Create editor session

### 3. Session Management 📡

#### Session Types

- **Authentication Sessions**: User login state
- **Project Sessions**: Individual project workspaces
- **Editor Sessions**: Real-time coding environment
- **AI Agent Sessions**: LangGraph conversation threads

#### Session Endpoints

- `POST /api/sessions/create` - Create new session
- `GET /api/sessions/{id}` - Get session details
- `PUT /api/sessions/{id}` - Update session state
- `DELETE /api/sessions/{id}` - Terminate session
- `GET /api/sessions/active` - List active sessions

## Database Schema

### User Management

```typescript
interface User {
	id: string;
	email: string;
	username: string;
	passwordHash: string;
	profile: UserProfile;
	preferences: UserPreferences;
	createdAt: Date;
	updatedAt: Date;
}

interface UserProfile {
	firstName?: string;
	lastName?: string;
	avatar?: string;
	githubId?: string;
	discordId?: string;
}

interface UserPreferences {
	theme: 'light' | 'dark' | 'system';
	defaultFramework: Framework;
	editorSettings: EditorSettings;
}
```

### Project Management

```typescript
interface Project {
	id: string;
	name: string;
	description?: string;
	ownerId: string;
	framework: Framework;
	configuration: ProjectConfiguration;
	status: 'initializing' | 'ready' | 'error';
	e2bSessionId?: string;
	createdAt: Date;
	updatedAt: Date;
}

interface ProjectConfiguration {
	typescript: boolean;
	eslint: boolean;
	prettier: boolean;
	tailwindcss: boolean;
	packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
	additionalDependencies: string[];
}

type Framework = 'react' | 'nextjs' | 'svelte' | 'vue' | 'angular';
```

### Session Management

```typescript
interface Session {
	id: string;
	userId: string;
	projectId?: string;
	type: 'auth' | 'project' | 'editor' | 'ai-agent';
	status: 'active' | 'idle' | 'terminated';
	data: Record<string, any>;
	expiresAt: Date;
	createdAt: Date;
	lastAccessedAt: Date;
}

interface EditorSession {
	id: string;
	projectId: string;
	userId: string;
	e2bSessionId: string;
	activeFiles: string[];
	terminalSessions: TerminalSession[];
	aiConversationId?: string;
	status: 'connected' | 'disconnected' | 'error';
}
```

## Implementation Plan

### Phase 1: Core Authentication (Week 1) 🔥

**Priority**: CRITICAL

#### Tasks:

1. **User Registration & Login**
   - JWT-based authentication
   - Password hashing (bcrypt)
   - Email validation
   - Rate limiting

2. **Session Management**
   - Secure session storage
   - Token refresh mechanism
   - Session expiry handling

3. **Database Setup**
   - MongoDB/PostgreSQL configuration
   - User schema implementation
   - Migration scripts

#### Files to Create/Update:

```
src/lib/
├── models/
│   ├── user.model.ts
│   ├── session.model.ts
│   └── project.model.ts
├── schemas/
│   ├── auth.schema.ts
│   ├── project.schema.ts
│   └── session.schema.ts
├── services/
│   ├── auth.service.ts
│   ├── jwt.service.ts
│   ├── password.service.ts
│   └── database.service.ts
└── middleware/
    ├── auth.middleware.ts
    └── rate-limit.middleware.ts

src/routes/api/auth/
├── signup/+server.ts
├── login/+server.ts
├── logout/+server.ts
├── profile/+server.ts
└── refresh/+server.ts
```

### Phase 2: Project Framework Selection (Week 2) 🟡

**Priority**: HIGH

#### Framework Configuration:

```typescript
const SUPPORTED_FRAMEWORKS = {
	react: {
		name: 'React',
		version: '18.x',
		template: 'create-react-app',
		uiLibraries: ['shadcn', 'chakra-ui', 'mantine', 'antd'],
		setupCommands: ['npx create-react-app']
	},
	nextjs: {
		name: 'Next.js',
		version: '14.x',
		template: 'create-next-app',
		uiLibraries: ['shadcn', 'nextui', 'chakra-ui', 'mantine'],
		setupCommands: ['npx create-next-app']
	},
	svelte: {
		name: 'Svelte',
		version: '5.x',
		template: 'sv',
		uiLibraries: ['shadcn-svelte', 'skeleton', 'smelte'],
		setupCommands: ['npx sv create']
	},
	vue: {
		name: 'Vue.js',
		version: '3.x',
		template: 'create-vue',
		uiLibraries: ['vuetify', 'quasar', 'primevue', 'naive-ui'],
		setupCommands: ['npm create vue@latest']
	},
	angular: {
		name: 'Angular',
		version: '17.x',
		template: 'ng-new',
		uiLibraries: ['angular-material', 'ng-bootstrap', 'primeng'],
		setupCommands: ['ng new']
	}
};
```

#### Tasks:

1. **Framework Registry**
   - Framework definitions
   - UI library mappings
   - Setup command templates

2. **Project Creation Flow**
   - Framework selection UI
   - Configuration wizard
   - Project initialization

3. **Template Management**
   - Framework-specific templates
   - Dependency management
   - Configuration files

#### Files to Create:

```
src/lib/
├── config/
│   ├── frameworks.config.ts
│   └── ui-libraries.config.ts
├── services/
│   ├── project.service.ts
│   ├── framework.service.ts
│   └── template.service.ts
└── types/
    ├── framework.types.ts
    └── project.types.ts

src/routes/api/projects/
├── create/+server.ts
├── frameworks/+server.ts
├── ui-libraries/+server.ts
└── [id]/
    ├── setup/+server.ts
    └── status/+server.ts
```

### Phase 3: E2B Integration & Editor Sessions (Week 3) 🟡

**Priority**: HIGH

#### E2B Session Management:

```typescript
interface E2BSessionConfig {
	template: string;
	apiKey: string;
	timeout: number;
	environment: {
		NODE_VERSION: string;
		PACKAGE_MANAGER: string;
	};
}

interface EditorSessionState {
	files: FileSystemTree;
	terminals: TerminalSession[];
	processes: ProcessInfo[];
	ports: PortInfo[];
}
```

#### Tasks:

1. **E2B Integration**
   - Session creation/termination
   - File system management
   - Terminal access
   - Process management

2. **Real-time Communication**
   - WebSocket connections
   - State synchronization
   - Collaborative features

3. **Session Persistence**
   - Session state saving
   - Auto-recovery
   - Timeout handling

#### Files to Create:

```
src/lib/services/
├── daytona.service.ts
├── websocket.service.ts
├── file-system.service.ts
└── session-persistence.service.ts

src/routes/api/sessions/
├── create/+server.ts
├── [id]/+server.ts
├── [id]/files/+server.ts
├── [id]/terminal/+server.ts
└── websocket/+server.ts
```

### Phase 4: AI Agent Integration (Week 4) 🟠

**Priority**: MEDIUM

#### LangGraph Integration:

```typescript
interface AIAgentSession {
	id: string;
	projectId: string;
	conversationId: string;
	agentType: 'general' | 'code-reviewer' | 'debugger' | 'documentation';
	state: LangGraphState;
	tools: ToolConfiguration[];
}
```

#### Tasks:

1. **Agent Session Management**
   - Conversation threads
   - Agent specialization
   - Tool integration

2. **Context Management**
   - Project context injection
   - File content awareness
   - Conversation history

3. **Streaming Responses**
   - Real-time AI responses
   - Progress indicators
   - Error handling

## Security Considerations 🔒

### Authentication Security

- JWT tokens with short expiration
- Refresh token rotation
- Rate limiting on auth endpoints
- Password strength requirements
- Account lockout protection

### Session Security

- Secure session storage
- Session hijacking prevention
- Cross-origin request protection
- Input validation & sanitization

### Project Security

- User access control
- File system sandboxing
- Resource limiting
- Code execution safety

### API Security

- Request validation
- SQL injection prevention
- XSS protection
- CSRF protection

## Environment Configuration

### Development

```env
# Database
DATABASE_URL=mongodb://localhost:27017/aura-dev
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-jwt-secret
JWT_EXPIRY=1h
REFRESH_TOKEN_EXPIRY=7d

# E2B
E2B_API_KEY=your-e2b-api-key

# AI Services
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key

# Helicone (Observability)
HELICONE_API_KEY=your-helicone-key
```

### Production

```env
# Database (Production)
DATABASE_URL=mongodb+srv://...
REDIS_URL=redis://...

# Security
JWT_SECRET=strong-production-secret
CORS_ORIGINS=https://aura-ide.com

# Rate Limiting
RATE_LIMIT_WINDOW=15m
RATE_LIMIT_MAX=100

# Monitoring
SENTRY_DSN=your-sentry-dsn
```

## API Documentation

### Auth Endpoints

#### POST /api/auth/signup

```typescript
// Request
{
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

// Response
{
  success: boolean;
  user: User;
  accessToken: string;
  refreshToken: string;
}
```

#### POST /api/auth/login

```typescript
// Request
{
	email: string;
	password: string;
}

// Response
{
	success: boolean;
	user: User;
	accessToken: string;
	refreshToken: string;
}
```

### Project Endpoints

#### POST /api/projects/create

```typescript
// Request
{
  name: string;
  description?: string;
  framework: Framework;
  configuration: ProjectConfiguration;
}

// Response
{
  success: boolean;
  project: Project;
  setupStatus: 'pending' | 'in-progress' | 'completed';
}
```

#### GET /api/projects/frameworks

```typescript
// Response
{
  frameworks: FrameworkDefinition[];
}
```

### Session Endpoints

#### POST /api/sessions/create

```typescript
// Request
{
	projectId: string;
	type: 'editor' | 'ai-agent';
}

// Response
{
	success: boolean;
	session: Session;
	connectionDetails: ConnectionInfo;
}
```

## Testing Strategy

### Unit Tests

- Authentication services
- Project creation logic
- Session management
- Database operations

### Integration Tests

- API endpoint testing
- E2B session lifecycle
- WebSocket connections
- Database migrations

### End-to-End Tests

- Complete user workflows
- Project creation flow
- Editor session management
- AI agent interactions

## Monitoring & Observability

### Metrics

- User registration/login rates
- Project creation success rates
- Session duration & activity
- API response times
- Error rates by endpoint

### Logging

- Authentication events
- Project lifecycle events
- Session state changes
- Error tracking
- Performance metrics

### Alerting

- High error rates
- Long response times
- Failed authentications
- System resource usage
- E2B session failures

## Next Steps

### Immediate Implementation (This Week)

1. Set up authentication system
2. Implement user registration/login
3. Create project models & schemas
4. Basic session management

### Week 2 Goals

1. Framework selection system
2. Project creation workflow
3. E2B session integration
4. Basic editor functionality

### Future Enhancements

1. Collaborative editing
2. Advanced AI agents
3. Project sharing
4. Performance optimization
5. Mobile responsiveness

---

_This backend architecture provides a solid foundation for Aura IDE, ensuring scalability, security, and an excellent developer experience._
