import { Buffer } from 'node:buffer';

import { DatabaseService } from '$lib/services/database.service.js';
import { DaytonaService } from '$lib/services/sandbox/daytona.service.js';
import { vectorDbService, type CodebaseDocument } from '$lib/services/vector-db.service.js';
import type { Project } from '$lib/types/index.js';

export interface WorkspaceSyncOptions {
	maxFiles?: number;
	chunkSize?: number;
	chunkOverlap?: number;
	maxFileSizeKB?: number;
	includeExtensions?: string[];
	excludeExtensions?: string[];
	includeHidden?: boolean;
}

export interface WorkspaceSyncResult {
	projectId: string;
	provider: 'daytona';
	sandboxId: string;
	summary: {
		totalFiles: number;
		processedFiles: number;
		skippedFiles: number;
		indexedDocuments: number;
		totalBytes: number;
	};
	documents: Array<{
		id: string;
		filePath: string;
		chunkIndex: number;
		chunkSize: number;
		language: string;
		type: CodebaseDocument['metadata']['type'];
	}>;
	skipped: Array<{
		filePath: string;
		reason: string;
	}>;
	errors: Array<{
		filePath: string;
		message: string;
	}>;
	startedAt: string;
	completedAt: string;
}

export class WorkspaceContextService {
	private static instance: WorkspaceContextService | null = null;

	static getInstance(): WorkspaceContextService {
		if (!this.instance) {
			this.instance = new WorkspaceContextService();
		}
		return this.instance;
	}

	async syncDaytonaWorkspace(
		projectId: string,
		options: WorkspaceSyncOptions = {}
	): Promise<WorkspaceSyncResult> {
		const startedAt = new Date();
		const project = await this.getProject(projectId);

		if (!project.sandboxId) {
			throw new Error(`Project ${projectId} does not have an associated Daytona sandbox`);
		}

		const daytonaService = DaytonaService.getInstance();

		const fileTree = await daytonaService.listFiles(project.sandboxId, '/workspace');
		const files = fileTree.filter((item) => item.type === 'file');

		const {
			maxFiles = 200,
			chunkSize = 2000,
			chunkOverlap = 200,
			maxFileSizeKB = 512,
			includeExtensions,
			excludeExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'bmp', 'pdf', 'zip', 'tar', 'gz'],
			includeHidden = false
		} = options;

		const processedDocuments: WorkspaceSyncResult['documents'] = [];
		const skipped: WorkspaceSyncResult['skipped'] = [];
		const errors: WorkspaceSyncResult['errors'] = [];

		let processedFiles = 0;
		let indexedDocuments = 0;
		let totalBytes = 0;

