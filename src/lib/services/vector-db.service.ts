import { env } from '$env/dynamic/private';
import { logger } from '$lib/utils/logger';
import { QdrantVectorStore } from '@langchain/community/vectorstores/qdrant';
import { Document } from '@langchain/core/documents';
import { OpenAIEmbeddings } from '@langchain/openai';
import { QdrantClient } from '@qdrant/js-client-rest';

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
	private vectorStore: QdrantVectorStore | null = null;
	private embeddings: OpenAIEmbeddings;
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

		this.embeddings = new OpenAIEmbeddings({
			openAIApiKey: env.OPENAI_API_KEY,
			model: 'text-embedding-3-small',
			dimensions: 1536
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
				(c: any) => c.name === this.COLLECTION_NAME
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

			this.vectorStore = new QdrantVectorStore(this.embeddings, {
				client: this.client,
				collectionName: this.COLLECTION_NAME
			});

			logger.info('✅ Vector database initialized successfully');
		} catch (error) {
			logger.error('❌ Failed to initialize vector database:', error);
			throw error;
		}
	}

	async indexCodebaseDocument(document: CodebaseDocument): Promise<void> {
		try {
			logger.info(`Starting to index document: ${document.id} (${document.filePath})`);

			if (!this.vectorStore) {
				logger.info('Vector store not initialized, initializing now...');
				await this.initialize();
			}

			if (!this.vectorStore) {
				throw new Error('Vector store initialization failed');
			}

			logger.debug(`Creating LangChain document for ${document.id}`);
			const langchainDoc = new Document({
				pageContent: document.content,
				metadata: {
					id: document.id,
					filePath: document.filePath,
					language: document.language,
					projectId: document.projectId,
					lastModified:
						document.lastModified instanceof Date
							? document.lastModified.toISOString()
							: new Date(document.lastModified).toISOString(),
					...document.metadata
				}
			});

			logger.debug(
				`Adding document ${document.id} to vector store (content length: ${document.content.length})`
			);
			await this.vectorStore.addDocuments([langchainDoc]);
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
		if (!this.vectorStore) {
			await this.initialize();
		}

		const { limit = 10, threshold = 0.7, fileType, language } = options;

		const results = await this.vectorStore!.similaritySearchWithScore(query, limit);

		return results
			.filter(([, score]) => score >= threshold)
			.map(([doc, score]) => ({
				document: {
					id: doc.metadata.id,
					filePath: doc.metadata.filePath,
					content: doc.pageContent,
					language: doc.metadata.language,
					projectId: doc.metadata.projectId,
					lastModified: new Date(doc.metadata.lastModified),
					metadata: {
						functions: doc.metadata.functions,
						classes: doc.metadata.classes,
						imports: doc.metadata.imports,
						exports: doc.metadata.exports,
						dependencies: doc.metadata.dependencies,
						framework: doc.metadata.framework,
						type: doc.metadata.type
					}
				} as CodebaseDocument,
				score
			}));
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
		if (!this.vectorStore) {
			await this.initialize();
		}

		await this.client.delete(this.COLLECTION_NAME, {
			points: [documentId]
		});
	}

	async updateDocument(document: CodebaseDocument): Promise<void> {
		// Delete existing and re-index
		await this.deleteDocument(document.id);
		await this.indexCodebaseDocument(document);
	}

	async getCollectionStats(): Promise<{
		totalDocuments: number;
		vectorDimensions: number;
		indexedProjects: string[];
	}> {
		try {
			logger.debug('Getting collection stats');
			if (!this.vectorStore) {
				await this.initialize();
			}

			const info = await this.client.getCollection(this.COLLECTION_NAME);
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
			const embedding = await this.embeddings.embedQuery(testText);
			logger.info(`Embeddings OK. Generated ${embedding.length} dimensions for test text`);

			// Initialize if needed
			if (!this.vectorStore) {
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
