<script lang="ts">
	import { revertSanitizedResponseContent, unescapeHtml } from '$lib';
	import DOMPurify from 'dompurify';
	import { createEventDispatcher } from 'svelte';
	import { quintOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import CodeBlockDisplay from '../ui/code-block-display.svelte';
	import KatexRenderer from './katex-renderer.svelte';
	import LlmThink from './llm-think.svelte';
	import MarkdownInlineTokens from './markdown-inline-tokens.svelte';
	import Markdown_tokens from './markdown-tokens.svelte';

	interface Props {
		// Component props
		streaming?: boolean;
		data: any;
		id: string;
		tokens?: any[];
		top?: boolean;
		fontFamily?: 'mono' | 'sans' | 'serif';
		fontSize?: 'md' | 'lg' | 'xl' | '2xl';
		messageId?: string | undefined;
		roomId?: string | undefined;
		sessionId?: string | undefined;
		users?: any[];
	}

	let {
		streaming = false,
		data,
		id,
		tokens = [],
		top = true,
		fontFamily = 'mono',
		fontSize = 'md',
		messageId = undefined,
		roomId = undefined,
		sessionId = undefined,
		users = []
	}: Props = $props();

	let codeFont = $derived(
		{
			mono: 'font-mono',
			sans: 'font-sans',
			serif: 'font-serif'
		}[fontFamily]
	);

	let textSize = $derived(
		{
			md: 'text-[15px]',
			lg: 'text-[17px]',
			xl: 'text-[19px]',
			'2xl': 'text-[21px]'
		}[fontSize]
	);

	let textClasses = $derived(`${textSize} leading-relaxed ${codeFont}`);

	const dispatch = createEventDispatcher();

	// Helper functions
	const getHeaderComponent = (depth: number) => `h${depth}`;

	let copiedStates: { [key: string]: boolean } = $state({});

	// DOMPurify configuration for safe HTML rendering
	const purifyConfig = {
		ALLOWED_TAGS: [
			'div',
			'p',
			'span',
			'a',
			'b',
			'i',
			'strong',
			'em',
			'strike',
			'code',
			'pre',
			'table',
			'thead',
			'tbody',
			'tr',
			'th',
			'td',
			'h1',
			'h2',
			'h3',
			'h4',
			'h5',
			'h6',
			'blockquote',
			'ul',
			'ol',
			'li',
			'br',
			'hr',
			'img',
			'video',
			'audio',
			'iframe'
		],
		ALLOWED_ATTR: [
			'href',
			'src',
			'alt',
			'title',
			'class',
			'style',
			'target',
			'width',
			'height',
			'controls',
			'allowfullscreen'
		],
		ALLOWED_STYLES: [
			'color',
			'background-color',
			'border',
			'border-radius',
			'padding',
			'margin',
			'font-size',
			'font-weight',
			'font-style',
			'text-decoration',
			'width',
			'height',
			'display',
			'flex-direction',
			'align-items',
			'justify-content',
			'gap'
		],
		RETURN_DOM_FRAGMENT: false,
		RETURN_DOM: false
	};

	// Process HTML content with enhanced styling and image handling
	function processHTML(html: string) {
		if (!html) return '';

		const doc = new DOMParser().parseFromString(html, 'text/html');

		// Add error handling for images
		doc.querySelectorAll('img').forEach((img) => {
			img.onerror = () => {
				img.setAttribute('data-error', 'true');
				img.setAttribute('alt', 'Failed to load image');
			};
			img.loading = 'lazy';
		});

		// Special handling for media content
		if (html.includes('<video') || html.includes('<iframe')) {
			return DOMPurify.sanitize(doc.body.innerHTML, {
				...purifyConfig,
				ADD_TAGS: ['video', 'iframe'],
				ADD_ATTR: ['allowfullscreen', 'frameborder', 'controls', 'loading', 'onerror', 'data-error']
			});
		}

		return DOMPurify.sanitize(doc.body.innerHTML, {
			...purifyConfig,
			ADD_ATTR: ['loading', 'onerror', 'data-error']
		});
	}
</script>

<!-- Markdown Token Renderer -->
{#each tokens as token, tokenIdx (tokenIdx)}
	<div
		class={streaming ? 'token-animate' : ''}
		in:fly={{ y: 10, duration: 400, delay: Math.min(tokenIdx * 10, 1000), easing: quintOut }}
	>
		{#if token.type === 'hr'}
			<hr class="my-3 border-t border-primary/20" />
		{:else if token.type === 'think'}
			<LlmThink text={token.text} raw={token.raw} />
		{:else if token.type === 'jsonArtifact'}
			<!-- <ArtifactTrigger
				_id={token._id || undefined}
				id={token.id}
				identifier={token.identifier}
				extension={token.extension}
				artifact={token.artifact}
				isPartial={token?.isStreaming}
				isStreaming={token?.isStreaming}
				version={token?.jsonData?.version}
			/> -->
		{:else if token.type === 'heading'}
			<svelte:element
				this={getHeaderComponent(token.depth)}
				class="font-semibold {token.depth === 1
					? 'text-xl'
					: token.depth === 2
						? 'text-lg'
						: 'text-base'} mb-3"
			>
				<MarkdownInlineTokens
					{messageId}
					{roomId}
					{sessionId}
					{data}
					id={`${id}-${tokenIdx}-h`}
					tokens={token.tokens ?? []}
				/>
			</svelte:element>
		{:else if token.type === 'code'}
			{#if token.raw.includes('```')}
				<!-- Code block with syntax highlighting -->
				{#if token.lang === 'mermaid'}
					<CodeBlockDisplay code={token?.text} language={token.lang ?? ''} />
				{:else}
					<!-- Regular code block -->
					<CodeBlockDisplay code={token?.text} language={token.lang ?? ''} {textClasses} />
				{/if}
			{:else}
				<!-- Inline code -->
				<code class="rounded bg-background/10 px-1.5 py-0.5 text-[15px] {codeFont}">
					{unescapeHtml(token.text ?? '')}
				</code>
			{/if}
		{:else if token.type === 'table'}
			<!-- Table with header and rows -->
			<div class="relative my-3 max-w-full overflow-x-auto rounded-lg border border-[#3E3E3E]/35">
				<table class="w-full text-base">
					<thead class="bg-[#3E3E3E]/10 dark:bg-[#3E3E3E]/15">
						<tr>
							{#each token.header as header, headerIdx}
								<th
									class="border-b border-[#3E3E3E]/35 px-4 py-2.5 text-left font-medium"
									style={token.align[headerIdx] ? `text-align: ${token.align[headerIdx]}` : ''}
								>
									<MarkdownInlineTokens
										{data}
										id={`${id}-${tokenIdx}-header-${headerIdx}`}
										tokens={header.tokens ?? []}
									/>
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each token.rows as row, rowIdx}
							<tr
								class="border-b border-[#3E3E3E]/35 transition-colors last:border-none hover:bg-[#3E3E3E]/10 dark:hover:bg-[#3E3E3E]/15"
							>
								{#each row ?? [] as cell, cellIdx}
									<td
										class="px-4 py-2.5"
										style={token.align[cellIdx] ? `text-align: ${token.align[cellIdx]}` : ''}
									>
										<MarkdownInlineTokens
											{data}
											id={`${id}-${tokenIdx}-row-${rowIdx}-${cellIdx}`}
											tokens={cell.tokens ?? []}
										/>
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else if token.type === 'blockquote'}
			<blockquote
				class="my-3 rounded-r border-l-4 border-primary/30 bg-background/5 py-2 pl-4 italic"
			>
				<Markdown_tokens id={`${id}-${tokenIdx}`} tokens={token.tokens ?? []} />
			</blockquote>
		{:else if token.type === 'list'}
			<!-- Ordered and unordered lists -->
			<div class="my-3">
				{#if token.ordered}
					<ol start={token.start || 1} class="list-decimal space-y-1 pl-6">
						{#each token.items as item, itemIdx}
							<li>
								<Markdown_tokens
									id={`${id}-${tokenIdx}-${itemIdx}`}
									tokens={item.tokens ?? []}
									top={token.loose}
								/>
							</li>
						{/each}
					</ol>
				{:else}
					<ul class="ml-2 list-disc space-y-1 pl-6">
						{#each token.items as item, itemIdx}
							<li>
								<Markdown_tokens
									id={`${id}-${tokenIdx}-${itemIdx}`}
									tokens={item.tokens ?? []}
									top={token.loose}
								/>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{:else if token.type === 'paragraph'}
			<p class="mb-3 last:mb-0">
				<MarkdownInlineTokens
					{streaming}
					{data}
					id={`${id}-${tokenIdx}-p`}
					tokens={token.tokens ?? []}
				/>
			</p>
		{:else if token.type === 'html'}
			<!-- HTML content with special handling for media -->
			<div class="my-3">
				{#if token.text?.includes('<video')}
					<div class="relative overflow-hidden rounded-lg bg-black/5">
						{@html processHTML(token.text)}
					</div>
				{:else if token.text?.includes('<iframe')}
					<div class="relative aspect-video overflow-hidden rounded-lg">
						{@html processHTML(token.text)}
					</div>
				{:else}
					<div class="prose-html">
						{@html processHTML(token.text ?? '')}
					</div>
				{/if}
			</div>
		{:else if token.type === 'inlineKatex' || token.type === 'blockKatex'}
			<!-- Math rendering -->
			{#if token.text}
				<div
					class={token.type === 'blockKatex' ? 'my-4 overflow-x-auto' : 'inline-flex items-center'}
				>
					<KatexRenderer
						content={revertSanitizedResponseContent(token.text)}
						displayMode={token.type === 'blockKatex'}
					/>
				</div>
			{/if}
		{:else if token.type === 'space'}
			<div class="h-2"></div>
		{:else if token.type === 'text' && top}
			<p class="mb-3 last:mb-0">
				{#if token.tokens}
					<MarkdownInlineTokens {data} id={`${id}-${tokenIdx}-t`} tokens={token.tokens ?? []} />
				{:else}
					{token.text}
				{/if}
			</p>
		{:else if token.type === 'text' && token.tokens}
			<MarkdownInlineTokens {data} id={`${id}-${tokenIdx}-p`} tokens={token.tokens ?? []} />
		{:else if token.type === 'text'}
			<span class="stream-text">
				{token.text}
			</span>
			{#if streaming && tokenIdx === tokens.length - 1}
				<span class="cursor-blink"></span>
			{/if}
		{:else if token.type === 'image'}
			<!-- Image with error handling -->
			<div class="my-3">
				<img
					src={token.href}
					alt={token.text || ''}
					class="max-w-full rounded-lg"
					loading="lazy"
					onerror={(e) => {
						e.currentTarget.setAttribute('data-error', 'true');
						e.currentTarget.setAttribute('alt', 'Failed to load image');
					}}
				/>
			</div>
		{:else}
			{unescapeHtml(token.raw ?? '')}
		{/if}
	</div>
{/each}

<style>
	/* Token animation for markdown elements */
	.token-animate {
		animation: tokenIn 0.2s ease-out forwards;
		will-change: transform, opacity;
	}

	@keyframes tokenIn {
		from {
			opacity: 0;
			transform: translateY(5px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Streaming text animation */
	.stream-text {
		display: inline;
		opacity: 0;
		animation: streamIn 0.15s ease-out forwards;
	}

	@keyframes streamIn {
		from {
			opacity: 0;
			transform: translateY(2px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Cursor animation for streaming */
	.cursor-blink {
		display: inline-block;
		width: 2px;
		height: 1.2em;
		background: rgb(213, 213, 204);
		margin-left: 2px;
		vertical-align: middle;
		animation: blink 0.8s step-end infinite;
	}

	@keyframes blink {
		from,
		to {
			opacity: 0;
		}
		50% {
			opacity: 1;
		}
	}

	/* Typewriter animation for text content */
	.text-animate {
		display: inline;
		overflow: hidden;
		border-right: 2px solid transparent;
		white-space: pre-wrap;
		animation:
			typing 1.5s steps(40, end),
			blink-caret 0.75s step-end infinite;
	}

	@keyframes typing {
		from {
			width: 0;
			opacity: 0;
		}
		to {
			width: 100%;
			opacity: 1;
		}
	}

	@keyframes blink-caret {
		from,
		to {
			border-color: transparent;
		}
		50% {
			border-color: rgb(213, 213, 204);
		}
	}

	/* Global prose styles for markdown content */
	:global(.prose) {
		max-width: none;
		line-height: 1.6;
		color: rgb(213, 213, 204);
	}

	:global(.prose p),
	:global(.prose li),
	:global(.prose strong),
	:global(.prose em) {
		font-size: inherit !important;
		color: rgb(213, 213, 204);
	}

	/* Heading styles */
	:global(.prose h1),
	:global(.prose h2),
	:global(.prose h3),
	:global(.prose h4),
	:global(.prose h5),
	:global(.prose h6) {
		color: rgb(213, 213, 204);
		margin: 0.5em 0 0.25em;
		line-height: 1.3;
		font-size: calc(1em * var(--heading-scale)) !important;
	}

	:global(.prose h1) {
		--heading-scale: 1.5;
	}
	:global(.prose h2) {
		--heading-scale: 1.25;
	}
	:global(.prose h3) {
		--heading-scale: 1.1;
	}

	/* List styles */
	:global(.prose ul),
	:global(.prose ol) {
		color: rgb(213, 213, 204);
		margin: 0.75em 0;
		padding-left: 1.5em;
	}

	:global(.prose li) {
		color: rgb(213, 213, 204);
		margin: 0.375em 0;
	}

	/* Code block styles */
	:global(.prose pre) {
		margin: 0;
		padding: 0;
		font-size: 0.9em;
		line-height: 1.5;
	}

	:global(.prose code) {
		font-size: 0.9em;
	}

	/* Block element styles */
	:global(.prose blockquote) {
		color: rgb(213, 213, 204);
		margin: 1em 0;
		padding: 0.75em 1.25em;
	}

	/* Table styles */
	:global(.prose table) {
		color: rgb(213, 213, 204);
		margin: 0.75em 0;
		border-collapse: separate;
		border-spacing: 0;
		width: 100%;
	}

	:global(.prose table th) {
		font-weight: 500;
		color: rgb(213, 213, 204);
	}

	:global(.prose table td, .prose table th) {
		padding: 0.625em 1em;
		border: 1px solid rgba(62, 62, 62, 0.35);
	}

	:global(.dark .prose table td, .dark .prose table th) {
		border-color: rgba(62, 62, 62, 0.35);
	}

	/* Math rendering styles */
	:global(.katex-display) {
		margin: 0.5em 0;
		overflow-x: auto;
		overflow-y: hidden;
	}

	:global(.katex) {
		font-size: 1.1em;
	}

	/* HTML content styles */
	:global(.prose-html) {
		color: var(--text-foreground);
	}

	:global(.prose-html div) {
		margin: 0.75em 0;
	}

	:global(.prose-html a) {
		color: var(--colors-primary);
		text-decoration: none;
		border-bottom: 1px solid var(--colors-primary);
	}

	/* Image styles */
	:global(.prose-html img) {
		max-width: 100%;
		height: auto;
		border-radius: 0.5rem;
		display: block;
		margin: 1em 0;
		background: rgba(62, 62, 62, 0.05);
		min-height: 100px;
		position: relative;
	}

	:global(.prose-html img[data-error='true']) {
		position: relative;
		min-height: 200px;
		background: rgba(62, 62, 62, 0.05);
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgba(62, 62, 62, 0.5);
	}

	:global(.prose-html img[data-error='true']::before) {
		content: 'Failed to load image';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		font-size: 0.9em;
	}

	/* Embedded content styles */
	:global(.prose-html iframe) {
		width: 100%;
		height: 100%;
		border: none;
	}

	:global(.prose-html video) {
		max-width: 100%;
		border-radius: 0.5rem;
	}

	/* Code block styles in HTML */
	:global(.prose-html pre) {
		/* padding: 1em; */
		border-radius: 0.5rem;
		overflow-x: auto;
	}

	:global(.prose-html code) {
		padding: 0.2em 0.4em;
		border-radius: 0.25rem;
		font-size: 0.9em;
	}

	/* Table styles in HTML */
	:global(.prose-html table) {
		width: 100%;
		border-collapse: collapse;
		margin: 1em 0;
	}

	:global(.prose-html th, .prose-html td) {
		border: 1px solid rgba(62, 62, 62, 0.35);
		padding: 0.625em 1em;
	}

	/* Blockquote styles in HTML */
	:global(.prose-html blockquote) {
		border-left: 4px solid var(--colors-primary);
		margin: 1em 0;
		padding: 0.5em 1em;
		background: var(--colors-primary-light);
		border-radius: 0 0.5rem 0.5rem 0;
	}
</style>
