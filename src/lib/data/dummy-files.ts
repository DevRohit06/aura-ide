import type { FileSystemItem, File, Directory } from '@/types/files';

// Helper function to create base file system item
const createBaseItem = (
	id: string,
	name: string,
	path: string,
	parentId: string | null,
	type: 'file' | 'directory',
	createdAt = new Date('2024-01-15'),
	modifiedAt = new Date('2024-08-20')
): Omit<FileSystemItem, 'size'> => ({
	id,
	name,
	path,
	parentId,
	type,
	createdAt,
	modifiedAt,
	permissions: {
		read: true,
		write: true,
		execute: type === 'directory',
		delete: true,
		share: true,
		owner: 'user',
		collaborators: []
	}
});

// File contents and metadata
export const fileContents: Record<
	string,
	{
		content: string;
		language: string;
		isDirty: boolean;
	}
> = {
	'package-json': {
		content: `{
  "name": "aura-ide",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "check:watch": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch",
    "test": "vitest"
  },
  "devDependencies": {
    "@sveltejs/adapter-auto": "^3.0.0",
    "@sveltejs/kit": "^2.0.0",
    "@sveltejs/vite-plugin-svelte": "^4.0.0",
    "svelte": "^5.0.0",
    "svelte-check": "^4.0.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0",
    "vitest": "^2.0.0"
  },
  "dependencies": {
    "@codemirror/lang-javascript": "^6.2.2",
    "@codemirror/lang-python": "^6.1.4",
    "codemirror": "^6.0.1"
  }
}`,
		language: 'json',
		isDirty: false
	},
	'readme-md': {
		content: `# Aura IDE

A modern, web-based IDE built with SvelteKit and CodeMirror.

## Features

- 🌟 Modern editor with syntax highlighting
- 📁 File explorer with tree view
- 🎨 Dark/Light theme support
- 🔍 Search and replace
- 🚀 Fast and responsive
- 📱 Mobile-friendly design

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Tech Stack

- **Frontend**: SvelteKit 5
- **Editor**: CodeMirror 6
- **Styling**: TailwindCSS
- **Icons**: Lucide Icons
- **Build Tool**: Vite

## Contributing

Feel free to contribute to this project by opening issues or pull requests.

## License

MIT License
`,
		language: 'markdown',
		isDirty: true
	},
	gitignore: {
		content: `# Dependencies
node_modules/
.pnp
.pnp.js

# Production build
/build
/dist
/.svelte-kit

# Environment variables
.env
.env.local
.env.production

# IDE files
.vscode/
.idea/

# OS files
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
`,
		language: 'text',
		isDirty: false
	},
	'utils-ts': {
		content: `import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function formatDate(date: Date): string {
	return new Intl.DateTimeFormat('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	}).format(date);
}

export function debounce<T extends (...args: any[]) => any>(
	func: T,
	delay: number
): (...args: Parameters<T>) => void {
	let timeoutId: NodeJS.Timeout;
	return (...args: Parameters<T>) => {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => func.apply(null, args), delay);
	};
}

export function throttle<T extends (...args: any[]) => any>(
	func: T,
	delay: number
): (...args: Parameters<T>) => void {
	let lastCall = 0;
	return (...args: Parameters<T>) => {
		const now = new Date().getTime();
		if (now - lastCall < delay) {
			return;
		}
		lastCall = now;
		return func.apply(null, args);
	};
}`,
		language: 'typescript',
		isDirty: false
	},
	'button-svelte': {
		content: `<script lang="ts">
	import { cn } from '$lib/utils.js';
	import type { ComponentProps } from 'svelte';
	
	let {
		children,
		variant = 'default',
		size = 'default',
		class: className,
		...restProps
	}: {
		children: any;
		variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
		size?: 'default' | 'sm' | 'lg' | 'icon';
		class?: string;
	} & ComponentProps<'button'> = $props();

	const variants = {
		default: 'bg-primary text-primary-foreground hover:bg-primary/90',
		destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
		outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
		secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
		ghost: 'hover:bg-accent hover:text-accent-foreground',
		link: 'text-primary underline-offset-4 hover:underline'
	};

	const sizes = {
		default: 'h-10 px-4 py-2',
		sm: 'h-9 rounded-md px-3',
		lg: 'h-11 rounded-md px-8',
		icon: 'h-10 w-10'
	};
</script>

<button
	class={cn(
		'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
		variants[variant],
		sizes[size],
		className
	)}
	{...restProps}
>
	{@render children()}
</button>`,
		language: 'svelte',
		isDirty: true
	},
	'card-svelte': {
		content: `<script lang="ts">
	import { cn } from '$lib/utils.js';
	import type { ComponentProps } from 'svelte';
	
	let {
		children,
		class: className,
		...restProps
	}: {
		children: any;
		class?: string;
	} & ComponentProps<'div'> = $props();
</script>

<div
	class={cn(
		'rounded-lg border bg-card text-card-foreground shadow-sm',
		className
	)}
	{...restProps}
>
	{@render children()}
</div>`,
		language: 'svelte',
		isDirty: true
	},
	'page-svelte': {
		content: `<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	
	let count = $state(0);
	
	function increment() {
		count += 1;
	}
	
	function decrement() {
		count -= 1;
	}
</script>

<svelte:head>
	<title>Aura IDE - Home</title>
	<meta name="description" content="Welcome to Aura IDE" />
</svelte:head>

<main class="container mx-auto px-4 py-8">
	<h1 class="text-4xl font-bold text-center mb-8">
		Welcome to Aura IDE
	</h1>
	
	<div class="max-w-md mx-auto">
		<Card class="p-6">
			<h2 class="text-2xl font-semibold mb-4">Counter Demo</h2>
			<div class="flex items-center justify-center gap-4">
				<Button onclick={decrement} variant="outline">
					-
				</Button>
				<span class="text-2xl font-mono">{count}</span>
				<Button onclick={increment}>
					+
				</Button>
			</div>
		</Card>
	</div>
	
	<div class="mt-8 text-center">
		<p class="text-muted-foreground">
			This is a demo page showcasing Svelte 5 features.
		</p>
	</div>
</main>`,
		language: 'svelte',
		isDirty: true
	},
	'layout-svelte': {
		content: `<script lang="ts">
	import '../app.css';
	
	let { children } = $props();
</script>

<div class="min-h-screen bg-background font-sans antialiased">
	<header class="border-b">
		<div class="container flex h-16 items-center px-4">
			<nav class="flex items-center space-x-6 text-sm font-medium">
				<a
					href="/"
					class="transition-colors hover:text-foreground/80 text-foreground"
				>
					Home
				</a>
				<a
					href="/editor"
					class="transition-colors hover:text-foreground/80 text-foreground/60"
				>
					Editor
				</a>
			</nav>
		</div>
	</header>
	
	<main>
		{@render children()}
	</main>
</div>`,
		language: 'svelte',
		isDirty: false
	}
};

