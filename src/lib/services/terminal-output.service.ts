/**
 * Terminal Output Service
 * Provides utilities for formatting and sending output to the terminal component
 */

export interface TerminalOutputFormatter {
	/**
	 * Format a command being executed
	 */
	formatCommand(command: string): string;

	/**
	 * Format success message
	 */
	formatSuccess(message: string): string;

	/**
	 * Format error message
	 */
	formatError(message: string): string;

	/**
	 * Format warning message
	 */
	formatWarning(message: string): string;

	/**
	 * Format info message
	 */
	formatInfo(message: string): string;

	/**
	 * Format tool execution
	 */
	formatToolExecution(toolName: string, args?: any): string;

	/**
	 * Format section header
	 */
	formatHeader(title: string): string;

	/**
	 * Format code block
	 */
	formatCode(code: string, language?: string): string;
}

/**
 * ANSI Color Codes for Terminal Formatting
 */
export const ANSI = {
	// Reset
	RESET: '\x1b[0m',

	// Colors
	BLACK: '\x1b[30m',
	RED: '\x1b[31m',
	GREEN: '\x1b[32m',
	YELLOW: '\x1b[33m',
	BLUE: '\x1b[34m',
	MAGENTA: '\x1b[35m',
	CYAN: '\x1b[36m',
	WHITE: '\x1b[37m',
	GRAY: '\x1b[90m',

	// Bright colors
	BRIGHT_RED: '\x1b[91m',
	BRIGHT_GREEN: '\x1b[92m',
	BRIGHT_YELLOW: '\x1b[93m',
	BRIGHT_BLUE: '\x1b[94m',
	BRIGHT_MAGENTA: '\x1b[95m',
	BRIGHT_CYAN: '\x1b[96m',

	// Styles
	BOLD: '\x1b[1m',
	DIM: '\x1b[2m',
	ITALIC: '\x1b[3m',
	UNDERLINE: '\x1b[4m',

	// Backgrounds
	BG_BLACK: '\x1b[40m',
	BG_RED: '\x1b[41m',
	BG_GREEN: '\x1b[42m',
	BG_YELLOW: '\x1b[43m',
	BG_BLUE: '\x1b[44m'
} as const;

/**
 * Default Terminal Output Formatter
 */
export class DefaultTerminalFormatter implements TerminalOutputFormatter {
	formatCommand(command: string): string {
		return `${ANSI.GRAY}$ ${command}${ANSI.RESET}\n`;
	}

	formatSuccess(message: string): string {
		return `${ANSI.BOLD}${ANSI.GREEN}✓${ANSI.RESET} ${message}\n`;
	}

	formatError(message: string): string {
		return `${ANSI.BOLD}${ANSI.RED}✗${ANSI.RESET} ${ANSI.RED}${message}${ANSI.RESET}\n`;
	}

	formatWarning(message: string): string {
		return `${ANSI.BOLD}${ANSI.YELLOW}⚠${ANSI.RESET} ${ANSI.YELLOW}${message}${ANSI.RESET}\n`;
	}

	formatInfo(message: string): string {
		return `${ANSI.BOLD}${ANSI.BLUE}ℹ${ANSI.RESET} ${message}\n`;
	}

	formatToolExecution(toolName: string, args?: any): string {
		const argsStr = args ? ` ${JSON.stringify(args, null, 2)}` : '';
		return `${ANSI.BOLD}${ANSI.CYAN}▶${ANSI.RESET} ${ANSI.CYAN}${toolName}${ANSI.RESET}${argsStr}\n`;
	}

	formatHeader(title: string): string {
		const line = '━'.repeat(Math.min(title.length + 4, 60));
		return `${ANSI.BOLD}${ANSI.BLUE}${line}${ANSI.RESET}\n${ANSI.BOLD}${ANSI.CYAN}  ${title}${ANSI.RESET}\n${ANSI.BOLD}${ANSI.BLUE}${line}${ANSI.RESET}\n`;
	}

	formatCode(code: string, language?: string): string {
		const langLabel = language ? `[${language}]` : '';
		return `${ANSI.DIM}${langLabel}${ANSI.RESET}\n${ANSI.GRAY}${code}${ANSI.RESET}\n`;
	}
}

/**
 * Helper functions for common terminal output patterns
 */
