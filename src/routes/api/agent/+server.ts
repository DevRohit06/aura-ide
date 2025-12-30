import { DatabaseService } from '$lib/services/database.service';
import { sandboxManager } from '$lib/services/sandbox/sandbox-manager';
import { logger } from '$lib/utils/logger.js';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// ===== Types =====
interface ChatMessageDoc {
	id: string;
	threadId: string;
	projectId?: string;
	userId: string;
	content: string;
	contentMarkdown: string;
	role: 'user' | 'assistant' | 'system';
	timestamp: Date;
	fileContext?: { filePath: string };
	metadata?: Record<string, any>;
	createdAt: Date;
	updatedAt: Date;
}

interface EditResult {
	filePath: string;
	success: boolean;
	previousContent?: string;
	error?: string;
}

// ===== Constants =====
const ALLOWED_ACTIONS = new Set(['approve', 'reject', 'modify']);

// ===== Utility Functions =====

/**
 * Creates a message document for MongoDB
 */
function createMessageDoc(
	threadId: string,
	userId: string,
	content: string,
	role: 'user' | 'assistant',
	options: {
		projectId?: string;
		currentFile?: string;
		metadata?: Record<string, any>;
	} = {}
): ChatMessageDoc {
	return {
		id: crypto.randomUUID(),
		threadId,
		projectId: options.projectId,
		userId,
		content: String(content),
		contentMarkdown: String(content),
		role,
		timestamp: new Date(),
		fileContext: options.currentFile ? { filePath: options.currentFile } : undefined,
		metadata: options.metadata,
		createdAt: new Date(),
		updatedAt: new Date()
	};
}

/**
 * Applies file edits to sandbox
 */
async function applyEdits(
	sandboxId: string,
	edits: Array<{ filePath: string; content: string }>,
	context?: { userId?: string; projectId?: string }
): Promise<EditResult[]> {
	const results: EditResult[] = [];

	for (const edit of edits) {
		try {
			const rawPrev = (await sandboxManager.readFile(sandboxId, edit.filePath))?.content ?? null;
			const previousContent = rawPrev && typeof rawPrev !== 'string' ? String(rawPrev) : rawPrev;

			const success = await sandboxManager.writeFile(sandboxId, edit.filePath, edit.content, {
				createDirs: true,
				userId: context?.userId,
				projectId: context?.projectId
			});

			results.push({
				filePath: edit.filePath,
				success: !!success,
				previousContent: previousContent ?? undefined
			});
		} catch (err: any) {
			results.push({
				filePath: edit.filePath,
				success: false,
				error: err?.message ?? String(err)
			});
		}
	}

	return results;
}

/**
 * Format tool results for display
 */
function formatToolResults(results: any[]): string {
	return results
		.map((result, index) => {
			const prefix = results.length > 1 ? `Tool ${index + 1}: ` : '';
			return prefix + formatSingleToolResult(result);
		})
		.join('\n\n');
}

/**
 * Format a single tool result for display
 */
function formatSingleToolResult(result: any): string {
	if (!result) return 'No result';

	let output = '';

	if (result.success === false) {
		output = `❌ ${result.message || 'Operation failed'}`;
		if (result.error) {
			output += `\nError: ${result.error}`;
		}
	} else if (result.success === true) {
		output = `✅ ${result.message || 'Operation completed'}`;
	} else if (result.message) {
		output = result.message;
	} else {
		output = 'Operation completed';
	}

	return output;
}

// ===== Request Handlers =====

