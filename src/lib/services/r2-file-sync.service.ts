/**
 * R2 File Synchronization Service
 * Service for synchronizing files between local workspace and R2 storage
 */

import { logger } from '$lib/utils/logger.js';
import { r2StorageService } from './r2-storage.service.js';

export interface SyncOptions {
	direction: 'upload' | 'download' | 'bidirectional';
	deleteRemote?: boolean;
	deleteLocal?: boolean;
	dryRun?: boolean;
	includePatterns?: string[];
	excludePatterns?: string[];
	version?: string;
}

export interface SyncResult {
	totalFiles: number;
	uploadedFiles: number;
	downloadedFiles: number;
	deletedFiles: number;
	skippedFiles: number;
	errors: Array<{ file: string; error: string }>;
	totalSize: number;
	duration: number;
}

export interface FileDiff {
	path: string;
	action: 'upload' | 'download' | 'delete' | 'skip';
	reason: string;
	localSize?: number;
	remoteSize?: number;
	localModified?: Date;
	remoteModified?: Date;
}

export interface SyncState {
	projectId: string;
	lastSync: Date;
	localFiles: Record<string, { size: number; modified: Date; hash?: string }>;
	remoteFiles: Record<string, { size: number; modified: Date; hash?: string }>;
	conflicts: Array<{ path: string; reason: string }>;
}

/**
 * R2 File Synchronization Service Class
 */
export class R2FileSyncService {
	private syncStates = new Map<string, SyncState>();

	/**
	 * Synchronize project files
	 */
	async syncProject(
		projectId: string,
		localFiles: Record<string, Buffer | string>,
		options: SyncOptions = { direction: 'bidirectional' }
	): Promise<SyncResult> {
		const startTime = Date.now();
		const result: SyncResult = {
			totalFiles: 0,
			uploadedFiles: 0,
			downloadedFiles: 0,
			deletedFiles: 0,
			skippedFiles: 0,
			errors: [],
			totalSize: 0,
			duration: 0
		};

		try {
			logger.info(`Starting sync for project: ${projectId} (${options.direction})`);

			// Get current sync state
			const syncState = await this.getSyncState(projectId);

			// Get remote files
			const remoteProject = await r2StorageService.downloadProject(projectId, options.version);
			const remoteFiles = remoteProject || {};

			// Calculate differences
			const diffs = await this.calculateDiffs(localFiles, remoteFiles, syncState, options);
			result.totalFiles = diffs.length;

			logger.info(`Found ${diffs.length} file differences for sync`);

			// Execute sync operations
			if (!options.dryRun) {
				await this.executeSyncOperations(
					projectId,
					localFiles,
					remoteFiles,
					diffs,
					result,
					options
				);
			} else {
				logger.info('Dry run mode - no files will be modified');
				this.logSyncPlan(diffs);
			}

			// Update sync state
			await this.updateSyncState(projectId, localFiles, remoteFiles);

			result.duration = Date.now() - startTime;

			logger.info(`Sync completed for project: ${projectId} in ${result.duration}ms`);

			return result;
		} catch (error) {
			logger.error(`Sync failed for project: ${projectId}`, error);
			result.errors.push({
				file: 'sync_operation',
				error: error instanceof Error ? error.message : 'Unknown error'
			});
			result.duration = Date.now() - startTime;
			return result;
		}
	}

	/**
	 * Calculate file differences for sync
	 */
	private async calculateDiffs(
		localFiles: Record<string, Buffer | string>,
		remoteFiles: Record<string, Buffer>,
		syncState: SyncState,
		options: SyncOptions
	): Promise<FileDiff[]> {
		const diffs: FileDiff[] = [];
		const allPaths = new Set([...Object.keys(localFiles), ...Object.keys(remoteFiles)]);

		for (const path of allPaths) {
			// Apply include/exclude patterns
			if (!this.shouldIncludeFile(path, options)) {
				continue;
			}

			const localFile = localFiles[path];
			const remoteFile = remoteFiles[path];
			const hasLocal = localFile !== undefined;
			const hasRemote = remoteFile !== undefined;

			if (hasLocal && hasRemote) {
				// Both exist - check if sync needed
				const diff = await this.compareFiles(path, localFile, remoteFile, syncState, options);
				if (diff) {
					diffs.push(diff);
				}
			} else if (hasLocal && !hasRemote) {
				// Local only - upload or skip
				if (options.direction === 'upload' || options.direction === 'bidirectional') {
					diffs.push({
						path,
						action: 'upload',
						reason: 'File exists locally but not remotely',
						localSize: Buffer.isBuffer(localFile)
							? localFile.length
							: Buffer.byteLength(localFile, 'utf-8')
					});
				}
			} else if (!hasLocal && hasRemote) {
				// Remote only - download or delete
				if (options.direction === 'download' || options.direction === 'bidirectional') {
					diffs.push({
						path,
						action: 'download',
						reason: 'File exists remotely but not locally',
						remoteSize: remoteFile.length
					});
				} else if (options.deleteRemote) {
					diffs.push({
						path,
						action: 'delete',
						reason: 'File exists remotely but not locally (delete requested)',
						remoteSize: remoteFile.length
					});
				}
			}
		}

		return diffs;
	}

