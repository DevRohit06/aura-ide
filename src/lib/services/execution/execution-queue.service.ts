import { env } from '$env/dynamic/private';
import { LangraphService } from '$lib/services/langraph';
import { randomUUID } from 'crypto';
import { MongoJobStore } from './mongo.job.store';

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'timed_out' | 'cancelled';

export interface JobInfo {
	id: string;
	status: JobStatus;
	attempts: number;
	createdAt: string;
	startedAt?: string;
	completedAt?: string;
	result?: any;
	error?: string;
}

export interface QueueJobOptions {
	maxRetries?: number;
	backoffBaseMs?: number;
	timeoutMs?: number; // per-job timeout
}

interface InternalJob {
	id: string;
	jobFn: () => Promise<any>;
	resolve: (v: any) => void;
	reject: (err: any) => void;
	attempts: number;
	maxRetries: number;
	backoffBaseMs: number;
	timeoutMs?: number;
}

export class ExecutionQueue {
	private static instance: ExecutionQueue | null = null;
	private queue: InternalJob[] = [];
	private activeCount = 0;
	private concurrency: number;
	private defaultMaxRetries: number;
	private defaultBackoffBaseMs: number;
	// in-memory job store
	private jobs: Map<string, JobInfo> = new Map();
	private jobStore: MongoJobStore | null = null;

	private constructor() {
		// Allow override via env variables
		this.concurrency = parseInt(env.EXECUTION_CONCURRENCY || '') || 2;
		this.defaultMaxRetries = parseInt(env.EXECUTION_MAX_RETRIES || '') || 2;
		this.defaultBackoffBaseMs = parseInt(env.EXECUTION_BACKOFF_MS || '') || 1000;

		// If MONGO_URL is present, initialize job store and rehydrate
		if (env.MONGO_URL) {
			this.jobStore = new MongoJobStore(env.MONGO_URL, env.MONGO_DB_NAME || 'aura');
			this.jobStore
				.init()
				.then(() => this.rehydratePendingJobs())
				.catch((err) => {
					console.error('Failed to initialize MongoJobStore:', err);
				});
		}
	}

	static getInstance() {
		if (!ExecutionQueue.instance) ExecutionQueue.instance = new ExecutionQueue();
		return ExecutionQueue.instance;
	}

	enqueue<T>(
		jobFn: () => Promise<T>,
		options: QueueJobOptions = {},
		payload?: Record<string, any>
	) {
		const id = randomUUID();
		const maxRetries = options.maxRetries ?? this.defaultMaxRetries;
		const backoffBaseMs = options.backoffBaseMs ?? this.defaultBackoffBaseMs;
		const timeoutMs = options.timeoutMs;

		let resolveFn: (v: any) => void = () => {};
		let rejectFn: (err: any) => void = () => {};
		const promise = new Promise<T>((res, rej) => {
			resolveFn = res;
			rejectFn = rej;
		});

		const job: InternalJob = {
			id,
			jobFn: jobFn as () => Promise<any>,
			resolve: resolveFn,
			reject: rejectFn,
			attempts: 0,
			maxRetries,
			backoffBaseMs,
			timeoutMs
		};

		this.queue.push(job);
		this.jobs.set(id, {
			id,
			status: 'queued',
			attempts: 0,
			createdAt: new Date().toISOString()
		});

		// persist into mongo if store available
		if (this.jobStore) {
			this.jobStore
				.saveJob(id, {
					id,
					status: 'queued',
					attempts: 0,
					createdAt: new Date().toISOString(),
					payload
				})
				.catch((err) => {
					console.warn('Failed to persist job to Mongo:', err?.message || String(err));
				});
		}

		this.processQueue();

		return { jobId: id, promise };
	}

	getJob(jobId: string) {
		if (this.jobStore) {
			// fetch from mongo
			return this.jobStore.getJob(jobId).then((doc) => {
				if (!doc) return null;
				return {
					id: doc.id as string,
					status: (doc.status as any) || 'queued',
					attempts: doc.attempts || 0,
					createdAt: doc.createdAt || '',
					startedAt: doc.startedAt,
					completedAt: doc.completedAt,
					result: doc.result,
					error: doc.error,
					// expose payload for debugging
					resultPayload: (doc as any).payload
				} as any;
			});
		}
		return this.jobs.get(jobId) ?? null;
	}

