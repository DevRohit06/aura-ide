/**
 * Morph Code Editing Service
 * Handles intelligent code merging and conflict resolution for AI-assisted code edits
 */

import { diff_match_patch, DIFF_DELETE, DIFF_INSERT, DIFF_EQUAL } from 'diff-match-patch';
import type { SandboxFile } from '$lib/services/sandbox/sandbox-provider.interface';

export interface CodeEdit {
	filePath: string;
	oldContent: string;
	newContent: string;
	changeType: 'create' | 'update' | 'delete';
	reason?: string;
}

export interface MergeConflict {
	filePath: string;
	conflicts: Array<{
		startLine: number;
		endLine: number;
		ourContent: string;
		theirContent: string;
		baseContent: string;
		resolution?: 'ours' | 'theirs' | 'manual';
	}>;
}

export interface MergeResult {
	success: boolean;
	mergedContent?: string;
	conflicts?: MergeConflict[];
	error?: string;
}

export class MorphCodeEditingService {
	private dmp: diff_match_patch;

	constructor() {
		this.dmp = new diff_match_patch();
		// Configure for better performance with code
		this.dmp.Diff_Timeout = 1.0;
		this.dmp.Diff_EditCost = 4;
	}

	/**
	 * Apply intelligent code edits with conflict resolution
	 */
	async applyEdits(
		edits: CodeEdit[],
		sandboxId: string,
		options: {
			autoResolve?: boolean;
			maxConflicts?: number;
			backupOriginals?: boolean;
		} = {}
	): Promise<{
		success: boolean;
		results: Array<{ filePath: string; result: MergeResult }>;
		summary: {
			totalFiles: number;
			successful: number;
			conflicts: number;
			errors: number;
		};
	}> {
		const { autoResolve = true, maxConflicts = 10, backupOriginals = true } = options;

		const results: Array<{ filePath: string; result: MergeResult }> = [];
		let successful = 0;
		let conflicts = 0;
		let errors = 0;

		for (const edit of edits) {
			try {
				const result = await this.applySingleEdit(edit, sandboxId, {
					autoResolve,
					maxConflicts,
					backupOriginals
				});

				results.push({ filePath: edit.filePath, result });

				if (result.success) {
					successful++;
				} else if (result.conflicts && result.conflicts.length > 0) {
					conflicts++;
				} else {
					errors++;
				}
			} catch (error) {
				results.push({
					filePath: edit.filePath,
					result: {
						success: false,
						error: error instanceof Error ? error.message : 'Unknown error'
					}
				});
				errors++;
			}
		}

		return {
			success: errors === 0,
			results,
			summary: {
				totalFiles: edits.length,
				successful,
				conflicts,
				errors
			}
		};
	}

