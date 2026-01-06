import { env } from '$env/dynamic/private';
import { sandboxManager } from '$lib/services/sandbox/sandbox-manager';
import { logger } from '$lib/utils/logger.js';
import { tavily } from '@tavily/core';
import { tool } from 'ai';
import { z } from 'zod';

// Web Search Tool
export const webSearchTool = tool({
	description:
		'Search the web for documentation, examples, tutorials, and solutions. Use this to find up-to-date information about libraries, APIs, error messages, and best practices.',
	inputSchema: z.object({
		query: z.string().describe('The search query - be specific and include relevant context')
	}),
	execute: async ({ query }) => {
		if (!env.TAVILY_API_KEY) {
			logger.warn('Tavily API key not configured, returning empty search result');
			return 'Web search is not configured. Please set TAVILY_API_KEY environment variable.';
		}

		try {
			const tvly = tavily({ apiKey: env.TAVILY_API_KEY });
			const results = await tvly.search(query, {
				maxResults: 5,
				searchDepth: 'advanced',
				includeAnswer: true
			});

			const resultData = {
				answer: results?.answer ?? null,
				results: results?.results ?? []
			};

			if (!resultData.answer && (!resultData.results || resultData.results.length === 0)) {
				return 'No web search results found for the query.';
			}

			return JSON.stringify(resultData, null, 2);
		} catch (error) {
			console.error('Web search tool error:', error);
			return (
				'Error performing web search: ' + (error instanceof Error ? error.message : String(error))
			);
		}
	}
});

// List Files Tool
export const listFilesTool = tool({
	description:
		'List files and directories in the sandbox. Use this to explore the project structure and understand what files exist.',
	inputSchema: z.object({
		sandboxId: z.string().describe('The ID of the sandbox'),
		sandboxType: z.string().optional().describe('The type of sandbox (e.g., "daytona")'),
		path: z
			.string()
			.optional()
			.describe('The directory path to list (defaults to project root /home/daytona)'),
		recursive: z.boolean().optional().describe('Whether to list recursively (default: false)'),
		maxDepth: z
			.number()
			.optional()
			.describe('Maximum depth for recursive listing (default: 2, max: 5)')
	}),
	execute: async ({ sandboxId, sandboxType, path = '/home/daytona', recursive = false, maxDepth = 2 }) => {
		try {
			const provider = sandboxType as any;
			const files = await sandboxManager.listFiles(sandboxId, path, { provider });

			if (!files || !Array.isArray(files) || files.length === 0) {
				return `No files found in "${path}" or directory does not exist.`;
			}

			// Format the file list
			const formatFiles = (
				fileList: any[],
				depth: number = 0,
				prefix: string = ''
			): string => {
				if (depth >= Math.min(maxDepth, 5)) return '';

				let result = '';
				const sorted = [...fileList].sort((a, b) => {
					if (a.type === 'directory' && b.type !== 'directory') return -1;
					if (a.type !== 'directory' && b.type === 'directory') return 1;
					return (a.name || '').localeCompare(b.name || '');
				});

				for (let i = 0; i < sorted.length; i++) {
					const file = sorted[i];
					const name = file.name || file.path?.split('/').pop() || '';

					// Skip hidden files and common ignore patterns at root level
					if (
						name.startsWith('.') ||
						name === 'node_modules' ||
						name === '__pycache__' ||
						name === '.git'
					) {
						continue;
					}

					const isLast = i === sorted.length - 1;
					const icon = file.type === 'directory' ? '📁' : '📄';
					const size = file.size ? ` (${formatSize(file.size)})` : '';
					result += `${prefix}${isLast ? '└── ' : '├── '}${icon} ${name}${size}\n`;

					if (recursive && file.type === 'directory' && file.children && depth < maxDepth - 1) {
						result += formatFiles(
							file.children,
							depth + 1,
							prefix + (isLast ? '    ' : '│   ')
						);
					}
				}

				return result;
			};

			const formatSize = (bytes: number): string => {
				if (bytes < 1024) return `${bytes}B`;
				if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
				return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
			};

			const tree = formatFiles(files);
			return `Files in ${path}:\n\`\`\`\n${tree}\`\`\``;
		} catch (error) {
			console.error('List files tool error:', error);
			return `Error listing files in "${path}": ${error instanceof Error ? error.message : String(error)}`;
		}
	}
});