// Create complete files
export const completeFiles: File[] = [
	{
		...createBaseItem('package-json', 'package.json', '/package.json', null, 'file'),
		size: 1024,
		content: fileContents['package-json'].content,
		language: fileContents['package-json'].language,
		encoding: 'utf-8' as const,
		mimeType: 'application/json',
		isDirty: fileContents['package-json'].isDirty,
		isReadOnly: false,
		metadata: {
			extension: '.json',
			lineCount: 24,
			characterCount: 685,
			wordCount: 45,
			lastCursor: null,
			bookmarks: [],
			breakpoints: [],
			folds: [],
			searchHistory: []
		}
	},
	{
		...createBaseItem(
			'readme-md',
			'README.md',
			'/README.md',
			null,
			'file',
			new Date('2024-01-15'),
			new Date('2024-08-25')
		),
		size: 2048,
		content: fileContents['readme-md'].content,
		language: fileContents['readme-md'].language,
		encoding: 'utf-8' as const,
		mimeType: 'text/markdown',
		isDirty: fileContents['readme-md'].isDirty,
		isReadOnly: false,
		metadata: {
			extension: '.md',
			lineCount: 32,
			characterCount: 512,
			wordCount: 78,
			lastCursor: { line: 10, column: 5, timestamp: new Date() },
			bookmarks: [],
			breakpoints: [],
			folds: [],
			searchHistory: ['features', 'install']
		}
	},
	{
		...createBaseItem('gitignore', '.gitignore', '/.gitignore', null, 'file'),
		size: 512,
		content: fileContents['gitignore'].content,
		language: fileContents['gitignore'].language,
		encoding: 'utf-8' as const,
		mimeType: 'text/plain',
		isDirty: fileContents['gitignore'].isDirty,
		isReadOnly: false,
		metadata: {
			extension: '',
			lineCount: 23,
			characterCount: 245,
			wordCount: 25,
			lastCursor: null,
			bookmarks: [],
			breakpoints: [],
			folds: [],
			searchHistory: []
		}
	},
	{
		...createBaseItem(
			'utils-ts',
			'utils.ts',
			'/src/lib/utils.ts',
			'lib-dir',
			'file',
			new Date('2024-01-16'),
			new Date('2024-08-20')
		),
		size: 1536,
		content: fileContents['utils-ts'].content,
		language: fileContents['utils-ts'].language,
		encoding: 'utf-8' as const,
		mimeType: 'text/typescript',
		isDirty: fileContents['utils-ts'].isDirty,
		isReadOnly: false,
		metadata: {
			extension: '.ts',
			lineCount: 35,
			characterCount: 845,
			wordCount: 98,
			lastCursor: null,
			bookmarks: [],
			breakpoints: [],
			folds: [],
			searchHistory: []
		}
	},
	{
		...createBaseItem(
			'button-svelte',
			'Button.svelte',
			'/src/lib/components/Button.svelte',
			'components-dir',
			'file',
			new Date('2024-01-16'),
			new Date('2024-08-15')
		),
		size: 2048,
		content: fileContents['button-svelte'].content,
		language: fileContents['button-svelte'].language,
		encoding: 'utf-8' as const,
		mimeType: 'text/svelte',
		isDirty: fileContents['button-svelte'].isDirty,
		isReadOnly: false,
		metadata: {
			extension: '.svelte',
			lineCount: 42,
			characterCount: 1254,
			wordCount: 156,
			lastCursor: null,
			bookmarks: [],
			breakpoints: [],
			folds: [],
			searchHistory: []
		}
	},
	{
		...createBaseItem(
			'card-svelte',
			'Card.svelte',
			'/src/lib/components/Card.svelte',
			'components-dir',
			'file',
			new Date('2024-01-17'),
			new Date('2024-08-10')
		),
		size: 1024,
		content: fileContents['card-svelte'].content,
		language: fileContents['card-svelte'].language,
		encoding: 'utf-8' as const,
		mimeType: 'text/svelte',
		isDirty: fileContents['card-svelte'].isDirty,
		isReadOnly: false,
		metadata: {
			extension: '.svelte',
			lineCount: 22,
			characterCount: 356,
			wordCount: 48,
			lastCursor: { line: 15, column: 12, timestamp: new Date() },
			bookmarks: [],
			breakpoints: [],
			folds: [],
			searchHistory: []
		}
	},
	{
		...createBaseItem(
			'page-svelte',
			'+page.svelte',
			'/src/routes/+page.svelte',
			'routes-dir',
			'file',
			new Date('2024-01-15'),
			new Date('2024-08-25')
		),
		size: 3072,
		content: fileContents['page-svelte'].content,
		language: fileContents['page-svelte'].language,
		encoding: 'utf-8' as const,
		mimeType: 'text/svelte',
		isDirty: fileContents['page-svelte'].isDirty,
		isReadOnly: false,
		metadata: {
			extension: '.svelte',
			lineCount: 45,
			characterCount: 968,
			wordCount: 128,
			lastCursor: { line: 25, column: 8, timestamp: new Date() },
			bookmarks: [{ id: 'bm1', line: 5, column: 0, label: 'Counter state', createdAt: new Date() }],
			breakpoints: [],
			folds: [],
			searchHistory: ['count', 'Button']
		}
	},
	{
		...createBaseItem(
			'layout-svelte',
			'+layout.svelte',
			'/src/routes/+layout.svelte',
			'routes-dir',
			'file',
			new Date('2024-01-15'),
			new Date('2024-08-20')
		),
		size: 1536,
		content: fileContents['layout-svelte'].content,
		language: fileContents['layout-svelte'].language,
		encoding: 'utf-8' as const,
		mimeType: 'text/svelte',
		isDirty: fileContents['layout-svelte'].isDirty,
		isReadOnly: false,
		metadata: {
			extension: '.svelte',
			lineCount: 28,
			characterCount: 562,
			wordCount: 75,
			lastCursor: null,
			bookmarks: [],
			breakpoints: [],
			folds: [],
			searchHistory: []
		}
	}
] as File[];

