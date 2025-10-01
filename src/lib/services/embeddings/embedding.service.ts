import { HeliconeConfigManager } from '$lib/config/helicone.config';

export class EmbeddingService {
	private heliConfig = HeliconeConfigManager.getInstance().getConfig();
	private baseUrl = this.heliConfig.baseUrl.replace(/\/+$/, '');
	private apiKey = this.heliConfig.apiKey;

	async embed(text: string, model = 'text-embedding-3-small'): Promise<number[]> {
		if (!text) return [];
		const url = `${this.baseUrl.replace(/\/v1$/, '')}/v1/embeddings`;
		try {
			const resp = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Helicone-Auth': `Bearer ${this.apiKey}`
				},
				body: JSON.stringify({ input: text, model })
			});
			if (!resp.ok) {
				const body = await resp.text();
				throw new Error(`Embedding request failed: ${resp.status} ${body}`);
			}
			const data = await resp.json();
			// Expect OpenAI-like response: { data: [{ embedding: [...] }] }
			const embedding = Array.isArray(data?.data) && data.data[0]?.embedding;
			if (!Array.isArray(embedding)) throw new Error('Invalid embedding response');
			return embedding as number[];
		} catch (err: any) {
			console.error('EmbeddingService.embed error:', err?.message || String(err));
			return [];
		}
	}
}
