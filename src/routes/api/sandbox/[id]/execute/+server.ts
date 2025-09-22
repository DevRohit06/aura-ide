/**
 * Code Execution API Routes
 * REST API endpoints for executing code and commands in sandbox
 */

import { SandboxManager } from '$lib/services/sandbox/sandbox-manager';
import { SandboxSessionService } from '$lib/services/session/sandbox-session.service';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

interface ExecuteCommandRequest {
	command: string;
	workingDir?: string;
	timeout?: number;
	environment?: Record<string, string>;
}

interface ExecuteCodeRequest {
	code: string;
	language?: string;
	filename?: string;
	workingDir?: string;
	timeout?: number;
	inputData?: string;
}

/**
 * POST /api/sandbox/[id]/execute/command
 * Execute a shell command in the sandbox
 */
export const POST: RequestHandler = async ({ params, request, locals, url }) => {
	try {
		const user = locals.user;
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const sandboxId = params.id;
		if (!sandboxId) {
			return json({ error: 'Sandbox ID is required' }, { status: 400 });
		}

		const executionType = url.searchParams.get('type') || 'command';

		const sessionService = SandboxSessionService.getInstance();
		const sandboxManager = SandboxManager.getInstance();

		// Get session by sandbox ID
		const session = await sessionService.getSession(sandboxId);
		if (!session || session.userId !== user.id) {
			return json({ error: 'Sandbox not found' }, { status: 404 });
		}

		// Check if sandbox is running
		if (session.status !== 'running' && session.status !== 'active') {
			return json(
				{
					error: 'Sandbox is not running',
					status: session.status
				},
				{ status: 400 }
			);
		}

		// Get provider for this sandbox
		const provider = await sandboxManager['getProviderForSandbox'](
			session.sandboxId,
			session.provider
		);

		let result;

		if (executionType === 'command') {
			const body = (await request.json()) as ExecuteCommandRequest;
			const { command, workingDir, timeout = 30000, environment } = body;

			if (!command) {
				return json({ error: 'Command is required' }, { status: 400 });
			}

			// Execute command
			result = await provider.executeCommand(session.sandboxId, command, {
				workingDir,
				timeout,
				environment
			});
		} else if (executionType === 'code') {
			const body = (await request.json()) as ExecuteCodeRequest;
			const { code, language, filename, workingDir, timeout = 30000, inputData } = body;

			if (!code) {
				return json({ error: 'Code is required' }, { status: 400 });
			}

			// For code execution, we need to create a temporary file and run it
			const tempFileName = filename || `temp_${Date.now()}.${getFileExtension(language)}`;
			const tempFilePath = workingDir ? `${workingDir}/${tempFileName}` : `/${tempFileName}`;

			try {
				// Write code to temporary file
				await provider.writeFile(session.sandboxId, tempFilePath, code, {
					encoding: 'utf-8',
					createDirs: true
				});

				// Execute based on language
				const command = getExecutionCommand(language, tempFilePath, inputData);

				result = await provider.executeCommand(session.sandboxId, command, {
					workingDir,
					timeout
				});

				// Clean up temporary file
				await provider.deleteFile(session.sandboxId, tempFilePath);
			} catch (error) {
				// Try to clean up on error
				try {
					await provider.deleteFile(session.sandboxId, tempFilePath);
				} catch (cleanupError) {
					console.warn('Failed to clean up temporary file:', cleanupError);
				}
				throw error;
			}
		} else {
			return json(
				{
					error: 'Invalid execution type. Supported types: command, code'
				},
				{ status: 400 }
			);
		}

		// Update session activity
		sessionService.updateLastActivity(session.id);

		// Store execution in database for analytics
		const execution = {
			sandbox_session_id: session.id,
			user_id: user.id,
			language: executionType === 'code' ? (request as any).body?.language || 'unknown' : 'shell',
			code: executionType === 'code' ? (request as any).body?.code : (request as any).body?.command,
			input_data: executionType === 'code' ? (request as any).body?.inputData : undefined,
			stdout: result.output,
			stderr: result.error,
			exit_code: result.exitCode,
			execution_time_ms: result.duration,
			memory_used_mb: undefined, // Not available in provider interface
			success: result.success,
			executed_at: new Date()
		};

		// Store execution record (optional - could be async)
		// await storeExecution(execution);

		return json({
			type: executionType,
			success: result.success,
			stdout: result.output,
			stderr: result.error,
			exit_code: result.exitCode,
			execution_time_ms: result.duration,
			memory_used_mb: undefined,
			error_message: result.error
		});
	} catch (error) {
		console.error(`Failed to execute ${url.searchParams.get('type') || 'command'}:`, error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Execution failed',
				success: false
			},
			{ status: 500 }
		);
	}
};

/**
 * Helper function to get file extension for language
 */
function getFileExtension(language?: string): string {
	const extensions: Record<string, string> = {
		javascript: 'js',
		typescript: 'ts',
		python: 'py',
		java: 'java',
		cpp: 'cpp',
		'c++': 'cpp',
		c: 'c',
		go: 'go',
		rust: 'rs',
		php: 'php',
		ruby: 'rb',
		swift: 'swift',
		kotlin: 'kt',
		scala: 'scala',
		r: 'r',
		shell: 'sh',
		bash: 'sh',
		powershell: 'ps1'
	};

	return extensions[language?.toLowerCase() || ''] || 'txt';
}

/**
 * Helper function to get execution command for different languages
 */
function getExecutionCommand(language?: string, filePath?: string, inputData?: string): string {
	if (!filePath) {
		return 'echo "No file path provided"';
	}

	const lang = language?.toLowerCase() || '';
	const input = inputData ? ` <<< "${inputData}"` : '';

	const commands: Record<string, string> = {
		javascript: `node ${filePath}${input}`,
		typescript: `npx ts-node ${filePath}${input}`,
		python: `python3 ${filePath}${input}`,
		java: `javac ${filePath} && java ${filePath.replace('.java', '')}${input}`,
		cpp: `g++ ${filePath} -o ${filePath}.out && ./${filePath}.out${input}`,
		'c++': `g++ ${filePath} -o ${filePath}.out && ./${filePath}.out${input}`,
		c: `gcc ${filePath} -o ${filePath}.out && ./${filePath}.out${input}`,
		go: `go run ${filePath}${input}`,
		rust: `rustc ${filePath} -o ${filePath}.out && ./${filePath}.out${input}`,
		php: `php ${filePath}${input}`,
		ruby: `ruby ${filePath}${input}`,
		swift: `swift ${filePath}${input}`,
		kotlin: `kotlinc ${filePath} -include-runtime -d ${filePath}.jar && java -jar ${filePath}.jar${input}`,
		scala: `scala ${filePath}${input}`,
		r: `Rscript ${filePath}${input}`,
		shell: `bash ${filePath}${input}`,
		bash: `bash ${filePath}${input}`,
		powershell: `pwsh ${filePath}${input}`
	};

	return commands[lang] || `cat ${filePath}${input}`;
}
