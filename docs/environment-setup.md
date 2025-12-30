# 🔐 Environment Setup

> **⚠️ EXPERIMENTAL** - Configuration options may change as the project evolves.

This guide covers all environment variables and their configuration.

---

## Quick Setup

```bash
# Copy the example file
cp .env.example .env

# Edit with your values
nano .env
```

---

## Required Variables

These variables are **essential** for the application to function:

### Database

```env
# MongoDB connection string
DATABASE_URL=mongodb://localhost:27017/aura_intellicode

# Alternative format (used by some services)
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=aura_intellicode
```

**Getting MongoDB**:
- **Local**: Install from [mongodb.com](https://www.mongodb.com/try/download/community)
- **Docker**: `docker run -d -p 27017:27017 mongo:latest`
- **Atlas**: Create free at [mongodb.com/atlas](https://www.mongodb.com/atlas)

### Authentication

```env
# Secret key for session encryption
# Generate with: openssl rand -base64 32
BETTER_AUTH_SECRET=your_super_secret_key_here

# Application URLs (must match your deployment)
ORIGIN=http://localhost:5173
PUBLIC_ORIGIN=http://localhost:5173
```

---

## AI Configuration

### Helicone Gateway (Recommended)

Helicone provides a unified gateway for all AI providers with caching, logging, and analytics.

```env
# Get your key at https://helicone.ai/
HELICONE_API_KEY=your_helicone_api_key
HELICONE_ENABLE_CACHING=true
```

**Benefits**:
- Automatic provider switching
- Request caching
- Cost monitoring
- Latency optimization

### Direct Provider Keys (Alternative)

If not using Helicone, set provider keys directly:

```env
# OpenAI - https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-...

# Anthropic - https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-...
```

### Model Configuration

```env
# Default model for AI agent
DEFAULT_AI_MODEL=gpt-4o

# Enable tracing for debugging
ENABLE_AI_TRACING=true
```

---

## Sandbox Configuration

### Daytona (Required for Code Execution)

Daytona provides isolated development environments.

```env
# Get your key at https://app.daytona.io/
DAYTONA_API_KEY=your_daytona_api_key
DAYTONA_API_URL=https://api.daytona.io
DAYTONA_TARGET=us  # Options: us, eu
DAYTONA_ENABLED=true
```

**Getting Daytona API Key**:
1. Sign up at [daytona.io](https://www.daytona.io/)
2. Go to Settings → API Keys
3. Create a new API key
4. Copy to your `.env`

---

## OAuth Providers (Optional)

Enable social login for better user experience.

### Google OAuth

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

**Setup**:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect: `http://localhost:5173/auth/callback/google`

### GitHub OAuth

```env
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

**Setup**:
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set Authorization callback URL: `http://localhost:5173/auth/callback/github`
4. Copy Client ID and Secret

---

## Vector Database (Optional)

Enable semantic code search with Qdrant.

```env
# Local Qdrant
QDRANT_URL=http://localhost:6333

# Qdrant Cloud
QDRANT_URL=https://your-cluster.qdrant.io
QDRANT_API_KEY=your_qdrant_api_key
```

**Running Locally**:
```bash
docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant
```

**Cloud Setup**:
1. Create account at [cloud.qdrant.io](https://cloud.qdrant.io/)
2. Create a cluster (free tier available)
3. Copy URL and API key

---

## External Services (Optional)

### Tavily Web Search

Enable web search capabilities for the AI agent.

```env
# Get your key at https://tavily.com/
TAVILY_API_KEY=your_tavily_api_key
```

### Redis (For Background Jobs)

Required for queue processing and caching.

```env
REDIS_URL=redis://localhost:6379
```

**Running Locally**:
```bash
docker run -p 6379:6379 redis:alpine
```

---

## MongoDB Advanced Settings

Fine-tune MongoDB connection for production:

```env
# Connection pool settings
MONGODB_MAX_POOL_SIZE=10
MONGODB_MIN_POOL_SIZE=2

# Timeout settings (in milliseconds)
MONGODB_MAX_IDLE_TIME_MS=30000
MONGODB_SERVER_SELECTION_TIMEOUT_MS=5000
MONGODB_SOCKET_TIMEOUT_MS=45000
MONGODB_CONNECT_TIMEOUT_MS=10000
```

---

## Development Settings

```env
# Environment mode
NODE_ENV=development

# Logging level
LOG_LEVEL=debug  # Options: debug, info, warn, error
```

---

## Complete Example

Here's a complete `.env` for local development:

```env
# Database
DATABASE_URL=mongodb://localhost:27017/aura_intellicode

# Auth
BETTER_AUTH_SECRET=local_dev_secret_change_in_production
ORIGIN=http://localhost:5173
PUBLIC_ORIGIN=http://localhost:5173

# AI (using Helicone)
HELICONE_API_KEY=your_helicone_key
DEFAULT_AI_MODEL=gpt-4o

# Sandbox
DAYTONA_API_KEY=your_daytona_key
DAYTONA_API_URL=https://api.daytona.io
DAYTONA_TARGET=us
DAYTONA_ENABLED=true

# Optional: OAuth
GOOGLE_CLIENT_ID=your_google_id
GOOGLE_CLIENT_SECRET=your_google_secret
GITHUB_CLIENT_ID=your_github_id
GITHUB_CLIENT_SECRET=your_github_secret

# Optional: Vector DB
QDRANT_URL=http://localhost:6333

# Optional: Web Search
TAVILY_API_KEY=your_tavily_key

# Development
NODE_ENV=development
```

---

## Production Considerations

For production deployments:

1. **Use strong secrets**: Generate with `openssl rand -base64 32`
2. **Use managed databases**: MongoDB Atlas, Qdrant Cloud
3. **Enable HTTPS**: Update ORIGIN to use `https://`
4. **Restrict CORS**: Configure allowed origins
5. **Monitor costs**: Set up Helicone cost alerts

---

## Troubleshooting

### "Missing environment variable" errors

The application validates required variables on startup. Check:
1. File is named exactly `.env` (not `.env.local`)
2. No trailing spaces in values
3. No quotes around values (unless needed)

### Database connection issues

```bash
# Test connection
bun run db:health

# Check MongoDB is running
mongosh --eval "db.runCommand({ ping: 1 })"
```

### AI not responding

1. Verify `HELICONE_API_KEY` is set
2. Check Helicone dashboard for errors
3. Try a direct provider key

---

<div align="center">
  <p><strong>Questions?</strong> Check the <a href="./getting-started.md">Getting Started</a> guide or open an issue.</p>
</div>
