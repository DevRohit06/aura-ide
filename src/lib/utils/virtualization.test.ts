import { describe, it, expect } from 'vitest';
import {
	calculateVisibleRange,
	flattenFileTree,
	VirtualScrollManager,
	filterVirtualizedTree
} from './virtualization';
import type { FileSystemItem } from '$lib/types/files';

describe('Virtualization Utilities', () => {
	describe('calculateVisibleRange', () => {
		it('should calculate correct visible range', () => {
			const config = {
				itemHeight: 24,
				containerHeight: 240,
				overscan: 2,
				scrollTop: 120
			};

			const range = calculateVisibleRange(config);

			expect(range.startIndex).toBe(3); // (120/24) - 2 = 3
			expect(range.endIndex).toBe(17); // 5 + (240/24) + 2 = 17
			expect(range.offsetY).toBe(120); // 5 * 24 = 120
		});
	});

	describe('flattenFileTree', () => {
		it('should flatten file tree correctly', () => {
			const files = new Map<string, FileSystemItem>([
				[
					'1',
					{
						id: '1',
						name: 'folder1',
						type: 'folder',
						path: '/folder1',
						parentId: null,
						children: ['2', '3']
					}
				],
				[
					'2',
					{ id: '2', name: 'file1.js', type: 'file', path: '/folder1/file1.js', parentId: '1' }
				],
				[
					'3',
					{ id: '3', name: 'file2.js', type: 'file', path: '/folder1/file2.js', parentId: '1' }
				],
				['4', { id: '4', name: 'file3.js', type: 'file', path: '/file3.js', parentId: null }]
			]);

			const expandedFolders = new Set(['1']);
			const flattened = flattenFileTree(files, expandedFolders);

			expect(flattened).toHaveLength(4);
			expect(flattened[0].item.name).toBe('folder1');
			expect(flattened[0].level).toBe(0);
			expect(flattened[1].item.name).toBe('file1.js');
			expect(flattened[1].level).toBe(1);
			expect(flattened[2].item.name).toBe('file2.js');
			expect(flattened[2].level).toBe(1);
			expect(flattened[3].item.name).toBe('file3.js');
			expect(flattened[3].level).toBe(0);
		});

		it('should not include children of collapsed folders', () => {
			const files = new Map<string, FileSystemItem>([
				[
					'1',
					{
						id: '1',
						name: 'folder1',
						type: 'folder',
						path: '/folder1',
						parentId: null,
						children: ['2']
					}
				],
				['2', { id: '2', name: 'file1.js', type: 'file', path: '/folder1/file1.js', parentId: '1' }]
			]);

			const expandedFolders = new Set<string>(); // No expanded folders
			const flattened = flattenFileTree(files, expandedFolders);

			expect(flattened).toHaveLength(1);
			expect(flattened[0].item.name).toBe('folder1');
		});
	});

	describe('VirtualScrollManager', () => {
		it('should manage virtual scrolling correctly', () => {
			const config = {
				itemHeight: 24,
				containerHeight: 240,
				overscan: 2,
				scrollTop: 0
			};

			const manager = new VirtualScrollManager(config);
			const items = Array.from({ length: 100 }, (_, i) => ({
				id: `item-${i}`,
				index: i,
				level: 0,
				isVisible: true,
				height: 24,
				data: { name: `Item ${i}` }
			}));

			manager.setItems(items);

			const visibleItems = manager.getVisibleItems();
			expect(visibleItems.length).toBeLessThanOrEqual(14); // (240/24) + 2*2 = 14

			const totalHeight = manager.getTotalHeight();
			expect(totalHeight).toBe(2400); // 100 * 24
		});

		it('should update visible range on scroll', () => {
			const config = {
				itemHeight: 24,
				containerHeight: 240,
				overscan: 2,
				scrollTop: 0
			};

			const manager = new VirtualScrollManager(config);
			const items = Array.from({ length: 100 }, (_, i) => ({
				id: `item-${i}`,
				index: i,
				level: 0,
				isVisible: true,
				height: 24,
				data: { name: `Item ${i}` }
			}));

			manager.setItems(items);

			const initialRange = manager.getVisibleRange();
			expect(initialRange.startIndex).toBe(0);

			manager.updateScrollPosition(240);
			const newRange = manager.getVisibleRange();
			expect(newRange.startIndex).toBeGreaterThan(initialRange.startIndex);
		});
	});

	describe('filterVirtualizedTree', () => {
		it('should filter tree nodes by search term', () => {
			const nodes = [
				{
					id: '1',
					index: 0,
					level: 0,
					isVisible: true,
					height: 24,
					isExpanded: false,
					hasChildren: false,
					parentId: null,
					item: {
						id: '1',
						name: 'component.js',
						type: 'file' as const,
						path: '/component.js',
						parentId: null
					},
					data: {}
				},
				{
					id: '2',
					index: 1,
					level: 0,
					isVisible: true,
					height: 24,
					isExpanded: false,
					hasChildren: false,
					parentId: null,
					item: {
						id: '2',
						name: 'utils.ts',
						type: 'file' as const,
						path: '/utils.ts',
						parentId: null
					},
					data: {}
				}
			];

			const filtered = filterVirtualizedTree(nodes, 'component');
			expect(filtered).toHaveLength(1);
			expect(filtered[0].item.name).toBe('component.js');
		});

		it('should return all nodes when search term is empty', () => {
			const nodes = [
				{
					id: '1',
					index: 0,
					level: 0,
					isVisible: true,
					height: 24,
					isExpanded: false,
					hasChildren: false,
					parentId: null,
					item: {
						id: '1',
						name: 'file1.js',
						type: 'file' as const,
						path: '/file1.js',
						parentId: null
					},
					data: {}
				}
			];

			const filtered = filterVirtualizedTree(nodes, '');
			expect(filtered).toEqual(nodes);
		});
	});
});
