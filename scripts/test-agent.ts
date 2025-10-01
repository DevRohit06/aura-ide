// Quick test script to validate the agent flow using a mock model.
// Run with: node -r ts-node/register scripts/test-agent.ts

import { AIMessage } from '@langchain/core/messages';
import { runAgentTest } from '../src/lib/agent/graph';

// Simple mock model that echoes the last human message and simulates a tool call
const mockModel = {
	async invoke(messages: any[]) {
		const last = messages[messages.length - 1];
		const content = typeof last.content === 'string' ? last.content : JSON.stringify(last);
		// Simulate an AIMessage with a simulated tool call payload
		return new AIMessage(`ECHO: ${content}`);
	}
};

(async () => {
	try {
		console.log('Running agent test with mock model...');
		const result = await runAgentTest({ message: 'Please summarize the project', mockModel });
		const resultAny = result as any;
		console.log('Test response:', JSON.stringify(resultAny.response ?? null));
		process.exit(0);
	} catch (err) {
		console.error('Test failed:', err);
		process.exit(2);
	}
})();