// Create complete directories
export const completeDirectories: Directory[] = [
	{
		...createBaseItem(
			'src-dir',
			'src',
			'/src',
			null,
			'directory',
			new Date('2024-01-15'),
			new Date('2024-08-25')
		),
		children: ['lib-dir', 'routes-dir'],
		isExpanded: true,
		isRoot: false
	},
	{
		...createBaseItem(
			'lib-dir',
			'lib',
			'/src/lib',
			'src-dir',
			'directory',
			new Date('2024-01-15'),
			new Date('2024-08-20')
		),
		children: ['components-dir', 'utils-ts'],
		isExpanded: true,
		isRoot: false
	},
	{
		...createBaseItem(
			'components-dir',
			'components',
			'/src/lib/components',
			'lib-dir',
			'directory',
			new Date('2024-01-15'),
			new Date('2024-08-15')
		),
		children: ['button-svelte', 'card-svelte'],
		isExpanded: true,
		isRoot: false
	},
	{
		...createBaseItem(
			'routes-dir',
			'routes',
			'/src/routes',
			'src-dir',
			'directory',
			new Date('2024-01-15'),
			new Date('2024-08-25')
		),
		children: ['page-svelte', 'layout-svelte'],
		isExpanded: false,
		isRoot: false
	}
] as Directory[];

// All complete file system items
export const completeFileSystem: FileSystemItem[] = [...completeFiles, ...completeDirectories];

// Git changes (for the Changes section in sidebar)
export const gitChanges = [
	{
		file: 'README.md',
		state: 'M' // Modified
	},
	{
		file: '+page.svelte',
		state: 'M' // Modified
	},
	{
		file: 'Card.svelte',
		state: 'M' // Modified
	}
];
