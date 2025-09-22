# Aura IDE - Chat Integration Setup

## Overview

This document outlines the chat integration implementation using Helicone + LangGraph with Svelte 5.

## Architecture

- **Frontend**: Svelte 5 with runes for reactive state management
- **Backend**: SvelteKit API routes with streaming support
- **AI**: LangChain + LangGraph agents with Helicone observability
- **State**: Reactive stores using Svelte 5 `$state` runes

## File Structure

```
src/
├── lib/
│   ├── stores/
│   │   └── chat.store.ts          # Main chat state management
│   ├── services/
│   │   └── llm.service.ts         # LLM service with Helicone
│   └── components/
│       └── chat/
│           ├── chat-sidebar.svelte    # Main chat component
│           ├── chat-container.svelte  # Message display
│           ├── chat-input.svelte      # Input component
│           └── message.svelte         # Individual message
└── routes/
    └── api/
        └── llm/
            ├── agent/+server.ts   # Production LLM endpoint
            └── test/+server.ts    # Development test endpoint
```

## Environment Variables

Create `.env.local` with:

```env
HELICONE_API_KEY=your_helicone_key
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
```

## Implementation Features

- ✅ Streaming responses with real-time UI updates
- ✅ Session management with persistent chat history
- ✅ Error handling with user-friendly messages
- ✅ Test endpoint for development without API costs
- ✅ Helicone integration for observability and caching
- ✅ Svelte 5 reactive state management

## Usage

1. **Development**: Uses `/api/llm/test` endpoint by default
2. **Production**: Add `?realapi=true` to URL or modify store to use real API
3. **Testing**: Visit `/chat-test` route to test functionality

## Key Components

### Chat Store (`chat.store.ts`)

- Uses Svelte 5 `$state` runes for reactivity
- Manages sessions and messages
- Handles streaming API communication
- Automatic error recovery

### Chat Sidebar (`chat-sidebar.svelte`)

- Main chat interface
- Reactive to store state changes
- Event-driven message handling
- Session management UI

### API Endpoints

- **Test Endpoint**: Simple mock responses for development
- **Production Endpoint**: Full LangChain + Helicone integration
- **Streaming Support**: Server-sent events for real-time responses

## Development Workflow

1. Start with test endpoint for UI development
2. Switch to real API when ready for integration testing
3. Use Helicone dashboard for monitoring and debugging
4. Deploy with environment variables configured

## VS Code Extensions Recommended

- Svelte for VS Code
- TypeScript and JavaScript Language Features
- Tailwind CSS IntelliSense
- Auto Rename Tag
- Error Lens

## Debugging

- Console logs in browser for client-side issues
- Server logs for API endpoint debugging
- Helicone dashboard for LLM request monitoring
- Network tab for streaming response inspection
