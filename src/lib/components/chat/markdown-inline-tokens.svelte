<script lang="ts">
	import AnchorModal from '$lib/components/common/modals/anchor-modal.svelte';
	import DOMPurify from 'dompurify';
	import type { Token } from 'marked';
	import { toast } from 'svelte-sonner';
	import { quintOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import Markdown_inline_tokens from './markdown-inline-tokens.svelte';
	// import { WEBUI_BASE_URL } from '$lib/constants';
	import { copyToClipboard, revertSanitizedResponseContent, unescapeHtml } from '$lib';

	// import Tooltip from '$lib/components/tooltip.svelte';
	// import ImageComponent from '../image-component.svelte';
	import KatexRenderer from './katex-renderer.svelte';

	interface Props {
		data: any;
		id: string;
		tokens: Token[];
		streaming?: boolean;
		messageId?: string | undefined;
		roomId?: string | undefined;
		sessionId?: string | undefined;
	}

	let {
		data,
		id,
		tokens,
		streaming = false,
		messageId = undefined,
		roomId = undefined,
		sessionId = undefined
	}: Props = $props();
</script>

{#each tokens as token, i}
	<span
		class={streaming ? 'inline-token-animate' : ''}
		in:fly={{ y: 5, duration: 150, delay: i * 15, easing: quintOut }}
	>
		{#if token.type === 'escape'}
			{unescapeHtml(token.text)}
		{:else if token.type === 'html'}
			{@const html = DOMPurify.sanitize(token.text)}
			{#if html && html.includes('<video')}
				{@html html}
				<!-- {:else if token.text.includes(`<iframe src="${WEBUI_BASE_URL}/api/v1/files/`)}
				{@html `${token.text}`} -->
			{:else}
				{token.text}
			{/if}
		{:else if token.type === 'link'}
			{#if token.tokens}
				<span class="not-prose inline-block">
					<AnchorModal url={token?.href} {token}>
						<Markdown_inline_tokens id={`${id}-a`} tokens={token.tokens} />
					</AnchorModal>
				</span>
			{:else}
				<span class="not-prose inline-block">
					<AnchorModal {token} url={token?.href}>
						{token.title}
					</AnchorModal>
				</span>
			{/if}
		{:else if token.type === 'mention'}
			<span class="inline-block items-center rounded-md bg-primary/20 px-1 text-sm text-foreground"
				>{token?.text}</span
			>
		{:else if token.type === 'link-mention'}
			<!-- <Tooltip text="Links with @ will go to Interactive's knowledge base" className=" inline-flex">
				<LinkMention url={token.href} text={token.text} isExternal={token.isExternal} />
			</Tooltip> -->
		{:else if token.type === 'image'}
			<!-- <ImageComponent {data} src={token.href} alt={token.text} title={token?.text} /> -->

			<img src={token.href} alt={token.text} title={token?.text} class="max-w-full rounded" />
		{:else if token.type === 'strong'}
			<strong>
				<Markdown_inline_tokens id={`${id}-strong`} tokens={token.tokens} />
			</strong>
		{:else if token.type === 'em'}
			<em>
				<Markdown_inline_tokens id={`${id}-em`} tokens={token.tokens} />
			</em>
		{:else if token.type === 'codespan'}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<code
				class="cursor-pointer rounded-md bg-black/30 px-1.5 py-1 font-mono font-light text-foreground/80 before:content-[''] after:content-['']"
				onclick={() => {
					copyToClipboard(unescapeHtml(token.text));
					toast.success('Copied to clipboard');
				}}
			>
				{unescapeHtml(token.text)}
			</code>
		{:else if token.type === 'br'}
			<br />
		{:else if token.type === 'del'}
			<del>
				<Markdown_inline_tokens id={`${id}-del`} tokens={token.tokens} />
			</del>
		{:else if token.type === 'inlineKatex'}
			{#if token.text}
				<KatexRenderer content={revertSanitizedResponseContent(token.text)} displayMode={false} />
			{/if}
			<!-- {:else if token.type === 'iframe'}
			<iframe
				src="{WEBUI_BASE_URL}/api/v1/files/{token.fileId}/content"
				title={token.fileId}
				width="100%"
				frameborder="0"
				onload="this.style.height=(this.contentWindow.document.body.scrollHeight+20)+'px';"
			></iframe> -->
		{:else if token.type === 'text'}
			{token.raw}
		{/if}
	</span>
{/each}

<style>
	.inline-token-animate {
		animation: inlineTokenIn 0.15s ease-out forwards;
		will-change: transform, opacity, filter;
	}

	@keyframes inlineTokenIn {
		from {
			opacity: 0;
			transform: translateY(5px);
			filter: blur(4px);
		}
		50% {
			opacity: 0.5;
			filter: blur(2px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
			filter: blur(0);
		}
	}
</style>
