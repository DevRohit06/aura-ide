import { filesService } from '$lib/services/files.service';
import { r2StorageService } from '$lib/services/r2-storage.service';
import { SandboxManager } from '$lib/services/sandbox/sandbox-manager';

// Exposed listing utility used by the API route and server-side page loaders.
export async function listFiles(
	{
		projectId,
		sandboxId,
		path = '/workspace'
	}: {
		projectId?: string;
		sandboxId?: string;
		path?: string;
	},
	options?: {
		includeSnippets?: 'sync' | 'async' | false;
		batchSize?: number;
		maxReadSize?: number;
		fastMode?: boolean; // New option for faster initial loading
	}
) {
	const results: any = {};

	// Determine provider from project
	let provider: 'daytona' | 'e2b' | undefined;
	if (sandboxId) {
		try {
			const { DatabaseService } = await import('$lib/services/database.service.js');
			const project = await DatabaseService.findProjectBySandboxId(sandboxId);
			provider = project?.sandboxProvider as 'daytona' | 'e2b' | undefined;
		} catch (error) {
			console.warn('Failed to determine provider:', error);
		}
	}

	// Fast mode optimizations
	const fastMode = options?.fastMode ?? false;
	const maxReadSize = options?.maxReadSize || (fastMode ? 512 * 1024 : 1024 * 1024); // Reduce to 512KB in fast mode
	const batchSize = options?.batchSize || (fastMode ? 5 : 10); // Smaller batches in fast mode
	const includeSnippets = fastMode ? false : (options?.includeSnippets ?? 'sync'); // Disable snippets in fast mode

	// List files based on provider
	if (provider === 'daytona' && sandboxId) {
		// For Daytona sandboxes, list from sandbox only
		try {
			const { DaytonaService } = await import('$lib/services/sandbox/daytona.service.js');
			const daytonaService = DaytonaService.getInstance();

			// Use timeout for file listing to prevent hanging
			const listPromise = daytonaService.listFiles(sandboxId, path || '/home/daytona');

			const files = await Promise.race([listPromise]);
			results.files = files;

			// Try to read small text files concurrently to provide content snippets
			try {
				const fileEntries = Array.isArray(files) ? files : [];

				// Build a quick id->item map to compute full paths for nested items reliably
				const idMap: Record<string, any> = {};
				// Default maximum inline read size (can be overridden via options.maxReadSize)
				const MAX_READ_SIZE = 1024 * 1024; // 1 MB

				for (const it of fileEntries) {
					if (it && it.id) idMap[it.id] = it;
				}

				function computeFullPath(item: any): string {
					if (!item) return '';
					// Prefer canonical path if provided
					if (item.path && typeof item.path === 'string') {
						// For Daytona, always ensure /home/daytona prefix
						if (provider === 'daytona') {
							return item.path.startsWith('/home/daytona')
								? item.path
								: `/home/daytona/${item.path.replace(/^\//, '')}`;
						}
						return item.path.startsWith('/') ? item.path : `/${item.path}`;
					}
					// Otherwise rebuild from parent chain
					const parts: string[] = [item.name];
					let p = item.parentId;
					while (p) {
						const parent = idMap[p];
						if (!parent) break;
						parts.unshift(parent.name);
						p = parent.parentId;
					}
					const joined = parts.join('/');
					// Provider-specific defaults: Daytona's file tree is rooted under /home/daytona
					if (provider === 'daytona') {
						return `/home/daytona/${joined}`;
					}
					// Fall back to the requested path prefix if available
					if (typeof path === 'string' && path.startsWith('/')) {
						return `${path.replace(/\/$/, '')}/${joined}`;
					}
					return joined;
				}

				const candidatePaths = fileEntries
					.filter((f: any) => {
						const fp = computeFullPath(f);
						if (!fp) return false;
						// prefer numeric size if present
						const size = Number(f?.size || 0) || 0;
						if (size && size > maxReadSize) return false;
						return isLikelyText(fp);
					})
					.map((f: any) => computeFullPath(f))
					.slice(0, fastMode ? 10 : 50); // Limit files in fast mode to improve performance

				if (candidatePaths.length > 0) {
					if (includeSnippets === 'async') {
						// start background fetch and attach promises to files (non-blocking)
						const snippetsPromise = batchReadFilesFromSandbox(
							sandboxId,
							candidatePaths,
							batchSize,
							maxReadSize,
							provider
						);
						results.files = fileEntries.map((f: any) => {
							const fp = computeFullPath(f);
							return {
								...f,
								fullPath: fp,
								// promise that resolves to content or undefined
								contentSnippetPromise: snippetsPromise.then((m) => m.get(fp)?.content),
								readErrorPromise: snippetsPromise.then((m) => m.get(fp)?.error),
								readSizePromise: snippetsPromise.then((m) => m.get(fp)?.size)
							};
						});
						// also expose the full promise map for callers who want everything at once
						results._snippetsPromise = snippetsPromise;
					} else if (includeSnippets === false) {
						// Skip content loading for faster performance
						results.files = fileEntries.map((f: any) => {
							const fp = computeFullPath(f);
							return { ...f, fullPath: fp };
						});
					} else {
						// default (sync): read snippets now and attach content directly
						const snippets = await batchReadFilesFromSandbox(
							sandboxId,
							candidatePaths,
							batchSize,
							maxReadSize,
							provider
						);
						results.files = fileEntries.map((f: any) => {
							const fp = computeFullPath(f);
							const info = snippets.get(fp);
							if (info) {
								return {
									...f,
									fullPath: fp,
									content: info.content,
									readError: info.error || undefined,
									readSize: info.size
								};
							}
							return { ...f, fullPath: fp };
						});
					}
				} else {
					// No candidates, just return basic file list
					results.files = fileEntries.map((f: any) => {
						const fp = computeFullPath(f);
						return { ...f, fullPath: fp };
					});
				}
			} catch (err) {
				console.warn('Failed to read file snippets from Daytona sandbox:', err);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			console.warn('Failed to list files from Daytona sandbox:', error);
			// If sandbox not found, assume no files (sandbox may not exist or be stopped)
			if (errorMessage.includes('Sandbox not found')) {
				results.files = [];
			} else {
				results.files = { error: errorMessage };
			}
		}
	} else if (provider === 'e2b' && projectId) {
		// For E2B sandboxes, list from R2 only
		try {
			const files = await r2StorageService.listFiles({
				prefix: `projects/${projectId}/`
			});
			results.files = files;
		} catch (error) {
			console.warn('Failed to list files from R2:', error);
			results.files = { error: error instanceof Error ? error.message : 'Unknown error' };
		}
	} else if (sandboxId) {
		// Fallback: try sandbox first, then R2
		try {
			const sandboxManager = SandboxManager.getInstance();
			const files = await sandboxManager.listFiles(sandboxId, path, { provider });
			results.files = files;
		} catch (error) {
			console.warn('Failed to list files from sandbox:', error);
			results.files = { error: error instanceof Error ? error.message : 'Unknown error' };
		}
	} else if (projectId) {
		// No sandbox, list from R2
		try {
			const files = await r2StorageService.listFiles({
				prefix: `projects/${projectId}/`
			});
			results.files = files;
		} catch (error) {
			console.warn('Failed to list files from R2:', error);
			results.files = { error: error instanceof Error ? error.message : 'Unknown error' };
		}
	} else {
		results.files = [];
	}

	// List from database (always include)
	try {
		const files = await filesService.getFilesByParentPath(path);
		results.database = files;
	} catch (error) {
		console.warn('Failed to list files from database:', error);
		results.database = { error: error instanceof Error ? error.message : 'Unknown error' };
	}

	return results;
}

// --- helpers copied from the route implementation (kept private to this service) ---
function getContentType(path: string): string {
	const extension = path.split('.').pop()?.toLowerCase();
	const mimeTypes: Record<string, string> = {
		js: 'application/javascript',
		ts: 'application/typescript',
		jsx: 'application/javascript',
		tsx: 'application/typescript',
		json: 'application/json',
		html: 'text/html',
		css: 'text/css',
		scss: 'text/scss',
		sass: 'text/sass',
		md: 'text/markdown',
		txt: 'text/plain',
		py: 'text/x-python',
		java: 'text/x-java-source',
		c: 'text/x-c',
		cpp: 'text/x-c++',
		php: 'text/x-php',
		rb: 'text/x-ruby',
		go: 'text/x-go',
		rs: 'text/x-rust',
		xml: 'application/xml',
		svg: 'image/svg+xml'
	};
	return mimeTypes[extension || ''] || 'text/plain';
}

function chunkArray<T>(arr: T[], size = 10): T[][] {
	if (!Array.isArray(arr) || size <= 0) return [];
	const chunks: T[][] = [];
	for (let i = 0; i < arr.length; i += size) {
		chunks.push(arr.slice(i, i + size));
	}
	return chunks;
}

function isLikelyText(path: string): boolean {
	const ct = getContentType(path);
	if (ct.startsWith('text/')) return true;
	if (ct === 'application/json') return true;
	if (ct.includes('javascript') || ct.includes('typescript')) return true;
	if (ct.includes('xml')) return true;
	if (ct === 'image/svg+xml') return true; // SVG is XML-based and safe to preview
	return false;
}

// Batch-read files from a sandbox with fallbacks and robust handling of variants.
async function batchReadFilesFromSandbox(
	sandboxId: string,
	filePaths: string[],
	batchSize = 10,
	maxReadSize = 1024 * 1024,
	provider?: 'daytona' | 'e2b'
): Promise<Map<string, { content?: string; size?: number; error?: string }>> {
	const results = new Map<string, { content?: string; size?: number; error?: string }>();
	if (!filePaths || filePaths.length === 0) return results;

	const sandboxManager = SandboxManager.getInstance();
	const batches = chunkArray(filePaths, batchSize);

	function buildVariants(filePath: string): string[] {
		const variants: string[] = [];
		if (!filePath.startsWith('/')) {
			variants.push(`/home/daytona/${filePath}`);
			variants.push(filePath);
			variants.push(`/workspace/${filePath}`);
		} else {
			// prefer daytona-root when present
			if (filePath.startsWith('/workspace'))
				variants.push(filePath.replace(/^\/workspace/, '/home/daytona'));
			variants.push(filePath);
			if (filePath.startsWith('/home/daytona'))
				variants.push(filePath.replace(/^\/home\/daytona/, '/workspace'));
		}
		return Array.from(new Set(variants));
	}

	for (const batch of batches) {
		const promises = batch.map(async (filePath) => {
			try {
				let content: string | undefined = undefined;
				let size: number | undefined = undefined;

				const variants = buildVariants(filePath);
				let usedVariant: string | undefined = undefined;

				// Try UTF-8 reads first for each variant
				for (const v of variants) {
					try {
						const file = await sandboxManager.readFile(sandboxId, v, {
							encoding: 'utf-8',
							provider: 'daytona'
						});
						if (file) {
							usedVariant = v;
							if (typeof file === 'string') {
								content = file;
								size = Buffer.byteLength(file, 'utf-8');
							} else if (Buffer.isBuffer(file)) {
								content = file.toString('utf-8');
								size = file.length;
							} else if ((file as any).content) {
								content = (file as any).content;
								size =
									Number((file as any).size) ||
									Buffer.byteLength(String((file as any).content || ''), 'utf-8');
							} else {
								content = String(file);
								size = Buffer.byteLength(content, 'utf-8');
							}
							break;
						}
					} catch (e) {
						// try next variant
					}
				}

				// If we didn't get content, try binary reads (may return buffers)
				if (!content) {
					for (const v of variants) {
						try {
							const binary = await sandboxManager.readFile(sandboxId, v, {
								encoding: 'binary',
								provider: 'daytona'
							});
							if (binary) {
								usedVariant = v;
								if (Buffer.isBuffer(binary)) {
									content = binary.toString('utf-8');
									size = binary.length;
								} else if (typeof (binary as any).content === 'string') {
									content = (binary as any).content;
									size =
										Number((binary as any).size) ||
										Buffer.byteLength(String(content || ''), 'utf-8');
								} else {
									content = String(binary);
									size = Buffer.byteLength(content, 'utf-8');
								}
								break;
							}
						} catch (err) {
							// continue
						}
					}
				}

				// Provider-specific direct read (Daytona SDK) as another fallback
				if (!content && provider === 'daytona') {
					try {
						const { DaytonaService } = await import('$lib/services/sandbox/daytona.service.js');
						const daytonaService = DaytonaService.getInstance();
						// daytonaService exposes readFile(sandboxId, path)
						try {
							// prefer using the usedVariant (if any) when calling the provider directly
							// adds a small debug message to help diagnose variant mismatches
							console.debug(
								`Attempting Daytona direct read for sandbox=${sandboxId} path=${usedVariant || filePath}`
							);
							const direct = await daytonaService.readFile(sandboxId, usedVariant || filePath);
							if (direct) {
								if (typeof direct === 'string') {
									content = direct;
									size = Buffer.byteLength(content, 'utf-8');
								} else if ((direct as any).content) {
									content = (direct as any).content;
									size =
										Number((direct as any).size) ||
										Buffer.byteLength(String(content || ''), 'utf-8');
								}
							}
						} catch (dErr) {
							// ignore and continue to downloadFiles fallback
						}
					} catch (err) {
						// ignore
					}
				}

				// Final fallback: bulk downloadFiles for single path
				if (!content) {
					try {
						const bulk = await sandboxManager.downloadFiles(sandboxId, [usedVariant || filePath]);
						const buf = bulk[usedVariant || filePath] || bulk[filePath];
						if (buf) {
							content = Buffer.isBuffer(buf) ? buf.toString('utf-8') : String(buf);
							size = Buffer.isBuffer(buf) ? buf.length : Buffer.byteLength(String(buf), 'utf-8');
						}
					} catch (err) {
						// ignore
					}
				}

				// store result (may be undefined content)
				results.set(filePath, { content, size });
			} catch (error: any) {
				results.set(filePath, {
					content: undefined,
					error: error instanceof Error ? error.message : String(error)
				});
			}
		});

		// Await the batch
		await Promise.all(promises);
	}

	return results;
}