// Grep/Search Tool
export const grepTool = tool({
	description:
		'Search for a pattern (text or regex) in files within the sandbox. Use this to find specific code patterns, function definitions, variable usages, imports, or any text within files.',
	inputSchema: z.object({
		sandboxId: z.string().describe('The ID of the sandbox'),
		sandboxType: z.string().optional().describe('The type of sandbox (e.g., "daytona")'),
		pattern: z.string().describe('The search pattern (text or regex)'),
		path: z
			.string()
			.optional()
			.describe('Directory or file path to search in (defaults to project root)'),
		filePattern: z
			.string()
			.optional()
			.describe('File glob pattern to filter (e.g., "*.ts", "*.{js,jsx}")'),
		caseSensitive: z.boolean().optional().describe('Case sensitive search (default: false)'),
		maxResults: z.number().optional().describe('Maximum number of results (default: 50)')
	}),
	execute: async ({
		sandboxId,
		sandboxType,
		pattern,
		path = '/home/daytona',
		filePattern,
		caseSensitive = false,
		maxResults = 50
	}) => {
		try {
			const provider = sandboxType as any;

			// Build grep command
			let command = 'grep -rn';
			if (!caseSensitive) command += ' -i';
			if (filePattern) command += ` --include="${filePattern}"`;
			command += ` "${pattern.replace(/"/g, '\\"')}" "${path}"`;
			command += ` | head -n ${maxResults}`;

			const result = await sandboxManager.executeCommand(sandboxId, command, { provider });

			if (!result || (typeof result === 'string' && result.trim() === '')) {
				return `No matches found for pattern "${pattern}" in ${path}`;
			}

			// Format the results
			const lines = (typeof result === 'string' ? result : String(result)).split('\n');
			const formattedResults = lines
				.filter((line) => line.trim())
				.slice(0, maxResults)
				.map((line) => {
					const match = line.match(/^([^:]+):(\d+):(.*)$/);
					if (match) {
						return {
							file: match[1].replace('/home/daytona/', ''),
							line: parseInt(match[2], 10),
							content: match[3].trim().substring(0, 200)
						};
					}
					return { raw: line.substring(0, 200) };
				});

			return JSON.stringify(
				{
					pattern,
					matchCount: formattedResults.length,
					results: formattedResults
				},
				null,
				2
			);
		} catch (error) {
			console.error('Grep tool error:', error);
			// Grep returns non-zero exit code when no matches found
			if (String(error).includes('exit code 1')) {
				return `No matches found for pattern "${pattern}" in ${path}`;
			}
			return `Error searching for pattern: ${error instanceof Error ? error.message : String(error)}`;
		}
	}
});

// Read File Tool
export const readFileTool = tool({
	description:
		'Read the contents of a file from the sandbox. Always read a file before modifying it to understand its current content and structure.',
	inputSchema: z.object({
		sandboxId: z.string().describe('The ID of the sandbox'),
		sandboxType: z.string().optional().describe('The type of sandbox (e.g., "daytona")'),
		filePath: z.string().describe('The path to the file to read'),
		startLine: z.number().optional().describe('Start reading from this line number (1-indexed)'),
		endLine: z.number().optional().describe('Stop reading at this line number (inclusive)')
	}),
	execute: async ({ sandboxId, sandboxType, filePath, startLine, endLine }) => {
		try {
			const provider = sandboxType as any;
			const file = await sandboxManager.readFile(sandboxId, filePath, { provider });
			if (!file?.content) {
				return `File "${filePath}" is empty or could not be read.`;
			}

			let content = file.content;

			// Handle line range if specified
			if (startLine || endLine) {
				const lines = content.split('\n');
				const start = Math.max(1, startLine || 1) - 1;
				const end = endLine ? Math.min(endLine, lines.length) : lines.length;
				const selectedLines = lines.slice(start, end);

				// Add line numbers
				content = selectedLines
					.map((line, idx) => `${String(start + idx + 1).padStart(4, ' ')} | ${line}`)
					.join('\n');

				return `File: ${filePath} (lines ${start + 1}-${end} of ${lines.length})\n\`\`\`\n${content}\n\`\`\``;
			}

			// For full file, add line numbers if reasonable size
			const lines = content.split('\n');
			if (lines.length <= 500) {
				content = lines.map((line, idx) => `${String(idx + 1).padStart(4, ' ')} | ${line}`).join('\n');
			}

			return `File: ${filePath} (${lines.length} lines)\n\`\`\`\n${content}\n\`\`\``;
		} catch (error) {
			console.error('Read file tool error:', error);
			return `Error reading file "${filePath}": ${error instanceof Error ? error.message : String(error)}`;
		}
	}
});

