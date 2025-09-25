import type { Token } from 'marked';

// Base token interface to ensure proper type compatibility
export interface BaseToken {
	type: string;
	raw: string;
	text?: string;
}

export interface MentionToken extends BaseToken {
	type: 'mention';
	raw: string;
	text: string;
	userId: string;
	user: any;
}

export interface LinkMentionToken extends BaseToken {
	type: 'link-mention';
	raw: string;
	text: string;
	href: string;
	domain: string;
}

export interface LinkToken extends BaseToken {
	type: 'link';
	raw: string;
	text: string;
	href: string;
	domain: string;
}

export interface ParagraphWithMentionsToken extends BaseToken {
	type: 'paragraph';
	raw: string;
	tokens: (Token | MentionToken | LinkMentionToken | LinkToken)[];
}

/**
 * Process a paragraph token to extract mentions and links
 * @param token The paragraph token to process
 * @param users Array of users to match mentions against
 * @returns A processed paragraph token with mentions and links as separate tokens
 */
export function processParagraphWithMentions(
	token: Token,
	users: any[]
): ParagraphWithMentionsToken | null {
	if (token.type !== 'paragraph') return null;

	const parts: (Token | MentionToken | LinkMentionToken | LinkToken)[] = [];
	let text = token.text;
	let lastIndex = 0;

	// Match markdown-style links, URLs, and mentions
	const markdownLinkRegex =
		/(@)?(!?\[([^\]]*)\]\(([^)]+)\))|(@)?(\bhttps?:\/\/[^\s]+\b)|(<@(\w+)>)/g;
	let match;
	let hasMatches = false;

	while ((match = markdownLinkRegex.exec(text)) !== null) {
		hasMatches = true;
		// Add text before the match
		if (match.index > lastIndex) {
			parts.push({
				type: 'text',
				raw: text.slice(lastIndex, match.index),
				text: text.slice(lastIndex, match.index)
			});
		}

		if (match[8]) {
			// Handle mentions <@userId>
			const userId = match[8];
			const user = users?.find((u) => u?._id === userId);
			if (user) {
				parts.push({
					type: 'mention',
					raw: match[0],
					text: `@${user?.name}`,
					userId: userId,
					user: user
				});
			} else {
				// If user not found, preserve the original text
				parts.push({
					type: 'text',
					raw: match[0],
					text: match[0]
				});
			}
		} else if (match[2]) {
			// Handle markdown links [text](url)
			const hasAtPrefix = match[1] === '@';
			const linkText = match[3];
			const url = match[4];
			const domain = url.replace(/^https?:\/\//, '').split('/')[0];

			parts.push({
				type: hasAtPrefix ? 'link-mention' : 'link',
				raw: match[0],
				text: (hasAtPrefix ? '@' : '') + (linkText || url),
				href: url,
				domain: domain
			});
		} else if (match[6]) {
			// Handle plain URLs
			const hasAtPrefix = match[5] === '@';
			const url = match[6];
			const domain = url.replace(/^https?:\/\//, '').split('/')[0];

			parts.push({
				type: hasAtPrefix ? 'link-mention' : 'link',
				raw: match[0],
				text: (hasAtPrefix ? '@' : '') + url,
				href: url,
				domain: domain
			});
		}

		lastIndex = match.index + match[0].length;
	}

	if (lastIndex < text.length) {
		parts.push({
			type: 'text',
			raw: text.slice(lastIndex),
			text: text.slice(lastIndex)
		});
	}

	if (!hasMatches) return null;

	return {
		type: 'paragraph',
		raw: token.raw,
		tokens: parts
	};
}

/**
 * Create a marked extension for processing mentions and links
 * @param options Configuration options
 * @returns A marked extension object
 */
export default function mentionExtension(options: Record<string, any> = {}) {
	return {
		name: 'mentions',
		level: 'inline',
		extensions: [
			{
				name: 'mention',
				level: 'inline',
				start(src: string): number {
					return src.match(/(?:@|<@|https?:|\[)/)?.index ?? -1;
				},
				tokenizer(src: string, tokens: Token[]): boolean | Token {
					// This is a placeholder - actual processing happens in the markdown.svelte component
					return false;
				}
			}
		]
	};
}
