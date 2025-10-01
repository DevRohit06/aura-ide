import { env } from '$env/dynamic/private';
import { telemetryService } from '$lib/services/telemetry.server';
import { logger } from '$lib/utils/logger';
import type { Job, Queue as QueueType, Worker as WorkerType } from 'bullmq';
import type { RedisOptions } from 'ioredis';
import { vectorDbService, type CodebaseDocument } from './vector-db.service';

const connection = { url: env.REDIS_URL || 'redis://localhost:6379' } as RedisOptions;
const QUEUE_NAME = env.VECTOR_INDEX_QUEUE_NAME || 'vector-index-queue';

/**
 * Data structure for indexing job payloads
 */
export interface IndexJobData {
	documents: Array<CodebaseDocument>;
	requestedBy?: string;
}

/**
 * Service for managing asynchronous document indexing using BullMQ.
 * Handles queue operations, worker processing, and telemetry tracking.
 */
export class IndexingQueueService {
	private queue: QueueType<IndexJobData> | null = null;
	private worker: WorkerType | null = null;
	private _initialized = false;
	private _initializing: Promise<void> | null = null;
	private bullMQModule: any = null;

	constructor() {
		// Lazy initialization on first use
	}

	private async ensureInitialized() {
		if (this._initialized) return;
		if (this._initializing) return this._initializing;

		this._initializing = (async () => {
			try {
				logger.info('Initializing BullMQ for indexing queue service');
				// Dynamic import with proper error handling
				this.bullMQModule = await import('bullmq');
				const BullMQModule = this.bullMQModule.default || this.bullMQModule;

				// Handle various module export patterns (ESM/CJS/default)
				const { Queue, Worker } = BullMQModule;

				// Validate Queue constructor
				if (typeof Queue !== 'function') {
					throw new Error(
						`BullMQ Queue constructor not found. Available exports: ${Object.keys(BullMQModule).join(', ')}`
					);
				}

				// Validate Worker constructor
				if (typeof Worker !== 'function') {
					throw new Error(
						`BullMQ Worker constructor not found. Available exports: ${Object.keys(BullMQModule).join(', ')}`
					);
				}

				// Initialize Queue with built-in scheduler functionality (BullMQ v3+)
				this.queue = new (Queue as any)(QUEUE_NAME, { connection });
				logger.info(`BullMQ queue initialized: ${QUEUE_NAME}`);

				this._initialized = true;
			} catch (err) {
				logger.error('Failed to initialize BullMQ:', err);
				throw err;
			}
		})();

		return this._initializing;
	}

	/**
	 * Starts the worker to process indexing jobs from the queue.
	 * Initializes the worker with concurrency and retry settings.
	 */
	async startWorker() {
		if (this.worker) {
			logger.debug('Worker already running, skipping start');
			return;
		}

		logger.info('Starting indexing worker');
		await this.ensureInitialized();

		// Get Worker constructor from cached module
		const { Worker } = this.bullMQModule.default || this.bullMQModule;

		this.worker = new (Worker as any)(
			QUEUE_NAME,
			async (job: Job<IndexJobData>) => {
				try {
					const jobId = job.id!;
					logger.info(
						`🔄 Processing indexing job ${jobId} with ${job.data.documents.length} documents`
					);
					logger.debug('Job data:', JSON.stringify(job.data, null, 2));

					// Track job start
					try {
						await telemetryService.trackQueueJobStart(jobId, {
							requestedBy: job.data.requestedBy,
							count: job.data.documents.length
						});
					} catch (telemetryError) {
						logger.warn('Telemetry tracking failed for job start:', telemetryError);
					}

					const { documents = [] } = job.data;

					if (!documents.length) {
						logger.warn(`⚠️ Job ${jobId} has no documents to index`);
						return { indexed: 0 };
					}

					let indexed = 0;
					const totalDocs = documents.length;
					logger.info(`📋 Starting to process ${totalDocs} documents in job ${jobId}`);

					// Process documents with progress tracking
					for (let i = 0; i < totalDocs; i++) {
						const doc = documents[i];
						logger.debug(`📄 Processing document ${i + 1}/${totalDocs}:`, {
							id: doc.id,
							filePath: doc.filePath,
							contentLength: doc.content?.length || 0
						});

						try {
							logger.debug(`🚀 Indexing document ${doc.id} (${doc.filePath})`);
							const start = Date.now();
							await vectorDbService.indexCodebaseDocument(doc);
							indexed++;

							const duration = Date.now() - start;
							const progress = Math.round(((i + 1) / totalDocs) * 100);

							logger.info(
								`✅ Successfully indexed ${doc.id} in ${duration}ms (${progress}% complete)`
							);

							// Update job progress
							try {
								await job.updateProgress(progress);
							} catch (progressError) {
								logger.warn('Failed to update job progress:', progressError);
							}

							// Track successful indexing
							try {
								await telemetryService.trackDocumentIndexed(jobId, doc.id, doc.filePath, true);
								await telemetryService.trackQueueJobProgress(jobId, progress);
							} catch (telemetryError) {
								logger.warn('Telemetry tracking failed for document indexing:', telemetryError);
							}
						} catch (err) {
							const errorMessage = err instanceof Error ? err.message : String(err);
							logger.error(
								`❌ Failed to index document ${doc.id} (${doc.filePath}):`,
								errorMessage
							);
							logger.error('Full error:', err);

							// Track failed indexing
							try {
								await telemetryService.trackDocumentIndexed(
									jobId,
									doc.id,
									doc.filePath,
									false,
									errorMessage
								);
							} catch (telemetryError) {
								logger.warn('Telemetry tracking failed for failed document:', telemetryError);
							}
						}
					}

					logger.info(`🎉 Job ${jobId} completed: indexed ${indexed}/${totalDocs} documents`);

					// Track job completion
					try {
						await telemetryService.trackQueueJobComplete(jobId, { indexed });
					} catch (telemetryError) {
						logger.warn('Telemetry tracking failed for job completion:', telemetryError);
					}

					return { indexed };
				} catch (jobError) {
					logger.error('❌ Critical error in job processor:', jobError);
					throw jobError;
				}
			},
			{
				connection,
				// Enable concurrency for better performance
				concurrency: 3,
				// Limit retries for failed jobs
				attempts: 3,
				backoff: {
					type: 'exponential',
					delay: 2000
				}
			}
		);

		// Event handlers
		if (this.worker) {
			logger.info('Indexing worker started and listening for jobs');
			this.worker.on('completed', (job: Job) => {
				logger.info(`Index job ${job.id} completed successfully`);
			});

			this.worker.on('failed', async (job: Job | undefined, err?: Error) => {
				const jobId = job?.id || 'unknown';
				logger.error(`Index job ${jobId} failed:`, err?.message || 'Unknown error');

				if (job?.id) {
					await telemetryService.trackQueueJobComplete(job.id, {
						success: false,
						error: err?.message || 'Unknown error'
					});
				}
			});
		}
	}