export const TerminalOutput = {
	/**
	 * Format a streaming output chunk from a process
	 */
	formatProcessOutput(output: string, isError: boolean = false): string {
		if (isError) {
			return `${ANSI.RED}${output}${ANSI.RESET}`;
		}
		return output;
	},

	/**
	 * Format agent thinking message
	 */
	formatThinking(message: string): string {
		return `${ANSI.DIM}${ANSI.ITALIC}💭 ${message}${ANSI.RESET}\n`;
	},

	/**
	 * Format file operation
	 */
	formatFileOperation(operation: string, filePath: string): string {
		return `${ANSI.BOLD}${ANSI.MAGENTA}📝${ANSI.RESET} ${operation}: ${ANSI.CYAN}${filePath}${ANSI.RESET}\n`;
	},

	/**
	 * Format timestamp
	 */
	formatTimestamp(date: Date = new Date()): string {
		return `${ANSI.GRAY}[${date.toLocaleTimeString()}]${ANSI.RESET} `;
	},

	/**
	 * Format progress indicator
	 */
	formatProgress(current: number, total: number, message?: string): string {
		const percentage = Math.round((current / total) * 100);
		const bar =
			'█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));
		const msg = message ? ` ${message}` : '';
		return `${ANSI.BOLD}${ANSI.BLUE}[${bar}]${ANSI.RESET} ${percentage}%${msg}\n`;
	},

	/**
	 * Format separator line
	 */
	formatSeparator(char: string = '─', length: number = 60): string {
		return `${ANSI.DIM}${char.repeat(length)}${ANSI.RESET}\n`;
	},

	/**
	 * Format key-value pair
	 */
	formatKeyValue(key: string, value: string): string {
		return `${ANSI.BOLD}${key}:${ANSI.RESET} ${value}\n`;
	},

	/**
	 * Format list item
	 */
	formatListItem(item: string, bullet: string = '•'): string {
		return `${ANSI.GRAY}${bullet}${ANSI.RESET} ${item}\n`;
	},

	/**
	 * Format JSON output with syntax highlighting
	 */
	formatJSON(obj: any): string {
		try {
			const json = JSON.stringify(obj, null, 2);
			// Simple syntax highlighting
			return (
				json
					.replace(/"([^"]+)":/g, `${ANSI.CYAN}"$1"${ANSI.RESET}:`)
					.replace(/: "([^"]*)"/g, `: ${ANSI.GREEN}"$1"${ANSI.RESET}`)
					.replace(/: (\d+)/g, `: ${ANSI.YELLOW}$1${ANSI.RESET}`)
					.replace(/: (true|false|null)/g, `: ${ANSI.MAGENTA}$1${ANSI.RESET}`) + '\n'
			);
		} catch {
			return String(obj) + '\n';
		}
	},

	/**
	 * Clear screen sequence
	 */
	clear(): string {
		return '\x1b[2J\x1b[H';
	},

	/**
	 * Format spinner animation frame
	 */
	formatSpinner(frame: number): string {
		const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
		return `${ANSI.CYAN}${frames[frame % frames.length]}${ANSI.RESET} `;
	}
};

/**
 * Create a formatted output for tool execution results
 */
export function formatToolResult(
	toolName: string,
	result: any,
	error?: string,
	duration?: number
): string {
	const formatter = new DefaultTerminalFormatter();
	let output = '';

	// Tool execution header
	output += formatter.formatToolExecution(toolName);

	// Result or error
	if (error) {
		output += formatter.formatError(`Failed: ${error}`);
	} else {
		output += formatter.formatSuccess('Completed');

		// Format result based on type
		if (typeof result === 'string') {
			output += result + '\n';
		} else if (result && typeof result === 'object') {
			output += TerminalOutput.formatJSON(result);
		}
	}

	// Duration if provided
	if (duration) {
		output += TerminalOutput.formatKeyValue('Duration', `${duration}ms`);
	}

	output += TerminalOutput.formatSeparator();

	return output;
}

/**
 * Create a formatted output for agent messages
 */
export function formatAgentMessage(
	type: 'thinking' | 'action' | 'result' | 'error',
	message: string
): string {
	const formatter = new DefaultTerminalFormatter();

	switch (type) {
		case 'thinking':
			return TerminalOutput.formatThinking(message);
		case 'action':
			return formatter.formatInfo(message);
		case 'result':
			return formatter.formatSuccess(message);
		case 'error':
			return formatter.formatError(message);
		default:
			return message + '\n';
	}
}
