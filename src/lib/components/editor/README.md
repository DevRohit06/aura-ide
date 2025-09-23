# Aura Editor Components

A production-ready code editor built with Svelte 5 and CodeMirror 6, featuring markdown preview and multi-file support.

## Components

### CodemirrorEditor

The main editor component with syntax highlighting and markdown preview capabilities.

```typescript
<script>
  import CodemirrorEditor from '$lib/components/code-editor/codemirror-editor.svelte';
</script>

<CodemirrorEditor showPreview={true} splitView={true} />
```

**Props:**

- `showPreview?: boolean` - Show markdown preview for .md files (default: false)
- `splitView?: boolean` - Enable split view for markdown preview (default: false)

**Features:**

- Syntax highlighting for JavaScript, TypeScript, Svelte, Python, HTML, CSS, JSON, Markdown
- Real-time markdown preview with split view
- Auto-save with dirty state tracking
- Theme support (light/dark)
- Configurable font size and family
- Keyboard shortcuts (Ctrl+S/Cmd+S for save)

### FileTabs

Tab component for managing multiple open files.

```typescript
<script>
  import FileTabs from '$lib/components/editor/file-tabs.svelte';
</script>

<FileTabs />
```

**Features:**

- Visual indication of dirty (unsaved) files
- File icons based on extension
- Close buttons with keyboard support
- Close all files functionality

## Store Management

The editor uses Svelte stores for state management:

```typescript
import {
	filesStore,
	tabsStore,
	activeFileId,
	fileActions,
	tabActions,
	fileStateActions,
	settingsStore
} from '$lib/stores/editor.js';
```

### File Management

```typescript
// Add a file
fileActions.addFile({
	id: 'unique-id',
	name: 'filename.md',
	path: 'path/to/filename.md',
	type: 'file',
	content: 'File content'
});

// Open file in tab
tabActions.openFile('file-id');

// Update file content
fileActions.updateFileContent('file-id', 'New content');

// Check if file is dirty
fileStateActions.isFileDirty('file-id');
```

### Settings

```typescript
// Update editor settings
settingsActions.updateSettings({
	theme: 'dark',
	fontSize: 16,
	fontFamily: 'Fira Code, monospace'
});
```

## Quick Start

1. **Basic Setup:**

```typescript
<script>
  import { onMount } from 'svelte';
  import CodemirrorEditor from '$lib/components/code-editor/codemirror-editor.svelte';
  import FileTabs from '$lib/components/editor/file-tabs.svelte';
  import { fileActions, tabActions } from '$lib/stores/editor.js';

  onMount(() => {
    // Add sample files
    fileActions.addFile({
      id: 'readme',
      name: 'README.md',
      path: 'README.md',
      type: 'file',
      content: '# Hello World\n\nThis is **markdown**!'
    });

    // Open the file
    tabActions.openFile('readme');
  });
</script>

<div class="editor-layout">
  <FileTabs />
  <CodemirrorEditor showPreview={true} splitView={true} />
</div>
```

2. **With Layout Integration:**

```typescript
<script>
  import CodemirrorEditor from '$lib/components/code-editor/codemirror-editor.svelte';
  import FileTabs from '$lib/components/editor/file-tabs.svelte';
</script>

<div class="editor-container">
  <header class="editor-header">
    <!-- Your header content -->
  </header>

  <FileTabs />

  <main class="editor-main">
    <CodemirrorEditor showPreview={true} splitView={true} />
  </main>
</div>

<style>
  .editor-container {
    height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .editor-main {
    flex: 1;
    overflow: hidden;
  }
</style>
```

## Supported Languages

- JavaScript (.js, .jsx)
- TypeScript (.ts, .tsx)
- Svelte (.svelte)
- Python (.py)
- HTML (.html)
- CSS (.css)
- JSON (.json)
- Markdown (.md, .markdown)

## Keyboard Shortcuts

- `Ctrl+S` / `Cmd+S` - Save file
- `Ctrl+F` / `Cmd+F` - Find
- `Ctrl+W` / `Cmd+W` - Close current file
- `Ctrl+Tab` / `Cmd+Tab` - Switch between open files

## Theme Support

The editor respects your application's theme system using CSS custom properties:

```css
/* Light theme */
:root {
	--background: 0 0% 100%;
	--foreground: 222.2 84% 4.9%;
	--muted: 210 40% 96%;
	--border: 214.3 31.8% 91.4%;
	--primary: 222.2 47.4% 11.2%;
}

/* Dark theme */
.dark {
	--background: 222.2 84% 4.9%;
	--foreground: 210 40% 98%;
	--muted: 217.2 32.6% 17.5%;
	--border: 217.2 32.6% 17.5%;
	--primary: 210 40% 98%;
}
```

## Dependencies

Required packages (already included):

- `codemirror` - Core editor
- `@codemirror/state` - Editor state management
- `@codemirror/view` - Editor view layer
- `@codemirror/lang-*` - Language support packages
- `@codemirror/theme-one-dark` - Dark theme
- `marked` - Markdown parsing for preview
- `mode-watcher` - Theme detection

## Browser Support

- Modern browsers with ES2020 support
- Chrome 80+
- Firefox 72+
- Safari 13.1+
- Edge 80+
