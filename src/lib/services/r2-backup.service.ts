/**
 * R2 Backup and Versioning Service
 * Service for managing project backups and version control in R2 storage
 */

import { r2Config } from '$lib/config/r2.config.js';
import { logger } from '$lib/utils/logger.js';
import { r2StorageService } from './r2-storage.service.js';

export interface BackupOptions {
	includeMetadata?: boolean;
	compress?: boolean;
	retentionDays?: number;
	tags?: Record<string, string>;
	description?: string;
}

export interface RestoreOptions {
	overwriteExisting?: boolean;
	selectiveRestore?: string[]; // Specific file paths to restore
	targetVersion?: string;
}

export interface BackupInfo {
	backupId: string;
	projectId: string;
	version: string;
	timestamp: Date;
	size: number;
	fileCount: number;
	description?: string;
	tags: Record<string, string>;
	checksum: string;
	metadata: Record<string, any>;
}

export interface VersionInfo {
	version: string;
	timestamp: Date;
	size: number;
	fileCount: number;
	description?: string;
	isLatest: boolean;
	parentVersion?: string;
	changes: VersionChange[];
}

export interface VersionChange {
	type: 'added' | 'modified' | 'deleted';
	path: string;
	oldSize?: number;
	newSize?: number;
}

export interface BackupSchedule {
	projectId: string;
	enabled: boolean;
	frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
	retentionDays: number;
	lastBackup?: Date;
	nextBackup?: Date;
}

/**
 * R2 Backup and Versioning Service Class
 */
export class R2BackupService {
	private backupSchedules = new Map<string, BackupSchedule>();

	/**
	 * Create a backup of project files
	 */
	async createBackup(
		projectId: string,
		files: Record<string, Buffer | string>,
		options: BackupOptions = {}
	): Promise<BackupInfo> {
		try {
			const timestamp = new Date();
			const version = options.tags?.version || this.generateVersionId(timestamp);
			const backupId = `backup_${projectId}_${version}_${timestamp.getTime()}`;

			logger.info(`Creating backup: ${backupId}`);

			// Calculate total size and file count
			let totalSize = 0;
			const fileCount = Object.keys(files).length;

			// Upload project files with version tag
			const uploadPromises = Object.entries(files).map(async ([filePath, content]) => {
				const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');
				totalSize += buffer.length;

				const key = `backups/${projectId}/${version}/${filePath}`;
				return r2StorageService.uploadFile(key, buffer, {
					compress: options.compress ?? true,
					version,
					metadata: {
						'backup-id': backupId,
						'project-id': projectId,
						'backup-timestamp': timestamp.toISOString(),
						'file-path': filePath
					},
					tags: {
						...options.tags,
						'backup-type': 'project-backup',
						'project-id': projectId,
						version: version
					}
				});
			});

			await Promise.all(uploadPromises);

			// Calculate checksum for backup integrity
			const checksum = await this.calculateBackupChecksum(files);

			// Create backup metadata
			const backupInfo: BackupInfo = {
				backupId,
				projectId,
				version,
				timestamp,
				size: totalSize,
				fileCount,
				description: options.description,
				tags: options.tags || {},
				checksum,
				metadata: {
					compressionEnabled: options.compress ?? true,
					retentionDays: options.retentionDays || r2Config.backup.defaultRetentionDays,
					createdBy: 'r2-backup-service',
					...(options.includeMetadata ? { projectMetadata: 'included' } : {})
				}
			};

			// Save backup metadata
			await r2StorageService.uploadFile(
				`backups/${projectId}/${version}/_backup_info.json`,
				JSON.stringify(backupInfo, null, 2),
				{
					contentType: 'application/json',
					compress: true,
					metadata: {
						'backup-id': backupId,
						'metadata-type': 'backup-info'
					}
				}
			);

			// Update version history
			await this.updateVersionHistory(projectId, version, files, backupInfo);

			logger.info(
				`Backup created successfully: ${backupId} (${fileCount} files, ${totalSize} bytes)`
			);

			return backupInfo;
		} catch (error) {
			logger.error(`Failed to create backup for project: ${projectId}`, error);
			throw error;
		}
	}

