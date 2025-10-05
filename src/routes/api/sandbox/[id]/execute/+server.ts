/**
 * Code Execution API Routes
 * REST API endpoints for executing code and commands in sandbox
 */

import { DatabaseService } from '$lib/services/database.service';
import { DaytonaService } from '$lib/services/sandbox/daytona.service';
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

		// Find project by sandbox ID to verify ownership
		const project = await DatabaseService.findProjectBySandboxId(sandboxId);
		if (!project || project.ownerId !== user.id) {
			return json({ error: 'Sandbox not found or access denied' }, { status: 404 });
		}

		// Check if this is a Daytona sandbox
		if (project.sandboxProvider !== 'daytona') {
			return json({ error: 'Only Daytona sandboxes are currently supported' }, { status: 400 });
		}

		const daytonaService = DaytonaService.getInstance();

		let result;

		if (executionType === 'command') {
			const body = (await request.json()) as ExecuteCommandRequest;
			const { command, workingDir, timeout = 30000, environment } = body;

			if (!command) {
				return json({ error: 'Command is required' }, { status: 400 });
			}

			// Execute command using Daytona service
			const startTime = Date.now();
			try {
				console.log(`🚀 [Execute] Running command: "${command}" in sandbox ${sandboxId}`);
				console.log(`📁 [Execute] Working directory: ${workingDir || 'default'}`);

				// For debugging, let's also check the current directory and list files
				if (workingDir) {
					try {
						const pwdResult = await daytonaService.executeCommand(sandboxId, 'pwd');
						console.log(`📍 [Execute] Current directory:`, pwdResult.output);

						const lsResult = await daytonaService.executeCommand(sandboxId, `ls -la ${workingDir}`);
						console.log(`📁 [Execute] Directory contents:`, lsResult.output);
					} catch (debugError) {
						console.log(`⚠️ [Execute] Debug commands failed:`, debugError);
					}
				}

				// Prepare the full command with working directory if specified
				console.log(`🔧 [Execute] Executing command: "${command}"`);
				console.log(`� [Execute] Working directory: ${workingDir || 'default'}`);

				const execResult = await daytonaService.executeCommand(
					sandboxId,
					command,
					workingDir,
					environment,
					timeout
				);
				const duration = Date.now() - startTime;

				console.log(`📊 [Execute] Raw result:`, {
					success: execResult.success,
					output: execResult.output?.substring(0, 500), // First 500 chars
					outputLength: execResult.output?.length || 0,
					exitCode: execResult.exitCode,
					executionTime: execResult.executionTime
				});

				// Determine if command was actually successful
				const isSuccess =
					execResult.success && (execResult.exitCode === 0 || execResult.exitCode === undefined);

				result = {
					success: isSuccess,
					output: execResult.output || '',
					error: isSuccess ? '' : execResult.output || 'Command execution failed',
					exitCode: execResult.exitCode || (isSuccess ? 0 : 1),
					duration
				};

				console.log(`✅ [Execute] Processed result:`, {
					success: result.success,
					outputLength: result.output.length,
					errorLength: result.error.length,
					exitCode: result.exitCode
				});
			} catch (execError) {
				const duration = Date.now() - startTime;
				console.error(`❌ [Execute] Command execution threw error:`, execError);

				result = {
					success: false,
					output: '',
					error: execError instanceof Error ? execError.message : String(execError),
					exitCode: -1,
					duration
				};
			}
		} else if (executionType === 'code') {
			const body = (await request.json()) as ExecuteCodeRequest;
			const { code, language, filename, workingDir, timeout = 30000, inputData } = body;

			if (!code) {
				return json({ error: 'Code is required' }, { status: 400 });
			}

			// For code execution, we need to create a temporary file and run it
			const tempFileName = filename || `temp_${Date.now()}.${getFileExtension(language)}`;
			const tempFilePath = workingDir
				? `${workingDir}/${tempFileName}`
				: `/workspace/${tempFileName}`;

			try {
				// Write code to temporary file using echo command
				const writeCommand = `echo ${JSON.stringify(code)} > ${tempFilePath}`;
				await daytonaService.executeCommand(sandboxId, writeCommand);

				// Execute based on language
				const command = getExecutionCommand(language, tempFilePath, inputData);

				const execResult = await daytonaService.executeCommand(sandboxId, command);

				result = {
					success: execResult.success,
					output: execResult.output || '',
					error: execResult.success ? '' : 'Execution failed',
					exitCode: execResult.exitCode || (execResult.success ? 0 : 1),
					duration: 0 // Daytona doesn't provide duration
				};

				// Clean up temporary file
				try {
					await daytonaService.executeCommand(sandboxId, `rm -f ${tempFilePath}`);
				} catch (cleanupError) {
					console.warn('Failed to clean up temporary file:', cleanupError);
				}
			} catch (error) {
				// Try to clean up on error
				try {
					await daytonaService.executeCommand(sandboxId, `rm -f ${tempFilePath}`);
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

		// Store execution in database for analytics (optional)
		const execution = {
			project_id: project.id,
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
