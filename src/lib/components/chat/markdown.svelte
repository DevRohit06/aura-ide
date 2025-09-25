<script lang="ts">
	// import '$lib/styles/int-artifacts.scss';
	import markedExtension from '$lib/utils/marked/extensions';
	import markedKatexExtension from '$lib/utils/marked/katex-extension';
	import mentionExtension, {
		processParagraphWithMentions
	} from '$lib/utils/marked/mention-extension';
	import thinkExtension, { processThinkBlocks } from '$lib/utils/marked/think';
	import { Marked, type MarkedExtension, type Token } from 'marked';
	import { createEventDispatcher } from 'svelte';
	import MarkdownTokens from './markdown-tokens.svelte';

	const dispatch = createEventDispatcher();

	interface Props {
		data: any;
		streaming?: boolean;
		id: string;
		content: string;
		fontFamily?: 'mono' | 'sans' | 'serif';
		fontSize?: 'md' | 'lg' | 'xl' | '2xl';
		// Add props for artifact tracking
		messageId?: string | undefined;
		roomId?: string | undefined;
		sessionId?: string | undefined;
	}

	let {
		data,
		streaming = false,
		id,
		content,
		fontFamily = 'mono',
		fontSize = 'md',
		messageId = undefined,
		roomId = undefined,
		sessionId = undefined
	}: Props = $props();

	let tokens: Token[] = $state([]);
	let users: any[] = $state([]);
	let lastProcessedContent = $state('');

	// Update users when data changes
	$effect(() => {
		users =
			data?.members && data?.agents?.agents
				? [
						...data.members.map((member: { user: { fullName: any; name: any; _id: any } }) => ({
							...member.user,
							name: member.user.fullName || member.user.name,
							_id: member.user._id
						})),
						...data.agents.agents
					]
				: [];
	});

	// Process tokens when content changes
	$effect(() => {
		// Only process if content actually changed
		if (content && content !== lastProcessedContent) {
			lastProcessedContent = content;

			(async () => {
				try {
					// Create options fresh to avoid reactive dependencies
					const currentOptions = {
						messageId,
						roomId,
						sessionId,
						throwOnError: false
					};

					// Create a fresh marked instance with extensions for each processing
					const markedInstance = new Marked();
					markedInstance.use(
						markedKatexExtension(currentOptions) as unknown as MarkedExtension,
						markedExtension(currentOptions) as unknown as MarkedExtension,
						// jsonArtifactExtension(currentOptions) as unknown as MarkedExtension,
						mentionExtension(currentOptions) as unknown as MarkedExtension,
						thinkExtension(currentOptions) as unknown as MarkedExtension
					);

					// Get initial tokens from marked lexer
					const allTokens = markedInstance.lexer(content);
					console.log('All tokens from marked lexer:', allTokens);
					let mergedTokens = [];

					// Process think blocks automatically
					const processedThinkTokens = processThinkBlocks(allTokens);

					// Process each token for mentions
					for (const token of processedThinkTokens) {
						// Handle mentions and links in paragraphs using the mention extension
						if (token.type === 'paragraph') {
							const processedParagraph = processParagraphWithMentions(token, users);
							if (processedParagraph) {
								mergedTokens.push(processedParagraph);
								continue;
							}
						}

						// For all other tokens, add them as-is
						mergedTokens.push(token);
					}

					tokens = mergedTokens;
					console.log('Tokens after processing:', tokens);
					dispatch('update', { tokens });
				} catch (error) {
					console.error('Error parsing markdown:', error);
				}
			})();
		}
	});
</script>

{#key id}
	<MarkdownTokens
		{streaming}
		{tokens}
		{users}
		{fontFamily}
		{fontSize}
		{messageId}
		{roomId}
		{sessionId}
		{data}
		{id}
	/>
{/key}