	/**
	 * Compare local and remote files
	 */
	private async compareFiles(
		path: string,
		localFile: Buffer | string,
		remoteFile: Buffer,
		syncState: SyncState,
		options: SyncOptions
	): Promise<FileDiff | null> {
		const localBuffer = Buffer.isBuffer(localFile) ? localFile : Buffer.from(localFile, 'utf-8');
		const localSize = localBuffer.length;
		const remoteSize = remoteFile.length;

		// Quick size comparison
		if (localSize !== remoteSize) {
			if (options.direction === 'upload' || options.direction === 'bidirectional') {
				return {
					path,
					action: 'upload',
					reason: 'File sizes differ',
					localSize,
					remoteSize
				};
			} else if (options.direction === 'download') {
				return {
					path,
					action: 'download',
					reason: 'File sizes differ',
					localSize,
					remoteSize
				};
			}
		}

		// Content comparison (for small files)
		if (localSize < 1024 * 1024) {
			// 1MB limit for content comparison
			if (!localBuffer.equals(remoteFile)) {
				if (options.direction === 'upload' || options.direction === 'bidirectional') {
					return {
						path,
						action: 'upload',
						reason: 'File contents differ',
						localSize,
						remoteSize
					};
				} else if (options.direction === 'download') {
					return {
						path,
						action: 'download',
						reason: 'File contents differ',
						localSize,
						remoteSize
					};
				}
			}
		}

		return null; // Files are identical
	}

	/**
	 * Execute sync operations
	 */
	private async executeSyncOperations(
		projectId: string,
		localFiles: Record<string, Buffer | string>,
		remoteFiles: Record<string, Buffer>,
		diffs: FileDiff[],
		result: SyncResult,
		options: SyncOptions
	): Promise<void> {
		// Group operations by type for better performance
		const uploads = diffs.filter((d) => d.action === 'upload');
		const downloads = diffs.filter((d) => d.action === 'download');
		const deletes = diffs.filter((d) => d.action === 'delete');

		// Execute uploads
		await Promise.all(
			uploads.map(async (diff) => {
				try {
					const content = localFiles[diff.path];
					await r2StorageService.uploadFile(`projects/${projectId}/${diff.path}`, content, {
						compress: true,
						version: options.version,
						metadata: {
							'project-id': projectId,
							'file-path': diff.path,
							'sync-timestamp': new Date().toISOString()
						}
					});

					result.uploadedFiles++;
					result.totalSize += diff.localSize || 0;

					logger.debug(`Uploaded: ${diff.path}`);
				} catch (error) {
					result.errors.push({
						file: diff.path,
						error: error instanceof Error ? error.message : 'Upload failed'
					});
					logger.error(`Failed to upload ${diff.path}:`, error);
				}
			})
		);

		// Execute downloads
		await Promise.all(
			downloads.map(async (diff) => {
				try {
					const content = await r2StorageService.downloadFile(
						`projects/${projectId}/${diff.path}`,
						{
							version: options.version,
							decompress: true
						}
					);

					if (content) {
						// In a real implementation, you would write to local filesystem
						// For now, we'll just track the operation
						localFiles[diff.path] = content;
						result.downloadedFiles++;
						result.totalSize += diff.remoteSize || 0;

						logger.debug(`Downloaded: ${diff.path}`);
					}
				} catch (error) {
					result.errors.push({
						file: diff.path,
						error: error instanceof Error ? error.message : 'Download failed'
					});
					logger.error(`Failed to download ${diff.path}:`, error);
				}
			})
		);

		// Execute deletes
		await Promise.all(
			deletes.map(async (diff) => {
				try {
					await r2StorageService.deleteFile(`projects/${projectId}/${diff.path}`, options.version);

					result.deletedFiles++;
					logger.debug(`Deleted: ${diff.path}`);
				} catch (error) {
					result.errors.push({
						file: diff.path,
						error: error instanceof Error ? error.message : 'Delete failed'
					});
					logger.error(`Failed to delete ${diff.path}:`, error);
				}
			})
		);
	}

	/**
	 * Check if file should be included in sync
	 */
	private shouldIncludeFile(path: string, options: SyncOptions): boolean {
		// Check exclude patterns first
		if (options.excludePatterns) {
			for (const pattern of options.excludePatterns) {
				if (this.matchesPattern(path, pattern)) {
					return false;
				}
			}
		}

		// Check include patterns
		if (options.includePatterns && options.includePatterns.length > 0) {
			for (const pattern of options.includePatterns) {
				if (this.matchesPattern(path, pattern)) {
					return true;
				}
			}
			return false; // No include pattern matched
		}

		return true; // Include by default
	}

