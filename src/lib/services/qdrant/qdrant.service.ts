import { env } from '$env/dynamic/private';

export interface CodeContext {
	id: string;
	fileName: string;
	filePath: string;
	content: string;
	language: string;
	lastModified: string;
	metadata?: Record<string, any>;
}

export class QdrantService {
	private client: any | null = null;
	private collectionName = 'coding_agent_context';

	constructor(
		private url?: string,
		private apiKey?: string
	) {
		this.url = this.url || env.QDRANT_URL || undefined;
		this.apiKey = this.apiKey || env.QDRANT_API_KEY || undefined;
	}

	async initialize(): Promise<void> {
		if (!this.url) {
			console.warn('Qdrant URL not configured, skipping Qdrant initialization');
			return;
		}

		try {
			// Dynamically import client to avoid forcing dependency on all consumers
			const mod = await import('@qdrant/js-client-rest');
			const { QdrantClient } = mod as any;
			this.client = new QdrantClient({
				host: this.url.replace(/^https?:\/\//, ''),
				apiKey: this.apiKey
			});

			// Ensure collection exists (best-effort)
			try {
				const collections = await this.client.getCollections();
				const exists = (collections.collections || []).some(
					(c: any) => c.name === this.collectionName
				);
				if (!exists) {
					await this.client.createCollection(this.collectionName, {
						vectors: { size: 1536, distance: 'Cosine' }
					});
				}
			} catch (err: unknown) {
				console.warn(
					'Qdrant collection check failed:',
					err instanceof Error ? err.message : String(err)
				);
			}
		} catch (err: unknown) {
			console.warn(
				'Failed to initialize Qdrant client - is @qdrant/js-client-rest installed?',
				err instanceof Error ? err.message : String(err)
			);
			this.client = null;
		}
	}

	async storeContext(context: CodeContext, embedding: number[]) {
		if (!this.client) return;
		const id = context.id;
		try {
			await this.client.upsert(this.collectionName, {
				wait: true,
				points: [
					{
						id,
						vector: embedding,
						payload: {
							fileName: context.fileName,
							filePath: context.filePath,
							content: context.content,
							language: context.language,
							lastModified: context.lastModified,
							...(context.metadata || {})
						}
					}
				]
			});
		} catch (err: unknown) {
			console.error(
				'Failed to store context in Qdrant:',
				err instanceof Error ? err.message : String(err)
			);
		}
	}

	async searchContext(queryEmbedding: number[], limit: number = 5) {
		if (!this.client) return [];
		try {
			const res = await this.client.search(this.collectionName, {
				vector: queryEmbedding,
				limit,
				with_payload: true
			});
			return res.map((r: any) => ({ id: r.id, score: r.score, payload: r.payload }));
		} catch (err: unknown) {
			console.error('Qdrant search failed:', err instanceof Error ? err.message : String(err));
			return [];
		}
	}
}
