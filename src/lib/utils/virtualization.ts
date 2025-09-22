/**
 * Virtualization utilities for handling large datasets efficiently
 */

import type { FileSystemItem, Directory } from '$lib/types/files';

export interface VirtualizedItem {
	id: string;
	index: number;
	level: number;
	isVisible: boolean;
	height: number;
	data: any;
}

export interface VirtualizedTreeNode extends VirtualizedItem {
	isExpanded: boolean;
	hasChildren: boolean;
	parentId: string | null;
	item: FileSystemItem;
}

export interface VirtualScrollConfig {
	itemHeight: number;
	containerHeight: number;
	overscan: number;
	scrollTop: number;
}

/**
 * Calculate visible items in a virtualized list
 */
export function calculateVisibleRange(config: VirtualScrollConfig) {
	const { itemHeight, containerHeight, overscan, scrollTop } = config;

	const startIndex = Math.floor(scrollTop / itemHeight);
	const endIndex = Math.min(
		startIndex + Math.ceil(containerHeight / itemHeight) + overscan,
		Number.MAX_SAFE_INTEGER
	);

	return {
		startIndex: Math.max(0, startIndex - overscan),
		endIndex,
		offsetY: startIndex * itemHeight
	};
}

/**
 * Flatten file tree into virtualized nodes for efficient rendering
 */
export function flattenFileTree(
	files: Map<string, FileSystemItem>,
	directories: Map<string, Directory>,
	expandedFolders: Set<string>,
	rootId: string | null = null,
	level: number = 0
): VirtualizedTreeNode[] {
	const result: VirtualizedTreeNode[] = [];
	let index = 0;

	function processNode(fileId: string, currentLevel: number) {
		const file = files.get(fileId);
		if (!file) return;

		const directory = file.type === 'directory' ? directories.get(fileId) : null;
		const hasChildren = directory ? directory.children.length > 0 : false;

		const node: VirtualizedTreeNode = {
			id: file.id,
			index: index++,
			level: currentLevel,
			isVisible: true,
			height: 24, // Standard tree item height
			isExpanded: file.type === 'directory' && expandedFolders.has(file.id),
			hasChildren,
			parentId: file.parentId,
			item: file,
			data: file
		};

		result.push(node);

		// Process children if directory is expanded
		if (node.isExpanded && directory) {
			// Sort children: directories first, then files, both alphabetically
			const sortedChildren = [...directory.children].sort((a, b) => {
				const fileA = files.get(a);
				const fileB = files.get(b);
				if (!fileA || !fileB) return 0;

				// Directories first
				if (fileA.type !== fileB.type) {
					return fileA.type === 'directory' ? -1 : 1;
				}

				// Then alphabetically
				return fileA.name.localeCompare(fileB.name);
			});

			for (const childId of sortedChildren) {
				processNode(childId, currentLevel + 1);
			}
		}
	}

	// Find root nodes (files with no parent or specified root)
	const rootNodes = Array.from(files.values())
		.filter((file) => file.parentId === rootId)
		.sort((a, b) => {
			// Directories first, then alphabetically
			if (a.type !== b.type) {
				return a.type === 'directory' ? -1 : 1;
			}
			return a.name.localeCompare(b.name);
		});

	for (const rootNode of rootNodes) {
		processNode(rootNode.id, level);
	}

	return result;
}

/**
 * Virtual scroll manager for efficient rendering of large lists
 */
export class VirtualScrollManager {
	private items: VirtualizedItem[] = [];
	private config: VirtualScrollConfig;
	private visibleRange = { startIndex: 0, endIndex: 0, offsetY: 0 };

	constructor(config: VirtualScrollConfig) {
		this.config = config;
	}

	setItems(items: VirtualizedItem[]) {
		this.items = items;
		this.updateVisibleRange();
	}

	updateScrollPosition(scrollTop: number) {
		this.config.scrollTop = scrollTop;
		this.updateVisibleRange();
	}

	updateContainerHeight(height: number) {
		this.config.containerHeight = height;
		this.updateVisibleRange();
	}

	private updateVisibleRange() {
		this.visibleRange = calculateVisibleRange(this.config);
	}

	getVisibleItems(): VirtualizedItem[] {
		return this.items.slice(this.visibleRange.startIndex, this.visibleRange.endIndex);
	}

	getVisibleRange() {
		return this.visibleRange;
	}

	getTotalHeight(): number {
		return this.items.length * this.config.itemHeight;
	}

	getOffsetY(): number {
		return this.visibleRange.offsetY;
	}
}

/**
 * Search and filter utilities for virtualized trees
 */
export function filterVirtualizedTree(
	nodes: VirtualizedTreeNode[],
	searchTerm: string
): VirtualizedTreeNode[] {
	if (!searchTerm.trim()) return nodes;

	const filteredNodes: VirtualizedTreeNode[] = [];
	const matchingIds = new Set<string>();
	const parentIds = new Set<string>();

	// Find all matching nodes
	for (const node of nodes) {
		if (node.item.name.toLowerCase().includes(searchTerm.toLowerCase())) {
			matchingIds.add(node.id);

			// Add all parent nodes to ensure path visibility
			let currentParentId = node.parentId;
			while (currentParentId && !parentIds.has(currentParentId)) {
				parentIds.add(currentParentId);
				const parentNode = nodes.find((n) => n.id === currentParentId);
				if (parentNode) {
					currentParentId = parentNode.parentId;
				} else {
					break;
				}
			}
		}
	}

	// Include matching nodes and their parents
	let index = 0;
	for (const node of nodes) {
		if (matchingIds.has(node.id) || parentIds.has(node.id)) {
			filteredNodes.push({
				...node,
				index: index++,
				isExpanded: parentIds.has(node.id) || node.isExpanded
			});
		}
	}

	return filteredNodes;
}
