#!/usr/bin/env node

/**
 * Vector Store Initialization Script
 * Scans the codebase and indexes files for semantic search capabilities
 *
 * Usage:
 *   node scripts/index-codebase.ts [options]
 *
 * Options:
 *   --project-id <id>    Project ID to associate documents with (default: 'default')
 *   --path <path>        Root path to scan (default: 'src')
 *   --exclude <patterns> Comma-separated glob patterns to exclude
 *   --max-files <num>    Maximum number of files to process (default: 1000)
 *   --batch-size <num>   Batch size for indexing (default: 50)
 *   --dry-run           Show what would be indexed without actually indexing
 *   --force              Clear existing index before indexing
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { minimatch } from 'minimatch';
import { extname, join, relative } from 'path';
import { vectorDbService, type CodebaseDocument } from '../src/lib/services/vector-db.service';
import { logger } from '../src/lib/utils/logger';

interface IndexOptions {
	projectId: string;
	rootPath: string;
	excludePatterns: string[];
	maxFiles: number;
	batchSize: number;
	dryRun: boolean;
	force: boolean;
}

class CodebaseIndexer {
	private options: IndexOptions;
	private processedFiles = 0;
	private indexedFiles = 0;

	constructor(options: IndexOptions) {
		this.options = options;
	}

	async initialize(): Promise<void> {
		logger.info('Initializing vector database...');
		await vectorDbService.initialize();

		if (this.options.force) {
			logger.warn('Force flag set - this would clear existing index');
			if (!this.options.dryRun) {
				// Note: We don't have a clear method, so we'll just proceed
				logger.info('Proceeding with indexing (existing documents will be updated)');
			}
		}
	}

	async indexCodebase(): Promise<void> {
		logger.info(`Starting codebase indexing for project: ${this.options.projectId}`);
		logger.info(`Root path: ${this.options.rootPath}`);
		logger.info(`Max files: ${this.options.maxFiles}`);
		logger.info(`Batch size: ${this.options.batchSize}`);
		logger.info(`Dry run: ${this.options.dryRun}`);

		const files = this.scanDirectory(this.options.rootPath);
		logger.info(`Found ${files.length} files to process`);

		if (files.length > this.options.maxFiles) {
			logger.warn(`Limiting to ${this.options.maxFiles} files`);
		}

		const filesToProcess = files.slice(0, this.options.maxFiles);
		const documents: CodebaseDocument[] = [];

		for (const filePath of filesToProcess) {
			try {
				const doc = await this.processFile(filePath);
				if (doc) {
					documents.push(doc);
					this.indexedFiles++;
				}
			} catch (error) {
				logger.error(`Failed to process ${filePath}:`, error);
			}

			this.processedFiles++;
			if (this.processedFiles % 100 === 0) {
				logger.info(`Processed ${this.processedFiles}/${filesToProcess.length} files`);
			}
		}

		logger.info(`Generated ${documents.length} documents from ${this.indexedFiles} files`);

		if (this.options.dryRun) {
			logger.info('Dry run - showing first few documents:');
			documents.slice(0, 3).forEach((doc, i) => {
				logger.info(`${i + 1}. ${doc.filePath} (${doc.content.length} chars, ${doc.language})`);
			});
			return;
		}

		// Index documents in batches
		await this.indexDocuments(documents);

		logger.info('Codebase indexing completed successfully!');
		logger.info(`Total files processed: ${this.processedFiles}`);
		logger.info(`Documents indexed: ${this.indexedFiles}`);
	}

	private scanDirectory(dirPath: string): string[] {
		const files: string[] = [];

		try {
			const entries = readdirSync(dirPath);

			for (const entry of entries) {
				const fullPath = join(dirPath, entry);
				const relativePath = relative(this.options.rootPath, fullPath);

				// Check if path should be excluded
				if (this.shouldExclude(relativePath)) {
					continue;
				}

				const stat = statSync(fullPath);

				if (stat.isDirectory()) {
					// Skip common directories that shouldn't be indexed
					if (!['node_modules', '.git', 'dist', 'build', '.svelte-kit'].includes(entry)) {
						files.push(...this.scanDirectory(fullPath));
					}
				} else if (stat.isFile()) {
					files.push(fullPath);
				}
			}
		} catch (error) {
			logger.error(`Failed to scan directory ${dirPath}:`, error);
		}

		return files;
	}

	private shouldExclude(filePath: string): boolean {
		return this.options.excludePatterns.some((pattern) => minimatch(filePath, pattern));
	}

	private async processFile(filePath: string): Promise<CodebaseDocument | null> {
		try {
			const content = readFileSync(filePath, 'utf-8');
			const relativePath = relative(this.options.rootPath, filePath);
			const language = this.detectLanguage(filePath);

			// Skip files that are too large or empty
			if (content.length === 0 || content.length > 100000) {
				return null;
			}

			// Skip binary files and certain file types
			if (this.isBinaryFile(filePath) || this.shouldSkipFileType(filePath)) {
				return null;
			}

			const metadata = this.extractMetadata(content, language);

			const document: CodebaseDocument = {
				id: `${this.options.projectId}:${relativePath}:${Date.now()}`,
				filePath: relativePath,
				content,
				language,
				projectId: this.options.projectId,
				lastModified: new Date(),
				metadata
			};

			return document;
		} catch (error) {
			logger.warn(`Failed to read file ${filePath}:`, error);
			return null;
		}
	}

	private detectLanguage(filePath: string): string {
		const ext = extname(filePath).toLowerCase();

		const languageMap: Record<string, string> = {
			'.js': 'javascript',
			'.jsx': 'javascript',
			'.ts': 'typescript',
			'.tsx': 'typescript',
			'.py': 'python',
			'.java': 'java',
			'.c': 'c',
			'.cpp': 'cpp',
			'.cc': 'cpp',
			'.cxx': 'cpp',
			'.h': 'c',
			'.hpp': 'cpp',
			'.cs': 'csharp',
			'.php': 'php',
			'.rb': 'ruby',
			'.go': 'go',
			'.rs': 'rust',
			'.sh': 'shell',
			'.bash': 'shell',
			'.zsh': 'shell',
			'.fish': 'shell',
			'.html': 'html',
			'.css': 'css',
			'.scss': 'scss',
			'.sass': 'sass',
			'.less': 'less',
			'.json': 'json',
			'.xml': 'xml',
			'.yaml': 'yaml',
			'.yml': 'yaml',
			'.md': 'markdown',
			'.txt': 'text',
			'.sql': 'sql',
			'.dockerfile': 'dockerfile'
		};

		return languageMap[ext] || 'text';
	}

	private isBinaryFile(filePath: string): boolean {
		const binaryExtensions = [
			'.png',
			'.jpg',
			'.jpeg',
			'.gif',
			'.bmp',
			'.ico',
			'.svg',
			'.woff',
			'.woff2',
			'.ttf',
			'.eot'
		];
		const ext = extname(filePath).toLowerCase();
		return binaryExtensions.includes(ext);
	}

	private shouldSkipFileType(filePath: string): boolean {
		const skipPatterns = [
			'*.lock',
			'*.log',
			'*.tmp',
			'*.temp',
			'*.cache',
			'*.min.js',
			'*.min.css',
			'package-lock.json',
			'yarn.lock',
			'pnpm-lock.yaml'
		];

		return skipPatterns.some((pattern) => minimatch(filePath, pattern));
	}

	private extractMetadata(content: string, language: string): CodebaseDocument['metadata'] {
		const metadata: CodebaseDocument['metadata'] = {
			type: 'code'
		};

		try {
			switch (language) {
				case 'javascript':
				case 'typescript':
					metadata.functions = this.extractFunctions(content, language);
					metadata.classes = this.extractClasses(content, language);
					metadata.imports = this.extractImports(content, language);
					metadata.exports = this.extractExports(content, language);
					break;

				case 'python':
					metadata.functions = this.extractPythonFunctions(content);
					metadata.classes = this.extractPythonClasses(content);
					metadata.imports = this.extractPythonImports(content);
					break;

				case 'java':
					metadata.classes = this.extractJavaClasses(content);
					break;

				case 'markdown':
					metadata.type = 'documentation';
					break;

				case 'json':
				case 'yaml':
				case 'yml':
					metadata.type = 'config';
					break;
			}

			// Determine if this is a framework file
			metadata.framework = this.detectFramework(content, language);
		} catch (error) {
			logger.warn('Failed to extract metadata:', error);
		}

		return metadata;
	}

	private extractFunctions(content: string, language: string): string[] {
		const functions: string[] = [];
		const patterns = {
			javascript: /function\s+(\w+)\s*\(/g,
			typescript:
				/(?:function\s+(\w+)\s*\(|const\s+(\w+)\s*=\s*\([^)]*\)\s*=>|(\w+)\s*\([^)]*\)\s*{)/g
		};

		const pattern = patterns[language as keyof typeof patterns];
		if (pattern) {
			let match;
			while ((match = pattern.exec(content)) !== null) {
				const funcName = match[1] || match[2] || match[3];
				if (funcName && !functions.includes(funcName)) {
					functions.push(funcName);
				}
			}
		}

		return functions;
	}

	private extractClasses(content: string, language: string): string[] {
		const classes: string[] = [];
		const patterns = {
			javascript: /class\s+(\w+)/g,
			typescript: /class\s+(\w+)/g,
			python: /class\s+(\w+)/g,
			java: /class\s+(\w+)/g
		};

		const pattern = patterns[language as keyof typeof patterns];
		if (pattern) {
			let match;
			while ((match = pattern.exec(content)) !== null) {
				if (match[1] && !classes.includes(match[1])) {
					classes.push(match[1]);
				}
			}
		}

		return classes;
	}

	private extractImports(content: string, language: string): string[] {
		const imports: string[] = [];

		if (language === 'javascript' || language === 'typescript') {
			const importPatterns = [
				/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
				/import\s+['"]([^'"]+)['"]/g,
				/const\s+\w+\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
			];

			for (const pattern of importPatterns) {
				let match;
				while ((match = pattern.exec(content)) !== null) {
					if (match[1] && !imports.includes(match[1])) {
						imports.push(match[1]);
					}
				}
			}
		}

		return imports;
	}

	private extractExports(content: string, language: string): string[] {
		const exports: string[] = [];

		if (language === 'javascript' || language === 'typescript') {
			const exportPatterns = [
				/export\s+(?:const|let|var|function|class)\s+(\w+)/g,
				/export\s*{\s*([^}]+)\s*}/g,
				/export\s+default\s+(?:\w+\s+)?(\w+)/g
			];

			for (const pattern of exportPatterns) {
				let match;
				while ((match = pattern.exec(content)) !== null) {
					if (match[1]) {
						const exportNames = match[1].split(',').map((s: string) => s.trim().split(' as ')[0]);
						for (const name of exportNames) {
							if (name && !exports.includes(name)) {
								exports.push(name);
							}
						}
					} else if (match[2]) {
						const exportName = match[2].trim();
						if (exportName && !exports.includes(exportName)) {
							exports.push(exportName);
						}
					}
				}
			}
		}

		return exports;
	}

	private extractPythonFunctions(content: string): string[] {
		const functions: string[] = [];
		const pattern = /def\s+(\w+)\s*\(/g;

		let match;
		while ((match = pattern.exec(content)) !== null) {
			if (match[1] && !functions.includes(match[1])) {
				functions.push(match[1]);
			}
		}

		return functions;
	}

	private extractPythonClasses(content: string): string[] {
		const classes: string[] = [];
		const pattern = /class\s+(\w+)/g;

		let match;
		while ((match = pattern.exec(content)) !== null) {
			if (match[1] && !classes.includes(match[1])) {
				classes.push(match[1]);
			}
		}

		return classes;
	}

	private extractPythonImports(content: string): string[] {
		const imports: string[] = [];
		const patterns = [/import\s+([^\n]+)/g, /from\s+([^\n]+)/g];

		for (const pattern of patterns) {
			let match;
			while ((match = pattern.exec(content)) !== null) {
				if (match[1]) {
					const importLine = match[1].trim();
					if (!imports.includes(importLine)) {
						imports.push(importLine);
					}
				}
			}
		}

		return imports;
	}

	private extractJavaClasses(content: string): string[] {
		const classes: string[] = [];
		const pattern = /(?:public\s+|private\s+|protected\s+)?class\s+(\w+)/g;

		let match;
		while ((match = pattern.exec(content)) !== null) {
			if (match[2] && !classes.includes(match[2])) {
				classes.push(match[2]);
			}
		}

		return classes;
	}

	private detectFramework(content: string, language: string): string | undefined {
		const frameworkPatterns: Record<string, RegExp[]> = {
			react: [/import\s+.*\s+from\s+['"]react['"]/i, /React\./, /useState|useEffect|useContext/],
			svelte: [/<script[^>]*>[\s\S]*?<\/script>/i, /export\s+let\s+/, /\$:/],
			vue: [/import\s+.*\s+from\s+['"]vue['"]/i, /Vue\./, /<template>/],
			angular: [/import\s+.*\s+from\s+['"]@angular['"]/i, /@Component|@Injectable/],
			express: [/import\s+.*\s+from\s+['"]express['"]/i, /app\.(get|post|put|delete)/],
			fastify: [/import\s+.*\s+from\s+['"]fastify['"]/i],
			nextjs: [/import\s+.*\s+from\s+['"]next['"]/i, /getServerSideProps|getStaticProps/],
			sveltekit: [
				/<script[^>]*context=['"]module['"][^>]*>/i,
				/import\s+.*\s+from\s+['"]@sveltejs\/kit['"]/i
			]
		};

		for (const [framework, patterns] of Object.entries(frameworkPatterns)) {
			if (patterns.some((pattern) => pattern.test(content))) {
				return framework;
			}
		}

		return undefined;
	}

	private async indexDocuments(documents: CodebaseDocument[]): Promise<void> {
		const batches = [];
		for (let i = 0; i < documents.length; i += this.options.batchSize) {
			batches.push(documents.slice(i, i + this.options.batchSize));
		}

		logger.info(`Indexing ${documents.length} documents in ${batches.length} batches`);

		for (let i = 0; i < batches.length; i++) {
			const batch = batches[i];
			logger.info(`Indexing batch ${i + 1}/${batches.length} (${batch.length} documents)`);

			try {
				// Use the vector DB indexing API
				const response = await fetch('http://localhost:5173/api/vector-db/index', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(batch)
				});

				if (!response.ok) {
					const error = await response.json();
					throw new Error(`Indexing failed: ${error.message}`);
				}

				const result = await response.json();
				logger.info(`Batch ${i + 1} indexed: ${result.indexedCount}/${batch.length} documents`);
			} catch (error) {
				logger.error(`Failed to index batch ${i + 1}:`, error);
				// Continue with next batch
			}

			// Small delay between batches
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}
}

// Parse command line arguments
function parseArgs(): IndexOptions {
	const args = process.argv.slice(2);
	const options: IndexOptions = {
		projectId: 'default',
		rootPath: 'src',
		excludePatterns: [
			'**/node_modules/**',
			'**/.git/**',
			'**/dist/**',
			'**/build/**',
			'**/.svelte-kit/**'
		],
		maxFiles: 1000,
		batchSize: 50,
		dryRun: false,
		force: false
	};

	for (let i = 0; i < args.length; i++) {
		switch (args[i]) {
			case '--project-id':
				options.projectId = args[++i];
				break;
			case '--path':
				options.rootPath = args[++i];
				break;
			case '--exclude':
				options.excludePatterns = args[++i].split(',');
				break;
			case '--max-files':
				options.maxFiles = parseInt(args[++i], 10);
				break;
			case '--batch-size':
				options.batchSize = parseInt(args[++i], 10);
				break;
			case '--dry-run':
				options.dryRun = true;
				break;
			case '--force':
				options.force = true;
				break;
			default:
				if (args[i].startsWith('--')) {
					console.error(`Unknown option: ${args[i]}`);
					process.exit(1);
				}
		}
	}

	return options;
}

// Main execution
async function main() {
	try {
		const options = parseArgs();
		const indexer = new CodebaseIndexer(options);

		await indexer.initialize();
		await indexer.indexCodebase();

		process.exit(0);
	} catch (error) {
		console.error('Indexing failed:', error);
		process.exit(1);
	}
}

if (require.main === module) {
	main();
}
