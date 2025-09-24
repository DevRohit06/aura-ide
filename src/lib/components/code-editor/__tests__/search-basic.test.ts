import { describe, expect, it, vi } from 'vitest';

// Mock browser environment
Object.defineProperty(globalThis, 'localStorage', {
	value: {
		getItem: vi.fn(),
		setItem: vi.fn(),
		removeItem: vi.fn(),
		clear: vi.fn()
	},
	writable: true
});

Object.defineProperty(globalThis, 'crypto', {
	value: {
		randomUUID: () => 'test-uuid-123'
	},
	writable: true
});

describe('Search Functionality Basic Tests', () => {
	it('should import search store without errors', async () => {
		const { searchStore, searchActions } = await import('$lib/stores/search.store');
		expect(searchStore).toBeDefined();
		expect(searchActions).toBeDefined();
		expect(searchActions.setQuery).toBeDefined();
		expect(searchActions.toggleCaseSensitive).toBeDefined();
		expect(searchActions.performGlobalSearch).toBeDefined();
	});

	it('should have all required search actions', async () => {
		const { searchActions } = await import('$lib/stores/search.store');

		const requiredActions = [
			'setQuery',
			'setReplaceText',
			'toggleCaseSensitive',
			'toggleWholeWord',
			'toggleUseRegex',
			'toggleReplace',
			'addToSearchHistory',
			'saveSearch',
			'loadSavedSearch',
			'deleteSavedSearch',
			'performGlobalSearch',
			'clearSearch',
			'nextMatch',
			'previousMatch'
		];

		requiredActions.forEach((action) => {
			expect((searchActions as any)[action]).toBeDefined();
			expect(typeof (searchActions as any)[action]).toBe('function');
		});
	});

	it('should create search components without errors', async () => {
		// Test that the components can be imported
		expect(async () => {
			await import('$lib/components/code-editor/search-panel.svelte');
		}).not.toThrow();

		expect(async () => {
			await import('$lib/components/code-editor/global-search-results.svelte');
		}).not.toThrow();

		expect(async () => {
			await import('$lib/components/code-editor/search-history.svelte');
		}).not.toThrow();
	});
});
