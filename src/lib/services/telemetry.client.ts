class TelemetryServiceClient {
	// Client-side telemetry is a no-op to avoid leaking secrets in browser bundles
	private baseUrl = '';
	private apiKey = '';

	constructor() {}

	private async sendEvent(_path: string, _payload: any) {
		// No-op on client to avoid exposing secrets
		return;
	}

	async trackToolCallStart(_callId: string, _toolCall: any, _context: any) {
		// best-effort logging for local dev
		if (import.meta.env.DEV) console.debug('Telemetry (client) tool call start', _callId);
	}

	async trackToolCallEnd(
		_callId: string,
		_toolCall: any,
		_context: any,
		_result: any,
		_durationMs: number
	) {
		if (import.meta.env.DEV) console.debug('Telemetry (client) tool call end', _callId, _result);
	}

	async trackQueueJobStart(_jobId: string, _meta: any) {}
	async trackQueueJobProgress(_jobId: string, _progress: number) {}
	async trackQueueJobComplete(_jobId: string, _meta: any) {}
	async trackDocumentIndexed(
		_jobId: string,
		_docId: string,
		_filePath: string,
		_success: boolean,
		_error?: string
	) {}
}

export const telemetryService = new TelemetryServiceClient();
export { TelemetryServiceClient };
