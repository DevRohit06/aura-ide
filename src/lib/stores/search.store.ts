import { writable, derived } from 'svelte/store';
import type { FileSystemItem, File } from '$lib/types/files';
import type { SearchMatch, FileSearchResult, FileSearchOptions } from '$lib/types/file-operations';
import { filesStore } from './files.store';

// Search state interface
export interface SearchState {
	// Current search
	query: string;
	replaceText: string;

	// Search options
	caseSensitive: boolean;
	wholeWord: boolean;
	useRegex: boolean;
	includeContent: boolean;

	// Global search state
	isGlobalSearch: boolean;
	globalResults: FileSearchResult[];
	isSearching: boolean;

	// Search history
	searchHistory: string[];
	replaceHistory: string[];

	// Saved searches
	savedSearches: SavedSearch[];

	// Current file search
	currentFileMatches: SearchMatch[];
	currentMatchIndex: number;

	// UI state
	showReplace: boolean;
	showAdvanced: boolean;
}

export interface SavedSearch {
	id: string;
	name: string;
	query: string;
	options: {
		caseSensitive: boolean;
		wholeWord: boolean;
		useRegex: boolean;
		includeContent: boolean;
	};
	createdAt: Date;
}

// Initial state
const initialState: SearchState = {
	query: '',
	replaceText: '',
	caseSensitive: false,
	wholeWord: false,
	useRegex: false,
	includeContent: true,
	isGlobalSearch: false,
	globalResults: [],
	isSearching: false,
	searchHistory: [],
	replaceHistory: [],
	savedSearches: [],
	currentFileMatches: [],
	currentMatchIndex: 0,
	showReplace: false,
	showAdvanced: false
};

// Create the store
export const searchStore = writable<SearchState>(initialState);

