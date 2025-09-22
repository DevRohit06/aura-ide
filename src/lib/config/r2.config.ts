import { env } from '$env/dynamic/private';

export const r2Config = {
	accessKeyId: env.R2_ACCESS_KEY_ID,
	secretAccessKey: env.R2_SECRET_ACCESS_KEY,
	accountId: env.R2_ACCOUNT_ID,
	defaultBucket: env.R2_DEFAULT_BUCKET || 'aura',
	region: env.R2_REGION || 'auto',
	maxFileSize: parseInt(env.R2_MAX_FILE_SIZE || '100000000'), // 100MB
	multipartThreshold: parseInt(env.R2_MULTIPART_THRESHOLD || '10000000'), // 10MB
	mountPath: env.R2_MOUNT_PATH || '/home/user/project-data',
	endpoint: env.R2_ENDPOINT || `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
	backup: {
		defaultRetentionDays: parseInt(env.R2_BACKUP_RETENTION_DAYS || '30'),
		maxVersionHistory: parseInt(env.R2_MAX_VERSION_HISTORY || '50'),
		compressionEnabled: env.R2_BACKUP_COMPRESSION !== 'false',
		incrementalBackupThreshold: parseInt(env.R2_INCREMENTAL_THRESHOLD || '5') // MB
	}
};
