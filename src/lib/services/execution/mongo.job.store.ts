import { MongoClient } from 'mongodb';
import type { JobInfo } from './execution-queue.service';

export interface MongoJobDocument extends Partial<JobInfo> {
	payload?: Record<string, any>;
	nextAttemptAt?: string | null;
	lockedUntil?: string | null;
}

export class MongoJobStore {
	private client: MongoClient;
	private dbName: string;
	private collectionName = 'langraph_jobs';

	constructor(mongoUrl: string, dbName = 'aura') {
		this.client = new MongoClient(mongoUrl);
		this.dbName = dbName;
	}

	async init() {
		await this.client.connect();
		const col = this.client.db(this.dbName).collection(this.collectionName);
		// ensure indexes for pending queries
		await col.createIndex({ status: 1 });
		await col.createIndex({ nextAttemptAt: 1 });
	}

	private col() {
		return this.client.db(this.dbName).collection(this.collectionName);
	}

	async saveJob(id: string, job: Partial<JobInfo> & { payload?: Record<string, any> }) {
		const doc: MongoJobDocument = {
			id,
			status: job.status,
			attempts: job.attempts,
			createdAt: job.createdAt,
			startedAt: job.startedAt,
			completedAt: job.completedAt,
			result: job.result,
			error: job.error,
			payload: job.payload || undefined,
			nextAttemptAt: null,
			lockedUntil: null
		};
		await this.col().updateOne({ id }, { $set: doc }, { upsert: true });
	}

	async updateJob(id: string, updates: Partial<JobInfo>) {
		const set: any = {};
		if (updates.status) set.status = updates.status;
		if (updates.attempts !== undefined) set.attempts = updates.attempts;
		if (updates.startedAt) set.startedAt = updates.startedAt;
		if (updates.completedAt) set.completedAt = updates.completedAt;
		if (updates.result !== undefined) set.result = updates.result;
		if (updates.error !== undefined) set.error = updates.error;
		if (Object.keys(set).length === 0) return;
		await this.col().updateOne({ id }, { $set: set });
	}

	async getJob(id: string) {
		const doc = await this.col().findOne({ id });
		return doc as MongoJobDocument | null;
	}

	async listPendingJobs(cutoffSeconds = 3600) {
		// return jobs that are queued or running but stale
		const now = new Date();
		const stale = new Date(now.getTime() - cutoffSeconds * 1000).toISOString();
		const docs = await this.col()
			.find({
				$or: [{ status: 'queued' }, { status: 'running', startedAt: { $lt: stale } }]
			})
			.toArray();
		return docs as MongoJobDocument[];
	}

	async markRunning(id: string) {
		const startedAt = new Date().toISOString();
		await this.col().updateOne({ id }, { $set: { status: 'running', startedAt } });
	}

	async close() {
		await this.client.close();
	}
}
