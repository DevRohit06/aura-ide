import type { Token, TokensList } from 'marked';

// Base token interface for type safety
export interface BaseToken {
	type: string;
	raw: string;
	text?: string;
}

export interface ProcessedToken {
	hasThinkEnd: boolean;
	text: string;
	raw: string;
}

export interface ThinkToken extends BaseToken {
	type: 'think';
	streaming?: boolean;
	text: string;
	raw: string;
}

const THINK_START = '<think>';
const THINK_END = '</think>';

/**
 * Process a token to extract think content and check for end tags
 * @param token The token to process
 * @returns Processed token information
 */
export function processToken(token: Token): ProcessedToken {
	if (token.type === 'paragraph' && 'tokens' in token && Array.isArray(token.tokens)) {
		let hasThinkEnd = false;
		let newText = '';
		let newRaw = '';

		for (const subToken of token.tokens) {
			if (subToken.type === 'html' && 'raw' in subToken && subToken.raw?.includes(THINK_END)) {
				hasThinkEnd = true;
				const [beforeEnd, ...rest] = subToken.raw.split(THINK_END);
				newText += beforeEnd;
				newRaw += beforeEnd + THINK_END;
			} else {
				// Safely access text property with type checking
				const text = ('text' in subToken ? subToken.text : '') || subToken.raw || '';
				const raw = subToken.raw || ('text' in subToken ? subToken.text : '') || '';
				newText += text;
				newRaw += raw;
			}
		}

		return { hasThinkEnd, text: newText, raw: newRaw };
	}

	return {
		hasThinkEnd: token.type === 'html' && token.raw?.includes(THINK_END),
		text: ('text' in token ? token.text : '') || token.raw || '',
		raw: token.raw || ('text' in token ? token.text : '') || ''
	};
}

/**
 * Clean think content by removing think tags
 * @param content The content to process
 * @returns Cleaned content without think tags
 */
export function processThinkContent(content: string): string {
	return content.replace(new RegExp(`${THINK_START}|${THINK_END}`, 'g'), '').trim();
}

/**
 * Check if a token contains a complete think block
 * @param token The token to check
 * @returns True if the token contains a complete think block
 */
export function isCompleteThinkBlock(token: Token): boolean {
	return (
		token.type === 'html' && token.raw?.includes(THINK_START) && token.raw?.includes(THINK_END)
	);
}

/**
 * Create a new think token
 * @param raw Raw content including think tags
 * @param text Processed text content
 * @param streaming Whether this is a streaming think block
 * @returns A new think token
 */
export function createThinkToken(raw: string, text: string, streaming = false): ThinkToken {
	return {
		type: 'think',
		raw,
		text,
		streaming
	};
}

/**
 * Process a token to extract a complete think block
 * @param token The token to process
 * @returns A think token if the input contains a complete think block, null otherwise
 */
export function processThinkToken(token: Token): ThinkToken | null {
	if (isCompleteThinkBlock(token)) {
		const thinkText = processThinkContent(token.raw);
		return thinkText ? createThinkToken(token.raw, thinkText) : null;
	}
	return null;
}

/**
 * Update an existing think token with new content
 * @param token The token to update
 * @param newContent New content
 * @param newRaw New raw content
 * @param isComplete Whether the think block is now complete
 */
export function updateThinkToken(
	token: ThinkToken,
	newContent: string,
	newRaw: string,
	isComplete = false
): void {
	token.text = processThinkContent(newContent);
	token.raw = newRaw;
	if (isComplete) {
		delete token.streaming;
	}
}

/**
 * Process all tokens to handle think blocks
 * This function automatically handles streaming think blocks
 * @param tokens The tokens to process
 * @returns Processed tokens with think blocks properly handled
 */
export function processThinkBlocks(tokens: Token[]): Token[] {
	const result: Token[] = [];
	let isCollectingThink = false;
	let thinkContent = '';
	let thinkRaw = '';

	for (const token of tokens) {
		// Handle single-token think blocks
		const thinkToken = processThinkToken(token);
		if (thinkToken) {
			result.push(thinkToken);
			continue;
		}

		// Start collecting think content
		if (token.type === 'html' && token.raw?.includes(THINK_START)) {
			isCollectingThink = true;
			thinkRaw = token.raw;
			thinkContent = token.raw.replace(THINK_START, '').trim();
			// Add initial think token
			const initialThinkToken = createThinkToken(thinkRaw, thinkContent, true);
			result.push(initialThinkToken);
			continue;
		}

		// Continue collecting think content if we're in a think block
		if (isCollectingThink) {
			const processed = processToken(token);
			thinkContent += processed.text;
			thinkRaw += processed.raw;

			// Update the last token with new content
			const lastToken = result[result.length - 1] as ThinkToken;
			if (lastToken?.type === 'think') {
				updateThinkToken(lastToken, thinkContent, thinkRaw, processed.hasThinkEnd);
			}

			if (processed.hasThinkEnd) {
				isCollectingThink = false;
				thinkContent = '';
				thinkRaw = '';
			}
			continue;
		}

		// For all other tokens, add them as-is
		result.push(token);
	}

	return result;
}

/**
 * Create a marked extension for processing think blocks
 * @param options Configuration options
 * @returns A marked extension object
 */
export default function thinkExtension(options: Record<string, any> = {}) {
	return {
		name: 'think',
		level: 'block',
		walker: (token: Token, tokens: TokensList) => {
			// We don't need to do anything in the walker
			return token;
		},
		renderer: (token: Token) => {
			// Custom renderer for think tokens
			if (token.type === 'think') {
				const thinkToken = token as ThinkToken;
				return `<div class="think-block${thinkToken.streaming ? ' streaming' : ''}">${thinkToken.text}</div>`;
			}
			return false;
		},
		tokenizer: (src: string, tokens: Token[]): boolean | Token => {
			// Check for think blocks
			if (src.startsWith(THINK_START)) {
				const endIndex = src.indexOf(THINK_END);
				if (endIndex !== -1) {
					// Complete think block
					const raw = src.slice(0, endIndex + THINK_END.length);
					const text = src.slice(THINK_START.length, endIndex).trim();
					return createThinkToken(raw, text);
				} else {
					// Streaming think block
					const raw = src;
					const text = src.slice(THINK_START.length).trim();
					return createThinkToken(raw, text, true);
				}
			}
			return false;
		},
		extensions: [
			{
				name: 'think',
				level: 'block',
				start(src: string): number {
					return src.indexOf(THINK_START);
				},
				tokenizer(src: string, tokens: Token[]): boolean | Token {
					// Check for think blocks
					if (src.startsWith(THINK_START)) {
						const endIndex = src.indexOf(THINK_END);
						if (endIndex !== -1) {
							// Complete think block
							const raw = src.slice(0, endIndex + THINK_END.length);
							const text = src.slice(THINK_START.length, endIndex).trim();
							return createThinkToken(raw, text);
						} else {
							// Streaming think block
							const raw = src;
							const text = src.slice(THINK_START.length).trim();
							return createThinkToken(raw, text, true);
						}
					}
					return false;
				}
			}
		]
	};
}