	/**
	 * Restore project from backup
	 */
	async restoreFromBackup(
		projectId: string,
		version: string,
		options: RestoreOptions = {}
	): Promise<Record<string, Buffer>> {
		try {
			logger.info(`Restoring project from backup: ${projectId}@${version}`);

			// Get backup info
			const backupInfo = await this.getBackupInfo(projectId, version);
			if (!backupInfo) {
				throw new Error(`Backup not found: ${projectId}@${version}`);
			}

			// List files in backup
			const backupFiles = await r2StorageService.listFiles({
				prefix: `backups/${projectId}/${version}/`,
				maxKeys: 1000
			});

			const restoredFiles: Record<string, Buffer> = {};

			// Filter files if selective restore
			const filesToRestore = options.selectiveRestore
				? backupFiles.objects.filter((obj) =>
						options.selectiveRestore!.some((pattern) => obj.key.includes(pattern))
					)
				: backupFiles.objects.filter((obj) => !obj.key.endsWith('_backup_info.json'));

			// Download and restore files
			await Promise.all(
				filesToRestore.map(async (fileObj) => {
					try {
						const content = await r2StorageService.downloadFile(fileObj.key, {
							decompress: true
						});

						if (content) {
							// Extract relative path from backup key
							const relativePath = fileObj.key.replace(`backups/${projectId}/${version}/`, '');
							restoredFiles[relativePath] = content;

							logger.debug(`Restored file: ${relativePath}`);
						}
					} catch (error) {
						logger.error(`Failed to restore file: ${fileObj.key}`, error);
					}
				})
			);

			// Verify backup integrity
			const actualChecksum = await this.calculateBackupChecksum(restoredFiles);
			if (actualChecksum !== backupInfo.checksum) {
				logger.warn(`Backup checksum mismatch for ${projectId}@${version}`);
			}

			logger.info(`Restore completed: ${Object.keys(restoredFiles).length} files restored`);

			return restoredFiles;
		} catch (error) {
			logger.error(`Failed to restore backup: ${projectId}@${version}`, error);
			throw error;
		}
	}

	/**
	 * List available backups for project
	 */
	async listBackups(projectId: string): Promise<BackupInfo[]> {
		try {
			const backupFiles = await r2StorageService.listFiles({
				prefix: `backups/${projectId}/`,
				maxKeys: 1000
			});

			// Filter backup info files
			const backupInfoFiles = backupFiles.objects.filter((obj) =>
				obj.key.endsWith('_backup_info.json')
			);

			// Load backup info for each backup
			const backups = await Promise.all(
				backupInfoFiles.map(async (fileObj) => {
					try {
						const content = await r2StorageService.downloadFile(fileObj.key, {
							decompress: true
						});

						if (content) {
							return JSON.parse(content.toString()) as BackupInfo;
						}
					} catch (error) {
						logger.error(`Failed to load backup info: ${fileObj.key}`, error);
					}
					return null;
				})
			);

			// Filter out null values and sort by timestamp (newest first)
			return backups
				.filter((backup): backup is BackupInfo => backup !== null)
				.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
		} catch (error) {
			logger.error(`Failed to list backups for project: ${projectId}`, error);
			throw error;
		}
	}

	/**
	 * Delete backup
	 */
	async deleteBackup(projectId: string, version: string): Promise<boolean> {
		try {
			logger.info(`Deleting backup: ${projectId}@${version}`);

			// List all files in backup
			const backupFiles = await r2StorageService.listFiles({
				prefix: `backups/${projectId}/${version}/`,
				maxKeys: 1000
			});

			// Delete all files
			await Promise.all(
				backupFiles.objects.map(async (fileObj) => {
					await r2StorageService.deleteFile(fileObj.key);
				})
			);

			logger.info(`Backup deleted: ${projectId}@${version} (${backupFiles.objects.length} files)`);

			return true;
		} catch (error) {
			logger.error(`Failed to delete backup: ${projectId}@${version}`, error);
			throw error;
		}
	}

	/**
	 * Get backup information
	 */
	async getBackupInfo(projectId: string, version: string): Promise<BackupInfo | null> {
		try {
			const content = await r2StorageService.downloadFile(
				`backups/${projectId}/${version}/_backup_info.json`,
				{ decompress: true }
			);

			if (content) {
				return JSON.parse(content.toString()) as BackupInfo;
			}

			return null;
		} catch (error) {
			logger.error(`Failed to get backup info: ${projectId}@${version}`, error);
			return null;
		}
	}

