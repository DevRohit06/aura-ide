/**
 * R2 Storage Service
 * Service for managing Cloudflare R2 storage operations with versioning and compression
 */

import { r2Config } from '$lib/config/r2.config.js';
import type { ProjectStorage } from '$lib/types/sandbox.js';
import { logger } from '$lib/utils/logger.js';
import {
	CopyObjectCommand,
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { promisify } from 'util';
import { gunzip, gzip } from 'zlib';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export interface R2Object {
	key: string;
	size: number;
	lastModified: Date;
	etag: string;
	storageClass?: string;
	metadata?: Record<string, string>;
}

export interface R2UploadOptions {
	contentType?: string;
	metadata?: Record<string, string>;
	compress?: boolean;
	version?: string;
	tags?: Record<string, string>;
}

export interface R2DownloadOptions {
	decompress?: boolean;
	version?: string;
	range?: string;
}

export interface R2ListOptions {
	prefix?: string;
	maxKeys?: number;
	continuationToken?: string;
	includeMetadata?: boolean;
}

export interface R2ListResult {
	objects: R2Object[];
	isTruncated: boolean;
	nextContinuationToken?: string;
	totalCount: number;
}

export interface R2ProjectStorage extends Omit<ProjectStorage, '_id'> {
	files: Array<{
		path: string;
		key: string;
		size: number;
		lastModified: Date;
		version: string;
	}>;
}

export interface R2VersionInfo {
	version: string;
	size: number;
	lastModified: Date;
	etag: string;
	isLatest: boolean;
	metadata?: Record<string, string>;
}

export interface R2ProjectInfo {
	projectId: string;
	totalFiles: number;
	totalSize: number;
	lastModified: Date;
	versions: R2VersionInfo[];
	compressionRatio?: number;
}

/**
 * R2 Storage Service Class
 */
export class R2StorageService {
	private s3Client: S3Client;
	private bucket: string;

	constructor() {
		this.s3Client = new S3Client({
			region: 'auto',
			endpoint: r2Config.endpoint,
			credentials: {
				accessKeyId: r2Config.accessKeyId,
				secretAccessKey: r2Config.secretAccessKey
			}
		});
		this.bucket = r2Config.defaultBucket;
	}

	/**
	 * Upload file to R2 storage
	 */
	async uploadFile(
		key: string,
		content: Buffer | string,
		options: R2UploadOptions = {}
	): Promise<{ key: string; etag: string; size: number; version?: string }> {
		try {
			let finalContent: Buffer;
			let finalMetadata = { ...options.metadata };

			// Convert string to buffer if needed
			if (typeof content === 'string') {
				finalContent = Buffer.from(content, 'utf-8');
			} else {
				finalContent = content;
			}

			// Compress if requested
			if (options.compress) {
				const compressed = await gzipAsync(finalContent);
				finalContent = compressed;
				finalMetadata['compression'] = 'gzip';
				finalMetadata['original-size'] = content.length.toString();
			}

			// Add version to key if specified
			const finalKey = options.version ? `${key}@${options.version}` : key;

			// Add metadata
			finalMetadata['upload-timestamp'] = new Date().toISOString();
			finalMetadata['content-length'] = finalContent.length.toString();

			const command = new PutObjectCommand({
				Bucket: this.bucket,
				Key: finalKey,
				Body: finalContent,
				ContentType: options.contentType || 'application/octet-stream',
				Metadata: finalMetadata
			});

			// Add timeout for R2 upload
			const result = await Promise.race([
				this.s3Client.send(command),
				new Promise<never>((_, reject) =>
					setTimeout(
						() => reject(new Error(`R2 upload timeout for ${finalKey} after 30 seconds`)),
						30000
					)
				)
			]);

			logger.info(`File uploaded to R2: ${finalKey} (${finalContent.length} bytes)`);

			return {
				key: finalKey,
				etag: result.ETag || '',
				size: finalContent.length,
				version: options.version
			};
		} catch (error) {
			logger.error(`Failed to upload file to R2: ${key}`, error);
			throw error;
		}
	}

	/**
	 * Download file from R2 storage
	 */
	async downloadFile(key: string, options: R2DownloadOptions = {}): Promise<Buffer | null> {
		try {
			// Add version to key if specified (consider if this is the right approach for your use case)
			const finalKey = options.version ? `${key}@${options.version}` : key;

			const command = new GetObjectCommand({
				Bucket: this.bucket,
				Key: finalKey,
				Range: options.range
			});

			const result = await this.s3Client.send(command);

			if (!result.Body) {
				return null;
			}

			// Convert stream to buffer more reliably
			let content: Buffer;

			if (result.Body instanceof Readable) {
				// Handle Node.js Readable stream
				const chunks: Buffer[] = [];
				for await (const chunk of result.Body) {
					chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
				}
				content = Buffer.concat(chunks);
			} else if (result.Body instanceof Uint8Array) {
				// Handle Uint8Array directly
				content = Buffer.from(result.Body);
			} else {
				// Fallback for other types
				const chunks: Buffer[] = [];
				const stream = result.Body as AsyncIterable<any>;
				for await (const chunk of stream) {
					chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
				}
				content = Buffer.concat(chunks);
			}

			// Decompress if needed
			if (options.decompress && result.Metadata?.compression === 'gzip') {
				try {
					content = await gunzipAsync(content);
				} catch (decompressError) {
					console.error(`Failed to decompress file: ${finalKey}`, decompressError);
					throw new Error(`Decompression failed for ${finalKey}`);
				}
			}

			console.log(`File downloaded from R2: ${finalKey} (${content.length} bytes)`);
			return content;
		} catch (error: any) {
			// Handle specific AWS S3 errors
			if (error.name === 'NoSuchKey' || error.Code === 'NoSuchKey') {
				return null;
			}
			if (error.name === 'AccessDenied' || error.Code === 'AccessDenied') {
				console.error(`Access denied for R2 file: ${key}`);
				throw new Error(`Access denied: ${key}`);
			}

			console.error(`Failed to download file from R2: ${key}`, {
				error: error.message,
				code: error.Code || error.name
			});
			throw error;
		}
	}
	/**
	 * Delete file from R2 storage
	 */
	async deleteFile(key: string, version?: string): Promise<boolean> {
		try {
			const finalKey = version ? `${key}@${version}` : key;

			const command = new DeleteObjectCommand({
				Bucket: this.bucket,
				Key: finalKey
			});

			await this.s3Client.send(command);

			logger.info(`File deleted from R2: ${finalKey}`);

			return true;
		} catch (error: any) {
			if (error.name === 'NoSuchKey') {
				return false;
			}
			logger.error(`Failed to delete file from R2: ${key}`, error);
			throw error;
		}
	}

	/**
	 * List files in R2 storage
	 */
	async listFiles(options: R2ListOptions = {}): Promise<R2ListResult> {
		try {
			const command = new ListObjectsV2Command({
				Bucket: this.bucket,
				Prefix: options.prefix,
				MaxKeys: options.maxKeys || 1000,
				ContinuationToken: options.continuationToken
			});

			const result = await this.s3Client.send(command);

			const objects: R2Object[] = (result.Contents || []).map((obj) => ({
				key: obj.Key || '',
				size: obj.Size || 0,
				lastModified: obj.LastModified || new Date(),
				etag: obj.ETag || '',
				storageClass: obj.StorageClass
			}));

			// Get metadata for each object if requested
			if (options.includeMetadata) {
				await Promise.all(
					objects.map(async (obj) => {
						try {
							const metadata = await this.getFileMetadata(obj.key);
							if (metadata) {
								obj.metadata = metadata;
							}
						} catch (error) {
							logger.warn(`Failed to get metadata for ${obj.key}:`, error);
						}
					})
				);
			}

			return {
				objects,
				isTruncated: result.IsTruncated || false,
				nextContinuationToken: result.NextContinuationToken,
				totalCount: result.KeyCount || 0
			};
		} catch (error) {
			logger.error('Failed to list files from R2:', error);
			throw error;
		}
	}

	/**
	 * Get file metadata
	 */
	async getFileMetadata(key: string): Promise<Record<string, string> | null> {
		try {
			const command = new HeadObjectCommand({
				Bucket: this.bucket,
				Key: key
			});

			const result = await this.s3Client.send(command);

			return result.Metadata || null;
		} catch (error: any) {
			if (error.name === 'NoSuchKey') {
				return null;
			}
			logger.error(`Failed to get metadata for ${key}:`, error);
			throw error;
		}
	}

	/**
	 * Check if file exists
	 */
	async fileExists(key: string, version?: string): Promise<boolean> {
		try {
			const finalKey = version ? `${key}@${version}` : key;
			const metadata = await this.getFileMetadata(finalKey);
			return metadata !== null;
		} catch (error) {
			return false;
		}
	}

	/**
	 * Copy file within R2 storage
	 */
	async copyFile(
		sourceKey: string,
		destinationKey: string,
		options: R2UploadOptions = {}
	): Promise<{ key: string; etag: string }> {
		try {
			const command = new CopyObjectCommand({
				Bucket: this.bucket,
				CopySource: `${this.bucket}/${sourceKey}`,
				Key: destinationKey,
				Metadata: options.metadata,
				MetadataDirective: options.metadata ? 'REPLACE' : 'COPY',
				TaggingDirective: options.tags ? 'REPLACE' : 'COPY',
				Tagging: options.tags
					? Object.entries(options.tags)
							.map(([k, v]) => `${k}=${v}`)
							.join('&')
					: undefined
			});

			const result = await this.s3Client.send(command);

			logger.info(`File copied in R2: ${sourceKey} -> ${destinationKey}`);

			return {
				key: destinationKey,
				etag: result.CopyObjectResult?.ETag || ''
			};
		} catch (error) {
			logger.error(`Failed to copy file in R2: ${sourceKey} -> ${destinationKey}`, error);
			throw error;
		}
	}

	/**
	 * Get signed URL for file access
	 */
	async getSignedUrl(
		key: string,
		operation: 'GET' | 'PUT' = 'GET',
		expiresIn = 3600
	): Promise<string> {
		try {
			const command =
				operation === 'GET'
					? new GetObjectCommand({ Bucket: this.bucket, Key: key })
					: new PutObjectCommand({ Bucket: this.bucket, Key: key });

			const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });

			logger.info(`Generated signed URL for ${operation} operation: ${key}`);

			return signedUrl;
		} catch (error) {
			logger.error(`Failed to generate signed URL for ${key}:`, error);
			throw error;
		}
	}

	/**
	 * Upload project files as a bundle
	 */
	async uploadProject(
		projectId: string,
		files: Record<string, string | Buffer>,
		version?: string
	): Promise<R2ProjectStorage> {
		try {
			const uploadResults: Array<{ path: string; key: string; size: number }> = [];
			let totalSize = 0;

			// Upload each file
			await Promise.all(
				Object.entries(files).map(async ([filePath, content]) => {
					const key = `projects/${projectId}/${filePath}`;
					const result = await this.uploadFile(key, content, {
						compress: true,
						version,
						metadata: {
							'project-id': projectId,
							'file-path': filePath,
							'upload-version': version || 'latest'
						}
					});

					uploadResults.push({
						path: filePath,
						key: result.key,
						size: result.size
					});

					totalSize += result.size;
				})
			);

			// Create project metadata
			const projectInfo: R2ProjectStorage = {
				project_id: projectId,
				storage_provider: 'r2',
				storage_key: `projects/${projectId}/`,
				bucket_name: this.bucket,
				file_count: uploadResults.length,
				total_size_bytes: totalSize,
				archive_format: 'individual',
				compression_ratio: 0.7, // Estimated for gzip
				upload_status: 'completed',
				files: uploadResults.map((r) => ({
					path: r.path,
					key: r.key,
					size: r.size,
					lastModified: new Date(),
					version: version || 'latest'
				})),
				metadata: {
					uploadedAt: new Date().toISOString(),
					fileCount: uploadResults.length.toString(),
					totalSizeBytes: totalSize.toString(),
					version: version || 'latest'
				},
				created_at: new Date(),
				updated_at: new Date()
			};

			// Upload project metadata
			await this.uploadFile(
				`projects/${projectId}/_metadata.json`,
				JSON.stringify(projectInfo, null, 2),
				{
					contentType: 'application/json',
					version,
					metadata: {
						'project-id': projectId,
						'metadata-type': 'project-info'
					}
				}
			);

			logger.info(
				`Project uploaded to R2: ${projectId} (${uploadResults.length} files, ${totalSize} bytes)`
			);

			return projectInfo;
		} catch (error) {
			logger.error(`Failed to upload project to R2: ${projectId}`, error);
			throw error;
		}
	}

	/**
	 * Download file from R2 storage
	 */
	async downloadFile(key: string, options: R2DownloadOptions = {}): Promise<Buffer | null> {
		try {
			// Handle version - only append if it's not "latest" or if you actually use versioned keys
			let finalKey = key;
			if (options.version && options.version !== 'latest') {
				finalKey = `${key}@${options.version}`;
			}
			// If version is "latest" or undefined, use the key as-is

			console.log(`Attempting to download from R2: ${finalKey}`);

			const command = new GetObjectCommand({
				Bucket: this.bucket,
				Key: finalKey,
				Range: options.range
			});

			const result = await this.s3Client.send(command);

			if (!result.Body) {
				console.log(`No body returned for key: ${finalKey}`);
				return null;
			}

			// Convert stream to buffer more reliably
			let content: Buffer;

			if (result.Body instanceof Readable) {
				// Handle Node.js Readable stream
				const chunks: Buffer[] = [];
				for await (const chunk of result.Body) {
					chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
				}
				content = Buffer.concat(chunks);
			} else if (result.Body instanceof Uint8Array) {
				// Handle Uint8Array directly
				content = Buffer.from(result.Body);
			} else {
				// Fallback for other types
				const chunks: Buffer[] = [];
				const stream = result.Body as AsyncIterable<any>;
				for await (const chunk of stream) {
					chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
				}
				content = Buffer.concat(chunks);
			}

			// Decompress if needed
			if (options.decompress && result.Metadata?.compression === 'gzip') {
				try {
					content = await gunzipAsync(content);
				} catch (decompressError) {
					console.error(`Failed to decompress file: ${finalKey}`, decompressError);
					throw new Error(`Decompression failed for ${finalKey}`);
				}
			}

			console.log(`File downloaded from R2: ${finalKey} (${content.length} bytes)`);
			return content;
		} catch (error: any) {
			console.log(`Download error for key "${key}":`, {
				errorName: error.name,
				errorCode: error.Code,
				message: error.message
			});

			// Handle specific AWS S3 errors
			if (error.name === 'NoSuchKey' || error.Code === 'NoSuchKey') {
				return null;
			}
			if (error.name === 'AccessDenied' || error.Code === 'AccessDenied') {
				console.error(`Access denied for R2 file: ${key}`);
				throw new Error(`Access denied: ${key}`);
			}

			console.error(`Failed to download file from R2: ${key}`, {
				error: error.message,
				code: error.Code || error.name
			});
			throw error;
		}
	}

	async downloadProject(
		projectId: string,
		version?: string
	): Promise<Record<string, Buffer> | null> {
		try {
			// Get project metadata first
			const metadataContent = await this.downloadFile(`projects/${projectId}/_metadata.json`, {
				version,
				decompress: true
			});

			if (!metadataContent) {
				console.log(`No metadata found for project: ${projectId}`);
				return null;
			}

			const projectInfo: R2ProjectStorage = JSON.parse(metadataContent.toString());
			const files: Record<string, Buffer> = {};

			console.log(`Found ${projectInfo.files.length} files in metadata`);

			// Download each file with better error handling
			const downloadPromises = projectInfo.files.map(async (fileInfo, index) => {
				try {
					console.log(`[${index + 1}/${projectInfo.files.length}] Downloading file:`, fileInfo.key);

					// Try different version strategies
					const downloadStrategies = [
						// Strategy 1: Don't use version at all
						{ version: undefined, decompress: true },
						// Strategy 2: Use version as-is (if it's not "latest")
						...(fileInfo.version && fileInfo.version !== 'latest'
							? [{ version: fileInfo.version, decompress: true }]
							: []),
						// Strategy 3: Try without decompression
						{ version: undefined, decompress: false }
					];

					let content: Buffer | null = null;
					let usedStrategy = '';

					for (const strategy of downloadStrategies) {
						try {
							console.log(`Trying strategy for ${fileInfo.key}:`, strategy);
							content = await this.downloadFile(fileInfo.key, strategy);
							if (content) {
								usedStrategy = JSON.stringify(strategy);
								break;
							}
						} catch (strategyError) {
							console.log(`Strategy failed for ${fileInfo.key}:`, strategy, strategyError.message);
						}
					}

					if (content) {
						files[fileInfo.path] = content;
						console.log(
							`✓ Successfully downloaded: ${fileInfo.path} (${content.length} bytes) using ${usedStrategy}`
						);
						return { success: true, path: fileInfo.path, size: content.length };
					} else {
						console.warn(`✗ All strategies failed for: ${fileInfo.key}`);
						return { success: false, path: fileInfo.path, error: 'All download strategies failed' };
					}
				} catch (error) {
					console.error(`✗ Error downloading file ${fileInfo.key}:`, error);
					return { success: false, path: fileInfo.path, error: error.message };
				}
			});

			// Wait for all downloads and collect results
			const results = await Promise.all(downloadPromises);

			// Log summary
			const successful = results.filter((r) => r.success);
			const failed = results.filter((r) => !r.success);

			console.log(`Download summary: ${successful.length} successful, ${failed.length} failed`);

			if (failed.length > 0) {
				console.log('Failed downloads:', failed);
			}

			console.log('Successfully downloaded files:', Object.keys(files));

			if (Object.keys(files).length === 0) {
				console.warn('No files were successfully downloaded!');
			}

			console.log(`Project downloaded from R2: ${projectId} (${Object.keys(files).length} files)`);

			return Object.keys(files).length > 0 ? files : null;
		} catch (error) {
			console.error(`Failed to download project from R2: ${projectId}`, error);
			throw error;
		}
	}

	/**
	 * Delete entire project
	 */
	async deleteProject(projectId: string, version?: string): Promise<boolean> {
		try {
			// List all files for the project
			const listResult = await this.listFiles({
				prefix: `projects/${projectId}/`,
				maxKeys: 1000
			});

			// Filter by version if specified
			const filesToDelete = version
				? listResult.objects.filter((obj) => obj.key.includes(`@${version}`))
				: listResult.objects;

			// Delete all files
			await Promise.all(
				filesToDelete.map(async (obj) => {
					await this.deleteFile(obj.key);
				})
			);

			logger.info(`Project deleted from R2: ${projectId} (${filesToDelete.length} files)`);

			return true;
		} catch (error) {
			logger.error(`Failed to delete project from R2: ${projectId}`, error);
			throw error;
		}
	}

	/**
	 * Get project information
	 */
	async getProjectInfo(projectId: string): Promise<R2ProjectInfo | null> {
		try {
			// List all files for the project
			const listResult = await this.listFiles({
				prefix: `projects/${projectId}/`,
				maxKeys: 1000,
				includeMetadata: true
			});

			if (listResult.objects.length === 0) {
				return null;
			}

			// Group by version
			const versionMap = new Map<string, R2VersionInfo>();
			let totalSize = 0;
			let lastModified = new Date(0);

			listResult.objects.forEach((obj) => {
				const versionMatch = obj.key.match(/@([^@]+)$/);
				const version = versionMatch ? versionMatch[1] : 'latest';

				if (!versionMap.has(version)) {
					versionMap.set(version, {
						version,
						size: 0,
						lastModified: obj.lastModified,
						etag: obj.etag,
						isLatest: version === 'latest',
						metadata: obj.metadata
					});
				}

				const versionInfo = versionMap.get(version)!;
				versionInfo.size += obj.size;

				if (obj.lastModified > versionInfo.lastModified) {
					versionInfo.lastModified = obj.lastModified;
				}

				totalSize += obj.size;

				if (obj.lastModified > lastModified) {
					lastModified = obj.lastModified;
				}
			});

			return {
				projectId,
				totalFiles: listResult.objects.length,
				totalSize,
				lastModified,
				versions: Array.from(versionMap.values()),
				compressionRatio: this.calculateCompressionRatio(listResult.objects)
			};
		} catch (error) {
			logger.error(`Failed to get project info from R2: ${projectId}`, error);
			throw error;
		}
	}

	/**
	 * Calculate compression ratio from object metadata
	 */
	private calculateCompressionRatio(objects: R2Object[]): number {
		let totalCompressed = 0;
		let totalOriginal = 0;

		objects.forEach((obj) => {
			if (obj.metadata?.compression === 'gzip') {
				totalCompressed += obj.size;
				totalOriginal += parseInt(obj.metadata['original-size'] || '0') || obj.size;
			} else {
				totalCompressed += obj.size;
				totalOriginal += obj.size;
			}
		});

		return totalOriginal > 0 ? totalCompressed / totalOriginal : 1;
	}

	/**
	 * Clean up old versions
	 */
	async cleanupOldVersions(projectId: string, keepVersions = 5): Promise<number> {
		try {
			const projectInfo = await this.getProjectInfo(projectId);
			if (!projectInfo) {
				return 0;
			}

			// Sort versions by date (newest first)
			const sortedVersions = projectInfo.versions
				.filter((v) => v.version !== 'latest')
				.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

			// Keep only the specified number of versions
			const versionsToDelete = sortedVersions.slice(keepVersions);
			let deletedCount = 0;

			// Delete old versions
			await Promise.all(
				versionsToDelete.map(async (version) => {
					const deleted = await this.deleteProject(projectId, version.version);
					if (deleted) {
						deletedCount++;
					}
				})
			);

			logger.info(`Cleaned up ${deletedCount} old versions for project: ${projectId}`);

			return deletedCount;
		} catch (error) {
			logger.error(`Failed to cleanup old versions for project: ${projectId}`, error);
			throw error;
		}
	}

	/**
	 * Get storage statistics
	 */
	async getStorageStats(): Promise<{
		totalObjects: number;
		totalSize: number;
		projectCount: number;
		averageProjectSize: number;
		compressionSavings: number;
	}> {
		try {
			const allObjects = await this.listFiles({
				maxKeys: 10000,
				includeMetadata: true
			});

			let totalSize = 0;
			let totalOriginalSize = 0;
			const projects = new Set<string>();

			allObjects.objects.forEach((obj) => {
				totalSize += obj.size;

				// Extract project ID from key
				const projectMatch = obj.key.match(/^projects\/([^\/]+)\//);
				if (projectMatch) {
					projects.add(projectMatch[1]);
				}

				// Calculate original size for compression savings
				if (obj.metadata?.compression === 'gzip') {
					totalOriginalSize += parseInt(obj.metadata['original-size'] || '0') || obj.size;
				} else {
					totalOriginalSize += obj.size;
				}
			});

			return {
				totalObjects: allObjects.objects.length,
				totalSize,
				projectCount: projects.size,
				averageProjectSize: projects.size > 0 ? totalSize / projects.size : 0,
				compressionSavings:
					totalOriginalSize > 0 ? ((totalOriginalSize - totalSize) / totalOriginalSize) * 100 : 0
			};
		} catch (error) {
			logger.error('Failed to get storage statistics:', error);
			throw error;
		}
	}
}

/**
 * Singleton R2 storage service instance
 */
export const r2StorageService = new R2StorageService();