	/**
	 * Apply a single edit with intelligent merging
	 */
	private async applySingleEdit(
		edit: CodeEdit,
		sandboxId: string,
		options: { autoResolve: boolean; maxConflicts: number; backupOriginals: boolean }
	): Promise<MergeResult> {
		const { sandboxManager } = await import('$lib/services/sandbox');

		try {
			// Read current file content
			let currentContent = '';
			try {
				const file = await sandboxManager.readFile(sandboxId, edit.filePath);
				currentContent = typeof file?.content === 'string' ? file.content : file?.content?.toString() || '';
			} catch (error) {
				// File doesn't exist, treat as empty for create operations
				if (edit.changeType !== 'create') {
					throw new Error(`File ${edit.filePath} does not exist`);
				}
			}

			// Handle different change types
			switch (edit.changeType) {
				case 'create':
					if (currentContent) {
						return {
							success: false,
							error: `File ${edit.filePath} already exists`
						};
					}
					return await this.createFile(edit, sandboxId, options.backupOriginals);

				case 'delete':
					if (!currentContent) {
						return {
							success: false,
							error: `File ${edit.filePath} does not exist`
						};
					}
					return await this.deleteFile(edit, sandboxId, options.backupOriginals);

				case 'update':
					return await this.updateFile(edit, currentContent, sandboxId, options);

				default:
					return {
						success: false,
						error: `Unknown change type: ${edit.changeType}`
					};
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Create a new file
	 */
	private async createFile(
		edit: CodeEdit,
		sandboxId: string,
		backupOriginals: boolean
	): Promise<MergeResult> {
		const { sandboxManager } = await import('$lib/services/sandbox');

		try {
			const success = await sandboxManager.writeFile(
				sandboxId,
				edit.filePath,
				edit.newContent,
				{ createDirs: true }
			);

			return {
				success,
				mergedContent: edit.newContent
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Failed to create file'
			};
		}
	}

	/**
	 * Delete a file
	 */
	private async deleteFile(
		edit: CodeEdit,
		sandboxId: string,
		backupOriginals: boolean
	): Promise<MergeResult> {
		const { sandboxManager } = await import('$lib/services/sandbox');

		try {
			const success = await sandboxManager.deleteFile(sandboxId, edit.filePath);

			return {
				success,
				mergedContent: ''
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Failed to delete file'
			};
		}
	}

	/**
	 * Update an existing file with intelligent merging
	 */
	private async updateFile(
		edit: CodeEdit,
		currentContent: string,
		sandboxId: string,
		options: { autoResolve: boolean; maxConflicts: number; backupOriginals: boolean }
	): Promise<MergeResult> {
		const { sandboxManager } = await import('$lib/services/sandbox');

		// If oldContent matches currentContent, it's a clean edit
		if (edit.oldContent === currentContent) {
			try {
				const success = await sandboxManager.writeFile(
					sandboxId,
					edit.filePath,
					edit.newContent,
					{ backup: options.backupOriginals }
				);

				return {
					success,
					mergedContent: edit.newContent
				};
			} catch (error) {
				return {
					success: false,
					error: error instanceof Error ? error.message : 'Failed to update file'
				};
			}
		}

		// Content has changed since the edit was prepared - need to merge
		const mergeResult = this.intelligentMerge(edit.oldContent, currentContent, edit.newContent);

		if (mergeResult.conflicts.length === 0) {
			// Clean merge
			try {
				const success = await sandboxManager.writeFile(
					sandboxId,
					edit.filePath,
					mergeResult.mergedContent,
					{ backup: options.backupOriginals }
				);

				return {
					success,
					mergedContent: mergeResult.mergedContent
				};
			} catch (error) {
				return {
					success: false,
					error: error instanceof Error ? error.message : 'Failed to apply merged changes'
				};
			}
		}

		// Has conflicts
		if (options.autoResolve && mergeResult.conflicts.length <= options.maxConflicts) {
			// Try auto-resolution
			const autoResolved = this.autoResolveConflicts(mergeResult);

			if (autoResolved.conflicts.length === 0) {
				try {
					const success = await sandboxManager.writeFile(
						sandboxId,
						edit.filePath,
						autoResolved.mergedContent,
						{ backup: options.backupOriginals }
					);

					return {
						success,
						mergedContent: autoResolved.mergedContent
					};
				} catch (error) {
					return {
						success: false,
						error: error instanceof Error ? error.message : 'Failed to apply auto-resolved changes'
					};
				}
			}
		}

		// Return conflicts for manual resolution
		return {
			success: false,
			conflicts: [{
				filePath: edit.filePath,
				conflicts: mergeResult.conflicts.map(c => ({
					startLine: c.startLine,
					endLine: c.endLine,
					ourContent: c.ourContent,
					theirContent: c.theirContent,
					baseContent: c.baseContent
				}))
			}]
		};
	}

	/**
	 * Perform intelligent 3-way merge
	 */
	private intelligentMerge(
		baseContent: string,
		ourContent: string,
		theirContent: string
	): { mergedContent: string; conflicts: Array<{
		startLine: number;
		endLine: number;
		ourContent: string;
		theirContent: string;
		baseContent: string;
	}> } {
		const baseLines = baseContent.split('\n');
		const ourLines = ourContent.split('\n');
		const theirLines = theirContent.split('\n');

		// Use diff-match-patch for intelligent merging
		const ourDiff = this.dmp.diff_main(baseContent, ourContent);
		const theirDiff = this.dmp.diff_main(baseContent, theirContent);

		// Clean up diffs
		this.dmp.diff_cleanupSemantic(ourDiff);
		this.dmp.diff_cleanupSemantic(theirDiff);

		// Simple conflict detection and resolution
		const conflicts: Array<{
			startLine: number;
			endLine: number;
			ourContent: string;
			theirContent: string;
			baseContent: string;
		}> = [];

		let mergedLines: string[] = [];
		let i = 0;

		while (i < Math.max(baseLines.length, ourLines.length, theirLines.length)) {
			const baseLine = baseLines[i] || '';
			const ourLine = ourLines[i] || '';
			const theirLine = theirLines[i] || '';

			if (ourLine === theirLine) {
				// No conflict
				mergedLines.push(ourLine);
			} else if (ourLine === baseLine && theirLine !== baseLine) {
				// Only they changed
				mergedLines.push(theirLine);
			} else if (theirLine === baseLine && ourLine !== baseLine) {
				// Only we changed
				mergedLines.push(ourLine);
			} else {
				// Conflict - both changed differently
				conflicts.push({
					startLine: i,
					endLine: i,
					ourContent: ourLine,
					theirContent: theirLine,
					baseContent: baseLine
				});

				// For now, prefer our changes
				mergedLines.push(ourLine);
			}

			i++;
		}

		return {
			mergedContent: mergedLines.join('\n'),
			conflicts
		};
	}

	/**
	 * Auto-resolve conflicts using heuristics
	 */
	private autoResolveConflicts(
		mergeResult: { mergedContent: string; conflicts: Array<{
			startLine: number;
			endLine: number;
			ourContent: string;
			theirContent: string;
			baseContent: string;
		}> }
	): { mergedContent: string; conflicts: Array<any> } {
		let mergedLines = mergeResult.mergedContent.split('\n');
		const remainingConflicts: Array<any> = [];

		for (const conflict of mergeResult.conflicts) {
			// Simple heuristics for auto-resolution:

			// 1. If one side is just whitespace/comments and other has real code, prefer real code
			const ourTrimmed = conflict.ourContent.trim();
			const theirTrimmed = conflict.theirContent.trim();

			if (!ourTrimmed && theirTrimmed) {
				// Prefer their content
				mergedLines[conflict.startLine] = conflict.theirContent;
			} else if (!theirTrimmed && ourTrimmed) {
				// Prefer our content
				mergedLines[conflict.startLine] = conflict.ourContent;
			} else {
				// Can't auto-resolve, keep conflict
				remainingConflicts.push(conflict);
			}
		}

		return {
			mergedContent: mergedLines.join('\n'),
			conflicts: remainingConflicts
		};
	}

	/**
	 * Generate a diff between two versions of content
	 */
	generateDiff(oldContent: string, newContent: string): string {
		const diffs = this.dmp.diff_main(oldContent, newContent);
		this.dmp.diff_cleanupSemantic(diffs);

		let diffText = '';
		for (const [op, text] of diffs) {
			switch (op) {
				case DIFF_DELETE:
					diffText += `-${text}\n`;
					break;
				case DIFF_INSERT:
					diffText += `+${text}\n`;
					break;
				case DIFF_EQUAL:
					// Only show context for significant changes
					if (text.length > 50) {
						diffText += ` ${text.substring(0, 50)}...\n`;
					} else {
						diffText += ` ${text}\n`;
					}
					break;
			}
		}

		return diffText;
	}

	/**
	 * Validate that an edit can be safely applied
	 */
	validateEdit(edit: CodeEdit, currentContent: string): {
		valid: boolean;
		reason?: string;
		risk: 'low' | 'medium' | 'high';
	} {
		// Check if the edit is based on outdated content
		if (edit.changeType === 'update' && edit.oldContent !== currentContent) {
			const diff = this.dmp.diff_main(edit.oldContent, currentContent);
			const changes = diff.filter(([op]: [number, string]) => op !== DIFF_EQUAL);

			if (changes.length > 5) {
				return {
					valid: true,
					risk: 'high',
					reason: 'Significant changes detected since edit was prepared'
				};
			} else {
				return {
					valid: true,
					risk: 'medium',
					reason: 'Minor changes detected since edit was prepared'
				};
			}
		}

		return {
			valid: true,
			risk: 'low'
		};
	}
}

export const morphCodeEditingService = new MorphCodeEditingService();