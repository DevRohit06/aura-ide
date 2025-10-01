import { filesStore } from '$lib/stores/files.store';
import { get } from 'svelte/store';
import { indexerStatus, type IndexerStatus } from '../stores/vector-indexer.store';

export interface IndexerOptions {
	projectId?: string;
	async?: boolean; // request server to enqueue indexing
	removeMissing?: boolean; // optional: remove documents that no longer exist
}

const INDEXED_HASHES_KEY = 'aura:indexedHashes_v1';

async function computeHash(content: string): Promise<string> {
	if (typeof content !== 'string') content = String(content || '');
	if (typeof crypto !== 'undefined' && (crypto as any).subtle) {
		const enc = new TextEncoder();
		const buf = enc.encode(content);
		const hashBuf = await (crypto as any).subtle.digest('SHA-256', buf);
		const hashArray = Array.from(new Uint8Array(hashBuf));
		return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
	}
	// Fallback: simple non-cryptographic hash
	let h = 2166136261 >>> 0;
	for (let i = 0; i < content.length; i++) {
		h = Math.imul(h ^ content.charCodeAt(i), 16777619) >>> 0;
	}
	return h.toString(16);
}

function loadIndexedHashes(): Record<string, string> {
	try {
		const raw = localStorage.getItem(INDEXED_HASHES_KEY);
		return raw ? JSON.parse(raw) : {};
	} catch (err) {
		console.warn('Failed to load indexed hashes from localStorage', err);
		return {};
	}
}

function saveIndexedHashes(hashes: Record<string, string>) {
	try {
		localStorage.setItem(INDEXED_HASHES_KEY, JSON.stringify(hashes));
	} catch (err) {
		console.warn('Failed to persist indexed hashes to localStorage', err);
	}
}

/**
 * Collect changed/new files from filesStore and POST them to the vector DB indexing endpoint.
 * Uses credentials so the browser session is forwarded.
 * Only files with changed content (based on SHA-256) will be sent unless forced.
 */
/**
 * Clear all indexed hashes to force re-indexing of all files
 */
export function clearIndexedHashes() {
	try {
		localStorage.removeItem(INDEXED_HASHES_KEY);
		console.log('🗑️ Cleared all indexed hashes - all files will be re-indexed');
		return true;
	} catch (err) {
		console.error('Failed to clear indexed hashes:', err);
		return false;
	}
}

/**
 * Get current indexed hashes for debugging
 */
export function getIndexedHashesDebug() {
	const hashes = loadIndexedHashes();
	console.log('🔍 Current indexed hashes:', {
		count: Object.keys(hashes).length,
		files: Object.keys(hashes).slice(0, 10)
	});
	return hashes;
}

/**
 * Force re-indexing by clearing hashes and triggering indexing
 */
export async function forceReindexAllFiles(opts: IndexerOptions = {}) {
	console.log('🔄 Force re-indexing: clearing hashes and triggering indexing');
	clearIndexedHashes();
	return await indexAllFilesFromStore({ ...opts, async: true });
}

/**
 * Collect changed/new files from filesStore and POST them to the vector DB indexing endpoint.
 * Uses credentials so the browser session is forwarded.
 * Only files with changed content (based on SHA-256) will be sent unless forced.
 */