	/**
	 * Create incremental backup (only changed files)
	 */
	async createIncrementalBackup(
		projectId: string,
		files: Record<string, Buffer | string>,
		baseVersion?: string,
		options: BackupOptions = {}
	): Promise<BackupInfo> {
		try {
			// Get base backup for comparison
			let baseFiles: Record<string, Buffer> = {};
			if (baseVersion) {
				baseFiles = await this.restoreFromBackup(projectId, baseVersion);
			}

			// Calculate changed files
			const changedFiles: Record<string, Buffer | string> = {};
			const changes: VersionChange[] = [];

			for (const [path, content] of Object.entries(files)) {
				const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');
				const baseFile = baseFiles[path];

				if (!baseFile) {
					// New file
					changedFiles[path] = content;
					changes.push({
						type: 'added',
						path,
						newSize: buffer.length
					});
				} else if (!buffer.equals(baseFile)) {
					// Modified file
					changedFiles[path] = content;
					changes.push({
						type: 'modified',
						path,
						oldSize: baseFile.length,
						newSize: buffer.length
					});
				}
			}

			// Check for deleted files
			for (const path of Object.keys(baseFiles)) {
				if (!files[path]) {
					changes.push({
						type: 'deleted',
						path,
						oldSize: baseFiles[path].length
					});
				}
			}

			// Create backup with changed files only
			const backupInfo = await this.createBackup(projectId, changedFiles, {
				...options,
				tags: {
					...options.tags,
					'backup-type': 'incremental',
					'base-version': baseVersion || 'none'
				},
				description: `Incremental backup (${changes.length} changes) ${options.description || ''}`
			});

			// Store change information
			await r2StorageService.uploadFile(
				`backups/${projectId}/${backupInfo.version}/_changes.json`,
				JSON.stringify({ baseVersion, changes }, null, 2),
				{
					contentType: 'application/json',
					compress: true,
					metadata: {
						'backup-id': backupInfo.backupId,
						'metadata-type': 'change-log'
					}
				}
			);

			logger.info(`Incremental backup created: ${backupInfo.backupId} (${changes.length} changes)`);

			return backupInfo;
		} catch (error) {
			logger.error(`Failed to create incremental backup for project: ${projectId}`, error);
			throw error;
		}
	}

	/**
	 * Get version history for project
	 */
	async getVersionHistory(projectId: string): Promise<VersionInfo[]> {
		try {
			const content = await r2StorageService.downloadFile(
				`projects/${projectId}/_version_history.json`,
				{ decompress: true }
			);

			if (content) {
				const history = JSON.parse(content.toString()) as VersionInfo[];
				return history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
			}

			return [];
		} catch (error) {
			logger.error(`Failed to get version history for project: ${projectId}`, error);
			return [];
		}
	}

	/**
	 * Clean up old backups based on retention policy
	 */
	async cleanupOldBackups(projectId?: string): Promise<{
		deletedBackups: number;
		freedSpace: number;
	}> {
		try {
			const result = { deletedBackups: 0, freedSpace: 0 };
			const cutoffDate = new Date(
				Date.now() - r2Config.backup.defaultRetentionDays * 24 * 60 * 60 * 1000
			);

			// Get projects to clean up
			const projectsToClean = projectId ? [projectId] : await this.getAllProjectIds();

			for (const pid of projectsToClean) {
				const backups = await this.listBackups(pid);

				for (const backup of backups) {
					if (backup.timestamp < cutoffDate) {
						await this.deleteBackup(pid, backup.version);
						result.deletedBackups++;
						result.freedSpace += backup.size;
					}
				}
			}

			logger.info(
				`Cleanup completed: ${result.deletedBackups} backups deleted, ${result.freedSpace} bytes freed`
			);

			return result;
		} catch (error) {
			logger.error('Failed to cleanup old backups:', error);
			throw error;
		}
	}

