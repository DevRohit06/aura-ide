/**
 * Chat Tool Integration Test Utility
 * Tests the enhanced chat completion endpoint with tool calling
 */

interface ChatCompletionRequest {
	threadId: string;
	content: string;
	model?: string;
	fileContext?: {
		fileName?: string;
		filePath?: string;
		language?: string;
	};
	contextVariables?: {
		selectedCode?: string;
		framework?: string;
	};
	enableTools?: boolean;
	projectId?: string;
}

interface ChatCompletionResponse {
	content: string;
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
	toolsUsed: boolean;
	toolResults: Array<{
		tool_call_id: string;
		content: string;
	}>;
}

/**
 * Send a message to the enhanced chat completion endpoint
 */
export async function sendChatMessage(
	request: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
	const response = await fetch('/api/chat/completion', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(request)
	});

	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.message || 'Chat completion failed');
	}

	return response.json();
}

/**
 * Test tool-enabled chat completion
 */
export async function testToolChat(
	threadId: string,
	message: string,
	projectId?: string
): Promise<ChatCompletionResponse> {
	return sendChatMessage({
		threadId,
		content: message,
		model: 'gpt-4',
		enableTools: true,
		projectId
	});
}

/**
 * Test file context chat
 */
export async function testFileContextChat(
	threadId: string,
	message: string,
	filePath: string,
	selectedCode?: string,
	projectId?: string
): Promise<ChatCompletionResponse> {
	return sendChatMessage({
		threadId,
		content: message,
		model: 'gpt-4',
		fileContext: {
			filePath,
			fileName: filePath.split('/').pop(),
			language: getLanguageFromPath(filePath)
		},
		contextVariables: {
			selectedCode,
			framework: 'SvelteKit'
		},
		enableTools: true,
		projectId
	});
}

/**
 * Get programming language from file path
 */
function getLanguageFromPath(filePath: string): string {
	const ext = filePath.split('.').pop()?.toLowerCase();

	const languageMap: Record<string, string> = {
		ts: 'typescript',
		js: 'javascript',
		tsx: 'typescript',
		jsx: 'javascript',
		svelte: 'svelte',
		vue: 'vue',
		py: 'python',
		rs: 'rust',
		go: 'go',
		java: 'java',
		cpp: 'cpp',
		c: 'c',
		cs: 'csharp',
		php: 'php',
		rb: 'ruby',
		swift: 'swift',
		kt: 'kotlin',
		dart: 'dart'
	};

	return languageMap[ext || ''] || 'text';
}

/**
 * Test scenarios for the enhanced chat completion
 */
export const chatTestScenarios = {
	/**
	 * Test basic file operations
	 */
	async testFileOperations(threadId: string, projectId: string) {
		const scenarios = [
			'List all files in the project',
			'Read the package.json file',
			'Create a new React component called HelloWorld',
			'Update the README.md with project information'
		];

		const results = [];
		for (const scenario of scenarios) {
			try {
				const result = await testToolChat(threadId, scenario, projectId);
				results.push({ scenario, success: true, result });
			} catch (error) {
				results.push({
					scenario,
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		}

		return results;
	},

	/**
	 * Test code analysis and improvement
	 */
	async testCodeAnalysis(threadId: string, filePath: string, code: string, projectId: string) {
		const scenarios = [
			'Analyze this code and suggest improvements',
			'Check for potential bugs or issues',
			'Optimize this code for better performance',
			'Add proper TypeScript types to this code'
		];

		const results = [];
		for (const scenario of scenarios) {
			try {
				const result = await testFileContextChat(threadId, scenario, filePath, code, projectId);
				results.push({ scenario, success: true, result });
			} catch (error) {
				results.push({
					scenario,
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		}

		return results;
	},

	/**
	 * Test project setup assistance
	 */
	async testProjectSetup(threadId: string, projectId: string) {
		const scenarios = [
			'Set up a new SvelteKit project structure',
			'Create a basic authentication system',
			'Add testing configuration with Vitest',
			'Set up Tailwind CSS configuration'
		];

		const results = [];
		for (const scenario of scenarios) {
			try {
				const result = await testToolChat(threadId, scenario, projectId);
				results.push({ scenario, success: true, result });
			} catch (error) {
				results.push({
					scenario,
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		}

		return results;
	}
};
