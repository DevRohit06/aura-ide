<script lang="ts">
	let {
		class: className = '',
		selected = $bindable(false),
		expanded = $bindable(false),
		onclick,
		children,
		...restProps
	}: {
		class?: string;
		selected?: boolean;
		expanded?: boolean;
		onclick?: (e: MouseEvent) => void;
		children?: any;
		[key: string]: any;
	} = $props();
</script>

<div
	class={`tree-view-item ${className}`}
	class:selected
	role="treeitem"
	aria-selected={selected}
	aria-expanded={expanded}
	{onclick}
	{...restProps}
>
	{@render children?.()}
</div>

<style>
	.tree-view-item {
		display: block;
		width: 100%;
		text-align: left;
		cursor: pointer;
		border-radius: 0.375rem;
		transition: background-color 0.15s ease;
	}

	.tree-view-item.selected {
		background-color: hsl(var(--accent));
		color: hsl(var(--accent-foreground));
	}

	.tree-view-item:hover {
		background-color: hsl(var(--muted) / 0.5);
	}
</style>
