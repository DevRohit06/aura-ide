import { MorphCodeEditingService } from '$lib/services/morph-code-editing.service';
import { SandboxService } from '$lib/services/sandbox.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock external dependencies
vi.mock('$lib/services/sandbox.service');
vi.mock('$lib/services/sandbox', () => ({
	sandboxManager: {
		readFile: vi.fn().mockResolvedValue({ content: 'console.log("old");' }),
		writeFile: vi.fn().mockResolvedValue(true)
	}
}));

describe('Agent E2E Workflow', () => {
	let mockSandboxService: any;

	beforeEach(() => {
		// Reset mocks
		vi.clearAllMocks();

		// Setup mock implementations
		mockSandboxService = {
			getInstance: vi.fn().mockReturnValue({
				createSandbox: vi.fn().mockResolvedValue({
					id: 'test-sandbox-123',
					status: 'running',
					url: 'http://localhost:3000'
				}),
				getSandbox: vi.fn().mockResolvedValue({
					id: 'test-sandbox-123',
					status: 'running'
				}),
				writeFile: vi.fn().mockResolvedValue(true),
				readFile: vi.fn().mockResolvedValue('console.log("test");'),
				listFiles: vi.fn().mockResolvedValue([{ path: '/test.js', type: 'file' }]),
				deleteFile: vi.fn().mockResolvedValue(true),
				deleteSandbox: vi.fn().mockResolvedValue(true),
				connectTerminal: vi.fn().mockResolvedValue({
					socket: { send: vi.fn(), on: vi.fn() },
					disconnect: vi.fn()
				})
			})
		};

		// Apply mocks
		vi.mocked(SandboxService.getInstance).mockReturnValue(mockSandboxService.getInstance());
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should initialize sandbox service', () => {
		const sandboxService = SandboxService.getInstance();
		expect(sandboxService).toBeDefined();
		expect(typeof sandboxService.createSandbox).toBe('function');
	});

	it('should create and manage sandbox lifecycle', async () => {
		const sandboxService = SandboxService.getInstance();

		// Create sandbox
		const sandbox = await sandboxService.createSandbox({
			userId: 'test-user',
			projectId: 'test-project',
			templateId: 'node-basic',
			provider: 'daytona'
		});

		expect(sandbox.id).toBe('test-sandbox-123');
		expect(sandbox.status).toBe('running');

		// Get sandbox status
		const status = await sandboxService.getSandbox('test-sandbox-123');
		expect(status?.status).toBe('running');

		// Cleanup
		await sandboxService.deleteSandbox('test-sandbox-123');
		expect(mockSandboxService.getInstance().deleteSandbox).toHaveBeenCalledWith('test-sandbox-123');
	});

	it('should handle file operations in sandbox', async () => {
		const sandboxService = SandboxService.getInstance();

		// Write file
		await sandboxService.writeFile('test-sandbox-123', '/test.js', 'console.log("hello");');
		expect(mockSandboxService.getInstance().writeFile).toHaveBeenCalledWith(
			'test-sandbox-123',
			'/test.js',
			'console.log("hello");'
		);

		// Read file
		const content = await sandboxService.readFile('test-sandbox-123', '/test.js');
		expect(content).toBe('console.log("test");');

		// List files
		const files = await sandboxService.listFiles('test-sandbox-123');
		expect(files).toHaveLength(1);
		expect(files[0].path).toBe('/test.js');
	});

	it('should apply morph code edits successfully', async () => {
		const morphService = new MorphCodeEditingService();

		const edits = [
			{
				filePath: '/test.js',
				oldContent: 'console.log("old");',
				newContent: 'console.log("new");',
				changeType: 'update' as const,
				reason: 'AI improvement'
			}
		];

		const result = await morphService.applyEdits(edits, 'test-sandbox-123');

		expect(result.success).toBe(true);
		expect(result.summary.successful).toBe(1);
		expect(result.summary.totalFiles).toBe(1);
	});

	it('should handle morph editing with conflicts', async () => {
		const morphService = new MorphCodeEditingService();

		// Create a scenario where the file content has changed
		const { sandboxManager } = await import('$lib/services/sandbox');
		vi.mocked(sandboxManager).readFile.mockResolvedValueOnce({
			path: '/test.js',
			content: 'console.log("modified by user");'
		});

		const edits = [
			{
				filePath: '/test.js',
				oldContent: 'console.log("original");',
				newContent: 'console.log("AI updated");',
				changeType: 'update' as const,
				reason: 'AI improvement'
			}
		];

		const result = await morphService.applyEdits(edits, 'test-sandbox-123');

		// Should succeed overall but report conflicts in summary
		expect(result.success).toBe(true);
		expect(result.summary.conflicts).toBe(1);
		expect(result.summary.successful).toBe(0);
	});

	it('should validate edit safety', () => {
		const morphService = new MorphCodeEditingService();

		const safeEdit = {
			filePath: '/test.js',
			oldContent: 'console.log("old");',
			newContent: 'console.log("new");',
			changeType: 'update' as const,
			reason: 'Safe edit'
		};

		const validation = morphService.validateEdit(safeEdit, 'console.log("old");');
		expect(validation.valid).toBe(true);
		expect(validation.risk).toBe('low');
	});

	it('should generate meaningful diffs', () => {
		const morphService = new MorphCodeEditingService();

		const oldContent = 'function add(a,b){return a+b;}';
		const newContent = 'function add(a, b) {\n  return a + b;\n}';

		const diff = morphService.generateDiff(oldContent, newContent);
		expect(diff).toContain('-');
		expect(diff).toContain('+');
		expect(diff.length).toBeGreaterThan(0);
	});

	it('should handle concurrent file operations', async () => {
		const sandboxService = SandboxService.getInstance();

		const operations = [
			sandboxService.writeFile('test-sandbox-123', '/file1.js', 'console.log(1);'),
			sandboxService.writeFile('test-sandbox-123', '/file2.js', 'console.log(2);'),
			sandboxService.writeFile('test-sandbox-123', '/file3.js', 'console.log(3);')
		];

		await Promise.all(operations);

		expect(mockSandboxService.getInstance().writeFile).toHaveBeenCalledTimes(3);
	});

	it('should handle error scenarios gracefully', async () => {
		const sandboxService = SandboxService.getInstance();

		// Mock an error
		mockSandboxService.getInstance().writeFile.mockRejectedValueOnce(new Error('Disk full'));

		await expect(
			sandboxService.writeFile('test-sandbox-123', '/test.js', 'content')
		).rejects.toThrow('Disk full');
	});
});
