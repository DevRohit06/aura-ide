# 🌟 Aura IDE Cloud

**Your AI-powered cloud IDE to accelerate coding and debugging with intelligent assistance.**

Aura IDE is a modern, cloud-based integrated development environment built with SvelteKit 5, featuring AI-powered code assistance, real-time collaboration, and integrated sandbox execution environments.

## ✨ Features

### 🤖 AI-Powered Development

- **Intelligent Code Assistance** - Context-aware AI suggestions and code completion
- **Smart Debugging** - AI-driven error detection and resolution recommendations
- **Code Analysis** - Real-time code quality insights and optimization suggestions

### ☁️ Cloud-Native Architecture

- **Sandbox Execution** - Isolated development environments via Daytona and E2B
- **Real-time Collaboration** - Live editing and sharing capabilities
- **Persistent Storage** - Cloudflare R2 integration for reliable file management

### 🛠️ Modern Development Experience

- **CodeMirror 6** - Advanced code editor with syntax highlighting
- **Live Previews** - Instant application preview with automatic reloading
- **Terminal Access** - Integrated WebSocket-based terminal sessions
- **Project Templates** - Quick start with popular frameworks and configurations

### 🔧 Technology Stack

- **Frontend**: SvelteKit 5 + TypeScript + Tailwind CSS 4.0
- **UI Components**: Shadcn-Svelte with modern design patterns
- **Backend**: MongoDB + Better Auth + Node.js
- **AI Services**: OpenAI/Anthropic via Helicone Gateway
- **Storage**: Cloudflare R2 for file persistence
- **Sandbox**: Daytona + E2B for code execution

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ or Bun
- MongoDB (local or cloud)
- Docker (for development environment)

### Installation

```bash
# Clone the repository
git clone https://github.com/DevRohit06/aura-ide.git
cd aura-ide

# Install dependencies
npm install
# or with pnpm
pnpm install
# or with bun
bun install

# Set up environment variables
cp .env.example .env
```

### Environment Configuration

Create a `.env` file in the root directory:

```env
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

# Storage
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret
R2_BUCKET_NAME=your-bucket-name
```

### Development

```bash
# Start development server
npm run dev

# Run with Docker (recommended)
docker-compose -f docker-compose.dev.yml up -d
npm run dev
```

The application will be available at `http://localhost:5173`

## 📝 Available Scripts

```bash
# Development
npm run dev                    # Start development server
npm run build                  # Build for production
npm run preview               # Preview production build
npm run build-p               # Build and preview

# Code Quality
npm run check                  # TypeScript + Svelte check
npm run check:watch           # Watch mode for type checking
npm run lint                   # Run ESLint + Prettier
npm run format                # Format code with Prettier

# Testing
npm run test                   # Run unit tests
npm run test:unit             # Run unit tests (Vitest)
npm run test:daytona          # Test Daytona connectivity

# Database Management
npm run db:init               # Initialize database
npm run db:reset              # Reset database
npm run db:stats              # Database statistics
npm run db:health             # Check database health
```

## 🏗️ Project Structure

```
src/
├── lib/
│   ├── components/           # Reusable UI components
│   │   ├── ui/              # Shadcn-Svelte components
│   │   ├── editor/          # Code editor components
│   │   └── chat/            # AI chat components
│   ├── stores/              # Svelte stores for state management
│   ├── services/            # API and external service integrations
│   ├── types/               # TypeScript type definitions
│   └── utils/               # Utility functions
├── routes/
│   ├── api/                 # API endpoints
│   ├── auth/                # Authentication pages
│   ├── editor/              # Code editor interface
│   └── dashboard/           # User dashboard
└── app.html                 # Main HTML template
```

## 🔧 Architecture

### Frontend Architecture

- **SvelteKit 5** with file-based routing
- **Component-based** architecture with Shadcn-Svelte
- **Store-based** state management pattern
- **Type-safe** development with TypeScript

### Backend Services

- **Better Auth** for authentication with MongoDB adapter
- **MongoDB** for data persistence
- **Helicone** as AI gateway proxy
- **WebSocket** connections for real-time features

### Sandbox Integration

- **Multi-provider** support (Daytona, E2B)
- **Persistent** file storage via R2
- **Isolated** execution environments
- **Live preview** generation and health monitoring

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Ensure all tests pass: `npm run test`
5. Format your code: `npm run format`
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

## 📚 Documentation

- [API Documentation](docs/README.md)
- [Sandbox Integration Guide](docs/sandbox-integration-plan.md)
- [Backend Architecture](docs/backend-architecture.md)
- [File Context Chat Integration](docs/file-context-chat-integration.md)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [SvelteKit](https://kit.svelte.dev/) - The web framework
- [Shadcn-Svelte](https://www.shadcn-svelte.com/) - UI component library
- [CodeMirror](https://codemirror.net/) - Code editor
- [Daytona](https://www.daytona.io/) - Development environment platform
- [E2B](https://e2b.dev/) - Code execution sandbox

---

Built with ❤️ by the Aura IDE team
