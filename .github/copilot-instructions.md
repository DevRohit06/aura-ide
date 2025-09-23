# Aura IDE - GitHub Copilot Instructions

## Project Overview

Aura IDE is a cloud-based integrated development environment built with SvelteKit 5, featuring AI-powered code assistance, real-time collaboration, and integrated sandbox execution. The project uses modern web technologies with MongoDB for data persistence and includes a comprehensive sandbox integration for code execution via Daytona and E2B providers.

## Architecture & Technology Stack

### Frontend Stack

- **SvelteKit 5** with TypeScript - File-based routing in `src/routes/`
- **Shadcn-Svelte** - UI components in `src/lib/components/ui/`
- **Tailwind CSS 4.0** - Styling with `@tailwindcss/vite` plugin
- **CodeMirror 6** - Code editor integration
- **Better Auth** - Authentication with MongoDB adapter

### Backend Services

- **MongoDB** - Primary database with Better Auth integration
- **Helicone AI Gateway** - AI service proxy for OpenAI/Anthropic
- **R2 Storage** - Cloudflare R2 for file storage (AWS SDK compatible)
- **Sandbox Providers** - Daytona and E2B integration for code execution

### Key Architecture Patterns

#### Store-Based State Management

Use modular Svelte stores pattern found in `src/lib/stores/`:

```typescript
// Individual feature stores with actions
export const filesStore = writable<Map<string, File>>(new Map());
export const fileActions = {
	create: (file: File) => {
		/* implementation */
	},
	update: (id: string, changes: Partial<File>) => {
		/* implementation */
	}
};

// Re-export from src/lib/stores/editor.ts for consumer convenience
export { filesStore, fileActions } from './files.store.js';
```

#### Type-First Development

All interfaces defined in `src/lib/types/` with strict typing:

- `files.ts` - File system and project types
- `editor-state.ts` - Editor state management
- `sandbox.ts` - Sandbox execution types

#### Service Layer Architecture

Services in `src/lib/services/` follow dependency injection pattern:

- MongoDB services use singleton pattern with `getDb()` method
- Authentication via `src/lib/auth.ts` with Better Auth configuration
- External integrations (R2, Daytona, E2B) with fallback mocks

## Development Workflow

### Scripts & Commands

```bash
# Development with hot reload
npm run dev                    # Start SvelteKit dev server (port 5173)

# Code quality
npm run check                  # TypeScript + Svelte check
npm run lint                   # Prettier + ESLint
npm run format                 # Auto-format code

# Testing
npm run test                   # Run Vitest unit tests
npm run test:daytona          # Test Daytona sandbox connectivity

# Build & Preview
npm run build                  # Production build
npm run preview               # Preview production build
```

### Environment Configuration

Set up environment variables in root `.env`:

```bash
# Database
DATABASE_URL=mongodb://localhost:27017/aura-dev

# Authentication
BETTER_AUTH_SECRET=your-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
GITHUB_CLIENT_ID=your-github-client-id

# AI Services
HELICONE_API_KEY=your-helicone-key
OPENAI_API_KEY=your-openai-key

# Sandbox Providers
DAYTONA_API_KEY=your-daytona-key
E2B_API_KEY=your-e2b-key

# R2 Storage
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret
R2_BUCKET_NAME=your-bucket-name
```

## Project-Specific Patterns

### Component Organization

- **UI Components**: `src/lib/components/ui/` - Shadcn-Svelte components with consistent naming
- **Shared Components**: `src/lib/components/shared/` - App-specific reusable components
- **Feature Components**: `src/lib/components/editor/` - Domain-specific components

### Svelte 5 Patterns

Uses modern Svelte 5 syntax throughout:

```svelte
<script lang="ts">
	// Use $state for reactive variables
	let count = $state(0);

	// Use $props() for component props with TypeScript
	let { projectId, onSave }: { projectId: string; onSave: () => void } = $props();

	// Use $derived for computed values
	let doubleCount = $derived(count * 2);
</script>
```

### File System Abstractions

Project uses comprehensive file system types in `src/lib/types/files.ts`:

- `FileSystemItem` - Base interface for files/directories
- `File` extends with content, language detection, metadata
- `Directory` extends with children and expansion state
- Rich metadata tracking: bookmarks, breakpoints, cursors, search history

### MongoDB Integration

Database services follow consistent patterns:

```typescript
class SomeService {
	private static db: Db | null = null;

	static async getDb(): Promise<Db> {
		if (!this.db) {
			const client = new MongoClient(connectionString);
			this.db = client.db(dbName);
		}
		return this.db;
	}

	static async createRecord(data: Omit<Record, 'id' | 'created_at'>): Promise<Record> {
		const now = new Date();
		const doc = { ...data, created_at: now, updated_at: now };
		const result = await this.getDb().collection('records').insertOne(doc);
		return { id: result.insertedId.toString(), ...doc };
	}
}
```

## Integration Guidelines

### Shadcn-Svelte Components

Before creating new components, check `@ieedan/shadcn-svelte-extras` via jsrepo. Use pinned version from `jsrepo.json`:

```bash
# Fetch component from jsrepo
jsrepo get @ieedan/shadcn-svelte-extras@1.0.0/ts/math
```

### Authentication Flow

Uses Better Auth with MongoDB adapter. Session available via:

- Server-side: `event.locals.session` and `event.locals.user`
- Client-side: Import from `$lib/auth.js`

### API Routes

Follow SvelteKit conventions:

- `src/routes/api/auth/[...all]/+server.ts` - Better Auth handler
- API endpoints use `RequestHandler` type with proper HTTP methods

### Sandbox Integration

Currently integrating comprehensive sandbox system:

- Project templates from StackBlitz
- File storage via R2
- Code execution via Daytona/E2B
- Session management with resource tracking

## Code Style & Conventions

- **TypeScript**: Strict mode enabled, prefer interfaces over types
- **Imports**: Use `@/` alias for `src/lib/` paths (configured in `svelte.config.js`)
- **File naming**: kebab-case for files, PascalCase for components
- **Store actions**: Group related mutations in action objects
- **Error handling**: Use proper TypeScript error types, avoid generic `any`

## Testing & Quality

- **Unit Tests**: Vitest with jsdom for DOM testing
- **Type Checking**: `svelte-check` for Svelte component type validation
- **Linting**: ESLint + Prettier with Svelte-specific rules
- **Package Manager**: pnpm for dependency management

This codebase emphasizes type safety, modular architecture, and modern Svelte patterns while integrating complex cloud services for a comprehensive IDE experience.
