/**
 * Daytona Preview Proxy Server
 * Proxies requests to Daytona preview URLs with dynamic authentication token injection
 * Based on: https://github.com/daytonaio/daytona-proxy-samples/blob/main/typescript/index.ts
 *
 * This implementation:
 * - Dynamically fetches preview URLs and tokens using Daytona API
 * - Injects authentication headers for each request
 * - Bypasses CORS and iframe restrictions for browser preview mode
 */

import { Configuration, SandboxApi } from '@daytonaio/api-client';
import { config } from 'dotenv';
import http from 'http';
import httpProxy from 'http-proxy';
import { parse } from 'url';

// Load environment variables
config({ quiet: true });

// Environment variables
const PORT = process.env.PROXY_PORT || 8080;
const DAYTONA_API_KEY = process.env.DAYTONA_API_KEY;
const DAYTONA_API_URL = process.env.DAYTONA_API_URL || 'https://app.daytona.io/api';

if (!DAYTONA_API_KEY) {
	console.error('❌ DAYTONA_API_KEY is not set');
	process.exit(1);
}

if (!DAYTONA_API_URL) {
	console.error('❌ DAYTONA_API_URL is not set');
	process.exit(1);
}

// Initialize Daytona API client
const sandboxApi = new SandboxApi(
	new Configuration({
		basePath: DAYTONA_API_URL,
		baseOptions: {
			headers: {
				Authorization: `Bearer ${DAYTONA_API_KEY}`
			}
		}
	})
);

// Create proxy server instance
const proxy = httpProxy.createProxyServer({
	changeOrigin: true,
	secure: false, // Allow self-signed certificates in development
	ws: true, // Enable WebSocket proxying
	timeout: 30000, // 30 second timeout
	proxyTimeout: 30000
});

// Cache for preview URLs and tokens (sandboxId:port -> { url, token, timestamp })
const previewCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Parse sandboxId and port from URL
 * Supports formats:
 * - Path-based: /:sandboxId/:port/path/to/resource
 * - Query params: /path?sandboxId=abc&port=3000
 * - Subdomain: abc-3000.proxy.domain.com/path
 */
function getSandboxIdAndPortFromUrl(url, host) {
	const parsedUrl = parse(url || '', true);
	const pathname = parsedUrl.pathname || '/';

	// Try path-based format first: /:sandboxId/:port/*
	const pathMatch = pathname.match(/^\/([^\/]+)\/(\d+)(\/.*)?$/);
	if (pathMatch) {
		return {
			sandboxId: pathMatch[1],
			port: parseInt(pathMatch[2]),
			path: pathMatch[3] || '/'
		};
	}

	// Try query parameters
	const sandboxId = parsedUrl.query.sandboxId || parsedUrl.query.sandbox;
	const port = parsedUrl.query.port ? parseInt(parsedUrl.query.port) : null;

	if (sandboxId && port) {
		return { sandboxId, port, path: pathname };
	}

	// Try subdomain format (e.g., abc-3000.proxy.domain.com)
	if (host) {
		const match = host.match(/^([^-]+)-(\d+)\./);
		if (match) {
			return {
				sandboxId: match[1],
				port: parseInt(match[2]),
				path: pathname
			};
		}
	}

	throw new Error('Invalid URL format. Use /:sandboxId/:port/path or ?sandboxId=xxx&port=yyy');
}

/**
 * Get preview URL and token from Daytona API
 * Implements caching to avoid excessive API calls
 */