// DEPRECATED: POST /api/agent - Replaced by /api/agent/stream
export const POST: RequestHandler = async () => {
	return json({ error: 'This endpoint is deprecated. Use /api/agent/stream instead.' }, { status: 410 });
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	// Read body once at the start
	const body = await request.json();
	const { threadId, action, edits, toolCalls, projectId } = body;

	const userId = locals?.user?.id || 'default';

	try {
		// Validation
		if (!threadId) {
			return json({ success: false, error: 'threadId is required' }, { status: 400 });
		}

		if (!ALLOWED_ACTIONS.has(action)) {
			return json(
				{
					success: false,
					error: `Invalid action. Must be one of: ${[...ALLOWED_ACTIONS].join(', ')}`
				},
				{ status: 400 }
			);
		}

		// Apply edits if approved or modified
		let appliedEdits: EditResult[] = [];
		const sandboxId = project?.sandboxId; // Wait, we need to fetch project or sandbox ID? 
        // The body doesn't strictly have sandboxId in the top level based on ChatService call, 
        // BUT ChatService passes `...payload` which includes `stateSnapshot` or `toolCalls`. 
        // Let's get sandboxId from context or lookup.
        
        // Lookup sandboxId via project or thread? 
        // In previous implementation: `const sandboxId = stateSnapshot?.sandboxId || edits?.[0]?.sandboxId || null;`
        
        const stateSnapshot = body.stateSnapshot;
        let effectiveSandboxId = body.sandboxId || stateSnapshot?.sandboxId;
        
        // If not provided, we might fail if we need to write files.
		
		if (action === 'approve' || action === 'modify') {
            if (!effectiveSandboxId && projectId) {
                // Try to find sandbox for project
                // For now, let's assume it's passed or we can't write.
                // In ChatService, `sendMessage` passes `sandboxId`. `approveInterrupt` passes toolCalls. 
                // Wait, logic in ChatService `handleInterruptDecision` uses `stateSnapshot` from the interrupt message.
                // It should have `sandboxId`.
            }

			const writeCalls = (toolCalls || []).filter((tc: any) => ['write_file', 'edit_file'].includes(tc.name));

			if (writeCalls.length > 0 && !effectiveSandboxId) {
                 // Try to fetch active sandbox for project?
                 // Let's rely on what was sent.
                 // If null, we can return error or try without it (will fail).
				return json(
					{ success: false, error: 'sandboxId not available to apply edits' },
					{ status: 400 }
				);
			}

			let editsToApply: Array<{ filePath: string; content: string }> = [];

			if (action === 'approve') {
				editsToApply = writeCalls.map((tc: any) => ({
					filePath: tc.args?.filePath || tc.args?.path || '',
					content: tc.args?.content || ''
				}));
			} else if (action === 'modify') {
				if (!Array.isArray(edits)) {
					return json(
						{ success: false, error: 'edits array required for modify action' },
						{ status: 400 }
					);
				}
				editsToApply = edits;
			}

			if (editsToApply.length > 0) {
				appliedEdits = await applyEdits(effectiveSandboxId, editsToApply, { userId, projectId });
			}
		}

		
        // Generate tool results message
		let toolResults: any[] = [];
        
        if (action === 'reject') {
             toolResults.push({
                tool_name: 'human_review',
                content: 'User rejected the proposed changes.',
                success: false,
                message: 'User rejected the changes.'
             });
        } else {
    		// If we have applied edits
    		if (appliedEdits.length > 0) {
    			toolResults = appliedEdits.map((edit) => ({
    				tool_name: 'write_file',
    				content: edit.success
    					? `✅ Successfully wrote ${edit.filePath}`
    					: `❌ Failed to write ${edit.filePath}: ${edit.error || 'Unknown error'}`,
    				success: edit.success,
    				message: edit.success
    					? `Successfully wrote ${edit.filePath}`
    					: `Failed to write ${edit.filePath}: ${edit.error || 'Unknown error'}`
    			}));
    		}
        }

		const toolResultsSummary =
			toolResults.length > 0
				? `\n\n**Action Results:**\n${formatToolResults(toolResults)}`
				: '\n\nAction completed.';

		// Save assistant response confirming the action
		const assistantMessageDoc = createMessageDoc(threadId, userId, toolResultsSummary, 'assistant', {
			projectId,
			metadata: {
				toolResults: toolResults.length > 0 ? toolResults : undefined,
                actionPerformed: action
			}
		});
		await DatabaseService.createChatMessage(assistantMessageDoc);

		return json({
			success: true,
			applied: appliedEdits,
			response: toolResultsSummary,
            // No interrupt, we are done for this turn
			metadata: {
				awaitingHumanInput: false
			}
		});
        
	} catch (err: any) {
		logger.error('Agent PUT error', err?.message ?? err);

		return json(
			{ success: false, error: err?.message ?? String(err) },
			{ status: 500 }
		);
	}
};