	/**
	 * Schedule automatic backups for project
	 */
	async scheduleBackups(
		projectId: string,
		schedule: Omit<BackupSchedule, 'projectId'>
	): Promise<void> {
		try {
			const fullSchedule: BackupSchedule = {
				projectId,
				...schedule,
				nextBackup: this.calculateNextBackup(schedule.frequency)
			};

			this.backupSchedules.set(projectId, fullSchedule);

			// Save schedule to R2
			await r2StorageService.uploadFile(
				`schedules/${projectId}_backup_schedule.json`,
				JSON.stringify(fullSchedule, null, 2),
				{
					contentType: 'application/json',
					compress: true,
					metadata: {
						'project-id': projectId,
						'schedule-type': 'backup'
					}
				}
			);

			logger.info(`Backup schedule created for project: ${projectId} (${schedule.frequency})`);
		} catch (error) {
			logger.error(`Failed to schedule backups for project: ${projectId}`, error);
			throw error;
		}
	}

	/**
	 * Generate version ID based on timestamp
	 */
	private generateVersionId(timestamp: Date): string {
		return `v${timestamp.getFullYear()}${String(timestamp.getMonth() + 1).padStart(2, '0')}${String(timestamp.getDate()).padStart(2, '0')}_${String(timestamp.getHours()).padStart(2, '0')}${String(timestamp.getMinutes()).padStart(2, '0')}${String(timestamp.getSeconds()).padStart(2, '0')}`;
	}

	/**
	 * Calculate checksum for backup integrity
	 */
	private async calculateBackupChecksum(files: Record<string, Buffer | string>): Promise<string> {
		const crypto = await import('crypto');
		const hash = crypto.createHash('sha256');

		// Sort files by path for consistent checksum
		const sortedPaths = Object.keys(files).sort();

		for (const path of sortedPaths) {
			const content = files[path];
			const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');

			hash.update(path);
			hash.update(buffer);
		}

		return hash.digest('hex');
	}

	/**
	 * Update version history
	 */
	private async updateVersionHistory(
		projectId: string,
		version: string,
		files: Record<string, Buffer | string>,
		backupInfo: BackupInfo
	): Promise<void> {
		try {
			const history = await this.getVersionHistory(projectId);

			// Mark previous version as not latest
			history.forEach((v) => (v.isLatest = false));

			// Add new version
			const newVersion: VersionInfo = {
				version,
				timestamp: backupInfo.timestamp,
				size: backupInfo.size,
				fileCount: backupInfo.fileCount,
				description: backupInfo.description,
				isLatest: true,
				parentVersion: history.length > 0 ? history[0].version : undefined,
				changes: [] // Would be populated by change detection
			};

			history.unshift(newVersion);

			// Keep only latest N versions in history
			const maxVersions = r2Config.backup.maxVersionHistory || 50;
			if (history.length > maxVersions) {
				history.splice(maxVersions);
			}

			// Save updated history
			await r2StorageService.uploadFile(
				`projects/${projectId}/_version_history.json`,
				JSON.stringify(history, null, 2),
				{
					contentType: 'application/json',
					compress: true,
					metadata: {
						'project-id': projectId,
						'metadata-type': 'version-history'
					}
				}
			);
		} catch (error) {
			logger.error(`Failed to update version history for project: ${projectId}`, error);
		}
	}

	/**
	 * Get all project IDs from backups
	 */
	private async getAllProjectIds(): Promise<string[]> {
		try {
			const backupFiles = await r2StorageService.listFiles({
				prefix: 'backups/',
				maxKeys: 1000
			});

			const projectIds = new Set<string>();

			backupFiles.objects.forEach((obj) => {
				const match = obj.key.match(/^backups\/([^\/]+)\//);
				if (match) {
					projectIds.add(match[1]);
				}
			});

			return Array.from(projectIds);
		} catch (error) {
			logger.error('Failed to get project IDs from backups:', error);
			return [];
		}
	}

	/**
	 * Calculate next backup time
	 */
	private calculateNextBackup(frequency: string): Date {
		const now = new Date();

		switch (frequency) {
			case 'hourly':
				return new Date(now.getTime() + 60 * 60 * 1000);
			case 'daily':
				return new Date(now.getTime() + 24 * 60 * 60 * 1000);
			case 'weekly':
				return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
			case 'monthly':
				const nextMonth = new Date(now);
				nextMonth.setMonth(nextMonth.getMonth() + 1);
				return nextMonth;
			default:
				return new Date(now.getTime() + 24 * 60 * 60 * 1000);
		}
	}
}

/**
 * Singleton R2 backup service instance
 */
export const r2BackupService = new R2BackupService();
