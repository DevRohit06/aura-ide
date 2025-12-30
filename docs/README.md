# 📚 Aura IDE Documentation

> **⚠️ EXPERIMENTAL** - This documentation covers an MVP version of Aura IDE. Features and APIs may change as the project evolves.

Welcome to the Aura IDE documentation! This guide will help you understand the architecture, setup, and usage of Aura IDE.

---

## 📖 Documentation Index

### Getting Started
- [Quick Start Guide](./getting-started.md) - Get up and running in minutes
- [Environment Setup](./environment-setup.md) - Detailed configuration guide

### Architecture
- [System Architecture](./architecture.md) - High-level system design
- [AI Agent Architecture](./ai-agent-architecture.md) - How the AI agent works
- [Sandbox Integration](./sandbox-integration.md) - Daytona sandbox details

### API Reference
- [API Overview](./api-reference.md) - Complete API documentation
- [Agent Streaming API](./agent-streaming-api.md) - AI agent streaming details

### Development
- [Contributing Guide](./contributing.md) - How to contribute
- [Code Style Guide](./code-style.md) - Coding conventions

---

## 🏗️ Architecture Overview

Aura IDE is built on a modern, layered architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    🖥️ Client Layer                          │
│  SvelteKit 5 + CodeMirror 6 + Chat Interface + Terminal     │
├─────────────────────────────────────────────────────────────┤
│                    🔌 API Layer                              │
│  SvelteKit API Routes + Better Auth + SSE Streaming         │
├─────────────────────────────────────────────────────────────┤
│                    ⚙️ Service Layer                          │
│  Chat Service + Sandbox Service + Database Service          │
├─────────────────────────────────────────────────────────────┤
│                    🤖 AI Layer                               │
│  AI SDK v6 + Tool Manager + Helicone Gateway                │
├─────────────────────────────────────────────────────────────┤
│                    ☁️ External Services                      │
│  OpenAI + Anthropic + Daytona + Qdrant + Tavily             │
├─────────────────────────────────────────────────────────────┤
│                    💾 Data Layer                             │
│  MongoDB                                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Links

| Topic | Description |
|-------|-------------|
| [Architecture](./architecture.md) | System design and components |
| [AI Agent](./ai-agent-architecture.md) | How the AI assistant works |
| [API Reference](./api-reference.md) | REST API documentation |
| [Sandbox](./sandbox-integration.md) | Code execution environment |

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/DevRohit06/aura-ide/issues)
- **Discussions**: [GitHub Discussions](https://github.com/DevRohit06/aura-ide/discussions)

---

<div align="center">
  <p><strong>🚧 Work in Progress - Documentation is being expanded 🚧</strong></p>
</div>