async function getPortPreviewUrl(sandboxId, port) {
	const cacheKey = `${sandboxId}:${port}`;
	const cached = previewCache.get(cacheKey);

	// Return cached value if still valid
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		console.log(`📦 Using cached preview URL for ${cacheKey}`);
		return { url: cached.url, token: cached.token };
	}

	// Fetch fresh preview URL and token from Daytona API using API client
	try {
		console.log(`🔍 Fetching preview URL for sandbox ${sandboxId}, port ${port}`);

		// Use the Daytona API client to get preview URL
		const response = await sandboxApi.getPortPreviewUrl(sandboxId, port);

		if (!response.data || !response.data.url) {
			throw new Error('No preview URL in Daytona API response');
		}

		// Cache the result
		previewCache.set(cacheKey, {
			url: response.data.url,
			token: response.data.token || null,
			timestamp: Date.now()
		});

		console.log(`✅ Fetched preview URL for ${cacheKey}: ${response.data.url}`);
		return { url: response.data.url, token: response.data.token || null };
	} catch (error) {
		const errorMessage = error?.response?.data?.message || error?.message || String(error);
		console.error(`❌ Failed to fetch preview URL for ${cacheKey}:`, errorMessage);
		throw new Error(`Failed to get preview URL: ${errorMessage}`);
	}
}

// Error handling
proxy.on('error', (err, req, res) => {
	console.error('❌ Proxy error:', err.message);
	// @ts-ignore
	const reqErr = req._err;
	if (reqErr) {
		console.error('   Request error:', reqErr.message || String(reqErr));
	}

	if (res.writeHead) {
		res.writeHead(500, {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*'
		});
		res.end(
			JSON.stringify({
				error: 'Proxy Error',
				message: err.message,
				code: err.code,
				details: reqErr ? reqErr.message || String(reqErr) : undefined
			})
		);
	}
});

// Successful proxy response
proxy.on('proxyRes', (proxyRes, req, res) => {
	// Add CORS headers to allow iframe embedding
	proxyRes.headers['Access-Control-Allow-Origin'] = '*';
	proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
	proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';

	// Remove restrictive headers that prevent iframe embedding
	delete proxyRes.headers['x-frame-options'];
	delete proxyRes.headers['content-security-policy'];

	console.log(`✅ Proxied: ${req.method} ${req.url} -> ${proxyRes.statusCode}`);
});

// Create HTTP server
const server = http.createServer((req, res) => {
	const parsedUrl = parse(req.url || '', true);
	const pathname = parsedUrl.pathname || '/';

	// CORS preflight
	if (req.method === 'OPTIONS') {
		res.writeHead(200, {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Daytona-Token, X-Project-Id'
		});
		res.end();
		return;
	}

	// Health check endpoint
	if (pathname === '/health') {
		res.writeHead(200, { 'Content-Type': 'application/json' });
		res.end(
			JSON.stringify({
				status: 'ok',
				uptime: process.uptime(),
				cachedPreviews: previewCache.size
			})
		);
		return;
	}

	// Clear cache endpoint
	if (pathname === '/clear-cache' && req.method === 'POST') {
		const size = previewCache.size;
		previewCache.clear();
		res.writeHead(200, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify({ success: true, clearedEntries: size }));
		console.log(`�️  Cleared ${size} cached preview URLs`);
		return;
	}

	// Get cache status endpoint
	if (pathname === '/cache' && req.method === 'GET') {
		const cacheEntries = Array.from(previewCache.entries()).map(([key, value]) => ({
			key,
			url: value.url,
			hasToken: !!value.token,
			age: Math.round((Date.now() - value.timestamp) / 1000)
		}));
		res.writeHead(200, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify({ entries: cacheEntries, size: previewCache.size }));
		return;
	}

	// Proxy requests - dynamically fetch preview URL and token
	(async () => {
		try {
			// Parse sandboxId, port, and path from request
			const { sandboxId, port, path } = getSandboxIdAndPortFromUrl(req.url, req.headers.host);

			console.log(`🔄 Proxy request for sandbox ${sandboxId}, port ${port}, path ${path}`);

			// Get preview URL and token from Daytona API
			const { url: targetUrl, token } = await getPortPreviewUrl(sandboxId, port);

			// Store the token for use in proxyReq handler
			// @ts-ignore - adding custom property to request
			req._authToken = token;
			// @ts-ignore - store target URL
			req._targetUrl = targetUrl;

			// Inject Daytona authentication headers if token is available
			if (token) {
				req.headers['x-daytona-preview-token'] = token;
				req.headers['x-daytona-skip-preview-warning'] = 'true';
				req.headers['x-daytona-disable-cors'] = 'true';
				console.log(`🔑 Injected Daytona auth token for ${sandboxId}:${port}`);
			} else {
				console.warn(`⚠️  No token available for ${sandboxId}:${port}`);
			}

			// Rewrite the request URL to include only the path
			req.url = path;

			// Remove problematic headers
			delete req.headers.host;

			// Proxy the request to the target URL
			console.log(`➡️  Proxying: ${req.method} ${path} -> ${targetUrl}${path}`);
			proxy.web(req, res, {
				target: targetUrl,
				changeOrigin: true
			});
		} catch (error) {
			console.error('❌ Error handling proxy request:', error.message);
			// @ts-ignore - store error for use in error handler
			req._err = error;

			res.writeHead(500, {
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': '*'
			});
			res.end(
				JSON.stringify({
					error: 'Proxy Configuration Error',
					message: error.message,
					hint: 'Ensure sandboxId and port are provided as query parameters'
				})
			);
		}
	})();
});