	/**
	 * Simple pattern matching (supports * wildcards)
	 */
	private matchesPattern(path: string, pattern: string): boolean {
		const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
		return regex.test(path);
	}

	/**
	 * Get sync state for project
	 */
	private async getSyncState(projectId: string): Promise<SyncState> {
		if (this.syncStates.has(projectId)) {
			return this.syncStates.get(projectId)!;
		}

		// Try to load from R2
		try {
			const stateContent = await r2StorageService.downloadFile(
				`projects/${projectId}/_sync_state.json`,
				{ decompress: true }
			);

			if (stateContent) {
				const state: SyncState = JSON.parse(stateContent.toString());
				this.syncStates.set(projectId, state);
				return state;
			}
		} catch (error) {
			logger.debug(`No sync state found for project: ${projectId}`);
		}

		// Create new sync state
		const newState: SyncState = {
			projectId,
			lastSync: new Date(0),
			localFiles: {},
			remoteFiles: {},
			conflicts: []
		};

		this.syncStates.set(projectId, newState);
		return newState;
	}

	/**
	 * Update sync state
	 */
	private async updateSyncState(
		projectId: string,
		localFiles: Record<string, Buffer | string>,
		remoteFiles: Record<string, Buffer>
	): Promise<void> {
		try {
			const state = this.syncStates.get(projectId);
			if (!state) return;

			// Update file states
			state.lastSync = new Date();
			state.localFiles = {};
			state.remoteFiles = {};

			// Record local file states
			for (const [path, content] of Object.entries(localFiles)) {
				const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');
				state.localFiles[path] = {
					size: buffer.length,
					modified: new Date(),
					hash: this.calculateHash(buffer)
				};
			}

			// Record remote file states
			for (const [path, content] of Object.entries(remoteFiles)) {
				state.remoteFiles[path] = {
					size: content.length,
					modified: new Date(),
					hash: this.calculateHash(content)
				};
			}

			// Save sync state to R2
			await r2StorageService.uploadFile(
				`projects/${projectId}/_sync_state.json`,
				JSON.stringify(state, null, 2),
				{
					contentType: 'application/json',
					compress: true,
					metadata: {
						'project-id': projectId,
						'state-type': 'sync-state'
					}
				}
			);

			logger.debug(`Updated sync state for project: ${projectId}`);
		} catch (error) {
			logger.error(`Failed to update sync state for project: ${projectId}`, error);
		}
	}

	/**
	 * Calculate simple hash for file content
	 */
	private calculateHash(content: Buffer): string {
		// Simple hash based on content length and first/last bytes
		if (content.length === 0) return '0';

		const first = content[0] || 0;
		const last = content[content.length - 1] || 0;
		const middle = content[Math.floor(content.length / 2)] || 0;

		return `${content.length}-${first}-${middle}-${last}`;
	}

	/**
	 * Log sync plan for dry run
	 */
	private logSyncPlan(diffs: FileDiff[]): void {
		logger.info('=== SYNC PLAN ===');

		const grouped = diffs.reduce(
			(acc, diff) => {
				acc[diff.action] = acc[diff.action] || [];
				acc[diff.action].push(diff);
				return acc;
			},
			{} as Record<string, FileDiff[]>
		);

		for (const [action, files] of Object.entries(grouped)) {
			logger.info(`${action.toUpperCase()}: ${files.length} files`);
			files.forEach((file) => {
				logger.info(`  - ${file.path} (${file.reason})`);
			});
		}

		logger.info('=================');
	}

	/**
	 * Get sync statistics for project
	 */
	async getSyncStats(projectId: string): Promise<{
		lastSync: Date;
		localFileCount: number;
		remoteFileCount: number;
		conflictCount: number;
		totalSyncSize: number;
	} | null> {
		try {
			const state = await this.getSyncState(projectId);

			return {
				lastSync: state.lastSync,
				localFileCount: Object.keys(state.localFiles).length,
				remoteFileCount: Object.keys(state.remoteFiles).length,
				conflictCount: state.conflicts.length,
				totalSyncSize: Object.values(state.localFiles).reduce((sum, file) => sum + file.size, 0)
			};
		} catch (error) {
			logger.error(`Failed to get sync stats for project: ${projectId}`, error);
			return null;
		}
	}

	/**
	 * Clear sync state for project
	 */
	async clearSyncState(projectId: string): Promise<void> {
		try {
			this.syncStates.delete(projectId);

			await r2StorageService.deleteFile(`projects/${projectId}/_sync_state.json`);

			logger.info(`Cleared sync state for project: ${projectId}`);
		} catch (error) {
			logger.error(`Failed to clear sync state for project: ${projectId}`, error);
		}
	}
}

/**
 * Singleton R2 file sync service instance
 */
export const r2FileSyncService = new R2FileSyncService();
