<script lang="ts">
	// Props expected by parent components. Use $props() destructuring per project Svelte 5 conventions.
	interface Props {
		open?: boolean;
		title?: string;
		description?: string;
		confirmLabel?: string;
		cancelLabel?: string;
	}

	let {
		open = $bindable(false),
		title = 'Confirm',
		description = '',
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel'
	}: Props = $props();

	import { Button } from '$lib/components/ui/button';
	import {
		Dialog,
		DialogContent,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	// Dispatch confirm/cancel events and open updates for two-way binding in Svelte 5
	import { createEventDispatcher } from 'svelte';
	// In Svelte 5 exported props are readonly. To support bind:open from parents,
	// we dispatch an 'open' event with the new boolean value instead of assigning the prop.
	const dispatch = createEventDispatcher<{ confirm: void; cancel: void; open: boolean }>();

	function onConfirm() {
		dispatch('confirm');
		// Inform parent that the dialog should be closed. Parent can update bound value.
		dispatch('open', false);
	}

	function onCancel() {
		dispatch('cancel');
		// Inform parent that the dialog should be closed.
		dispatch('open', false);
	}
</script>

<Dialog bind:open>
	<DialogContent class="max-w-lg">
		<DialogHeader>
			<DialogTitle>{title}</DialogTitle>
		</DialogHeader>
		<div class="mt-2 text-sm text-muted-foreground">{description}</div>
		<DialogFooter class="mt-4 flex justify-end gap-2">
			<Button variant="ghost" onclick={onCancel}>{cancelLabel}</Button>
			<Button variant="destructive" onclick={onConfirm}>{confirmLabel}</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
