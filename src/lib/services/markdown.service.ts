/**
 * Markdown utilities for chat messages and threads
 * Handles conversion between plain text and markdown formats
 */

import type { ChatMessage, ChatThread } from '$lib/types/chat';

export class MarkdownService {
	/**
	 * Convert plain text to markdown format
	 */
	static textToMarkdown(text: string, role: 'user' | 'assistant' | 'system' = 'user'): string {
		// Basic text to markdown conversion
		let markdown = text;

		// Handle code blocks (detect common patterns)
		markdown = markdown.replace(/```(\w+)?\n([\s\S]*?)```/g, '```$1\n$2\n```');

		// Handle inline code
		markdown = markdown.replace(/`([^`]+)`/g, '`$1`');

		// Handle URLs
		markdown = markdown.replace(/(https?:\/\/[^\s]+)/g, '[$1]($1)');

		// Handle file paths (common in development contexts)
		markdown = markdown.replace(
			/([^\s]+\.(ts|js|tsx|jsx|vue|svelte|py|java|cpp|cs|php|rb|go|rs|html|css|scss|sass|less|json|yaml|yml|xml|md|txt))/g,
			'`$1`'
		);

		// Handle function calls and method names
		markdown = markdown.replace(/(\w+)\(\)/g, '`$1()`');

		// Handle class names and interfaces (PascalCase)
		markdown = markdown.replace(
			/\b([A-Z][a-zA-Z0-9]*(?:[A-Z][a-zA-Z0-9]*)*)\b/g,
			(match, className) => {
				// Don't replace if it's already in backticks or part of a URL
				return className.length > 1 ? `\`${className}\`` : match;
			}
		);

		return markdown;
	}

	/**
	 * Convert markdown to plain text
	 */
	static markdownToText(markdown: string): string {
		let text = markdown;

		// Remove markdown syntax
		text = text.replace(/```[\w]*\n([\s\S]*?)\n```/g, '$1'); // Code blocks
		text = text.replace(/`([^`]+)`/g, '$1'); // Inline code
		text = text.replace(/\*\*(.*?)\*\*/g, '$1'); // Bold
		text = text.replace(/\*(.*?)\*/g, '$1'); // Italic
		text = text.replace(/~~(.*?)~~/g, '$1'); // Strikethrough
		text = text.replace(/\[(.*?)\]\(.*?\)/g, '$1'); // Links
		text = text.replace(/^#{1,6}\s+/gm, ''); // Headers
		text = text.replace(/^>\s+/gm, ''); // Blockquotes
		text = text.replace(/^\s*[-*+]\s+/gm, ''); // Unordered lists
		text = text.replace(/^\s*\d+\.\s+/gm, ''); // Ordered lists
		text = text.replace(/^\s*\|\s*(.*?)\s*\|/gm, '$1'); // Tables
		text = text.replace(/\s*\|\s*/g, ' | '); // Table separators

		return text.trim();
	}

	/**
	 * Enhance message content with smart markdown formatting
	 */
	static enhanceMessageContent(
		content: string,
		role: 'user' | 'assistant' | 'system'
	): {
		content: string;
		contentMarkdown: string;
	} {
		const plainContent = this.markdownToText(content);
		const markdownContent = this.textToMarkdown(plainContent, role);

		return {
			content: plainContent,
			contentMarkdown: markdownContent
		};
	}

	/**
	 * Generate thread summary markdown
	 */
	static generateThreadSummary(
		thread: ChatThread,
		messageCount: number,
		participantCount: number
	): string {
		const tags = thread.tags.length > 0 ? `\n**Tags:** ${thread.tags.join(', ')}` : '';
		const description = thread.description ? `\n\n${thread.description}` : '';

		return `# ${thread.title}${description}

**Created:** ${thread.createdAt.toLocaleString()}
**Last Updated:** ${thread.updatedAt.toLocaleString()}
**Messages:** ${messageCount}
**Participants:** ${participantCount}${tags}