	/**
	 * Enqueues a batch of documents for indexing.
	 * Automatically starts the worker if not already running.
	 * @param docs Array of codebase documents to index
	 * @param requestedBy Optional identifier for the requester
	 * @returns Job ID of the enqueued job
	 * @throws Error if documents array is empty
	 */
	async enqueueIndexDocuments(docs: Array<CodebaseDocument>, requestedBy?: string) {
		await this.ensureInitialized();

		if (!docs.length) {
			logger.warn('Attempted to enqueue empty documents array');
			throw new Error('Cannot enqueue job with empty documents array');
		}

		logger.info(`Enqueuing ${docs.length} documents for indexing`, { requestedBy });

		// Ensure worker is started
		if (!this.worker) {
			logger.info('Worker not running, starting worker automatically');
			await this.startWorker();
		}

		const job = await this.queue!.add(
			'index_docs',
			{ documents: docs, requestedBy },
			{
				removeOnComplete: 100, // Keep last 100 completed jobs
				removeOnFail: false, // Keep failed jobs for debugging
				attempts: 3,
				backoff: {
					type: 'exponential',
					delay: 2000
				}
			}
		);

		logger.info(`Enqueued indexing job ${job.id!} with ${docs.length} documents`);
		return job.id!;
	}

	/**
	 * Retrieves the status of a specific job.
	 * @param jobId The ID of the job to check
	 * @returns Job status information or null if not found
	 */
	async getJobStatus(jobId: string) {
		logger.debug(`Getting status for job: ${jobId}`);
		await this.ensureInitialized();

		const job = await this.queue!.getJob(jobId);
		if (!job) {
			logger.warn(`Job ${jobId} not found`);
			return null;
		}

		const [state, progressRaw] = await Promise.all([job.getState(), job.progress]);

		const progress = typeof progressRaw === 'number' ? progressRaw : undefined;

		logger.debug(`Job ${jobId} status: ${state}, progress: ${progress}`);
		return {
			id: job.id!,
			name: job.name,
			data: job.data,
			state,
			progress,
			returnValue: job.returnvalue,
			failedReason: job.failedReason
		};
	}

	/**
	 * Closes all connections and resets the service state.
	 * Should be called during application shutdown.
	 */
	async closeConnections() {
		logger.info('Closing indexing queue connections');
		const promises: Promise<void>[] = [];

		if (this.worker) {
			logger.debug('Closing worker connection');
			promises.push((this.worker as any).close());
		}

		if (this.queue) {
			logger.debug('Closing queue connection');
			promises.push((this.queue as any).close());
		}

		await Promise.all(promises);
		logger.info('All indexing queue connections closed');

		this.worker = null;
		this.queue = null;
		this._initialized = false;
		this._initializing = null;
	}
}

// Singleton instance
let _singleton: IndexingQueueService | null = null;

export function getIndexingQueueService() {
	if (!_singleton) {
		_singleton = new IndexingQueueService();
	}
	return _singleton;
}
