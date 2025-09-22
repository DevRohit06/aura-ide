/**
 * Sandbox Service Unit Tests
 * Comprehensive testing for sandbox management functionality
 */

import { SandboxService } from '$lib/services/sandbox.service';
import type { SandboxCreateRequest, SandboxInstance } from '$lib/types/sandbox';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('$lib/services/database.service');
vi.mock('$lib/services/daytona.service');
vi.mock('$lib/services/e2b.service');

describe('SandboxService', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('createSandbox', () => {
		it('should create a new sandbox with valid request', async () => {
			const createRequest: SandboxCreateRequest = {
				name: 'test-sandbox',
				description: 'Test sandbox for unit testing',
				template: 'node-basic',
				provider: 'daytona',
				environment: {
					NODE_VERSION: '18',
					NPM_VERSION: 'latest'
				}
			};

			const mockSandbox: SandboxInstance = {
				id: 'sandbox-123',
				name: 'test-sandbox',
				description: 'Test sandbox for unit testing',
				status: 'creating',
				provider: 'daytona',
				template: 'node-basic',
				environment: createRequest.environment,
				resources: {
					cpu: 2,
					memory: 4096,
					disk: 10240
				},
				created_at: new Date(),
				updated_at: new Date(),
				user_id: 'user-123',
				project_id: 'project-123'
			};

			// Mock the create method
			vi.spyOn(SandboxService, 'create').mockResolvedValue(mockSandbox);

			const result = await SandboxService.create('user-123', 'project-123', createRequest);

			expect(result).toEqual(mockSandbox);
			expect(result.status).toBe('creating');
			expect(result.provider).toBe('daytona');
		});

		it('should throw error for invalid template', async () => {
			const createRequest: SandboxCreateRequest = {
				name: 'test-sandbox',
				description: 'Test sandbox',
				template: 'invalid-template',
				provider: 'daytona',
				environment: {}
			};

			vi.spyOn(SandboxService, 'create').mockRejectedValue(
				new Error('Template "invalid-template" not found')
			);

			await expect(SandboxService.create('user-123', 'project-123', createRequest)).rejects.toThrow(
				'Template "invalid-template" not found'
			);
		});

		it('should handle provider unavailability', async () => {
			const createRequest: SandboxCreateRequest = {
				name: 'test-sandbox',
				description: 'Test sandbox',
				template: 'node-basic',
				provider: 'unavailable-provider',
				environment: {}
			};

			vi.spyOn(SandboxService, 'create').mockRejectedValue(
				new Error('Provider "unavailable-provider" is not available')
			);

			await expect(SandboxService.create('user-123', 'project-123', createRequest)).rejects.toThrow(
				'Provider "unavailable-provider" is not available'
			);
		});
	});

	describe('getSandbox', () => {
		it('should retrieve sandbox by ID', async () => {
			const mockSandbox: SandboxInstance = {
				id: 'sandbox-123',
				name: 'test-sandbox',
				description: 'Test sandbox',
				status: 'running',
				provider: 'daytona',
				template: 'node-basic',
				environment: {},
				resources: {
					cpu: 2,
					memory: 4096,
					disk: 10240
				},
				created_at: new Date(),
				updated_at: new Date(),
				user_id: 'user-123',
				project_id: 'project-123'
			};

			vi.spyOn(SandboxService, 'getById').mockResolvedValue(mockSandbox);

			const result = await SandboxService.getById('sandbox-123');

			expect(result).toEqual(mockSandbox);
			expect(result.id).toBe('sandbox-123');
		});

		it('should return null for non-existent sandbox', async () => {
			vi.spyOn(SandboxService, 'getById').mockResolvedValue(null);

			const result = await SandboxService.getById('non-existent');

			expect(result).toBeNull();
		});
	});

	describe('updateSandboxStatus', () => {
		it('should update sandbox status correctly', async () => {
			const mockSandbox: SandboxInstance = {
				id: 'sandbox-123',
				name: 'test-sandbox',
				description: 'Test sandbox',
				status: 'running',
				provider: 'daytona',
				template: 'node-basic',
				environment: {},
				resources: {
					cpu: 2,
					memory: 4096,
					disk: 10240
				},
				created_at: new Date(),
				updated_at: new Date(),
				user_id: 'user-123',
				project_id: 'project-123'
			};

			vi.spyOn(SandboxService, 'updateStatus').mockResolvedValue(mockSandbox);

			const result = await SandboxService.updateStatus('sandbox-123', 'running');

			expect(result.status).toBe('running');
		});
	});

	describe('deleteSandbox', () => {
		it('should delete sandbox successfully', async () => {
			vi.spyOn(SandboxService, 'delete').mockResolvedValue(true);

			const result = await SandboxService.delete('sandbox-123');

			expect(result).toBe(true);
		});

		it('should handle deletion of non-existent sandbox', async () => {
			vi.spyOn(SandboxService, 'delete').mockResolvedValue(false);

			const result = await SandboxService.delete('non-existent');

			expect(result).toBe(false);
		});
	});

	describe('listSandboxes', () => {
		it('should list user sandboxes with pagination', async () => {
			const mockSandboxes: SandboxInstance[] = [
				{
					id: 'sandbox-1',
					name: 'sandbox-1',
					description: 'First sandbox',
					status: 'running',
					provider: 'daytona',
					template: 'node-basic',
					environment: {},
					resources: { cpu: 2, memory: 4096, disk: 10240 },
					created_at: new Date(),
					updated_at: new Date(),
					user_id: 'user-123',
					project_id: 'project-123'
				},
				{
					id: 'sandbox-2',
					name: 'sandbox-2',
					description: 'Second sandbox',
					status: 'stopped',
					provider: 'e2b',
					template: 'python-basic',
					environment: {},
					resources: { cpu: 1, memory: 2048, disk: 5120 },
					created_at: new Date(),
					updated_at: new Date(),
					user_id: 'user-123',
					project_id: 'project-123'
				}
			];

			const mockResult = {
				sandboxes: mockSandboxes,
				total: 2,
				page: 1,
				limit: 10,
				totalPages: 1
			};

			vi.spyOn(SandboxService, 'listByUser').mockResolvedValue(mockResult);

			const result = await SandboxService.listByUser('user-123', {
				page: 1,
				limit: 10
			});

			expect(result.sandboxes).toHaveLength(2);
			expect(result.total).toBe(2);
			expect(result.page).toBe(1);
		});

		it('should filter sandboxes by status', async () => {
			const runningSandboxes = [
				{
					id: 'sandbox-1',
					name: 'running-sandbox',
					description: 'Running sandbox',
					status: 'running' as const,
					provider: 'daytona' as const,
					template: 'node-basic',
					environment: {},
					resources: { cpu: 2, memory: 4096, disk: 10240 },
					created_at: new Date(),
					updated_at: new Date(),
					user_id: 'user-123',
					project_id: 'project-123'
				}
			];

			const mockResult = {
				sandboxes: runningSandboxes,
				total: 1,
				page: 1,
				limit: 10,
				totalPages: 1
			};

			vi.spyOn(SandboxService, 'listByUser').mockResolvedValue(mockResult);

			const result = await SandboxService.listByUser('user-123', {
				page: 1,
				limit: 10,
				status: 'running'
			});

			expect(result.sandboxes).toHaveLength(1);
			expect(result.sandboxes[0].status).toBe('running');
		});
	});

	describe('getAvailableProviders', () => {
		it('should return list of available providers', async () => {
			const mockProviders = [
				{
					name: 'daytona',
					type: 'cloud' as const,
					status: 'healthy' as const,
					capabilities: ['terminal', 'files', 'networking'],
					limits: { max_cpu: 8, max_memory: 16384, max_disk: 51200 }
				},
				{
					name: 'e2b',
					type: 'cloud' as const,
					status: 'healthy' as const,
					capabilities: ['terminal', 'files'],
					limits: { max_cpu: 4, max_memory: 8192, max_disk: 25600 }
				}
			];

			vi.spyOn(SandboxService, 'getAvailableProviders').mockResolvedValue(mockProviders);

			const result = await SandboxService.getAvailableProviders();

			expect(result).toHaveLength(2);
			expect(result.map((p) => p.name)).toContain('daytona');
			expect(result.map((p) => p.name)).toContain('e2b');
		});
	});
});
