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

export class TelemetryService {
	private baseUrl: string;
	private apiKey: string;

	constructor() {
		this.baseUrl = HELICONE_BASE_URL;
		this.apiKey = HELICONE_API_KEY;
	}

	private async sendEvent(path: string, payload: any) {
		if (!this.apiKey) {
			console.debug('Telemetry disabled: no HELICONE_API_KEY');
			return;
		}

		try {
			const url = `${this.baseUrl.replace(/\/$/, '')}/v1/events`;
			await fetch(url, {
				method: 'POST',
				headers: safeHeaders(),
				body: JSON.stringify(payload)
			});
		} catch (err) {
			console.warn('Failed to send telemetry event:', err);
		}
	}

	async trackToolCallStart(callId: string, toolCall: any, context: any) {
		const payload = {
			type: 'tool_call.start',
			callId,
			tool: toolCall.name,
			parameters: toolCall.parameters,
			context,
			timestamp: new Date().toISOString()
		};
		await this.sendEvent('/v1/events', payload);
	}

	async trackToolCallEnd(
		callId: string,
		toolCall: any,
		context: any,
		result: any,
		durationMs: number
	) {
		const payload: any = {
			type: 'tool_call.end',
			callId,
			tool: toolCall.name,
			parameters: toolCall.parameters,
			context,
			result: {
				success: result?.success !== false,
				message: result?.message,
				error: result?.error
			},
			durationMs,
			timestamp: new Date().toISOString()
		};

		if (result?.usage) payload.usage = result.usage;

		await this.sendEvent('/v1/events', payload);
	}

	async trackQueueJobStart(jobId: string, meta: any) {
		await this.sendEvent('/v1/events', {
			type: 'queue.job.start',
			jobId,
			meta,
			timestamp: new Date().toISOString()
		});
	}

	async trackQueueJobProgress(jobId: string, progress: number) {
		await this.sendEvent('/v1/events', {
			type: 'queue.job.progress',
			jobId,
			progress,
			timestamp: new Date().toISOString()
		});
	}

	async trackQueueJobComplete(jobId: string, meta: any) {
		await this.sendEvent('/v1/events', {
			type: 'queue.job.complete',
			jobId,
			meta,
			timestamp: new Date().toISOString()
		});
	}

	async trackDocumentIndexed(
		jobId: string,
		docId: string,
		filePath: string,
		success: boolean,
		error?: string
	) {
		await this.sendEvent('/v1/events', {
			type: 'queue.document.index',
			jobId,
			docId,
			filePath,
			success,
			error,
			timestamp: new Date().toISOString()
		});
	}
}

export const telemetryService = new TelemetryService();
