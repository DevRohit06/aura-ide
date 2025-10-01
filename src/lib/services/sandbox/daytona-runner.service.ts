import { env } from '$env/dynamic/private';

export class DaytonaRunnerService {
	private client: any | null = null;
	private workspaceId: string | null = null;

	constructor(
		private apiKey?: string,
		private serverUrl?: string
	) {
		this.apiKey = this.apiKey || env.DAYTONA_API_KEY || undefined;
		this.serverUrl = this.serverUrl || env.DAYTONA_SERVER_URL || undefined;
	}

	async initialize() {
		if (!this.apiKey || !this.serverUrl) {
			console.warn('Daytona not configured; Daytona runner will operate in mock mode');
			return;
		}

		try {
			const mod = await import('@daytona/sdk');
			const { DaytonaSDK } = mod as any;
			this.client = new DaytonaSDK({ apiKey: this.apiKey, serverUrl: this.serverUrl });
		} catch (err: unknown) {
			console.warn(
				'Failed to initialize Daytona SDK (is @daytona/sdk installed?)',
				err instanceof Error ? err.message : String(err)
			);
			this.client = null;
		}
	}

	async createWorkspace(template = 'node-typescript') {
		if (!this.client) return null;
		try {
			const workspace = await this.client.workspaces.create({
				name: `coding-agent-${Date.now()}`,
				template
			});
			this.workspaceId = workspace.id;
			await this.waitForWorkspaceReady();
			return workspace;
		} catch (err: unknown) {
			console.error(
				'Failed to create Daytona workspace:',
				err instanceof Error ? err.message : String(err)
			);
			return null;
		}
	}

	private async waitForWorkspaceReady() {
		if (!this.client || !this.workspaceId) return;
		// Best-effort polling
		for (let i = 0; i < 30; i++) {
			const ws = await this.client.workspaces.get(this.workspaceId);
			if (ws && ws.status === 'ready') return;
			await new Promise((r) => setTimeout(r, 2000));
		}
	}

	async executeCode(code: string, language = 'typescript') {
		if (!this.client || !this.workspaceId) {
			return { success: true, output: `MOCK_DAYTONA_EXECUTION:\n${code.substring(0, 1000)}` };
		}

		try {
			const result = await this.client.process.execute(this.workspaceId!, {
				cmd: ['bash', '-lc', code]
			});
			return {
				success: result.exitCode === 0,
				output: result.stdout || '',
				error: result.stderr || ''
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
		if (!this.client || !this.workspaceId) {
			return { success: true, output: `MOCK_DAYTONA_TERMINAL_OUTPUT: ${command}` };
		}

		try {
			const result = await this.client.process.execute(this.workspaceId!, {
				cmd: ['bash', '-lc', command]
			});
			return {
				success: result.exitCode === 0,
				output: result.stdout || '',
				error: result.stderr || ''
			};
		} catch (err: unknown) {
			return {
				success: false,
				output: '',
				error: err instanceof Error ? err.message : String(err)
			};
		}
	}

	async cleanup() {
		if (this.client && this.workspaceId) {
			try {
				await this.client.workspaces.delete(this.workspaceId);
				this.workspaceId = null;
			} catch (err: unknown) {
				console.warn(
					'Failed to cleanup Daytona workspace',
					err instanceof Error ? err.message : String(err)
				);
			}
		}
	}
}
