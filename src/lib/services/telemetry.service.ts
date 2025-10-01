import { env } from '$env/dynamic/private';

const HELICONE_API_KEY = env.HELICONE_API_KEY || env.HELICONE_KEY || '';
const HELICONE_BASE_URL =
	env.HELICONE_BASE_URL || env.HELICONE_OPENAI_BASE_URL || 'https://api.helicone.ai';

function safeHeaders() {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json'
	};
	if (HELICONE_API_KEY) headers['Helicone-Auth'] = `Bearer ${HELICONE_API_KEY}`;
	return headers;
}

// Client-safe telemetry re-export (server code should import telemetry.server when secrets are needed)
export { telemetryService } from './telemetry.client';
export type { TelemetryServiceClient as TelemetryService } from './telemetry.client';
