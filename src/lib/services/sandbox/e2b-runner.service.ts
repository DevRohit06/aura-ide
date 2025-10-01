import { env } from '$env/dynamic/private';

export class E2BRunnerService {
	private sandbox: any | null = null;

	constructor(private apiKey?: string) {
		this.apiKey = this.apiKey || env.E2B_API_KEY || undefined;
	}

	async initialize() {
		if (!this.apiKey) {
			console.warn('E2B API key not configured; E2B runner will operate in mock mode');
			return;
		}

		try {
			const mod = await import('@e2b/code-interpreter');
			const { CodeInterpreter } = mod as any;
			this.sandbox = await CodeInterpreter.create({ apiKey: this.apiKey });
		} catch (err: unknown) {
			console.warn(
				'Failed to initialize E2B sandbox (is @e2b/code-interpreter installed?)',
				err instanceof Error ? err.message : String(err)
			);
			this.sandbox = null;
		}
	}

	async executeCode(code: string) {
		if (!this.sandbox) {
			// Mock execution: return captured text without running
			return { success: true, output: `MOCK_EXECUTION:\n${code.substring(0, 1000)}` };
		}

		try {
			const execution = await this.sandbox.notebook.execCell(code);
			return {
				success: true,
				output: execution.text || '',
				error: execution.error || null,
				logs: execution.logs || []
			};
		} catch (err: unknown) {
			return {
				success: false,
				output: '',
				error: err instanceof Error ? err.message : String(err)
			};
		}
	}

	async runTerminal(command: string) {
		if (!this.sandbox) {
			return { success: true, output: `MOCK_TERMINAL_OUTPUT: ${command}` };
		}

		try {
			const result = await this.sandbox.process.start({ cmd: command.split(' ') });
			await result.wait();
			return {
				success: result.exitCode === 0,
				output: result.stdout,
				error: result.stderr,
				exitCode: result.exitCode
			};
		} catch (err: unknown) {
			return {
				success: false,
				output: '',
				error: err instanceof Error ? err.message : String(err)
			};
		}
	}

	async uploadFile(path: string, content: string) {
		if (!this.sandbox) return false;
		await this.sandbox.files.write(path, content);
		return true;
	}

	async downloadFile(path: string) {
		if (!this.sandbox) return null;
		return await this.sandbox.files.read(path);
	}

	async cleanup() {
		if (this.sandbox) {
			await this.sandbox.close();
			this.sandbox = null;
		}
	}
}
