/**
 * Proxy Management API
 * Manages the Daytona preview proxy server for secure iframe embedding
 *
 * The proxy now uses dynamic token fetching from the Daytona API,
 * so no need to pre-configure targets. Just use the proxy URL directly:
 * http://localhost:8080?sandboxId=xxx&port=3000
 */

import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const PROXY_URL = env.PROXY_SERVER_URL || 'http://localhost:8080';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { action } = body;

		if (!action) {
			return json({ error: 'Action is required' }, { status: 400 });
		}

		switch (action) {
			case 'health': {
				const response = await fetch(`${PROXY_URL}/health`);
				if (!response.ok) {
					throw new Error(`Proxy server responded with ${response.status}`);
				}

				const result = await response.json();
				return json(result);
			}

			case 'clear-cache': {
				const response = await fetch(`${PROXY_URL}/clear-cache`, {
					method: 'POST'
				});
				if (!response.ok) {
					throw new Error(`Proxy server responded with ${response.status}`);
				}

				const result = await response.json();
				return json(result);
			}

			case 'get-cache': {
				const response = await fetch(`${PROXY_URL}/cache`);
				if (!response.ok) {
					throw new Error(`Proxy server responded with ${response.status}`);
				}

				const result = await response.json();
				return json(result);
			}

			default:
				return json({ error: `Unknown action: ${action}` }, { status: 400 });
		}
	} catch (error) {
		console.error('❌ Proxy API error:', error);
		return json(
			{
				error: 'Proxy API Error',
				message: error instanceof Error ? error.message : 'Unknown error',
				details: 'Make sure the proxy server is running'
			},
			{ status: 500 }
		);
	}
};

export const GET: RequestHandler = async () => {
	try {
		// Health check
		const response = await fetch(`${PROXY_URL}/health`);
		if (!response.ok) {
			throw new Error(`Proxy server is not responding`);
		}

		const result = await response.json();
		return json({
			...result,
			proxyUrl: PROXY_URL
		});
	} catch (error) {
		return json(
			{
				status: 'error',
				message: error instanceof Error ? error.message : 'Proxy server not available',
				proxyUrl: PROXY_URL
			},
			{ status: 503 }
		);
	}
};
