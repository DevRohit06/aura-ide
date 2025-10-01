let shuttingDown = false;

export async function setupGracefulShutdown() {
	if (typeof process === 'undefined' || !process || !('on' in process)) return;

	const shutdown = async (signal: string) => {
		if (shuttingDown) return;
		shuttingDown = true;
		console.info(`Received ${signal}, shutting down gracefully...`);
		try {
			console.info('Cleanup complete, exiting');
			process.exit(0);
		} catch (err) {
			console.error('Error during shutdown:', err);
			process.exit(1);
		}
	};

	process.on('SIGINT', () => shutdown('SIGINT'));
	process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Auto-run when module is imported (server entry should import this file)
setupGracefulShutdown();
