# 🚀 Getting Started

> **⚠️ EXPERIMENTAL** - This is an MVP version. Some features may not work as expected.

This guide will help you get Aura IDE up and running on your local machine.

---

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** or **Bun** (recommended)
- **MongoDB** (local or MongoDB Atlas)
- **Git**
- **API Keys** (see [Environment Setup](./environment-setup.md))

---

## Quick Installation

### 1. Clone the Repository

```bash
git clone https://github.com/DevRohit06/aura-ide.git
cd aura-ide
```

### 2. Install Dependencies

Using **Bun** (recommended):
```bash
bun install
```

Using **pnpm**:
```bash
pnpm install
```

### 3. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit with your configuration
nano .env  # or use your preferred editor
```

See [Environment Setup](./environment-setup.md) for detailed configuration.

### 4. Start MongoDB

**Option A: Local MongoDB**
```bash
# macOS with Homebrew
brew services start mongodb-community

# Ubuntu/Debian
sudo systemctl start mongod

# Docker
docker run -d -p 27017:27017 mongo:latest
```

**Option B: MongoDB Atlas**
1. Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Get your connection string
3. Set `DATABASE_URL` in your `.env`

### 5. Start Development Server

```bash
bun dev
```

🎉 **That's it!** Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## First Steps

### 1. Create an Account

- Click "Sign Up" on the landing page
- Use email/password or OAuth (Google/GitHub)

### 2. Create Your First Project

- Click "New Project" in the dashboard
- Select a template (React, Vue, Node.js, etc.)
- Wait for the sandbox to provision

### 3. Start Coding

- Use the file tree to navigate
- Open files in the code editor
- Use the AI chat to get assistance

### 4. Chat with the AI

Try these example prompts:
- "Explain this codebase structure"
- "Add a new API endpoint for /users"
- "Fix the bug in src/app.ts"
- "Write tests for the main component"

---

## Docker Development (Optional)

For a complete development environment with all services:

```bash
# Start supporting services
docker-compose -f docker-compose.dev.yml up -d

# This starts:
# - MongoDB on port 27017
# - Qdrant on port 6333

# Then start the dev server
bun dev
```

---

## Verify Installation

### Check the API

```bash
curl http://localhost:5173/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-..."
}
```

### Check Database Connection

```bash
bun run db:health
```

---

## Common Issues

### Port Already in Use

```bash
# Find and kill the process
lsof -i :5173
kill -9 <PID>

# Or use a different port
bun dev -- --port 3000
```

### MongoDB Connection Failed

1. Ensure MongoDB is running
2. Check your `DATABASE_URL` in `.env`
3. Verify network connectivity

### Missing Environment Variables

The app will show warnings for missing required variables. Check:
- `BETTER_AUTH_SECRET`
- `HELICONE_API_KEY` (for AI features)
- `DAYTONA_API_KEY` (for sandbox features)

---

## Next Steps

- [Environment Setup](./environment-setup.md) - Detailed configuration
- [Architecture](./architecture.md) - Learn how it works
- [API Reference](./api-reference.md) - Explore the APIs

---

<div align="center">
  <p><strong>Need help?</strong> Open an <a href="https://github.com/DevRohit06/aura-ide/issues">issue</a> on GitHub!</p>
</div>