// Write File Tool
export const writeFileTool = tool({
	description:
		'Create or overwrite a file in the sandbox with the provided content. Use this to create new files or completely replace existing file contents. For partial edits, read the file first, modify the content, then write.',
	inputSchema: z.object({
		sandboxId: z.string().describe('The ID of the sandbox where the file should be written'),
		sandboxType: z.string().optional().describe('The type of sandbox (e.g., "daytona")'),
		filePath: z
			.string()
			.describe('The path to the file relative to the sandbox root (e.g., "src/app/page.tsx")'),
		content: z
			.string()
			.describe(
				'The COMPLETE content of the file as a string. This should be the full file content you want to write.'
			),
		createDirectories: z
			.boolean()
			.optional()
			.describe('Create parent directories if they do not exist (default: true)')
	}),
	execute: async ({ sandboxId, sandboxType, filePath, content, createDirectories = true }) => {
		if (!sandboxId) return JSON.stringify({ success: false, error: 'Missing sandboxId' });
		if (!filePath) return JSON.stringify({ success: false, error: 'Missing filePath' });
		if (content === undefined || content === null)
			return JSON.stringify({ success: false, error: 'Missing content' });

		try {
			const provider = sandboxType as any;

			// Create parent directories if needed
			if (createDirectories) {
				const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
				if (dirPath) {
					await sandboxManager.executeCommand(sandboxId, `mkdir -p "${dirPath}"`, { provider });
				}
			}

			const success = await sandboxManager.writeFile(sandboxId, filePath, content, {
				provider
			});

			const lineCount = content.split('\n').length;

			return JSON.stringify({
				success,
				message: success
					? `✅ File "${filePath}" written successfully (${lineCount} lines).`
					: `❌ Failed to write file "${filePath}".`,
				filePath,
				lineCount
			});
		} catch (error) {
			console.error('Write file tool error:', error);
			return JSON.stringify({
				success: false,
				error: error instanceof Error ? error.message : String(error),
				message: `❌ Error writing file "${filePath}": ${error instanceof Error ? error.message : String(error)}`
			});
		}
	}
});

// Edit File Tool (for targeted edits)
export const editFileTool = tool({
	description:
		'Make targeted edits to a file by replacing specific text. Use this for small, precise changes instead of rewriting the entire file. You must provide the exact text to find and replace.',
	inputSchema: z.object({
		sandboxId: z.string().describe('The ID of the sandbox'),
		sandboxType: z.string().optional().describe('The type of sandbox (e.g., "daytona")'),
		filePath: z.string().describe('The path to the file to edit'),
		edits: z
			.array(
				z.object({
					oldText: z.string().describe('The exact text to find (must match exactly)'),
					newText: z.string().describe('The text to replace it with')
				})
			)
			.describe('Array of edits to apply to the file')
	}),
	execute: async ({ sandboxId, sandboxType, filePath, edits }) => {
		try {
			const provider = sandboxType as any;

			// Read the current file
			const file = await sandboxManager.readFile(sandboxId, filePath, { provider });
			if (!file?.content) {
				return JSON.stringify({
					success: false,
					error: `File "${filePath}" not found or is empty.`
				});
			}

			let content = file.content;
			const appliedEdits: string[] = [];
			const failedEdits: string[] = [];

			// Apply each edit
			for (const edit of edits) {
				if (content.includes(edit.oldText)) {
					content = content.replace(edit.oldText, edit.newText);
					appliedEdits.push(`Replaced "${edit.oldText.substring(0, 50)}..."`);
				} else {
					failedEdits.push(`Could not find "${edit.oldText.substring(0, 50)}..."`);
				}
			}

			if (appliedEdits.length === 0) {
				return JSON.stringify({
					success: false,
					error: 'No edits could be applied - text patterns not found.',
					failedEdits
				});
			}

			// Write the modified content
			const success = await sandboxManager.writeFile(sandboxId, filePath, content, { provider });

			return JSON.stringify({
				success,
				message: success
					? `✅ Applied ${appliedEdits.length} edit(s) to "${filePath}".`
					: `❌ Failed to save edits to "${filePath}".`,
				appliedEdits,
				failedEdits: failedEdits.length > 0 ? failedEdits : undefined
			});
		} catch (error) {
			console.error('Edit file tool error:', error);
			return JSON.stringify({
				success: false,
				error: error instanceof Error ? error.message : String(error)
			});
		}
	}
});

