<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { css } from '@codemirror/lang-css';
	import { html } from '@codemirror/lang-html';
	import { javascript } from '@codemirror/lang-javascript';
	import { json } from '@codemirror/lang-json';
	import { markdown } from '@codemirror/lang-markdown';
	import { python } from '@codemirror/lang-python';
	import { oneDark } from '@codemirror/theme-one-dark';
	import { EditorView } from '@codemirror/view';
	import { Check, Copy } from '@lucide/svelte';
	import { mode } from 'mode-watcher';
	import { onDestroy, onMount } from 'svelte';
	import { tomorrow } from 'thememirror';

	interface Props {
		code: string;
		language?: string;
	}

	let { code, language = 'text' }: Props = $props();

	let copied = $state(false);

	// Copy functionality
	async function copyCode() {
		try {
			await navigator.clipboard.writeText(code);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 2000);
		} catch (err) {
			console.error('Failed to copy code:', err);
		}
	}

	let editorContainer: HTMLElement;
	let editor: EditorView | null = null;

	// Language mapping for CodeMirror
	const languageMap: Record<string, any> = {
		javascript: javascript,
		js: javascript,
		typescript: javascript,
		ts: javascript,
		python: python,
		py: python,
		html: html,
		css: css,
		json: json,
		markdown: markdown,
		md: markdown
	};

	// Get the current theme
	function getCurrentTheme(): 'light' | 'dark' {
		return mode.current === 'dark' ? 'dark' : 'light';
	}

	// Create CodeMirror editor
	function createEditor() {
		if (!editorContainer) return;

		const isDark = getCurrentTheme() === 'dark';

		// Get language extension
		const langExt = languageMap[language.toLowerCase()]?.() || [];

		editor = new EditorView({
			doc: code,
			extensions: [
				highlightSpecialChars(),
				drawSelection(),
				syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
				keymap.of(defaultKeymap),
				langExt,
				isDark ? oneDark : tomorrow,
				EditorView.editable.of(false), // Make it read-only
				EditorView.theme({
					'&': {
						height: 'auto',
						minHeight: '2rem'
					},
					'.cm-scroller': {
						fontSize: '14px',
						padding: '0.5rem'
					},
					'.cm-focused': {
						outline: 'none'
					},
					'.cm-content': {
						padding: 0
					}
				})
			],
			parent: editorContainer
		});
	}

	onMount(() => {
		createEditor();
	});

	onDestroy(() => {
		if (editor) {
			editor.destroy();
			editor = null;
		}
	});
</script>

<div class="code-block-container">
	<div class="code-header">
		<span class="language-label">{language}</span>
		<Button
			variant="ghost"
			size="icon"
			class="ml-auto h-6 w-6 text-muted-foreground hover:text-foreground"
			onclick={copyCode}
			title={copied ? 'Copied!' : 'Copy code'}
		>
			{#if copied}
				<Check size={14} />
			{:else}
				<Copy size={14} />
			{/if}
		</Button>
	</div>
	<div bind:this={editorContainer} class="code-editor-container"></div>
</div>

<style>
	.code-block-container {
		margin: 1em 0;
		border-radius: 8px;
		overflow: hidden;
		border: 1px solid hsl(var(--border));
		background-color: hsl(var(--card));
	}

	.code-header {
		background-color: hsl(var(--muted));
		padding: 0.5em 1em;
		border-bottom: 1px solid hsl(var(--border));
		font-size: 0.875em;
		font-weight: 500;
		color: hsl(var(--muted-foreground));
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.code-editor-container {
		background-color: hsl(var(--card));
		min-height: 2rem;
	}

	.code-editor-container :global(.cm-editor) {
		height: auto !important;
		min-height: 2rem;
	}

	.code-editor-container :global(.cm-scroller) {
		padding: 0 !important;
	}

	.code-editor-container :global(.cm-content) {
		padding: 0 !important;
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		font-size: 14px;
		line-height: 1.5;
	}
</style>
