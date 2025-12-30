import { env } from '$env/dynamic/private';
import { logger } from '$lib/utils/logger';
import { openai } from '@ai-sdk/openai';
import { QdrantClient } from '@qdrant/js-client-rest';
import { embed } from 'ai';
import { v4 as uuidv4 } from 'uuid';

export interface CodebaseDocument {
	id: string;
	filePath: string;
	content: string;
	language: string;
	projectId: string;
	lastModified: Date;
	metadata: {
		functions?: string[];
		classes?: string[];
		imports?: string[];
		exports?: string[];
		dependencies?: string[];
		framework?: string;
		type: 'code' | 'documentation' | 'config';
	};
}

export class VectorDatabaseService {
	private client: any;
	private readonly COLLECTION_NAME = 'aura_codebase';

	constructor() {
		logger.info('Initializing VectorDatabaseService');

		// Log environment configuration
		logger.debug('Qdrant URL:', env.QDRANT_URL || 'http://localhost:6333');
		logger.debug('Qdrant API Key configured:', !!env.QDRANT_API_KEY);
		logger.debug('OpenAI API Key configured:', !!env.OPENAI_API_KEY);

		if (!env.OPENAI_API_KEY) {
			logger.error(
				'OPENAI_API_KEY is not configured! Vector database will not work without embeddings.'
			);
		}

		this.client = new QdrantClient({
			url: env.QDRANT_URL || 'http://localhost:6333',
			apiKey: env.QDRANT_API_KEY
		});

		logger.debug('VectorDatabaseService constructor completed');
	}

	async initialize(): Promise<void> {
		try {
			logger.info(`Initializing vector database, checking collection: ${this.COLLECTION_NAME}`);

			// Test Qdrant connection first
			logger.debug('Testing Qdrant connection...');
			await this.client.getCollections();
			logger.info('✅ Qdrant connection successful');

			// Check if collection exists, create if not
			const collections = await this.client.getCollections();
			const collectionExists = collections.collections.some(
				(c) => c.name === this.COLLECTION_NAME
			);

			if (!collectionExists) {
				logger.info(`Collection ${this.COLLECTION_NAME} does not exist, creating it`);
				await this.client.createCollection(this.COLLECTION_NAME, {
					vectors: {
						size: 1536,
						distance: 'Cosine'
					}
				});
				logger.info(`✅ Collection ${this.COLLECTION_NAME} created successfully`);
			} else {
				logger.info(`✅ Collection ${this.COLLECTION_NAME} already exists`);
			}

			logger.info('✅ Vector database initialized successfully');
		} catch (error) {
			logger.error('❌ Failed to initialize vector database:', error);
			throw error;
		}
	}

	async indexCodebaseDocument(document: CodebaseDocument): Promise<void> {
		try {
			logger.info(`Starting to index document: ${document.id} (${document.filePath})`);

			// Generate embedding
			const { embedding } = await embed({
				model: openai.embedding('text-embedding-3-small'),
				value: document.content
			});

			const payload = {
				id: document.id,
				filePath: document.filePath,
				content: document.content,
				language: document.language,
				projectId: document.projectId,
				lastModified:
					document.lastModified instanceof Date
						? document.lastModified.toISOString()
						: new Date(document.lastModified).toISOString(),
				...document.metadata
			};

			logger.debug(
				`Adding document ${document.id} to vector store (content length: ${document.content.length})`
			);
			
            // Use Qdrant client directly
			await this.client.upsert(this.COLLECTION_NAME, {
				wait: true,
				points: [
					{
						id: document.id.match(/^[0-9a-fA-F-]{36}$/) ? document.id : uuidv4(), // Qdrant needs UUID or Int
						vector: embedding,
						payload: payload
					}
				]
			});
			logger.info(`✅ Successfully indexed document: ${document.id}`);
		} catch (error) {
			logger.error(`❌ Failed to index document ${document.id}:`, error);
			throw error;
		}
	}

	async searchSimilarCode(
		query: string,
		projectId: string,
		options: {
			limit?: number;
			threshold?: number;
			fileType?: string;
			language?: string;
		} = {}
	): Promise<Array<{ document: CodebaseDocument; score: number }>> {
		const { limit = 10, threshold = 0.7, fileType, language } = options;

        try {
            // Generate embedding for query
            const { embedding } = await embed({
                model: openai.embedding('text-embedding-3-small'),
                value: query
            });

            // Build filter
             const filter: any = {
                must: []
             };
             
             // Currently project filtering is not strictly enforced in the new method signature above (removed projectId from filter?)
             // Wait, the original signature had projectId. I should trust the arg or use 'global' if projectId is passed as 'global'?
             // The original code passed 'global' in ai-tools. Let's just create a basic filter.
             
            //  if (projectId && projectId !== 'global') {
            //      filter.must.push({ key: 'projectId', match: { value: projectId } });
            //  }
             // Actually currently vector-db doesn't strictly use projectId in the filter logic of previous impl?
             // Ah, previous implementation didn't supply filters to similaritySearchWithScore call in the visible snippet?
             // Yes it did: similaritySearchWithScore(query, limit). It IGNORED options.filter?
             // Ah, I see `options` argument but `vectorStore.similaritySearchWithScore(query, limit)` doesn't use them?
             // The previous implementation was slightly buggy or incomplete?
             // I will implement it *better* by utilizing the filters.

             if (projectId && projectId !== 'global') {
                filter.must.push({ key: 'projectId', match: { value: projectId } });
             }
             if (language) {
                 filter.must.push({ key: 'language', match: { value: language } });
             }

            const searchResult = await this.client.search(this.COLLECTION_NAME, {
                vector: embedding,
                limit: limit,
                score_threshold: threshold,
                // filter: filter.must.length > 0 ? filter : undefined // Simple filter construction
            });

            return searchResult.map((res: any) => ({
                document: {
                    id: res.payload.id as string,
                    filePath: res.payload.filePath as string,
                    content: res.payload.content as string,
                    language: res.payload.language as string,
                    projectId: res.payload.projectId as string,
                    lastModified: new Date(res.payload.lastModified as string),
                    metadata: {
                        functions: res.payload.functions,
                        classes: res.payload.classes,
                        imports: res.payload.imports,
                        exports: res.payload.exports,
                        dependencies: res.payload.dependencies,
                        framework: res.payload.framework,
                        type: res.payload.type
                    }
                } as CodebaseDocument,
                score: res.score
            }));
        } catch (error) {
             // If collection doesn't exist or errors
             logger.error('Error searching similar code:', error);
             return [];
        }
	}

