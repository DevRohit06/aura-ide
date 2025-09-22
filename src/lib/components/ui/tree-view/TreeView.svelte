<script lang="ts">
	let {
		class: className = '',
		children,
		...restProps
	}: {
		class?: string;
		children?: any;
		[key: string]: any;
	} = $props();
</script>

<div class={`tree-view ${className}`} role="tree" {...restProps}>
	{@render children?.()}
</div>

<style>
	.tree-view {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}
</style>
