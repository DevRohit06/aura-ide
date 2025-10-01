/**
 * End-to-End Agent Workflow Tests (SSE-based)
 * Validates complete agent workflow using Server-Sent Events
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Test configuration
const BASE_URL = 'http://localhost:5173';
const TEST_USER_ID = 'test-user-e2e';
const TEST_PROJECT_ID = 'test-project-e2e';

describe('End-to-End Agent SSE Workflow Tests', () => {
	let authToken: string;
	let testSandboxId: string;

	beforeAll(async () => {
		// Setup test authentication
		authToken = 'test-auth-token-e2e';

		// Create test sandbox (if available)
		try {
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

			const response = await fetch(`${BASE_URL}/api/sandbox`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${authToken}`
				},
				body: JSON.stringify(createRequest)
			});

			if (response.ok) {
				const result = await response.json();
				testSandboxId = result.sandboxId;
				console.log(`Test sandbox created: ${testSandboxId}`);
			}
		} catch (error) {
			console.warn('Test sandbox creation failed, tests will run without sandbox:', error);
		}
	});

	afterAll(async () => {
		// Cleanup test sandbox
		if (testSandboxId) {
			try {
				await fetch(`${BASE_URL}/api/sandbox/${testSandboxId}`, {
					method: 'DELETE',
					headers: {
						Authorization: `Bearer ${authToken}`
					}
				});
				console.log(`Test sandbox cleaned up: ${testSandboxId}`);
			} catch (error) {
				console.error('Failed to cleanup test sandbox:', error);
			}
		}
	});

	describe('Agent SSE Communication', () => {
		it('should process agent requests via SSE stream', async () => {
			const agentRequest = {
				message: 'Create a simple Hello World Node.js application',
				projectId: TEST_PROJECT_ID,
				sandboxId: testSandboxId || undefined,
				currentFile: null
			};

			const response = await fetch(`${BASE_URL}/api/agent/stream`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${authToken}`
				},
				body: JSON.stringify(agentRequest)
			});

			expect(response.ok).toBe(true);
			expect(response.headers.get('content-type')).toBe('text/event-stream');

			// Test that we can read the stream
			const reader = response.body?.getReader();
			expect(reader).toBeDefined();

			if (reader) {
				const decoder = new TextDecoder();
				let eventCount = 0;
				let hasStartEvent = false;
				let hasCompleteEvent = false;
				let receivedContent = '';

				try {
					while (eventCount < 20) {
						// Limit to prevent infinite loop
						const { done, value } = await reader.read();
						if (done) break;

						const chunk = decoder.decode(value);
						const lines = chunk.split('\n');

						for (const line of lines) {
							if (line.startsWith('data: ')) {
								const eventData = line.slice(6);
								if (eventData.trim()) {
									try {
										const event = JSON.parse(eventData);

										switch (event.type) {
											case 'start':
												hasStartEvent = true;
												break;
											case 'content':
												if (event.data?.chunk) {
													receivedContent += event.data.chunk;
												}
												break;
											case 'complete':
												hasCompleteEvent = true;
												break;
										}

										eventCount++;
									} catch (e) {
										console.warn('Failed to parse SSE event:', eventData);
									}
								}
							}
						}

						if (hasCompleteEvent) break;
					}
				} finally {
					reader.releaseLock();
				}

				expect(hasStartEvent).toBe(true);
				expect(eventCount).toBeGreaterThan(0);
				console.log(`Received ${eventCount} SSE events`);
				console.log(`Received content: ${receivedContent.slice(0, 100)}...`);
			}
		});

		it('should handle agent errors gracefully', async () => {
			const agentRequest = {
				message: '', // Invalid empty message
				projectId: TEST_PROJECT_ID,
				sandboxId: testSandboxId || undefined,
				currentFile: null
			};

			const response = await fetch(`${BASE_URL}/api/agent/stream`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${authToken}`
				},
				body: JSON.stringify(agentRequest)
			});

			// Should either handle gracefully or return appropriate error
			expect(response.status).toBeLessThan(500);
		});
	});

	describe('Agent Message Threading', () => {
		it('should create and manage message threads', async () => {
			// First message should create a new thread
			const firstMessage = {
				message: 'Hello, agent!',
				projectId: TEST_PROJECT_ID,
				sandboxId: testSandboxId || undefined
			};

			const response1 = await fetch(`${BASE_URL}/api/agent/stream`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${authToken}`
				},
				body: JSON.stringify(firstMessage)
			});

			expect(response1.ok).toBe(true);

			// Read the stream to completion to get thread ID
			const reader1 = response1.body?.getReader();
			let threadId: string | undefined;

			if (reader1) {
				const decoder = new TextDecoder();
				try {
					while (true) {
						const { done, value } = await reader1.read();
						if (done) break;

						const chunk = decoder.decode(value);
						const lines = chunk.split('\n');

						for (const line of lines) {
							if (line.startsWith('data: ')) {
								const eventData = line.slice(6);
								if (eventData.trim()) {
									try {
										const event = JSON.parse(eventData);
										if (event.type === 'complete' && event.data?.threadId) {
											threadId = event.data.threadId;
										}
									} catch (e) {
										// Ignore parse errors
									}
								}
							}
						}

						if (threadId) break;
					}
				} finally {
					reader1.releaseLock();
				}
			}

			// Verify we got a thread ID
			expect(threadId).toBeDefined();
			console.log(`Created thread: ${threadId}`);
		});
	});
});
