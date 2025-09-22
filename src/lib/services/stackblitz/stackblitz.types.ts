export interface StackBlitzTemplate {
	name: string;
	path: string;
	description: string;
	framework: string;
	features: string[];
	files: Record<string, string>;
	packageJson?: any;
}

export interface StackBlitzDownloadOptions {
	framework: string;
	starter: string;
	version?: string;
}

export interface StackBlitzDownloadResult {
	success: boolean;
	template?: StackBlitzTemplate;
	files?: Record<string, string>;
	error?: string;
}

export interface StackBlitzService {
	// Template Management
	getAvailableTemplates(): Promise<StackBlitzTemplate[]>;
	getTemplate(framework: string, starter: string): Promise<StackBlitzTemplate | null>;
	downloadTemplate(options: StackBlitzDownloadOptions): Promise<StackBlitzDownloadResult>;

	// File Operations
	extractTemplateFiles(template: StackBlitzTemplate): Promise<Record<string, string>>;
	validateTemplate(template: StackBlitzTemplate): Promise<boolean>;

	// Integration
	applyTemplateToSandbox(
		sandboxId: string,
		template: StackBlitzTemplate,
		mountPath: string
	): Promise<boolean>;
}
