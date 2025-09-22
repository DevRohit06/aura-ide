<script lang="ts">
	import type { EditorView } from '@codemirror/view';
	import { undo, redo } from '@codemirror/commands';
	import {
		Root as ContextMenu,
		ContextMenuTrigger,
		ContextMenuContent,
		ContextMenuItem,
		ContextMenuSeparator,
		ContextMenuShortcut
	} from '$lib/components/ui/context-menu';

	interface Props {
		children: any;
		editorView: EditorView | null;
		onSearch: () => void;
	}

	let { children, editorView, onSearch }: Props = $props();

	// Context menu actions
	function handleCut() {
		if (editorView) {
			const selection = editorView.state.selection.main;
			if (!selection.empty) {
				const selectedText = editorView.state.doc.sliceString(selection.from, selection.to);
				navigator.clipboard.writeText(selectedText);
				editorView.dispatch({
					changes: { from: selection.from, to: selection.to, insert: '' }
				});
			}
		}
	}

	function handleCopy() {
		if (editorView) {
			const selection = editorView.state.selection.main;
			if (!selection.empty) {
				const selectedText = editorView.state.doc.sliceString(selection.from, selection.to);
				navigator.clipboard.writeText(selectedText);
			}
		}
	}

	async function handlePaste() {
		if (editorView) {
			try {
				const clipboardText = await navigator.clipboard.readText();
				const selection = editorView.state.selection.main;
				editorView.dispatch({
					changes: { from: selection.from, to: selection.to, insert: clipboardText }
				});
			} catch (error) {
				console.error('Failed to paste:', error);
			}
		}
	}

	function handleSelectAll() {
		if (editorView) {
			editorView.dispatch({
				selection: { anchor: 0, head: editorView.state.doc.length }
			});
		}
	}

	function handleUndo() {
		if (editorView) {
			undo(editorView);
		}
	}

	function handleRedo() {
		if (editorView) {
			redo(editorView);
		}
	}

	function handleFind() {
		onSearch();
	}

	// Check if actions are available
	let hasSelection = $derived(() => {
		if (!editorView) return false;
		const selection = editorView.state.selection.main;
		return !selection.empty;
	});
</script>

<ContextMenu>
	<ContextMenuTrigger class="h-full w-full">
		{@render children()}
	</ContextMenuTrigger>

	<ContextMenuContent class="w-48">
		<!-- Edit actions -->
		<ContextMenuItem onclick={handleUndo} disabled={!editorView}>
			<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
				/>
			</svg>
			Undo
			<ContextMenuShortcut>Ctrl+Z</ContextMenuShortcut>
		</ContextMenuItem>

		<ContextMenuItem onclick={handleRedo} disabled={!editorView}>
			<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M21 10H11a8 8 0 00-8 8v2m18-10l-6-6m6 6l-6 6"
				/>
			</svg>
			Redo
			<ContextMenuShortcut>Ctrl+Y</ContextMenuShortcut>
		</ContextMenuItem>

		<ContextMenuSeparator />

		<ContextMenuItem onclick={handleCut} disabled={!hasSelection}>
			<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h8m-8-8h8"
				/>
			</svg>
			Cut
			<ContextMenuShortcut>Ctrl+X</ContextMenuShortcut>
		</ContextMenuItem>

		<ContextMenuItem onclick={handleCopy} disabled={!hasSelection}>
			<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
				/>
			</svg>
			Copy
			<ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
		</ContextMenuItem>

		<ContextMenuItem onclick={handlePaste} disabled={!editorView}>
			<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
				/>
			</svg>
			Paste
			<ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
		</ContextMenuItem>

		<ContextMenuSeparator />

		<ContextMenuItem onclick={handleSelectAll} disabled={!editorView}>
			<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			Select All
			<ContextMenuShortcut>Ctrl+A</ContextMenuShortcut>
		</ContextMenuItem>

		<ContextMenuItem onclick={handleFind} disabled={!editorView}>
			<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<circle cx="11" cy="11" r="8" />
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="m21 21-4.35-4.35"
				/>
			</svg>
			Find
			<ContextMenuShortcut>Ctrl+F</ContextMenuShortcut>
		</ContextMenuItem>
	</ContextMenuContent>
</ContextMenu>
