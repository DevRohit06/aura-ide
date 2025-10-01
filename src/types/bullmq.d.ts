declare module 'bullmq' {
	export class Queue<T = any> {
		constructor(name: string, opts?: any);
		add(name: string, data: any, opts?: any): Promise<{ id: string }>;
		getJob(id: string): Promise<any | null>;
	}

	export class Worker<T = any> {
		constructor(name: string, processor: any, opts?: any);
		on(event: 'completed' | 'failed', callback: (job: any, err?: Error) => void): void;
	}

	export class QueueScheduler<T = any> {
		constructor(name: string, opts?: any);
	}

	export type Job<T = any> = any;

	export {};
}