		for (const file of files.slice(0, maxFiles)) {
			if (!includeHidden && this.isHiddenPath(file.path)) {
				skipped.push({ filePath: file.path, reason: 'hidden-file' });
				continue;
			}

			const extension = this.getExtension(file.path);

			if (excludeExtensions.includes(extension)) {
				skipped.push({ filePath: file.path, reason: `excluded-extension:${extension}` });
				continue;
			}

			if (includeExtensions && includeExtensions.length > 0 && !includeExtensions.includes(extension)) {
				skipped.push({ filePath: file.path, reason: `not-in-allowlist:${extension}` });
				continue;
			}

			try {
				const content = await daytonaService.readFile(project.sandboxId, file.path, {
					encoding: 'utf-8'
				});

				if (!content) {
					skipped.push({ filePath: file.path, reason: 'empty-file' });
					continue;
				}

				const fileSizeBytes = Buffer.byteLength(content, 'utf-8');
				const fileSizeKB = fileSizeBytes / 1024;

				if (fileSizeKB > maxFileSizeKB) {
					skipped.push({ filePath: file.path, reason: `file-too-large:${fileSizeKB.toFixed(1)}KB` });
					continue;
				}

				const language = this.detectLanguage(extension);
				const type = this.detectDocumentType(extension);

				const chunks = this.chunkContent(content, chunkSize, chunkOverlap);

				for (const [index, chunk] of chunks.entries()) {
					const documentId = `${projectId}:${file.path}:${index}`;
					const document: CodebaseDocument = {
						id: documentId,
						filePath: file.path,
						content: chunk,
						language,
						projectId,
						lastModified: new Date(),
						metadata: {
							type,
							framework: project.framework,
							dependencies: project.configuration?.additionalDependencies || [],
							functions: [],
							classes: [],
							imports: [],
							exports: []
						}
					};

					await vectorDbService.indexCodebaseDocument(document);

					processedDocuments.push({
						id: documentId,
						filePath: file.path,
						chunkIndex: index,
						chunkSize: chunk.length,
						language,
						type
					});

					indexedDocuments++;
				}

				totalBytes += fileSizeBytes;
				processedFiles++;
			} catch (error) {
				errors.push({
					filePath: file.path,
					message: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		}

		const completedAt = new Date();

		return {
			projectId,
			provider: 'daytona',
			sandboxId: project.sandboxId!,
			summary: {
				totalFiles: files.length,
				processedFiles,
				skippedFiles: skipped.length,
				indexedDocuments,
				totalBytes
			},
			documents: processedDocuments,
			skipped,
			errors,
			startedAt: startedAt.toISOString(),
			completedAt: completedAt.toISOString()
		};
	}

	private async getProject(projectId: string): Promise<Project> {
		const project = await DatabaseService.findProjectById(projectId);

		if (!project) {
			throw new Error(`Project not found: ${projectId}`);
		}

		if (project.sandboxProvider !== 'daytona') {
			throw new Error(`Project ${projectId} is not backed by a Daytona workspace`);
		}

		return project;
	}

	private chunkContent(content: string, chunkSize: number, overlap: number): string[] {
		if (content.length <= chunkSize) {
			return [content];
		}

		const chunks: string[] = [];
		let start = 0;
		const effectiveOverlap = Math.min(overlap, chunkSize - 1);

		while (start < content.length) {
			const end = Math.min(content.length, start + chunkSize);
			chunks.push(content.slice(start, end));
			if (end === content.length) break;
			start = end - effectiveOverlap;
		}

		return chunks;
	}

	private getExtension(filePath: string): string {
		return filePath.split('.').pop()?.toLowerCase() || '';
	}

	private isHiddenPath(filePath: string): boolean {
		return filePath.split('/').some((segment) => segment.startsWith('.'));
	}

	private detectLanguage(extension: string): string {
		const languageMap: Record<string, string> = {
			c: 'c',
			cpp: 'cpp',
			css: 'css',
			go: 'go',
			html: 'html',
			java: 'java',
			js: 'javascript',
			json: 'json',
			jsx: 'javascript',
			kt: 'kotlin',
			lock: 'plaintext',
			markdown: 'markdown',
			md: 'markdown',
			php: 'php',
			py: 'python',
			rb: 'ruby',
			rs: 'rust',
			sass: 'sass',
			scss: 'scss',
			sh: 'shell',
			svelte: 'svelte',
			ts: 'typescript',
			tsx: 'typescript',
			txt: 'plaintext',
			yaml: 'yaml',
			yml: 'yaml',
			toml: 'toml'
		};

		return languageMap[extension] || 'plaintext';
	}

	private detectDocumentType(
		extension: string
	): CodebaseDocument['metadata']['type'] {
		const configExtensions = ['json', 'yaml', 'yml', 'toml', 'lock'];
		const documentationExtensions = ['md', 'markdown'];

		if (documentationExtensions.includes(extension)) {
			return 'documentation';
		}

		if (configExtensions.includes(extension)) {
			return 'config';
		}

		return 'code';
	}
}

export const workspaceContextService = WorkspaceContextService.getInstance();