export async function indexAllFilesFromStore(opts: IndexerOptions = {}) {
	const projectId = opts.projectId || 'default';
	const asyncFlag = !!opts.async;
	const removeMissing = !!opts.removeMissing;

	console.log(`🚀 Starting vector indexing for project: ${projectId} (async: ${asyncFlag})`);

	try {
		const status: IndexerStatus = {
			status: 'indexing',
			pending: 0,
			indexed: 0,
			failed: 0,
			lastRun: new Date().toISOString()
		};
		indexerStatus.set(status);

		const filesMap = get(filesStore) as Map<string, any>;
		console.log(`📂 Files in store for indexing:`, {
			totalFiles: filesMap.size,
			fileKeys: Array.from(filesMap.keys()).slice(0, 10),
			firstFile: Array.from(filesMap.values())[0] || null
		});

		const prevHashes = loadIndexedHashes();
		const newHashes: Record<string, string> = { ...prevHashes };

		const candidates: Array<{ path: string; item: any; hash: string }> = [];

		console.log(`📋 Scanning ${filesMap.size} files in store for changes...`);

		// Compute hashes and pick only changed/new files
		for (const [path, item] of Array.from(filesMap.entries())) {
			if (!item) continue;
			if (item.type !== 'file') continue;

			const content = item.content || '';
			const hash = await computeHash(content);
			const prev = prevHashes[path];
			if (!prev || prev !== hash) {
				candidates.push({ path, item, hash });
				console.log(`📄 Found changed file: ${path} (content: ${content.length} chars)`);
			}
		}

		// Optionally detect deleted files (present previously but not now)
		const deletedPaths: string[] = [];
		if (removeMissing) {
			for (const p of Object.keys(prevHashes)) {
				if (!filesMap.has(p)) deletedPaths.push(p);
			}
		}

		if (candidates.length === 0 && deletedPaths.length === 0) {
			console.log('✅ Vector indexer: no changed or new files to index');
			indexerStatus.set({
				status: 'done',
				pending: 0,
				indexed: 0,
				failed: 0,
				lastRun: new Date().toISOString()
			});
			return { success: true, indexed: 0 };
		}

		console.log(`📤 Preparing to index ${candidates.length} changed files`);

		// Build document payloads only for changed files
		const docs = candidates.map((c) => ({
			id: String(c.path),
			filePath: String(c.path),
			content: c.item.content || '',
			language: c.item.language || 'unknown',
			projectId,
			lastModified: c.item.modifiedAt
				? new Date(c.item.modifiedAt).toISOString()
				: new Date().toISOString(),
			metadata: c.item.metadata || { type: 'code' }
		}));

		indexerStatus.set({
			status: 'indexing',
			pending: docs.length,
			indexed: 0,
			failed: 0,
			lastRun: new Date().toISOString()
		});

		console.log(`🚀 Sending ${docs.length} documents to vector indexing API (async: ${asyncFlag})`);

		// POST to server (supporting chunking if desired later)
		const res = await fetch('/api/vector-db/index', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'same-origin',
			body: JSON.stringify({ documents: docs, async: asyncFlag })
		});

		if (!res.ok) {
			const txt = await res.text();
			console.error('❌ Vector indexer failed:', res.status, txt);
			indexerStatus.set({
				status: 'error',
				pending: docs.length,
				indexed: 0,
				failed: docs.length,
				lastRun: new Date().toISOString()
			});
			return { success: false, status: res.status, body: txt };
		}

		const json = await res.json();
		console.log('📥 Vector indexing response:', json);

		// Update local hashes for those that were indexed successfully when running synchronously
		if (!asyncFlag && Array.isArray(json.results)) {
			let indexed = 0;
			let failed = 0;
			for (const r of json.results) {
				if (r && r.id && r.status === 'indexed') {
					// find candidate hash
					const cand = candidates.find((c) => c.path === r.id);
					if (cand) {
						newHashes[cand.path] = await computeHash(cand.item.content || '');
						indexed++;
					}
				} else {
					failed++;
				}
			}
			saveIndexedHashes(newHashes);
			console.log(`✅ Indexing completed: ${indexed} indexed, ${failed} failed`);
			indexerStatus.set({
				status: 'done',
				pending: 0,
				indexed,
				failed,
				lastRun: new Date().toISOString()
			});
			return { success: true, indexed, failed };
		}

		// If async, we optimistically update local hashes for the candidates so future mounts don't re-send them repeatedly
		if (asyncFlag) {
			for (const c of candidates) newHashes[c.path] = c.hash;
			saveIndexedHashes(newHashes);
			console.log(`✅ Async indexing queued: ${candidates.length} documents`);
			indexerStatus.set({
				status: 'done',
				pending: 0,
				indexed: candidates.length,
				failed: 0,
				lastRun: new Date().toISOString()
			});
			return { success: true, enqueued: true, queued: candidates.length };
		}

		// Fallback: return complete response
		console.log('✅ Indexing completed');
		indexerStatus.set({
			status: 'done',
			pending: 0,
			indexed: docs.length,
			failed: 0,
			lastRun: new Date().toISOString()
		});
		return json;
	} catch (err) {
		console.error('❌ Vector indexer error:', err);
		indexerStatus.set({
			status: 'error',
			pending: 0,
			indexed: 0,
			failed: 0,
			lastRun: new Date().toISOString()
		});
		return { success: false, error: err instanceof Error ? err.message : String(err) };
	}
}
