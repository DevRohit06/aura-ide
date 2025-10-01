import { writable } from 'svelte/store';

export type IndexerState = 'idle' | 'indexing' | 'done' | 'error';

export interface IndexerStatus {
	status: IndexerState;
	pending: number;
	indexed: number;
	failed: number;
	lastRun: string | null;
}

export const indexerStatus = writable<IndexerStatus>({
	status: 'idle',
	pending: 0,
	indexed: 0,
	failed: 0,
	lastRun: null
});
