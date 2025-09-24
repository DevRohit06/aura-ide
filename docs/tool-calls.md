# Tool Calls in AI Responses

The AI can return tool calls in the chat response using special formatting that gets parsed and displayed in the UI.

## Supported Formats

### 1. Tool Tags

Wrap tool calls in `<tool>` tags:

```
I need to create a new file for you.

<tool>
{
  "name": "create_file",
  "args": {
    "filePath": "src/components/NewComponent.svelte",
    "content": "<script>\n  // New component\n</script>\n\n<div>New Component</div>",
    "projectId": "project-123"
  },
  "status": "pending"
}
</tool>

The file has been created successfully!
```

### 2. JSON Code Blocks

Use code blocks with `json` or `tool` language:

````
I'll help you update that file.

```json
{
  "tool_call": {
    "id": "call-123",
    "name": "update_file",
    "args": {
      "filePath": "src/App.svelte",
      "content": "<script>\n  import NewComponent from './components/NewComponent.svelte';\n</script>\n\n<div>\n  <NewComponent />\n</div>",
      "projectId": "project-123"
    },
    "status": "running"
  }
}
````

File updated successfully!

```

### 3. Text Format in Tool Tags

For simpler cases, you can use a text format:

```

<tool>
name: read_file
args: {"filePath": "package.json", "projectId": "project-123"}
status: pending
</tool>
```

## Tool Call States

The UI supports different states for tool calls:

- `pending`: Tool call is queued
- `running`: Tool call is executing
- `success`: Tool call completed successfully
- `error`: Tool call failed

## Available Tools

### File Operations

- `create_file`: Create a new file
  - Args: `filePath`, `content`, `projectId` (optional)
- `update_file`: Update an existing file
  - Args: `filePath`, `content`, `projectId` (optional)
- `delete_file`: Delete a file
  - Args: `filePath`, `projectId` (optional)
- `read_file`: Read a file's content
  - Args: `filePath`, `projectId` (optional)
- `list_files`: List files in a directory
  - Args: `directoryPath` (optional), `projectId` (optional)

## Example Response

```
I'll create a new React component for you.

<tool>
{
  "name": "create_file",
  "args": {
    "filePath": "src/components/Welcome.tsx",
    "content": "import React from 'react';\n\nconst Welcome: React.FC = () => {\n  return (\n    <div className=\"welcome\">\n      <h1>Welcome to Aura IDE!</h1>\n      <p>This component was created via AI tool call.</p>\n    </div>\n  );\n};\n\nexport default Welcome;",
    "projectId": "my-project"
  },
  "status": "success",
  "result": {
    "message": "File created successfully",
    "data": {
      "filePath": "src/components/Welcome.tsx",
      "size": 245
    }
  }
}
</tool>

The Welcome component has been created and is ready to use in your project!
```