// Search utilities
class SearchUtils {
	static escapeRegex(text: string): string {
		return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	static createSearchRegex(
		query: string,
		options: { caseSensitive: boolean; wholeWord: boolean; useRegex: boolean }
	): RegExp {
		let pattern = query;

		if (!options.useRegex) {
			pattern = this.escapeRegex(query);
		}

		if (options.wholeWord) {
			pattern = `\\b${pattern}\\b`;
		}

		const flags = options.caseSensitive ? 'g' : 'gi';

		try {
			return new RegExp(pattern, flags);
		} catch (error) {
			// If regex is invalid, fall back to escaped literal search
			const escapedPattern = this.escapeRegex(query);
			return new RegExp(escapedPattern, flags);
		}
	}

	static findMatches(content: string, regex: RegExp): SearchMatch[] {
		const matches: SearchMatch[] = [];
		const lines = content.split('\n');

		lines.forEach((line, lineIndex) => {
			let match;
			const lineRegex = new RegExp(regex.source, regex.flags);

			while ((match = lineRegex.exec(line)) !== null) {
				matches.push({
					line: lineIndex + 1,
					column: match.index + 1,
					text: match[0],
					length: match[0].length,
					context: line.trim()
				});

				// Prevent infinite loop on zero-length matches
				if (match.index === lineRegex.lastIndex) {
					lineRegex.lastIndex++;
				}
			}
		});

		return matches;
	}

	static searchInFile(file: File, options: FileSearchOptions): FileSearchResult | null {
		const matches: SearchMatch[] = [];
		let score = 0;

		// Search in filename
		const nameRegex = this.createSearchRegex(options.query, {
			caseSensitive: options.caseSensitive,
			wholeWord: options.wholeWord,
			useRegex: options.useRegex
		});
		if (nameRegex.test(file.name)) {
			score += 10; // Higher score for filename matches
		}

		// Search in content if enabled
		if (options.includeContent && file.content) {
			const contentMatches = this.findMatches(file.content, nameRegex);
			matches.push(...contentMatches);
			score += contentMatches.length;
		}

		if (matches.length > 0 || nameRegex.test(file.name)) {
			return {
				file,
				matches,
				score,
				preview: matches.length > 0 ? matches[0].context : file.name
			};
		}

		return null;
	}
}

// Search actions
export const searchActions = {
	// Update search query
	setQuery: (query: string) => {
		searchStore.update((state) => ({
			...state,
			query,
			currentMatchIndex: 0
		}));
	},

	// Update replace text
	setReplaceText: (replaceText: string) => {
		searchStore.update((state) => ({
			...state,
			replaceText
		}));
	},

	// Toggle search options
	toggleCaseSensitive: () => {
		searchStore.update((state) => ({
			...state,
			caseSensitive: !state.caseSensitive
		}));
	},

	toggleWholeWord: () => {
		searchStore.update((state) => ({
			...state,
			wholeWord: !state.wholeWord
		}));
	},

	toggleUseRegex: () => {
		searchStore.update((state) => ({
			...state,
			useRegex: !state.useRegex
		}));
	},

	toggleIncludeContent: () => {
		searchStore.update((state) => ({
			...state,
			includeContent: !state.includeContent
		}));
	},

	// Toggle UI states
	toggleReplace: () => {
		searchStore.update((state) => ({
			...state,
			showReplace: !state.showReplace
		}));
	},

	toggleAdvanced: () => {
		searchStore.update((state) => ({
			...state,
			showAdvanced: !state.showAdvanced
		}));
	},

	// Search history management
	addToSearchHistory: (query: string) => {
		if (!query.trim()) return;

		searchStore.update((state) => {
			const history = state.searchHistory.filter((item) => item !== query);
			history.unshift(query);
			return {
				...state,
				searchHistory: history.slice(0, 20) // Keep last 20 searches
			};
		});
	},

	addToReplaceHistory: (replaceText: string) => {
		if (!replaceText.trim()) return;

		searchStore.update((state) => {
			const history = state.replaceHistory.filter((item) => item !== replaceText);
			history.unshift(replaceText);
			return {
				...state,
				replaceHistory: history.slice(0, 20) // Keep last 20 replacements
			};
		});
	},

	// Saved searches
	saveSearch: (name: string) => {
		searchStore.update((state) => {
			const savedSearch: SavedSearch = {
				id: crypto.randomUUID(),
				name,
				query: state.query,
				options: {
					caseSensitive: state.caseSensitive,
					wholeWord: state.wholeWord,
					useRegex: state.useRegex,
					includeContent: state.includeContent
				},
				createdAt: new Date()
			};

			return {
				...state,
				savedSearches: [...state.savedSearches, savedSearch]
			};
		});
	},

	loadSavedSearch: (savedSearch: SavedSearch) => {
		searchStore.update((state) => ({
			...state,
			query: savedSearch.query,
			caseSensitive: savedSearch.options.caseSensitive,
			wholeWord: savedSearch.options.wholeWord,
			useRegex: savedSearch.options.useRegex,
			includeContent: savedSearch.options.includeContent
		}));
	},

	deleteSavedSearch: (id: string) => {
		searchStore.update((state) => ({
			...state,
			savedSearches: state.savedSearches.filter((search) => search.id !== id)
		}));
	},

	// Global search across all files
	performGlobalSearch: async () => {
		searchStore.update((state) => ({
			...state,
			isSearching: true,
			isGlobalSearch: true,
			globalResults: []
		}));

		// Get current search state
		const state = searchStore;
		let currentState: SearchState;
		const unsubscribe = state.subscribe((s) => (currentState = s));
		unsubscribe();

		if (!currentState!.query.trim()) {
			searchStore.update((state) => ({
				...state,
				isSearching: false,
				globalResults: []
			}));
			return;
		}

		try {
			// Get all files from the files store
			let allFiles: Map<string, FileSystemItem>;
			const unsubscribeFiles = filesStore.subscribe((files) => (allFiles = files));
			unsubscribeFiles();

			const searchOptions: FileSearchOptions = {
				query: currentState!.query,
				includeContent: currentState!.includeContent,
				caseSensitive: currentState!.caseSensitive,
				wholeWord: currentState!.wholeWord,
				useRegex: currentState!.useRegex,
				fileTypes: [],
				excludePatterns: []
			};

			const results: FileSearchResult[] = [];

			// Search through all files
			for (const [id, item] of allFiles!) {
				if (item.type === 'file') {
					const file = item as File;
					const result = SearchUtils.searchInFile(file, searchOptions);
					if (result) {
						results.push(result);
					}
				}
			}

			// Sort results by score (descending)
			results.sort((a, b) => b.score - a.score);

			searchStore.update((state) => ({
				...state,
				isSearching: false,
				globalResults: results
			}));

			// Add to search history
			searchActions.addToSearchHistory(currentState!.query);
		} catch (error) {
			console.error('Global search failed:', error);
			searchStore.update((state) => ({
				...state,
				isSearching: false,
				globalResults: []
			}));
		}
	},

	// Clear search
	clearSearch: () => {
		searchStore.update((state) => ({
			...state,
			query: '',
			replaceText: '',
			isGlobalSearch: false,
			globalResults: [],
			currentFileMatches: [],
			currentMatchIndex: 0
		}));
	},

	// Navigation
	nextMatch: () => {
		searchStore.update((state) => ({
			...state,
			currentMatchIndex:
				state.currentFileMatches.length > 0
					? (state.currentMatchIndex + 1) % state.currentFileMatches.length
					: 0
		}));
	},

	previousMatch: () => {
		searchStore.update((state) => ({
			...state,
			currentMatchIndex:
				state.currentFileMatches.length > 0
					? (state.currentMatchIndex - 1 + state.currentFileMatches.length) %
						state.currentFileMatches.length
					: 0
		}));
	},

	// Set current file matches (called by editor)
	setCurrentFileMatches: (matches: SearchMatch[]) => {
		searchStore.update((state) => ({
			...state,
			currentFileMatches: matches,
			currentMatchIndex: matches.length > 0 ? 0 : 0
		}));
	}
};

// Derived stores
export const searchResults = derived(searchStore, ($searchStore) => $searchStore.globalResults);

export const hasSearchResults = derived(
	searchStore,
	($searchStore) => $searchStore.globalResults.length > 0
);

export const searchSummary = derived(searchStore, ($searchStore) => {
	const totalFiles = $searchStore.globalResults.length;
	const totalMatches = $searchStore.globalResults.reduce(
		(sum, result) => sum + result.matches.length,
		0
	);
	return { totalFiles, totalMatches };
});

// Persistence
if (typeof window !== 'undefined') {
	// Save search history and saved searches to localStorage
	searchStore.subscribe((state) => {
		localStorage.setItem('aura-search-history', JSON.stringify(state.searchHistory));
		localStorage.setItem('aura-replace-history', JSON.stringify(state.replaceHistory));
		localStorage.setItem('aura-saved-searches', JSON.stringify(state.savedSearches));
	});

	// Restore from localStorage
	try {
		const searchHistory = JSON.parse(localStorage.getItem('aura-search-history') || '[]');
		const replaceHistory = JSON.parse(localStorage.getItem('aura-replace-history') || '[]');
		const savedSearches = JSON.parse(localStorage.getItem('aura-saved-searches') || '[]');

		searchStore.update((state) => ({
			...state,
			searchHistory,
			replaceHistory,
			savedSearches
		}));
	} catch (error) {
		console.warn('Failed to restore search data:', error);
	}
}