---`;
	}

	/**
	 * Format message for markdown export
	 */
	static formatMessageForExport(message: ChatMessage, includeMetadata = true): string {
		const timestamp = message.timestamp.toLocaleString();
		const roleIcon = this.getRoleIcon(message.role);
		const roleName = message.role.charAt(0).toUpperCase() + message.role.slice(1);

		let markdown = `## ${roleIcon} ${roleName} - ${timestamp}\n\n`;

		// Add file context if available
		if (message.fileContext) {
			const fileName = message.fileContext.fileName || message.fileContext.filePath;
			const lineRange = message.fileContext.lineRange
				? ` (lines ${message.fileContext.lineRange.start}-${message.fileContext.lineRange.end})`
				: '';
			markdown += `*Context: ${fileName}${lineRange}*\n\n`;
		}

		// Add message content
		markdown += `${message.contentMarkdown || message.content}\n\n`;

		// Add metadata if requested
		if (includeMetadata && message.metadata) {
			const metaItems: string[] = [];

			if (message.metadata.model) {
				metaItems.push(`Model: ${message.metadata.model}`);
			}
			if (message.metadata.tokens) {
				metaItems.push(`Tokens: ${message.metadata.tokens}`);
			}
			if (message.metadata.latency) {
				metaItems.push(`Latency: ${message.metadata.latency}ms`);
			}
			if (message.metadata.cost) {
				metaItems.push(`Cost: $${message.metadata.cost.toFixed(4)}`);
			}

			if (metaItems.length > 0) {
				markdown += `*${metaItems.join(' | ')}*\n\n`;
			}
		}

		// Add reactions if any
		if (message.reactions && message.reactions.length > 0) {
			const reactionCounts = message.reactions.reduce(
				(acc, reaction) => {
					acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
					return acc;
				},
				{} as Record<string, number>
			);

			const reactionString = Object.entries(reactionCounts)
				.map(([emoji, count]) => `${emoji} ${count}`)
				.join(' ');

			markdown += `*Reactions: ${reactionString}*\n\n`;
		}

		return markdown;
	}

	/**
	 * Get emoji icon for message role
	 */
	private static getRoleIcon(role: 'user' | 'assistant' | 'system'): string {
		switch (role) {
			case 'user':
				return '👤';
			case 'assistant':
				return '🤖';
			case 'system':
				return '⚙️';
			default:
				return '💬';
		}
	}

	/**
	 * Create table of contents for long markdown documents
	 */
	static generateTableOfContents(markdown: string): string {
		const headers = markdown.match(/^#{1,6}\s+.+$/gm) || [];

		if (headers.length === 0) return '';

		let toc = '## Table of Contents\n\n';

		headers.forEach((header) => {
			const level = header.match(/^#+/)?.[0].length || 1;
			const title = header.replace(/^#+\s+/, '');
			const anchor = title
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '');
			const indent = '  '.repeat(Math.max(0, level - 1));

			toc += `${indent}- [${title}](#${anchor})\n`;
		});

		return toc + '\n';
	}

	/**
	 * Sanitize markdown content for safe display
	 */
	static sanitizeMarkdown(markdown: string): string {
		// Remove potentially dangerous HTML tags while preserving markdown
		let sanitized = markdown;

		// Remove script tags
		sanitized = sanitized.replace(/<script[\s\S]*?<\/script>/gi, '');

		// Remove iframe tags
		sanitized = sanitized.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');

		// Remove form tags
		sanitized = sanitized.replace(/<form[\s\S]*?<\/form>/gi, '');

		// Remove on* event attributes
		sanitized = sanitized.replace(/\s+on\w+\s*=\s*['""][^'"]*['"]/gi, '');

		// Remove javascript: links
		sanitized = sanitized.replace(/javascript:/gi, '');

		return sanitized;
	}

	/**
	 * Extract code blocks from markdown
	 */
	static extractCodeBlocks(markdown: string): Array<{
		language: string;
		code: string;
		startLine: number;
	}> {
		const codeBlocks: Array<{ language: string; code: string; startLine: number }> = [];
		const lines = markdown.split('\n');
		let currentBlock: { language: string; code: string[]; startLine: number } | null = null;

		lines.forEach((line, index) => {
			const codeBlockStart = line.match(/^```(\w+)?/);
			const codeBlockEnd = line.match(/^```$/);

			if (codeBlockStart) {
				currentBlock = {
					language: codeBlockStart[1] || 'text',
					code: [],
					startLine: index + 1
				};
			} else if (codeBlockEnd && currentBlock) {
				codeBlocks.push({
					language: currentBlock.language,
					code: currentBlock.code.join('\n'),
					startLine: currentBlock.startLine
				});
				currentBlock = null;
			} else if (currentBlock) {
				currentBlock.code.push(line);
			}
		});

		return codeBlocks;
	}

	/**
	 * Create diff markdown for code changes
	 */
	static createDiffMarkdown(before: string, after: string, filename?: string): string {
		const header = filename ? `## Changes in \`${filename}\`\n\n` : '';

		return `${header}\`\`\`diff
- ${before.split('\n').join('\n- ')}
+ ${after.split('\n').join('\n+ ')}
\`\`\``;
	}
}
