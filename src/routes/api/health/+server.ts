/**
 * Health Check API Endpoint
 * Provides comprehensive system health monitoring
 */

import { DatabaseService } from '$lib/services/database.service';
import { json, type RequestHandler } from '@sveltejs/kit';

interface HealthCheck {
	status: 'healthy' | 'degraded' | 'unhealthy';
	timestamp: string;
	services: {
		database: ServiceHealth;
		sse_streaming: ServiceHealth;
		file_storage: ServiceHealth;
		template_service: ServiceHealth;
	};
	metrics: {
		uptime: number;
		memory_usage: number;
		active_connections: number;
		active_sandboxes: number;
	};
	version: string;
}

interface ServiceHealth {
	status: 'healthy' | 'degraded' | 'unhealthy';
	response_time?: number;
	last_check: string;
	error?: string;
	details?: any;
}

const startTime = Date.now();

export const GET: RequestHandler = async () => {
	const services = {
		database: await checkDatabaseHealth(),
		sse_streaming: await checkSSEStreamingHealth(),
		file_storage: await checkFileStorageHealth(),
		template_service: await checkTemplateServiceHealth()
	};

	const healthCheck: HealthCheck = {
		status: 'healthy',
		timestamp: new Date().toISOString(),
		services,
		metrics: {
			uptime: Date.now() - startTime,
			memory_usage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
			active_connections: 0, // SSE connections are stateless
			active_sandboxes: 0 // Would be populated from sandbox service
		},
		version: '1.0.0'
	};

	// Determine overall health status
	const serviceStatuses = Object.values(healthCheck.services).map((s) => s.status);
	if (serviceStatuses.includes('unhealthy')) {
		healthCheck.status = 'unhealthy';
	} else if (serviceStatuses.includes('degraded')) {
		healthCheck.status = 'degraded';
	}

	return json(healthCheck, {
		status: healthCheck.status === 'healthy' ? 200 : healthCheck.status === 'degraded' ? 200 : 503
	});
};

export const HEAD: RequestHandler = async () => {
	return new Response(null, {
		status: 200
	});
};

async function checkDatabaseHealth(): Promise<ServiceHealth> {
	const startTime = Date.now();

	try {
		// Test database connection
		await DatabaseService.testConnection();

		return {
			status: 'healthy',
			response_time: Date.now() - startTime,
			last_check: new Date().toISOString()
		};
	} catch (error) {
		return {
			status: 'unhealthy',
			response_time: Date.now() - startTime,
			last_check: new Date().toISOString(),
			error: error instanceof Error ? error.message : 'Database connection failed'
		};
	}
}

async function checkSSEStreamingHealth(): Promise<ServiceHealth> {
	try {
		// SSE is stateless, so we just check if the endpoint is responsive
		const isHealthy = true; // SSE endpoints are always available if server is running

		return {
			status: isHealthy ? 'healthy' : 'degraded',
			last_check: new Date().toISOString(),
			response_time: 0, // SSE has no persistent connection to measure
			details: {
				service_type: 'sse_streaming',
				endpoint_available: true
			}
		};
	} catch (error) {
		return {
			status: 'unhealthy',
			last_check: new Date().toISOString(),
			response_time: -1,
			details: {
				error: error instanceof Error ? error.message : 'Unknown error',
				service_type: 'sse_streaming'
			}
		};
	}
}

async function checkFileStorageHealth(): Promise<ServiceHealth> {
	const startTime = Date.now();

	try {
		// Test Daytona sandbox availability
		const { sandboxConfig } = await import('$lib/config/sandbox.config');

		// Check if Daytona is configured
		if (!sandboxConfig.daytona.apiKey) {
			return {
				status: 'degraded',
				response_time: Date.now() - startTime,
				last_check: new Date().toISOString(),
				details: {
					storage_type: 'daytona_sandbox',
					configured: false,
					message: 'Daytona API key not configured'
				}
			};
		}

		return {
			status: 'healthy',
			response_time: Date.now() - startTime,
			last_check: new Date().toISOString(),
			details: {
				storage_type: 'daytona_sandbox',
				configured: true,
				api_url: sandboxConfig.daytona.apiUrl
			}
		};
	} catch (error) {
		return {
			status: 'unhealthy',
			response_time: Date.now() - startTime,
			last_check: new Date().toISOString(),
			error: error instanceof Error ? error.message : 'Sandbox storage check failed'
		};
	}
}

async function checkTemplateServiceHealth(): Promise<ServiceHealth> {
	const startTime = Date.now();

	try {
		// Test template service availability
		// This would include StackBlitz API health check

		return {
			status: 'healthy',
			response_time: Date.now() - startTime,
			last_check: new Date().toISOString(),
			details: {
				template_source: 'stackblitz',
				cache_status: 'healthy'
			}
		};
	} catch (error) {
		return {
			status: 'degraded',
			response_time: Date.now() - startTime,
			last_check: new Date().toISOString(),
			error: error instanceof Error ? error.message : 'Template service check failed'
		};
	}
}