	private async rehydratePendingJobs() {
		if (!this.jobStore) return;
		try {
			const docs = await this.jobStore.listPendingJobs();
			for (const d of docs) {
				const id = d.id as string;
				this.jobs.set(id, {
					id,
					status: 'queued',
					attempts: d.attempts || 0,
					createdAt: d.createdAt || new Date().toISOString()
				});

				// Reconstruct jobFn for known payload types
				if (d.payload && (d.payload as any).type === 'graph-execution') {
					const graphId = (d.payload as any).graphId;
					const prompt = (d.payload as any).prompt;
					const jobFn = () => LangraphService.getInstance().executeGraph(graphId, { prompt });
					this.queue.push({
						id,
						jobFn: jobFn as any,
						resolve: () => {},
						reject: () => {},
						attempts: d.attempts || 0,
						maxRetries: this.defaultMaxRetries,
						backoffBaseMs: this.defaultBackoffBaseMs
					});
				}
			}
		} catch (err) {
			console.error('Failed to rehydrate jobs:', err);
		}
	}

	private async processQueue() {
		if (this.activeCount >= this.concurrency) return;
		const job = this.queue.shift();
		if (!job) return;
		this.activeCount++;
		// update job status
		const meta = this.jobs.get(job.id);
		if (meta) {
			meta.status = 'running';
			meta.startedAt = new Date().toISOString();
			meta.attempts = job.attempts + 1;
			this.jobs.set(job.id, meta);
		}
		this.runJob(job).finally(() => {
			this.activeCount--;
			// process next job in next tick to avoid deep recursion
			setImmediate(() => this.processQueue());
		});
	}

	private async runJob(job: InternalJob) {
		job.attempts++;
		try {
			// mark running in mongo
			if (this.jobStore) await this.jobStore.markRunning(job.id);
			let timedPromise = job.jobFn();
			if (job.timeoutMs && job.timeoutMs > 0) {
				timedPromise = this.withTimeout(timedPromise, job.timeoutMs);
			}
			const result = await timedPromise;
			job.resolve(result);
			const meta = this.jobs.get(job.id);
			if (meta) {
				meta.status = 'succeeded';
				meta.completedAt = new Date().toISOString();
				meta.result = result;
				this.jobs.set(job.id, meta);
			}
			if (this.jobStore)
				await this.jobStore.updateJob(job.id, {
					status: 'succeeded',
					completedAt: meta?.completedAt,
					result: result
				} as any);
			return result;
		} catch (err: any) {
			const meta = this.jobs.get(job.id);
			if (job.attempts <= job.maxRetries) {
				const backoff = job.backoffBaseMs * Math.pow(2, job.attempts - 1);
				// update attempts
				if (meta) {
					meta.attempts = job.attempts;
					meta.status = 'queued';
					this.jobs.set(job.id, meta);
				}
				// Re-enqueue with delay
				setTimeout(() => {
					this.queue.push(job);
					// persist nextAttempt
					if (this.jobStore)
						this.jobStore.updateJob(job.id, { attempts: job.attempts } as any).catch(() => {});
					this.processQueue();
				}, backoff);
			} else {
				if (meta) {
					meta.status = err && err.message === 'Job timed out' ? 'timed_out' : 'failed';
					meta.completedAt = new Date().toISOString();
					meta.error = err instanceof Error ? err.message : String(err);
					this.jobs.set(job.id, meta);
				}
				if (this.jobStore)
					await this.jobStore
						.updateJob(job.id, {
							status: meta?.status,
							completedAt: meta?.completedAt,
							error: meta?.error
						} as any)
						.catch(() => {});
				job.reject(err);
				return Promise.reject(err);
			}
		}
	}

	private withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			const t = setTimeout(() => reject(new Error('Job timed out')), ms);
			p.then((v) => {
				clearTimeout(t);
				resolve(v);
			}).catch((err) => {
				clearTimeout(t);
				reject(err);
			});
		});
	}

	getStats() {
		return { queued: this.queue.length, active: this.activeCount, concurrency: this.concurrency };
	}
}
