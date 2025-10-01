# Agent Tool Calls Error Fix

## Issue
The agent was throwing an error when processing tool calls for human review:
```
[ERROR] Agent invocation error Cannot read properties of undefined (reading 'length')
[ERROR] Error stack: TypeError: Cannot read properties of undefined (reading 'length')
    at PregelRunner._commit (file:///.../@langchain/langgraph/dist/pregel/runner.js:218:38)
```

## Root Cause
The error was happening **inside LangGraph itself**, not in our code. We were using an incorrect pattern for interrupting the graph - throwing a custom `GraphInterrupt` error instead of using LangGraph's official `interrupt()` function.

When we threw a custom error object, LangGraph's internal state management (`PregelRunner._commit`) tried to process it and accessed `.length` on an undefined value, causing the crash.

### Why the Old Approach Failed
```typescript
// ❌ WRONG: Throwing custom error
throw Object.assign(new Error('GraphInterrupt:human_review'), {
    name: 'GraphInterrupt',
    value: { ... }
});
```

This bypassed LangGraph's proper interrupt mechanism and caused internal state corruption.

## Solution
Migrated to LangGraph's official `interrupt()` function for proper human-in-the-loop workflows.

### 1. Use LangGraph's `interrupt()` Function

**In `graph.ts` - Import interrupt:**
```typescript
import { Command, interrupt, MemorySaver, StateGraph } from '@langchain/langgraph';
```

**Replace error throwing with interrupt():**
```typescript
// ✅ CORRECT: Use LangGraph's interrupt() function
const humanDecision = interrupt({
    reason: 'human_review',
    toolCalls: sanitizedToolCalls,
    stateSnapshot: {
        currentFile: state.currentFile,
        sandboxId: state.sandboxId,
        sandboxType: state.sandboxType
    }
});

// Process human decision
if (humanDecision?.action === 'approve' || humanDecision?.action === 'modify') {
    return new Command({ goto: 'tools' });
} else {
    return new Command({ goto: '__end__' });
}
```

### 2. Enable Checkpointer (Required for interrupt())

**In `graph.ts`:**
```typescript
const checkpointer = new MemorySaver();
// Checkpointer is REQUIRED for interrupt() to work
export const agentGraph = workflow.compile({ checkpointer } as any);
```

### 3. Handle Interrupt Response in Server

**In `+server.ts` POST handler:**
```typescript
const result = await agentGraph.invoke(initialState, config);

// Check if the graph was interrupted for human review
// __interrupt__ is added by LangGraph when interrupt() is called
if ((result as any).__interrupt__) {
    const interruptData = (result as any).__interrupt__[0];
    logger.info('Graph interrupted for human review:', interruptData);
    
    return json({
        interrupt: true,
        data: interruptData.value,
        threadId: actualThreadId
    });
}
```

### 4. Resume with Command

**In `+server.ts` PUT handler:**
```typescript
import { Command } from '@langchain/langgraph';

// Prepare human decision to resume the graph
const humanDecision = {
    action,
    edits: action === 'modify' ? edits : undefined
};

// Resume agent with Command
const result = await agentGraph.invoke(
    new Command({ resume: humanDecision }),
    config
);
```

### 5. Additional Safety Improvements

**Filter null/undefined tool calls:**
```typescript
const validToolCalls = toolCallsArray.filter((tc: any) => tc != null);
```

**Safe property access:**
```typescript
validToolCalls.map((tc) => ({ 
    name: tc?.name || '', 
    args: tc?.args || tc?.arguments || {} 
}))
```

## Files Modified
- `/src/lib/agent/graph.ts` - Replaced custom error with `interrupt()`, enabled checkpointer, added null filtering
- `/src/routes/api/agent/+server.ts` - Handle `__interrupt__` response, use `Command` for resuming, removed old error-based interrupt handling

## Testing
After this fix:
1. Tool calls should be properly normalized to arrays
2. No more "Cannot read properties of undefined" errors
3. Human review interrupts should work correctly
4. The agent can safely process `execute_code`, `write_file`, and other tool calls

## Prevention
This fix adds defensive programming practices:
- Explicit type checking with `Array.isArray()`
- Optional chaining (`?.`) for safe property access
- Fallback values (`|| 0`) for undefined cases
- More explicit boolean conditions (`length > 0` instead of truthy check)