// WebSocket support
server.on('upgrade', async (req, socket, head) => {
	try {
		// Parse sandboxId, port, and path from request
		const { sandboxId, port, path } = getSandboxIdAndPortFromUrl(req.url, req.headers.host);

		console.log(`🔌 WebSocket upgrade for sandbox ${sandboxId}, port ${port}, path ${path}`);

		// Get preview URL and token from Daytona API
		const { url: targetUrl, token } = await getPortPreviewUrl(sandboxId, port);

		// Inject Daytona headers for WebSocket connections
		if (token) {
			req.headers['x-daytona-preview-token'] = token;
			req.headers['x-daytona-skip-preview-warning'] = 'true';
			req.headers['x-daytona-disable-cors'] = 'true';
			console.log(`🔑 Injected Daytona auth token for WebSocket ${sandboxId}:${port}`);
		}

		// Rewrite the request URL to include only the path
		req.url = path;

		// Remove problematic headers
		delete req.headers.host;

		console.log(`➡️  WebSocket proxying to: ${targetUrl}${path}`);
		proxy.ws(req, socket, head, {
			target: targetUrl,
			changeOrigin: true
		});
	} catch (error) {
		console.error('❌ WebSocket upgrade error:', error.message);
		socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
		socket.destroy();
	}
});

// Graceful shutdown
process.on('SIGTERM', () => {
	console.log('🛑 SIGTERM received, shutting down gracefully...');
	server.close(() => {
		console.log('✅ Server closed');
		process.exit(0);
	});
});

process.on('SIGINT', () => {
	console.log('\n🛑 SIGINT received, shutting down gracefully...');
	server.close(() => {
		console.log('✅ Server closed');
		process.exit(0);
	});
});

// Start server
server.listen(PORT, () => {
	console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║      🚀 Daytona Preview Proxy Server (Dynamic)            ║
║                                                            ║
║  Listening on: http://localhost:${PORT}                      ║
║  Health check: http://localhost:${PORT}/health              ║
║                                                            ║
║  Usage:                                                    ║
║  http://localhost:${PORT}?sandboxId=xxx&port=3000            ║
║                                                            ║
║  Endpoints:                                                ║
║  - GET  /health       Health check                        ║
║  - GET  /cache        View cached preview URLs            ║
║  - POST /clear-cache  Clear preview URL cache             ║
║                                                            ║
║  Features:                                                 ║
║  ✓ Dynamic token fetching from Daytona API               ║
║  ✓ Automatic authentication header injection              ║
║  ✓ Preview URL caching (${CACHE_TTL / 1000}s TTL)                   ║
║  ✓ WebSocket support                                       ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
	`);
});

export default server;
