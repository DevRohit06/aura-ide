import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

// Mock browser environment
const localStorageMock = {
	getItem: vi.fn(),
	setItem: vi.fn(),
	removeItem: vi.fn(),
	clear: vi.fn()
};

Object.defineProperty(globalThis, 'localStorage', {
	value: localStorageMock,
	writable: true
});

Object.defineProperty(globalThis, 'crypto', {
	value: {
		randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
	},
	writable: true
});

// Import after mocking
const { searchStore, searchActions } = await import('$lib/stores/search.store');

describe('Search Integration Tests', () => {
	beforeEach(() => {
		searchActions.clearSearch();
		vi.clearAllMocks();
	});

	it('should initialize with default state', () => {
		const state = get(searchStore);
		expect(state.query).toBe('');
		expect(state.replaceText).toBe('');
		expect(state.caseSensitive).toBe(false);
		expect(state.wholeWord).toBe(false);
		expect(state.useRegex).toBe(false);
		expect(state.globalResults).toEqual([]);
		expect(state.searchHistory).toEqual([]);
	});

	it('should update search query', () => {
		searchActions.setQuery('test search');
		const state = get(searchStore);
		expect(state.query).toBe('test search');
	});

	it('should toggle search options', () => {
		searchActions.toggleCaseSensitive();
		expect(get(searchStore).caseSensitive).toBe(true);

		searchActions.toggleWholeWord();
		expect(get(searchStore).wholeWord).toBe(true);

		searchActions.toggleUseRegex();
		expect(get(searchStore).useRegex).toBe(true);
	});

	it('should manage search history', () => {
		searchActions.addToSearchHistory('first search');
		searchActions.addToSearchHistory('second search');

		const state = get(searchStore);
		expect(state.searchHistory).toEqual(['second search', 'first search']);
	});

	it('should save and load searches', () => {
		searchActions.setQuery('test query');
		searchActions.toggleCaseSensitive();

		// Verify the state was updated
		let state = get(searchStore);
		expect(state.caseSensitive).toBe(true);

		searchActions.saveSearch('My Test Search');

		state = get(searchStore);
		expect(state.savedSearches).toHaveLength(1);

		const savedSearch = state.savedSearches[0];
		expect(savedSearch.name).toBe('My Test Search');
		expect(savedSearch.query).toBe('test query');
		expect(savedSearch.options.caseSensitive).toBe(true);

		// Clear and load
		searchActions.clearSearch();
		searchActions.loadSavedSearch(savedSearch);

		state = get(searchStore);
		expect(state.query).toBe('test query');
		expect(state.caseSensitive).toBe(true);
	});

	it('should clear search state', () => {
		searchActions.setQuery('test');
		searchActions.setReplaceText('replace');
		searchActions.toggleCaseSensitive();

		searchActions.clearSearch();

		const state = get(searchStore);
		expect(state.query).toBe('');
		expect(state.replaceText).toBe('');
		expect(state.globalResults).toEqual([]);
	});
});