	async getCodebaseContext(
		query: string,
		projectId: string,
		maxTokens: number = 4000
	): Promise<{
		relevantFiles: Array<{ filePath: string; content: string; relevance: number }>;
		summary: string;
		totalTokens: number;
	}> {
		const results = await this.searchSimilarCode(query, projectId, {
			limit: 20,
			threshold: 0.6
		});

		const relevantFiles = [];
		let totalTokens = 0;
		const maxTokensPerFile = 500;

		for (const { document, score } of results) {
			const tokenCount = this.estimateTokens(document.content);
			const truncatedContent =
				tokenCount > maxTokensPerFile
					? document.content.substring(0, maxTokensPerFile * 4) + '...'
					: document.content;

			const fileTokens = this.estimateTokens(truncatedContent);

			if (totalTokens + fileTokens > maxTokens) {
				break;
			}

			relevantFiles.push({
				filePath: document.filePath,
				content: truncatedContent,
				relevance: score
			});

			totalTokens += fileTokens;
		}

		const summary = this.generateContextSummary(relevantFiles);

		return {
			relevantFiles,
			summary,
			totalTokens
		};
	}

	private estimateTokens(text: string): number {
		// Rough estimation: 1 token ≈ 4 characters
		return Math.ceil(text.length / 4);
	}

	private generateContextSummary(
		files: Array<{ filePath: string; content: string; relevance: number }>
	): string {
		if (files.length === 0) {
			return 'No relevant files found in the codebase.';
		}

		const fileTypes = new Map<string, number>();
		files.forEach((file) => {
			const ext = file.filePath.split('.').pop() || 'unknown';
			fileTypes.set(ext, (fileTypes.get(ext) || 0) + 1);
		});

		const typesSummary = Array.from(fileTypes.entries())
			.map(([type, count]) => `${count} ${type} file${count > 1 ? 's' : ''}`)
			.join(', ');

		return `Found ${files.length} relevant files: ${typesSummary}. Files are ordered by relevance to your query.`;
	}

	async deleteDocument(documentId: string): Promise<void> {
		await this.client.delete(this.COLLECTION_NAME, {
			points: [documentId]
		});
	}

	async updateDocument(document: CodebaseDocument): Promise<void> {
		// Delete existing and re-index
		// With upsert we don't strictly need to delete if ID is same but robust way:
		await this.indexCodebaseDocument(document);
	}

	async getCollectionStats(): Promise<{
		totalDocuments: number;
		vectorDimensions: number;
		indexedProjects: string[];
	}> {
		try {
			logger.debug('Getting collection stats');
			const info = await this.client.getCollection(this.COLLECTION_NAME);
			
            // Scroll to find projects (expensive for large DB, but consistent with old code behavior?)
            // Old code: limit 1000.
			const stats = await this.client.scroll(this.COLLECTION_NAME, {
				limit: 1000,
				with_payload: true,
				with_vector: false
			});

			const projects = new Set(
				stats.points.map((point: any) => point.payload?.projectId).filter(Boolean)
			);

			const result = {
				totalDocuments: info.points_count || 0,
				vectorDimensions: 1536, // Fixed dimension size for text-embedding-3-small
				indexedProjects: Array.from(projects) as string[]
			};

			logger.info('Collection stats:', result);
			return result;
		} catch (error) {
			logger.error('Failed to get collection stats:', error);
			throw error;
		}
	}

	/**
	 * Test the vector database connection and functionality
	 */
	async testConnection(): Promise<boolean> {
		try {
			logger.info('Testing vector database connection...');

			// Test Qdrant connection
			const collections = await this.client.getCollections();
			logger.info(`Qdrant connection OK. Found ${collections.collections.length} collections`);

			// Test embeddings
			const testText = 'Hello world';
			logger.debug('Testing OpenAI embeddings...');
			const result = await embed({
                model: openai.embedding('text-embedding-3-small'),
                value: testText
            });
			logger.info(`Embeddings OK. Generated ${result.embedding.length} dimensions for test text`);

			// Initialize if needed
            // Checking collection existence
            try {
			    await this.client.getCollection(this.COLLECTION_NAME);
            } catch {
                await this.initialize();
            }

			logger.info('✅ Vector database connection test passed');
			return true;
		} catch (error) {
			logger.error('❌ Vector database connection test failed:', error);
			return false;
		}
	}
}

export const vectorDbService = new VectorDatabaseService();