// Delete File Tool
export const deleteFileTool = tool({
	description: 'Delete a file or directory from the sandbox. Use with caution.',
	inputSchema: z.object({
		sandboxId: z.string().describe('The ID of the sandbox'),
		sandboxType: z.string().optional().describe('The type of sandbox (e.g., "daytona")'),
		path: z.string().describe('The path to the file or directory to delete'),
		recursive: z
			.boolean()
			.optional()
			.describe('If true, recursively delete directories (required for non-empty directories)')
	}),
	execute: async ({ sandboxId, sandboxType, path, recursive = false }) => {
		try {
			const provider = sandboxType as any;

			const command = recursive ? `rm -rf "${path}"` : `rm "${path}"`;
			await sandboxManager.executeCommand(sandboxId, command, { provider });

			return JSON.stringify({
				success: true,
				message: `✅ Deleted "${path}" successfully.`
			});
		} catch (error) {
			console.error('Delete file tool error:', error);
			return JSON.stringify({
				success: false,
				error: error instanceof Error ? error.message : String(error),
				message: `❌ Error deleting "${path}": ${error instanceof Error ? error.message : String(error)}`
			});
		}
	}
});

// Execute Command Tool
export const executeCommandTool = tool({
	description:
		'Execute a shell command in the sandbox terminal. Use this to run build commands, install packages, run tests, start servers, or any other terminal operation.',
	inputSchema: z.object({
		sandboxId: z.string().describe('The ID of the sandbox'),
		sandboxType: z.string().optional().describe('The type of sandbox (e.g., "daytona")'),
		command: z.string().describe('The shell command to execute'),
		workingDir: z
			.string()
			.optional()
			.describe('Working directory for the command (defaults to /home/daytona)'),
		timeout: z
			.number()
			.optional()
			.describe('Timeout in milliseconds (default: 60000, max: 300000)')
	}),
	execute: async ({ sandboxId, sandboxType, command, workingDir, timeout = 60000 }) => {
		try {
			const provider = sandboxType as any;

			// Prepend cd if working directory specified
			let fullCommand = command;
			if (workingDir) {
				fullCommand = `cd "${workingDir}" && ${command}`;
			}

			const result = await sandboxManager.executeCommand(sandboxId, fullCommand, {
				provider,
				timeout: Math.min(timeout, 300000)
			});

			if (typeof result === 'string') {
				// Truncate very long output
				const output = result.length > 10000 ? result.substring(0, 10000) + '\n... (output truncated)' : result;
				return `\`\`\`\n$ ${command}\n${output || '(no output)'}\n\`\`\``;
			}

			return JSON.stringify(result, null, 2);
		} catch (error) {
			console.error('Execute command tool error:', error);
			return JSON.stringify({
				success: false,
				command,
				error: error instanceof Error ? error.message : String(error)
			});
		}
	}
});

// Create Directory Tool
export const createDirectoryTool = tool({
	description: 'Create a new directory in the sandbox. Parent directories are created automatically.',
	inputSchema: z.object({
		sandboxId: z.string().describe('The ID of the sandbox'),
		sandboxType: z.string().optional().describe('The type of sandbox (e.g., "daytona")'),
		path: z.string().describe('The path of the directory to create')
	}),
	execute: async ({ sandboxId, sandboxType, path }) => {
		try {
			const provider = sandboxType as any;
			await sandboxManager.executeCommand(sandboxId, `mkdir -p "${path}"`, { provider });

			return JSON.stringify({
				success: true,
				message: `✅ Directory "${path}" created successfully.`
			});
		} catch (error) {
			console.error('Create directory tool error:', error);
			return JSON.stringify({
				success: false,
				error: error instanceof Error ? error.message : String(error)
			});
		}
	}
});

// Map of all tools
export const aiSdkTools = {
	web_search: webSearchTool,
	list_files: listFilesTool,
	grep: grepTool,
	read_file: readFileTool,
	write_file: writeFileTool,
	edit_file: editFileTool,
	delete_file: deleteFileTool,
	execute_command: executeCommandTool,
	create_directory: createDirectoryTool
};

// Aliases for backwards compatibility
export const executeCodeTool = executeCommandTool;
