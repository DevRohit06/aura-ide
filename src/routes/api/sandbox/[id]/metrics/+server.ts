/**
 * Sandbox Metrics API Routes
 * REST API endpoints for sandbox monitoring and performance metrics
 */

import { SandboxManager } from '$lib/services/sandbox/sandbox-manager';
import { SandboxSessionService } from '$lib/services/session/sandbox-session.service';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

interface MetricsQuery {
	startTime?: string;
	endTime?: string;
	interval?: '1m' | '5m' | '15m' | '1h' | '1d';
	metrics?: Array<'cpu' | 'memory' | 'storage' | 'network' | 'all'>;
}

/**
 * GET /api/sandbox/[id]/metrics
 * Get real-time and historical metrics for the sandbox
 */
export const GET: RequestHandler = async ({ params, locals, url }) => {
	try {
		const user = locals.user;
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const sandboxId = params.id;
		if (!sandboxId) {
			return json({ error: 'Sandbox ID is required' }, { status: 400 });
		}

		const sessionService = SandboxSessionService.getInstance();
		const sandboxManager = SandboxManager.getInstance();

		// Get session by sandbox ID
		const session = await sessionService.getSession(sandboxId);
		if (!session || session.userId !== user.id) {
			return json({ error: 'Sandbox not found' }, { status: 404 });
		}

		// Parse query parameters
		const startTime = url.searchParams.get('startTime');
		const endTime = url.searchParams.get('endTime');
		const interval = (url.searchParams.get('interval') as MetricsQuery['interval']) || '5m';
		const metricsParam = url.searchParams.get('metrics');
		const metrics = metricsParam ? (metricsParam.split(',') as MetricsQuery['metrics']) : ['all'];

		// Get provider for this sandbox
		const provider = await sandboxManager['getProviderForSandbox'](
			session.sandboxId,
			session.provider
		);

		// Get current real-time metrics
		const currentMetrics = await provider.getMetrics(session.sandboxId);

		// Get historical metrics if time range specified
		let historicalMetrics = null;
		if (startTime && endTime) {
			// In a real implementation, this would query historical metrics from a time-series database
			historicalMetrics = {
				interval,
				dataPoints: [],
				message: 'Historical metrics would be fetched from time-series database'
			};
		}

		// Calculate uptime
		const uptime = Date.now() - session.start_time.getTime();

		// Session activity metrics
		const activityMetrics = {
			sessionDuration: uptime,
			lastActivity: session.last_activity,
			executionCount: session.metrics?.executionCount || 0,
			lastCollected: session.metrics?.lastCollected || new Date()
		};

		// Resource limits and usage
		const resourceInfo = {
			limits: session.resource_limits,
			current: currentMetrics
				? {
						cpu: currentMetrics.cpu,
						memory: currentMetrics.memory,
						storage: currentMetrics.storage,
						network: currentMetrics.network
					}
				: null,
			session: session.metrics
		};

		// Update session activity
		sessionService.updateLastActivity(session.id);

		return json({
			sandboxId,
			timestamp: new Date().toISOString(),
			metrics: {
				current: currentMetrics,
				historical: historicalMetrics,
				activity: activityMetrics,
				resources: resourceInfo
			},
			query: {
				startTime,
				endTime,
				interval,
				metrics
			}
		});
	} catch (error) {
		console.error('Failed to get sandbox metrics:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to get metrics'
			},
			{ status: 500 }
		);
	}
};

/**
 * POST /api/sandbox/[id]/metrics/export
 * Export metrics data in various formats
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	try {
		const user = locals.user;
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const sandboxId = params.id;
		if (!sandboxId) {
			return json({ error: 'Sandbox ID is required' }, { status: 400 });
		}

		const sessionService = SandboxSessionService.getInstance();

		// Get session by sandbox ID
		const session = await sessionService.getSession(sandboxId);
		if (!session || session.userId !== user.id) {
			return json({ error: 'Sandbox not found' }, { status: 404 });
		}

		const body = (await request.json()) as MetricsQuery & {
			format?: 'json' | 'csv' | 'prometheus';
			includeMetadata?: boolean;
		};

		const {
			startTime,
			endTime,
			interval = '5m',
			metrics = ['all'],
			format = 'json',
			includeMetadata = true
		} = body;

		// In a real implementation, this would:
		// 1. Query historical metrics from time-series database
		// 2. Format data according to requested format
		// 3. Generate downloadable file or stream response

		const exportData = {
			sandboxId,
			exportTime: new Date().toISOString(),
			query: { startTime, endTime, interval, metrics },
			format,
			data: {
				// This would contain the actual metrics data
				message: 'Metrics export would contain historical data points',
				sampleStructure: {
					timestamp: '2024-01-01T00:00:00Z',
					cpu: 45.2,
					memory: 512.8,
					storage: 1024.5,
					network: {
						bytesIn: 1000,
						bytesOut: 2000
					}
				}
			},
			metadata: includeMetadata
				? {
						session: {
							id: session.id,
							created: session.created_at,
							provider: session.provider,
							status: session.status
						}
					}
				: undefined
		};

		// Update session activity
		sessionService.updateLastActivity(session.id);

		// For CSV/Prometheus formats, you would set appropriate headers
		if (format === 'csv') {
			// return new Response(csvData, {
			//   headers: {
			//     'Content-Type': 'text/csv',
			//     'Content-Disposition': `attachment; filename="sandbox_${sandboxId}_metrics.csv"`
			//   }
			// });
		}

		return json({
			success: true,
			export: exportData,
			downloadUrl: `/api/sandbox/${sandboxId}/metrics/download/${Date.now()}`,
			message: 'Metrics export prepared. In production, this would generate a downloadable file.'
		});
	} catch (error) {
		console.error('Failed to export metrics:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to export metrics'
			},
			{ status: 500 }
		);
	}
};
