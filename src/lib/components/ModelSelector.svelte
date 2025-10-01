<script lang="ts">
	// Backwards-compatible wrapper that delegates to the UI folder's model selector.
	import ModelSelectorInner from './ui/model-selector/model-selector.svelte';

	export let value: string | undefined;
	export let onValueChange: ((v: string) => void) | undefined;
	export let placeholder: string = 'Select a model...';
	export let className: string = '';
	export let disabled: boolean = false;
</script>

<!-- Forward all props/events to the canonical model selector placed in ui/ -->
<ModelSelectorInner {value} {onValueChange} {placeholder} {className} {disabled} on:change />
