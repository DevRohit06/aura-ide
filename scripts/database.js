#!/usr/bin/env node

import {
	getSandboxDatabaseStats,
	initializeSandboxDatabase,
	resetSandboxDatabase
} from '../src/lib/database/init.js';
import { SandboxDatabase } from '../src/lib/database/sandbox.js';

const command = process.argv[2];

async function main() {
	try {
		switch (command) {
			case 'init':
				console.log('🚀 Initializing sandbox database...');
				await initializeSandboxDatabase();
				break;

			case 'reset':
				console.log('⚠️  Resetting sandbox database...');
				const confirm = process.argv[3];
				if (confirm !== '--confirm') {
					console.log('⚠️  This will delete all sandbox data!');
					console.log('To proceed, run: npm run db:reset -- --confirm');
					process.exit(1);
				}
				await resetSandboxDatabase();
				break;

			case 'stats':
				console.log('📊 Getting database statistics...');
				const stats = await getSandboxDatabaseStats();
				console.log(JSON.stringify(stats, null, 2));
				break;

			case 'health':
				console.log('🏥 Checking database health...');
				const health = await SandboxDatabase.healthCheck();
				console.log('Health status:', health);
				if (health.status === 'healthy') {
					console.log('✅ Database is healthy');
					process.exit(0);
				} else {
					console.log('❌ Database is unhealthy:', health.error);
					process.exit(1);
				}
				break;

			default:
				console.log(`
Aura Sandbox Database CLI

Usage:
  node scripts/database.js [command]

Commands:
  init     Initialize sandbox collections and indexes
  reset    Reset all sandbox collections (requires --confirm)
  stats    Show database statistics
  health   Check database health

Examples:
  node scripts/database.js init
  node scripts/database.js reset --confirm
  node scripts/database.js stats
  node scripts/database.js health
				`);
				process.exit(1);
		}

		console.log('✅ Operation completed successfully');
	} catch (error) {
		console.error('❌ Operation failed:', error);
		process.exit(1);
	} finally {
		await SandboxDatabase.close();
	}
}

main();
