/**
 * End-to-End Agent Workflow Tests
 * Validates complete agent workflow from sandbox creation to code execution
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Test configuration
const BASE_URL = 'http://localhost:5173';
const TEST_USER_ID = 'test-user-e2e';
const TEST_PROJECT_ID = 'test-project-e2e';

describe('End-to-End Agent Workflow Tests', () => {
	let authToken: string;
	let testSandboxId: string;
	let agentWebSocket: WebSocket;
	let agentConnectionId: string;

	beforeAll(async () => {
		// Setup test authentication
		authToken = 'test-auth-token-e2e';

		// Create test sandbox
		const createRequest = {
			name: 'e2e-test-sandbox',
			description: 'Sandbox for end-to-end agent testing',
			template: 'node-basic',
			provider: 'daytona',
			environment: {
				NODE_VERSION: '18',
				NPM_VERSION: 'latest'
			}
		};

		const createResponse = await fetch(`${BASE_URL}/api/sandbox`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${authToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(createRequest)
		});

		expect(createResponse.ok).toBe(true);
		const sandbox = await createResponse.json();
		testSandboxId = sandbox.id;
		expect(testSandboxId).toBeDefined();

		// Wait for sandbox to be ready
		await waitForSandboxReady(testSandboxId, authToken);
	});

	afterAll(async () => {
		// Close WebSocket connection
		if (agentWebSocket && agentWebSocket.readyState === WebSocket.OPEN) {
			agentWebSocket.close();
		}

		// Cleanup test sandbox
		if (testSandboxId) {
			try {
				await fetch(`${BASE_URL}/api/sandbox/${testSandboxId}`, {
					method: 'DELETE',
					headers: {
						Authorization: `Bearer ${authToken}`,
						'Content-Type': 'application/json'
					}
				});
			} catch (error) {
				console.warn('Sandbox cleanup failed:', error);
			}
		}
	});

	describe('Agent WebSocket Connection', () => {
		it('should establish WebSocket connection to agent', async () => {
			return new Promise<void>((resolve, reject) => {
				const wsUrl = `ws://localhost:5173/api/agent/ws/${TEST_PROJECT_ID}`;
				agentWebSocket = new WebSocket(wsUrl, {
					headers: {
						Authorization: `Bearer ${authToken}`
					}
				});

				const timeout = setTimeout(() => {
					reject(new Error('WebSocket connection timeout'));
				}, 10000);

				agentWebSocket.onopen = () => {
					clearTimeout(timeout);
					expect(agentWebSocket.readyState).toBe(WebSocket.OPEN);
					resolve();
				};

				agentWebSocket.onerror = (error) => {
					clearTimeout(timeout);
					reject(new Error(`WebSocket connection failed: ${error}`));
				};

				agentWebSocket.onmessage = (event) => {
					const message = JSON.parse(event.data);
					if (message.type === 'connection_confirmed') {
						agentConnectionId = message.data.connectionId;
					}
				};
			});
		});

		it('should initialize sandbox in agent', async () => {
			return new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error('Agent sandbox initialization timeout'));
				}, 30000);

				const initMessage = {
					type: 'initialize_sandbox',
					sandboxId: testSandboxId
				};

				agentWebSocket.send(JSON.stringify(initMessage));

				const messageHandler = (event: MessageEvent) => {
					const message = JSON.parse(event.data);

					if (message.type === 'message' && message.content.includes('Agent initialized')) {
						clearTimeout(timeout);
						agentWebSocket.removeEventListener('message', messageHandler);
						expect(message.role).toBe('system');
						expect(message.content).toContain(testSandboxId);
						resolve();
					} else if (message.type === 'error') {
						clearTimeout(timeout);
						agentWebSocket.removeEventListener('message', messageHandler);
						reject(new Error(`Agent initialization failed: ${message.message}`));
					}
				};

				agentWebSocket.addEventListener('message', messageHandler);
			});
		});
	});

	describe('Agent Code Execution Workflow', () => {
		it('should execute simple command via agent', async () => {
			return new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error('Command execution timeout'));
				}, 60000);

				const userMessage = {
					type: 'user_message',
					content: 'Run the command "echo \'Hello from E2E test\'" in the sandbox'
				};

				let interruptReceived = false;

				const messageHandler = (event: MessageEvent) => {
					const message = JSON.parse(event.data);

					if (message.type === 'interrupt') {
						interruptReceived = true;
						// Approve the interrupt (allow the command execution)
						const approveMessage = {
							type: 'approve_interrupt',
							toolCalls: message.interrupt.toolCalls
						};
						agentWebSocket.send(JSON.stringify(approveMessage));
					} else if (message.type === 'message' && message.role === 'assistant') {
						if (interruptReceived) {
							clearTimeout(timeout);
							agentWebSocket.removeEventListener('message', messageHandler);
							expect(message.content).toBeDefined();
							resolve();
						}
					} else if (message.type === 'error') {
						clearTimeout(timeout);
						agentWebSocket.removeEventListener('message', messageHandler);
						reject(new Error(`Command execution failed: ${message.message}`));
					}
				};

				agentWebSocket.addEventListener('message', messageHandler);
				agentWebSocket.send(JSON.stringify(userMessage));
			});
		});

		it('should create and run a simple Node.js script', async () => {
			return new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error('Script creation and execution timeout'));
				}, 120000);

				const userMessage = {
					type: 'user_message',
					content: 'Create a simple Node.js script that prints "E2E test successful" and run it'
				};

				let interruptCount = 0;
				let scriptCreated = false;
				let scriptExecuted = false;

				const messageHandler = (event: MessageEvent) => {
					const message = JSON.parse(event.data);

					if (message.type === 'interrupt') {
						interruptCount++;
						// Approve all interrupts
						const approveMessage = {
							type: 'approve_interrupt',
							toolCalls: message.interrupt.toolCalls
						};
						agentWebSocket.send(JSON.stringify(approveMessage));
					} else if (message.type === 'message' && message.role === 'assistant') {
						const content = message.content.toLowerCase();
						if (content.includes('created') || content.includes('written')) {
							scriptCreated = true;
						}
						if (
							content.includes('executed') ||
							content.includes('ran') ||
							content.includes('output')
						) {
							scriptExecuted = true;
						}

						// If we've seen both creation and execution, and had at least one interrupt
						if (scriptCreated && scriptExecuted && interruptCount > 0) {
							clearTimeout(timeout);
							agentWebSocket.removeEventListener('message', messageHandler);
							expect(message.content).toBeDefined();
							resolve();
						}
					} else if (message.type === 'error') {
						clearTimeout(timeout);
						agentWebSocket.removeEventListener('message', messageHandler);
						reject(new Error(`Script workflow failed: ${message.message}`));
					}
				};

				agentWebSocket.addEventListener('message', messageHandler);
				agentWebSocket.send(JSON.stringify(userMessage));
			});
		});
	});

	describe('Agent File Operations', () => {
		it('should read and modify files', async () => {
			return new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error('File operations timeout'));
				}, 90000);

				const userMessage = {
					type: 'user_message',
					content:
						'Create a file called test-e2e.txt with content "Initial content", then read it back and append " - modified" to it'
				};

				let fileCreated = false;
				let fileModified = false;
				let interruptCount = 0;

				const messageHandler = (event: MessageEvent) => {
					const message = JSON.parse(event.data);

					if (message.type === 'interrupt') {
						interruptCount++;
						const approveMessage = {
							type: 'approve_interrupt',
							toolCalls: message.interrupt.toolCalls
						};
						agentWebSocket.send(JSON.stringify(approveMessage));
					} else if (message.type === 'message' && message.role === 'assistant') {
						const content = message.content.toLowerCase();
						if (content.includes('created') || content.includes('written')) {
							fileCreated = true;
						}
						if (
							content.includes('modified') ||
							content.includes('appended') ||
							content.includes('updated')
						) {
							fileModified = true;
						}

						if (fileCreated && fileModified && interruptCount >= 2) {
							clearTimeout(timeout);
							agentWebSocket.removeEventListener('message', messageHandler);
							expect(message.content).toBeDefined();
							resolve();
						}
					} else if (message.type === 'error') {
						clearTimeout(timeout);
						agentWebSocket.removeEventListener('message', messageHandler);
						reject(new Error(`File operations failed: ${message.message}`));
					}
				};

				agentWebSocket.addEventListener('message', messageHandler);
				agentWebSocket.send(JSON.stringify(userMessage));
			});
		});
	});

	describe('Agent Error Handling', () => {
		it('should handle invalid commands gracefully', async () => {
			return new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error('Error handling timeout'));
				}, 30000);

				const userMessage = {
					type: 'user_message',
					content: 'Run a command that does not exist: nonexistentcommand'
				};

				const messageHandler = (event: MessageEvent) => {
					const message = JSON.parse(event.data);

					if (message.type === 'interrupt') {
						// Approve the interrupt to let it attempt the command
						const approveMessage = {
							type: 'approve_interrupt',
							toolCalls: message.interrupt.toolCalls
						};
						agentWebSocket.send(JSON.stringify(approveMessage));
					} else if (message.type === 'message' && message.role === 'assistant') {
						clearTimeout(timeout);
						agentWebSocket.removeEventListener('message', messageHandler);
						// Should still get a response even if command fails
						expect(message.content).toBeDefined();
						resolve();
					} else if (message.type === 'error') {
						clearTimeout(timeout);
						agentWebSocket.removeEventListener('message', messageHandler);
						// Errors should be handled gracefully
						expect(message.message).toBeDefined();
						resolve();
					}
				};

				agentWebSocket.addEventListener('message', messageHandler);
				agentWebSocket.send(JSON.stringify(userMessage));
			});
		});
	});

	describe('Agent Interrupt Handling', () => {
		it('should handle interrupt rejection', async () => {
			return new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error('Interrupt rejection timeout'));
				}, 30000);

				const userMessage = {
					type: 'user_message',
					content: 'Please run: echo "This should be rejected"'
				};

				const messageHandler = (event: MessageEvent) => {
					const message = JSON.parse(event.data);

					if (message.type === 'interrupt') {
						// Reject the interrupt
						const rejectMessage = {
							type: 'reject_interrupt'
						};
						agentWebSocket.send(JSON.stringify(rejectMessage));
					} else if (message.type === 'message' && message.role === 'assistant') {
						clearTimeout(timeout);
						agentWebSocket.removeEventListener('message', messageHandler);
						// Should get a rejection message
						expect(message.content).toContain('rejected');
						resolve();
					} else if (message.type === 'error') {
						clearTimeout(timeout);
						agentWebSocket.removeEventListener('message', messageHandler);
						reject(new Error(`Unexpected error: ${message.message}`));
					}
				};

				agentWebSocket.addEventListener('message', messageHandler);
				agentWebSocket.send(JSON.stringify(userMessage));
			});
		});
	});
});

// Helper functions

async function waitForSandboxReady(
	sandboxId: string,
	authToken: string,
	maxWaitTime = 300000
): Promise<void> {
	const startTime = Date.now();

	while (Date.now() - startTime < maxWaitTime) {
		try {
			const response = await fetch(`${BASE_URL}/api/sandbox/${sandboxId}`, {
				headers: {
					Authorization: `Bearer ${authToken}`,
					'Content-Type': 'application/json'
				}
			});

			if (response.ok) {
				const sandbox = await response.json();
				if (sandbox.status === 'running' || sandbox.status === 'ready') {
					return;
				}
			}
		} catch (error) {
			console.warn('Error checking sandbox status:', error);
		}

		// Wait 5 seconds before checking again
		await new Promise((resolve) => setTimeout(resolve, 5000));
	}

	throw new Error(`Sandbox ${sandboxId} did not become ready within ${maxWaitTime}ms`);
}
