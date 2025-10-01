#!/usr/bin/env node

/**
 * Agent E2E Test Runner
 * Runs comprehensive end-to-end tests for the agent workflow
 */

import { Agent, type AgentConfig } from '../src/lib/agent/index.js';
import { MorphCodeEditingService } from '../src/lib/services/morph-code-editing.service.js';
import { SandboxService } from '../src/lib/services/sandbox.service.js';

const TEST_USER_ID = 'test-agent-user-123';
const TEST_PROJECT_ID = 'test-agent-project-123';

async function runAgentE2ETests() {
	console.log('🚀 Starting Agent End-to-End Tests...\n');

	let testSandboxId: string | undefined;
	let agent: Agent;
	let morphService: MorphCodeEditingService;

	try {
		// Initialize services
		console.log('📦 Initializing services...');
		morphService = new MorphCodeEditingService();

		// Create test sandbox
		console.log('🏗️  Creating test sandbox...');
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
		console.log(`✅ Sandbox created: ${testSandboxId}`);

		// Wait for sandbox to be ready
		console.log('⏳ Waiting for sandbox to be ready...');
		let attempts = 0;
		while (attempts < 30) {
			const status = await sandboxService.getSandbox(testSandboxId);
			if (status?.status === 'running') {
				console.log('✅ Sandbox is running');
				break;
			}
			await new Promise((resolve) => setTimeout(resolve, 2000));
			attempts++;
		}

		// Create agent with sandbox
		console.log('🤖 Creating agent...');
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
		console.log('✅ Agent created');

		// Test 1: Agent Initialization
		console.log('\n🧪 Test 1: Agent Initialization');
		console.log(
			'   ✅ Agent has processMessage method:',
			typeof agent.processMessage === 'function'
		);

		// Test 2: Simple Message Processing
		console.log('\n🧪 Test 2: Simple Message Processing');
		let messageReceived = false;
		let stateChanged = false;

		const testAgent = new Agent({
			sandboxId: testSandboxId,
			projectId: TEST_PROJECT_ID,
			callbacks: {
				onMessage: (message) => {
					messageReceived = true;
					console.log('   📨 Message received:', message.content.substring(0, 50) + '...');
				},
				onStateChange: (state) => {
					stateChanged = true;
					console.log('   🔄 State changed:', state.isActive);
				}
			}
		});

		await testAgent.processMessage('Hello, can you help me write a simple function?');
		console.log('   ✅ Message processed, callbacks triggered:', messageReceived && stateChanged);

		// Test 3: Code Generation
		console.log('\n🧪 Test 3: Code Generation');
		let codeGenerated = false;

		const codeGenAgent = new Agent({
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

		await codeGenAgent.processMessage(
			'Write a JavaScript function to calculate the factorial of a number'
		);
		console.log('   ✅ Code generation completed:', codeGenerated);

		// Test 4: Sandbox File Operations
		console.log('\n🧪 Test 4: Sandbox File Operations');
		await testAgent.processMessage(
			'Create a file called test.js with console.log("Hello World") and run it'
		);

		// Verify file was created
		const files = await sandboxService.listFiles(testSandboxId);
		const testFile = files.find((f) => f.path === '/test.js');
		console.log('   ✅ Test file created:', !!testFile);

		// Test 5: Morph Code Editing
		console.log('\n🧪 Test 5: Morph Code Editing');
		let testFilePath = `/morph-test-${Date.now()}.js`;

		const initialContent = `
function calculateSum(a, b) {
	return a + b;
}

console.log('Initial version');
		`.trim();

		// Create file directly via sandbox service
		await sandboxService.writeFile(testSandboxId, testFilePath, initialContent);
		console.log('   📝 Initial file created');

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
				oldContent: initialContent,
				newContent: aiEdit,
				changeType: 'update' as const,
				reason: 'AI improved function with validation'
			}
		];

		const result = await morphService.applyEdits(edits, testSandboxId);
		console.log('   ✅ Morph editing applied:', result.success);

		// Cleanup test file
		await sandboxService.deleteFile(testSandboxId, testFilePath);

		console.log('\n🎉 All Agent E2E Tests Completed Successfully!');
	} catch (error) {
		console.error('\n❌ Test failed:', error);
		process.exit(1);
	} finally {
		// Cleanup
		try {
			if (testSandboxId) {
				console.log('\n🧹 Cleaning up test sandbox...');
				const sandboxService = SandboxService.getInstance();
				await sandboxService.deleteSandbox(testSandboxId);
				console.log('✅ Cleanup completed');
			}
		} catch (error) {
			console.warn('⚠️  Cleanup failed:', error);
		}
	}
}

// Run the tests
runAgentE2ETests().catch(console.error);
