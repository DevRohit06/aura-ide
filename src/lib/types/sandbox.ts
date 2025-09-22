import { ObjectId } from 'mongodb';

// Core Sandbox Types
export type SandboxProvider = 'daytona' | 'e2b' | 'local';
export type SandboxStatus =
	| 'initializing'
	| 'running'
	| 'stopped'
	| 'error'
	| 'timeout'
	| 'active'
	| 'terminating'
	| 'terminated';
export type StorageProvider = 'r2' | 'local' | 's3';
export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'failed';
export type ExecutionErrorType = 'syntax' | 'runtime' | 'timeout' | 'memory';
export type FileOperation = 'create' | 'update' | 'delete' | 'rename';
export type DependencyType = 'runtime' | 'dev' | 'peer';

// Project Templates Collection
export interface ProjectTemplate {
	_id: ObjectId;
	name: string;
	type: string;
	description?: string;
	source_url?: string;
	stackblitz_path: string;
	category: string;
	tags: string[];
	is_active: boolean;
	popularity_score: number;
	file_count: number;
	dependencies: TemplateDependency[];
	preview_url?: string;
	created_at: Date;
	updated_at: Date;
}

// Template Dependencies Collection (for normalization)
export interface TemplateDependency {
	_id: ObjectId;
	template_id: string; // Reference to project_templates collection
	dependency_name: string;
	dependency_version: string;
	dependency_type: DependencyType;
	is_optional: boolean;
	created_at: Date;
}

// Project Storage Collection
export interface ProjectStorage {
	_id: ObjectId;
	project_id: string; // Reference to projects collection
	storage_provider: StorageProvider;
	storage_key: string;
	bucket_name?: string;
	file_count: number;
	total_size_bytes: number;
	archive_format: string;
	compression_ratio?: number;
	upload_status: UploadStatus;
	last_sync_at?: Date;
	metadata: Record<string, any>;
	created_at: Date;
	updated_at: Date;
}

// Sandbox Sessions Collection
export interface SandboxSession {
	_id: ObjectId;
	id: string;
	sandboxId: string;
	project_id?: string; // Reference to projects collection
	user_id: string; // Reference to users collection
	userId: string; // Additional field for compatibility
	projectId: string; // Additional field for compatibility
	templateId?: string;
	provider: SandboxProvider;
	provider_session_id?: string;
	environment_type?: string;
	environment?: Record<string, string>;
	status: SandboxStatus;
	start_time: Date;
	created_at: Date;
	updated_at: Date;
	last_activity: Date;
	last_accessed: Date;
	auto_stop_time?: Date;
	expires_at?: Date;
	stop_time?: Date;
	resource_limits: Record<string, any>;
	resources?: {
		maxCpu: number;
		maxMemory: number;
		maxStorage: number;
		maxNetworkIO: number;
	};
	network_info: Record<string, any>;
	error_message?: string;
	metadata: Record<string, any>;
	metrics?: {
		cpuUsage: number;
		memoryUsage: number;
		storageUsage: number;
		networkIO: number;
		executionCount: number;
		lastCollected: Date;
	};
}

// Code Executions Collection
export interface CodeExecution {
	_id: ObjectId;
	sandbox_session_id: string; // Reference to sandbox_sessions collection
	user_id: string; // Reference to users collection
	language: string;
	code: string;
	input_data?: string;
	stdout?: string;
	stderr?: string;
	exit_code?: number;
	execution_time_ms?: number;
	memory_used_mb?: number;
	cpu_time_ms?: number;
	success: boolean;
	error_type?: ExecutionErrorType;
	file_changes?: any[]; // JSON array of file modifications
	dependencies_used?: string[];
	executed_at: Date;
}

// Sandbox File Changes Collection (for detailed tracking)
export interface SandboxFileChange {
	_id: ObjectId;
	sandbox_session_id: string; // Reference to sandbox_sessions collection
	file_path: string;
	operation: FileOperation;
	old_content?: string;
	new_content?: string;
	old_path?: string;
	change_size_bytes?: number;
	created_at: Date;
}

// Template Cache Collection (for performance)
export interface TemplateCache {
	_id: ObjectId;
	template_id: string; // Reference to project_templates collection
	cache_key: string;
	cached_data: Record<string, any>;
	expires_at: Date;
	created_at: Date;
}

// Sandbox Usage Analytics Collection
export interface SandboxUsageAnalytics {
	_id: ObjectId;
	user_id: string; // Reference to users collection
	sandbox_session_id?: string; // Reference to sandbox_sessions collection
	provider: SandboxProvider;
	event_type: string;
	event_data: Record<string, any>;
	resource_usage: Record<string, any>;
	cost_cents: number;
	created_at: Date;
}

// Service Response Types
export interface StorageResult {
	success: boolean;
	storage_key: string;
	file_count: number;
	total_size: number;
}

export interface ProjectFile {
	path: string;
	content: string;
	size: number;
	language?: string;
	metadata?: Record<string, any>;
}

export interface ExecutionResult {
	stdout?: string;
	stderr?: string;
	exit_code?: number;
	execution_time_ms?: number;
	memory_used_mb?: number;
	success: boolean;
	error_message?: string;
	file_changes?: ProjectFile[];
}

export interface SessionStatus {
	id: string;
	status: SandboxStatus;
	provider: SandboxProvider;
	start_time: Date;
	last_activity: Date;
	resource_usage?: Record<string, any>;
	network_info?: Record<string, any>;
}

export interface TemplateFiles {
	files: Record<string, string>;
	dependencies: string[];
	metadata: Record<string, any>;
}

// MongoDB Indexes Configuration
export interface MongoIndexConfig {
	collection: string;
	indexes: Array<{
		fields: Record<string, 1 | -1 | 'text'>;
		options?: {
			unique?: boolean;
			sparse?: boolean;
			expireAfterSeconds?: number;
			name?: string;
		};
	}>;
}

// Configuration for database initialization
export const SANDBOX_COLLECTIONS = [
	'project_templates',
	'template_dependencies',
	'project_storage',
	'sandbox_sessions',
	'code_executions',
	'sandbox_file_changes',
	'template_cache',
	'sandbox_usage_analytics'
] as const;

export type SandboxCollectionName = (typeof SANDBOX_COLLECTIONS)[number];

// Session Management Types
export interface SessionMetrics {
	sessionId: string;
	sandboxId: string;
	uptime: number;
	lastActivity: Date;
	resourceUsage: ResourceUsage;
	sandboxMetrics?: any;
}

export interface ResourceUsage {
	cpu: number;
	memory: number;
	storage: number;
	network: number;
}
