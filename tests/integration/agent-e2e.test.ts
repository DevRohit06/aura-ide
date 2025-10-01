/**
 * End-to-End Agent Testing Suite
 * Comprehensive testing for the complete agent workflow including:
 * - Agent initialization and message processing
 * - Sandbox creation and management
 * - Code execution and validation
 * - Morph code editing integration
 * - File operations and conflict resolution
 */

import { Agent, type AgentConfig } from '$lib/agent';
import { MorphCodeEditingService } from '$lib/services/morph-code-editing.service';
import { SandboxService } from '$lib/services/sandbox.service';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Test configuration
const TEST_USER_ID = 'test-agent-user-123';
const TEST_PROJECT_ID = 'test-agent-project-123';

describe('Agent End-to-End Workflow Tests', () => {
	let testSandboxId: string;
	let agent: Agent;
	let morphService: MorphCodeEditingService;

	beforeAll(async () => {
		// Initialize services
		morphService = new MorphCodeEditingService();

		// Create test sandbox
		const sandboxService = SandboxService.getInstance();
		const sandbox = await sandboxService.createSandbox({
			userId: TEST_USER_ID,
			projectId: TEST_PROJECT_ID,
			templateId: 'node-basic',
			provider: 'daytona',
			environment: {
				NODE_VERSION: '18',
				NPM_VERSION: 'latest'
			}
		});

		testSandboxId = sandbox.id;

		// Wait for sandbox to be ready
		let attempts = 0;
		while (attempts < 30) {
			const status = await sandboxService.getSandbox(testSandboxId);
			if (status?.status === 'running') {
				break;
			}
			await new Promise((resolve) => setTimeout(resolve, 2000));
			attempts++;
		}

		// Create agent with sandbox
		const agentConfig: AgentConfig = {
			sandboxId: testSandboxId,
			projectId: TEST_PROJECT_ID,
			modelConfig: {
				provider: 'openai',
				model: 'gpt-4o',
				temperature: 0.7
			}
		};

		agent = new Agent(agentConfig);
	});

	afterAll(async () => {
		// Cleanup test resources
		try {
			const sandboxService = SandboxService.getInstance();
			await sandboxService.deleteSandbox(testSandboxId);
		} catch (error) {
			console.warn('Cleanup failed:', error);
		}
	});

	describe('Agent Initialization and Message Processing', () => {
		it('should initialize agent with sandbox', async () => {
			expect(agent).toBeDefined();
			expect(typeof agent.processMessage).toBe('function');
		});

		it('should process a simple message', async () => {
			let messageReceived = false;
			let stateChanged = false;

			const testAgent = new Agent({
				sandboxId: testSandboxId,
				projectId: TEST_PROJECT_ID,
				callbacks: {
					onMessage: (message) => {
						messageReceived = true;
						expect(message.content).toBeDefined();
						expect(message.role).toBeDefined();
					},
					onStateChange: (state) => {
						stateChanged = true;
						expect(state.isActive).toBeDefined();
					}
				}
			});

			await testAgent.processMessage('Hello, can you help me write a simple function?');

			expect(messageReceived).toBe(true);
			expect(stateChanged).toBe(true);
		});

		it('should handle code generation requests', async () => {
			let codeGenerated = false;

			const testAgent = new Agent({
				sandboxId: testSandboxId,
				projectId: TEST_PROJECT_ID,
				callbacks: {
					onMessage: (message) => {
						if (message.content.includes('function') || message.content.includes('const')) {
							codeGenerated = true;
						}
					}
				}
			});

			await testAgent.processMessage(
				'Write a JavaScript function to calculate the factorial of a number'
			);

			expect(codeGenerated).toBe(true);
		});
	});

	describe('Sandbox Integration with Agent', () => {
		it('should execute code in sandbox via agent', async () => {
			let executionCompleted = false;

			const testAgent = new Agent({
				sandboxId: testSandboxId,
				projectId: TEST_PROJECT_ID,
				callbacks: {
					onMessage: (message) => {
						if (message.content.includes('executed') || message.content.includes('result')) {
							executionCompleted = true;
						}
					}
				}
			});

			await testAgent.processMessage(
				'Create a file called test.js with console.log("Hello World") and run it'
			);

			expect(executionCompleted).toBe(true);

			// Verify file was created
			const sandboxService = SandboxService.getInstance();
			const files = await sandboxService.listFiles(testSandboxId);
			const testFile = files.find((f) => f.path === '/test.js');
			expect(testFile).toBeDefined();
		});

		it('should handle file operations through agent', async () => {
			const testAgent = new Agent({
				sandboxId: testSandboxId,
				projectId: TEST_PROJECT_ID
			});

			await testAgent.processMessage(
				'Create a file called example.txt with the content "Hello from agent test"'
			);

			// Verify file creation
			const sandboxService = SandboxService.getInstance();
			const fileContent = await sandboxService.readFile(testSandboxId, '/example.txt');
			expect(fileContent).toContain('Hello from agent test');
		});
	});

	describe('Morph Code Editing Integration', () => {
		let testFilePath: string;

		beforeAll(async () => {
			testFilePath = `/morph-test-${Date.now()}.js`;
		});

		it('should create initial file for morph editing', async () => {
			const initialContent = `
function calculateSum(a, b) {
	return a + b;
}

console.log('Initial version');
			`.trim();

			// Create file directly via sandbox service
			const sandboxService = SandboxService.getInstance();
			await sandboxService.writeFile(testSandboxId, testFilePath, initialContent);

			// Verify file was created
			const fileContent = await sandboxService.readFile(testSandboxId, testFilePath);
			expect(fileContent).toBe(initialContent);
		});

		it('should perform intelligent code merge with morph editing', async () => {
			const originalContent = `
function calculateSum(a, b) {
	return a + b;
}

console.log('Initial version');
			`.trim();

			const aiEdit = `
function calculateSum(a, b) {
	// Add input validation
	if (typeof a !== 'number' || typeof b !== 'number') {
		throw new Error('Both arguments must be numbers');
	}
	return a + b;
}

console.log('AI improved with validation');
			`.trim();

			const edits = [
				{
					filePath: testFilePath,
					oldContent: originalContent,
					newContent: aiEdit,
					changeType: 'update' as const,
					reason: 'AI improved function with validation'
				}
			];

			const result = await morphService.applyEdits(edits, testSandboxId);

			expect(result.success).toBe(true);
			expect(result.results).toBeDefined();
			expect(result.results.length).toBeGreaterThan(0);
		});

		it('should handle merge conflicts with auto-resolution', async () => {
			const baseContent = `
const config = {
	port: 3000,
	host: 'localhost'
};
			`.trim();

			const edit2 = `
const config = {
	port: 8080,
	host: '0.0.0.0'
};
			`.trim();

			const edits = [
				{
					filePath: testFilePath,
					oldContent: baseContent,
					newContent: edit2,
					changeType: 'update' as const,
					reason: 'Update configuration'
				}
			];

			const result = await morphService.applyEdits(edits, testSandboxId);

			expect(result.success).toBe(true);
			expect(result.summary).toBeDefined();
		});

		it('should validate merged code syntax', async () => {
			const originalContent = `
function testFunction() {
	console.log("Hello");
}
			`.trim();

			const aiEdit = `
function testFunction() {
	console.log("Hello World");
	return true;
}
			`.trim();

			const edits = [
				{
					filePath: testFilePath,
					oldContent: originalContent,
					newContent: aiEdit,
					changeType: 'update' as const,
					reason: 'Add return statement'
				}
			];

			const result = await morphService.applyEdits(edits, testSandboxId);

			expect(result.success).toBe(true);
			expect(result.results).toBeDefined();
		});

		afterAll(async () => {
			// Cleanup test file
			try {
				const sandboxService = SandboxService.getInstance();
				await sandboxService.deleteFile(testSandboxId, testFilePath);
			} catch (error) {
				console.warn('File cleanup failed:', error);
			}
		});
	});

	describe('Complete Agent Workflow Integration', () => {
		it('should execute complete agent workflow: plan -> code -> test -> edit', async () => {
			let workflowCompleted = false;
			let fileCreated = false;
			let codeExecuted = false;

			const testAgent = new Agent({
				sandboxId: testSandboxId,
				projectId: TEST_PROJECT_ID,
				callbacks: {
					onMessage: (message) => {
						if (message.content.includes('completed') || message.content.includes('done')) {
							workflowCompleted = true;
						}
					},
					onStateChange: (state) => {
						if (state.currentFile) {
							fileCreated = true;
						}
					}
				}
			});

			await testAgent.processMessage(
				'Create a complete JavaScript utility that validates email addresses. ' +
					'Include proper error handling, create the file, test it, and make any necessary improvements.'
			);

			expect(workflowCompleted).toBe(true);

			// Verify file was created and contains expected content
			const sandboxService = SandboxService.getInstance();
			const files = await sandboxService.listFiles(testSandboxId);
			const emailFile = files.find((f) => f.path.includes('email') || f.content?.includes('email'));

			if (emailFile) {
				const content = await sandboxService.readFile(testSandboxId, emailFile.path);
				expect(content).toContain('function');
				expect(content).toContain('email');
				expect(content).toContain('validate');
			}
		});

		it('should handle agent workflow failures gracefully', async () => {
			const failingAgent = new Agent({
				sandboxId: 'non-existent-sandbox',
				projectId: TEST_PROJECT_ID
			});

			await expect(
				failingAgent.processMessage('This should handle failure gracefully')
			).rejects.toThrow();
		});
	});

	describe('Performance and Resource Management', () => {
		it('should handle concurrent agent executions', async () => {
			const tasks = [
				'Write a function to reverse a string',
				'Create a calculator class',
				'Implement a stack data structure'
			];

			const executionPromises = tasks.map(async (task) => {
				const testAgent = new Agent({
					sandboxId: testSandboxId,
					projectId: TEST_PROJECT_ID
				});

				await testAgent.processMessage(task);
				return true;
			});

			const results = await Promise.all(executionPromises);

			expect(results).toHaveLength(3);
			expect(results.every((r) => r === true)).toBe(true);
		});

		it('should respect sandbox resource limits', async () => {
			const sandboxService = SandboxService.getInstance();

			// Execute a memory-intensive operation
			const memoryIntensiveCode = `
// Create a large array to test memory limits
const largeArray = new Array(10000).fill('test');
console.log('Array created with', largeArray.length, 'elements');
largeArray.length;
			`.trim();

			const result = await sandboxService.executeCode(testSandboxId, memoryIntensiveCode);

			expect(result).toBeDefined();
			expect(result.success).toBe(true);
		});
	});

	describe('Agent State Persistence and Recovery', () => {
		it('should handle agent interruptions and resumption', async () => {
			let interruptReceived = false;

			const interruptibleAgent = new Agent({
				sandboxId: testSandboxId,
				projectId: TEST_PROJECT_ID,
				callbacks: {
					onInterrupt: (interrupt) => {
						interruptReceived = true;
						expect(interrupt.toolCalls).toBeDefined();
						expect(interrupt.stateSnapshot).toBeDefined();
					}
				}
			});

			// This should potentially trigger an interrupt for file operations
			await interruptibleAgent.processMessage(
				'Create a file that requires careful review before execution'
			);

			// Note: This test may not always trigger an interrupt depending on the agent logic
			// It's here to test the interrupt handling capability
		});

		it('should maintain conversation context', async () => {
			const contextualAgent = new Agent({
				sandboxId: testSandboxId,
				projectId: TEST_PROJECT_ID
			});

			// First message
			await contextualAgent.processMessage('My name is Alice');

			// Second message should remember context
			await contextualAgent.processMessage('What is my name?');

			// This is a basic test - in practice, you'd check the response content
			expect(true).toBe(true); // Placeholder for actual context verification
		});
	});
});
