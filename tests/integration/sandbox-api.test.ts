/**
 * Integration Tests for Sandbox API Endpoints
 * Tests the complete sandbox management workflow
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Test configuration
const BASE_URL = 'http://localhost:5173';
const TEST_USER_ID = 'test-user-123';
const TEST_PROJECT_ID = 'test-project-123';

describe('Sandbox API Integration Tests', () => {
	let authToken: string;
	let testSandboxId: string;

	beforeAll(async () => {
		// Setup test authentication
		// In a real scenario, you would authenticate a test user
		authToken = 'test-auth-token';
	});

	afterAll(async () => {
		// Cleanup test data
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
				console.warn('Cleanup failed:', error);
			}
		}
	});

	describe('Sandbox Lifecycle', () => {
		it('should create a new sandbox', async () => {
			const createRequest = {
				name: 'integration-test-sandbox',
				description: 'Sandbox created during integration testing',
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
					Authorization: `Bearer ${authToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(createRequest)
			});

			expect(response.status).toBe(201);

			const sandbox = await response.json();
			testSandboxId = sandbox.id;

			expect(sandbox).toHaveProperty('id');
			expect(sandbox.name).toBe(createRequest.name);
			expect(sandbox.template).toBe(createRequest.template);
			expect(sandbox.provider).toBe(createRequest.provider);
			expect(sandbox.status).toBeOneOf(['creating', 'provisioning']);
		});

		it('should retrieve the created sandbox', async () => {
			expect(testSandboxId).toBeDefined();

			const response = await fetch(`${BASE_URL}/api/sandbox/${testSandboxId}`, {
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			});

			expect(response.status).toBe(200);

			const sandbox = await response.json();
			expect(sandbox.id).toBe(testSandboxId);
			expect(sandbox.name).toBe('integration-test-sandbox');
		});

		it('should list user sandboxes', async () => {
			const response = await fetch(`${BASE_URL}/api/sandbox?page=1&limit=10`, {
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			});

			expect(response.status).toBe(200);

			const result = await response.json();
			expect(result).toHaveProperty('sandboxes');
			expect(result).toHaveProperty('total');
			expect(result).toHaveProperty('page');
			expect(result).toHaveProperty('limit');
			expect(Array.isArray(result.sandboxes)).toBe(true);

			// Should include our test sandbox
			const testSandbox = result.sandboxes.find((s: any) => s.id === testSandboxId);
			expect(testSandbox).toBeDefined();
		});

		it('should start the sandbox', async () => {
			const response = await fetch(`${BASE_URL}/api/sandbox/${testSandboxId}/start`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${authToken}`,
					'Content-Type': 'application/json'
				}
			});

			expect(response.status).toBe(200);

			const result = await response.json();
			expect(result.success).toBe(true);
		});

		it('should get sandbox status', async () => {
			const response = await fetch(`${BASE_URL}/api/sandbox/${testSandboxId}/status`, {
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			});

			expect(response.status).toBe(200);

			const status = await response.json();
			expect(status).toHaveProperty('status');
			expect(status.status).toBeOneOf(['starting', 'running', 'provisioning']);
		});

		it('should stop the sandbox', async () => {
			const response = await fetch(`${BASE_URL}/api/sandbox/${testSandboxId}/stop`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${authToken}`,
					'Content-Type': 'application/json'
				}
			});

			expect(response.status).toBe(200);

			const result = await response.json();
			expect(result.success).toBe(true);
		});

		it('should delete the sandbox', async () => {
			const response = await fetch(`${BASE_URL}/api/sandbox/${testSandboxId}`, {
				method: 'DELETE',
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			});

			expect(response.status).toBe(200);

			const result = await response.json();
			expect(result.success).toBe(true);

			// Verify deletion
			const getResponse = await fetch(`${BASE_URL}/api/sandbox/${testSandboxId}`, {
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			});

			expect(getResponse.status).toBe(404);
		});
	});

	describe('File Operations', () => {
		let fileSandboxId: string;

		beforeAll(async () => {
			// Create a sandbox for file operations testing
			const createRequest = {
				name: 'file-test-sandbox',
				description: 'Sandbox for file operations testing',
				template: 'node-basic',
				provider: 'daytona',
				environment: {}
			};

			const response = await fetch(`${BASE_URL}/api/sandbox`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${authToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(createRequest)
			});

			const sandbox = await response.json();
			fileSandboxId = sandbox.id;

			// Wait for sandbox to be ready
			await new Promise((resolve) => setTimeout(resolve, 2000));
		});

		afterAll(async () => {
			// Cleanup
			if (fileSandboxId) {
				await fetch(`${BASE_URL}/api/sandbox/${fileSandboxId}`, {
					method: 'DELETE',
					headers: {
						Authorization: `Bearer ${authToken}`
					}
				});
			}
		});

		it('should list sandbox files', async () => {
			const response = await fetch(`${BASE_URL}/api/sandbox/${fileSandboxId}/files`, {
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			});

			expect(response.status).toBe(200);

			const files = await response.json();
			expect(Array.isArray(files)).toBe(true);
		});

		it('should create a new file', async () => {
			const fileContent = `console.log('Hello from integration test!');`;

			const response = await fetch(`${BASE_URL}/api/sandbox/${fileSandboxId}/files`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${authToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					path: '/test.js',
					content: fileContent,
					isDirectory: false
				})
			});

			expect(response.status).toBe(201);

			const result = await response.json();
			expect(result.success).toBe(true);
		});

		it('should read the created file', async () => {
			const response = await fetch(`${BASE_URL}/api/sandbox/${fileSandboxId}/files?path=/test.js`, {
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			});

			expect(response.status).toBe(200);

			const file = await response.json();
			expect(file.content).toContain('Hello from integration test!');
		});

		it('should update the file content', async () => {
			const newContent = `console.log('Updated content from integration test!');`;

			const response = await fetch(`${BASE_URL}/api/sandbox/${fileSandboxId}/files`, {
				method: 'PUT',
				headers: {
					Authorization: `Bearer ${authToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					path: '/test.js',
					content: newContent
				})
			});

			expect(response.status).toBe(200);

			const result = await response.json();
			expect(result.success).toBe(true);
		});

		it('should delete the file', async () => {
			const response = await fetch(`${BASE_URL}/api/sandbox/${fileSandboxId}/files?path=/test.js`, {
				method: 'DELETE',
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			});

			expect(response.status).toBe(200);

			const result = await response.json();
			expect(result.success).toBe(true);
		});
	});

	describe('Template Operations', () => {
		it('should list available templates', async () => {
			const response = await fetch(`${BASE_URL}/api/templates`, {
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			});

			expect(response.status).toBe(200);

			const templates = await response.json();
			expect(Array.isArray(templates)).toBe(true);
			expect(templates.length).toBeGreaterThan(0);

			// Verify template structure
			const template = templates[0];
			expect(template).toHaveProperty('id');
			expect(template).toHaveProperty('name');
			expect(template).toHaveProperty('description');
			expect(template).toHaveProperty('category');
		});

		it('should get specific template details', async () => {
			// First get list of templates
			const listResponse = await fetch(`${BASE_URL}/api/templates`, {
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			});

			const templates = await listResponse.json();
			const templateId = templates[0].id;

			// Get specific template
			const response = await fetch(`${BASE_URL}/api/templates/${templateId}`, {
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			});

			expect(response.status).toBe(200);

			const template = await response.json();
			expect(template.id).toBe(templateId);
			expect(template).toHaveProperty('files');
			expect(template).toHaveProperty('dependencies');
		});
	});

	describe('Health Check', () => {
		it('should return system health status', async () => {
			const response = await fetch(`${BASE_URL}/api/health`);

			expect(response.status).toBe(200);

			const health = await response.json();
			expect(health).toHaveProperty('status');
			expect(health).toHaveProperty('timestamp');
			expect(health).toHaveProperty('services');
			expect(health).toHaveProperty('metrics');
			expect(health).toHaveProperty('version');

			// Verify service statuses
			expect(health.services).toHaveProperty('database');
			expect(health.services).toHaveProperty('sse_streaming');
			expect(health.services).toHaveProperty('sandbox_providers');
			expect(health.services).toHaveProperty('file_storage');
			expect(health.services).toHaveProperty('template_service');
		});
	});
});
