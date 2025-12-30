# 🤝 Contributing to Aura IDE

> **⚠️ EXPERIMENTAL** - As an MVP project, we welcome all contributions to help improve Aura IDE!

Thank you for your interest in contributing! This guide will help you get started.

---

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [Testing](#testing)

---

## Code of Conduct

Please be respectful and inclusive. We're building this together!

- Be welcoming to newcomers
- Be patient with questions
- Give constructive feedback
- Focus on what's best for the project

---

## Getting Started

### Types of Contributions

We welcome:

| Type | Description |
|------|-------------|
| 🐛 **Bug Fixes** | Fix issues and errors |
| ✨ **Features** | Add new functionality |
| 📚 **Documentation** | Improve or add docs |
| 🎨 **UI/UX** | Improve the interface |
| ⚡ **Performance** | Optimize speed/efficiency |
| 🧪 **Tests** | Add or improve tests |

### Finding Issues

1. Check [GitHub Issues](https://github.com/DevRohit06/aura-ide/issues)
2. Look for `good first issue` labels
3. Check `help wanted` labels
4. Propose new features in Discussions

---

## Development Setup

### Prerequisites

- Node.js 18+ or Bun
- MongoDB (local or Atlas)
- Git

### Clone & Install

```bash
# Fork the repo first, then clone
git clone https://github.com/YOUR_USERNAME/aura-ide.git
cd aura-ide

# Install dependencies
bun install

# Copy environment file
cp .env.example .env
# Edit .env with your values
```

### Start Development

```bash
# Start dev server
bun dev

# In another terminal, start supporting services (optional)
docker-compose -f docker-compose.dev.yml up -d
```

---

## Making Changes

### Branch Naming

Use descriptive branch names:

```bash
# Features
git checkout -b feature/add-login-page

# Bug fixes
git checkout -b fix/resolve-crash-on-save

# Documentation
git checkout -b docs/update-readme

# Refactoring
git checkout -b refactor/simplify-auth-flow
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Format
<type>(<scope>): <description>

# Examples
feat(chat): add message editing support
fix(editor): resolve syntax highlighting bug
docs(readme): add mermaid diagrams
refactor(sandbox): simplify file operations
test(agent): add unit tests for tools
```

**Types**:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Formatting (no code change)
- `refactor` - Code refactoring
- `test` - Adding tests
- `chore` - Maintenance tasks

### Making Changes

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature
   ```

2. **Make your changes**
   - Write clean, readable code
   - Add comments where needed
   - Follow existing patterns

3. **Test your changes**
   ```bash
   bun test
   bun run check
   ```

4. **Format your code**
   ```bash
   bun run format
   bun run lint
   ```

5. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat(scope): description"
   ```

---

## Pull Request Process

### Before Submitting

- [ ] Code follows project style
- [ ] Tests pass (`bun test`)
- [ ] TypeScript check passes (`bun run check`)
- [ ] Linting passes (`bun run lint`)
- [ ] Documentation updated if needed

### Creating a PR

1. Push your branch:
   ```bash
   git push origin feature/your-feature
   ```

2. Go to GitHub and create a Pull Request

3. Fill in the PR template:
   - **Title**: Clear, concise description
   - **Description**: What changed and why
   - **Related Issues**: Link to issues (e.g., "Fixes #123")
   - **Screenshots**: For UI changes

### PR Review

- PRs need at least 1 approval
- Address review feedback promptly
- Keep discussions constructive
- Squash commits if requested

---

## Code Style

### TypeScript

```typescript
// Use explicit types
function processMessage(message: string): Result {
  // ...
}

// Use interfaces for objects
interface UserConfig {
  theme: 'light' | 'dark';
  fontSize: number;
}

// Use const for constants
const MAX_RETRIES = 3;

// Use async/await over promises
async function fetchData() {
  const response = await fetch(url);
  return response.json();
}
```

### Svelte

```svelte
<script lang="ts">
  // Imports first
  import { onMount } from 'svelte';
  import Button from '$lib/components/ui/button';
  
  // Props
  let { message, onSend }: { message: string; onSend: () => void } = $props();
  
  // State
  let isLoading = $state(false);
  
  // Functions
  function handleClick() {
    isLoading = true;
    onSend();
  }
</script>

<!-- Markup with proper indentation -->
<div class="container">
  <Button onclick={handleClick}>
    Send
  </Button>
</div>

<style>
  .container {
    padding: 1rem;
  }
</style>
```

### CSS/Tailwind

```css
/* Use Tailwind utilities when possible */
/* Custom CSS only for complex animations or specific needs */

/* Follow mobile-first approach */
.component {
  @apply p-4 text-sm;
  @apply md:p-6 md:text-base;
  @apply lg:p-8 lg:text-lg;
}
```

---

## Testing

### Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test src/lib/services/chat.service.test.ts

# Run tests in watch mode
bun test --watch
```

### Writing Tests

```typescript
import { describe, it, expect, vi } from 'vitest';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  it('should create a new thread', async () => {
    const service = new ChatService();
    const threadId = await service.createThread('project123', 'Test Thread');
    
    expect(threadId).toBeDefined();
    expect(typeof threadId).toBe('string');
  });

  it('should handle errors gracefully', async () => {
    const service = new ChatService();
    
    await expect(
      service.loadThreadMessages('invalid')
    ).rejects.toThrow();
  });
});
```

### Test Coverage

Focus on:
- Service layer functions
- Utility functions
- Complex component logic
- API endpoints

---

## Project Structure

When contributing, understand where files go:

```
src/
├── lib/
│   ├── components/     # Svelte components
│   │   ├── ui/         # Generic UI (buttons, inputs)
│   │   ├── chat/       # Chat-specific components
│   │   └── editor/     # Editor components
│   ├── services/       # Business logic
│   ├── stores/         # Svelte stores
│   ├── types/          # TypeScript types
│   └── utils/          # Utility functions
├── routes/
│   ├── api/            # API endpoints
│   ├── auth/           # Auth pages
│   └── editor/         # Editor pages
└── tests/              # Test files
```

---

## Getting Help

- **Questions**: Open a [Discussion](https://github.com/DevRohit06/aura-ide/discussions)
- **Bugs**: Open an [Issue](https://github.com/DevRohit06/aura-ide/issues)
- **Chat**: Join our community (coming soon)

---

## Recognition

Contributors will be:
- Listed in the README
- Mentioned in release notes
- Appreciated forever! 🙏

---

<div align="center">
  <h3>Thank you for contributing! 💜</h3>
  <p>Every contribution, no matter how small, helps make Aura IDE better.</p>
</div>
