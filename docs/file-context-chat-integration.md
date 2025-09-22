# File Context Chat Integration

This document explains the new file context integration for the chat system in Aura IDE.

## 🎯 Features Implemented

### 1. **Automatic File Context Detection**

- Chat automatically detects when a file is open in the editor
- Includes file information (name, path, language, content excerpt) in chat context
- System prompts are enhanced with file-specific context

### 2. **File Context Store**

- `fileContext` store tracks the currently active file
- `fileContextStore` provides controls to enable/disable file context
- Reactive updates when files are opened/closed

### 3. **Enhanced Chat Experience**

- System prompts include current file context
- User messages show which file was attached
- Context-aware AI responses based on current file

### 4. **UI Components**

#### File Attachment Badge (`file-attachment-badge.svelte`)

- Shows attached file with icon, name, and language
- Multiple variants: `compact`, `default`, `detailed`
- Color-coded by programming language
- Detach functionality

#### File Context Indicator (`file-context-indicator.svelte`)

- Shows in chat input area
- Toggle to enable/disable file context
- Visual indicator of current state

## 🚀 How It Works

### Chat Flow with File Context

1. **User opens a file** → `activeFile` store updates
2. **File context store detects change** → Updates context variables
3. **User sends chat message** → Chat includes file context in system prompt
4. **AI receives enhanced context** → More relevant, file-specific responses

### Context Variables Included

```typescript
{
  fileName: "auth.service.ts",
  filePath: "src/lib/services/auth.service.ts",
  language: "typescript",
  projectName: "aura-ide",
  framework: "SvelteKit",
  selectedCode: "// File content excerpt...",
  cursorPosition: { line: 42, column: 10 }
}
```

### System Prompt Enhancement

When a file is open, the chat automatically includes:

````
You are an expert AI programming assistant integrated into Aura IDE.

## Current File Context
- File: auth.service.ts
- Path: src/lib/services/auth.service.ts
- Language: typescript
- Project: aura-ide
- Framework: SvelteKit

## Guidelines
- Consider the current file context when providing assistance
- Provide code examples that match the file's language and style
- Reference the current file when relevant to the user's question
- Be specific about file paths and locations when making suggestions

## Current File Content (excerpt)
```typescript
export class AuthService {
  // ... file content
}
````

## 💡 Usage Examples

### Basic Usage

```typescript
import { fileContext, fileContextStore } from '@/stores/editor';

// Check if file is attached
$fileContext.isAttached; // boolean

// Get attached file
$fileContext.file; // File | null

// Get context variables
$fileContext.context; // ContextVariables

// Toggle file context
fileContextStore.toggle();
```

### In Chat Components

```svelte
<script>
	import FileContextIndicator from './file-context-indicator.svelte';
	import FileAttachmentBadge from './file-attachment-badge.svelte';
</script>

<!-- Show current file context status -->
<FileContextIndicator />

<!-- Show attached file badge -->
<FileAttachmentBadge variant="compact" showDetach={true} />
```

## 🎨 UI States

### 1. No File Open

```
📄 Open a file to include context
```

### 2. File Open, Context Disabled

```
[📄 auth.service.ts] [👁️‍🗨️ Enable]
```

### 3. File Open, Context Enabled

```
[📎 🔷 auth.service.ts ✕] [👁️ Enabled]
```

### 4. Message with File Context

```
You: "How do I add error handling?"
[📎 🔷 auth.service.ts]
```

## 🔧 Configuration

### Enable/Disable File Context

```typescript
// Enable for all chat messages
fileContextStore.enable();

// Disable file context
fileContextStore.disable();

// Toggle current state
fileContextStore.toggle();
```

### File Context Store API

```typescript
class FileContextStore {
	isEnabled: boolean; // Current enabled state
	forceAttached: string | null; // Force attach specific file

	enable(): void; // Enable context
	disable(): void; // Disable context
	toggle(): void; // Toggle state
	attachFile(id: string): void; // Force attach file
	detachFile(): void; // Remove forced attachment
	reset(): void; // Reset to auto-detection
}
```

## 🎯 Benefits

1. **Context-Aware Responses**: AI understands what file you're working on
2. **Better Code Suggestions**: Language and framework-specific advice
3. **File-Specific Help**: Targeted assistance for current code
4. **Visual Feedback**: Clear indication of attached files
5. **User Control**: Easy toggle to enable/disable context

## 🔄 Integration Points

### Chat Store Integration

- `sendMessage()` automatically includes file context
- System prompts enhanced with file information
- Message metadata tracks attached files

### Editor Integration

- Reactive updates when files change
- Automatic context extraction from active file
- Language and framework detection

### UI Integration

- File indicators in chat input
- Attachment badges on messages
- Context controls in chat interface

This integration makes the chat system much more powerful and context-aware, providing users with relevant assistance based on their current work context! 🎉
