import { writable, get } from 'svelte/store';
import type { PanelState } from '@/types/editor-state';

// Default panel state
const defaultPanels: PanelState = {
	explorer: true,
	search: false,
	git: false,
	extensions: false,
	terminal: false,
	problems: false,
	output: false,
	debugConsole: false
};

// Panels store
export const panelsStore = writable<PanelState>(defaultPanels);

// Panel actions
export const panelActions = {
	// Update panels
	updatePanels: (updates: Partial<PanelState>) => {
		panelsStore.update((state) => ({ ...state, ...updates }));
	},

	// Toggle a specific panel
	togglePanel: (panel: keyof PanelState) => {
		panelsStore.update((state) => ({
			...state,
			[panel]: !state[panel]
		}));
	},

	// Show a specific panel
	showPanel: (panel: keyof PanelState) => {
		panelsStore.update((state) => ({
			...state,
			[panel]: true
		}));
	},

	// Hide a specific panel
	hidePanel: (panel: keyof PanelState) => {
		panelsStore.update((state) => ({
			...state,
			[panel]: false
		}));
	},

	// Explorer panel
	toggleExplorer: () => panelActions.togglePanel('explorer'),
	showExplorer: () => panelActions.showPanel('explorer'),
	hideExplorer: () => panelActions.hidePanel('explorer'),

	// Search panel
	toggleSearch: () => panelActions.togglePanel('search'),
	showSearch: () => panelActions.showPanel('search'),
	hideSearch: () => panelActions.hidePanel('search'),

	// Git panel
	toggleGit: () => panelActions.togglePanel('git'),
	showGit: () => panelActions.showPanel('git'),
	hideGit: () => panelActions.hidePanel('git'),

	// Extensions panel
	toggleExtensions: () => panelActions.togglePanel('extensions'),
	showExtensions: () => panelActions.showPanel('extensions'),
	hideExtensions: () => panelActions.hidePanel('extensions'),

	// Terminal panel
	toggleTerminal: () => panelActions.togglePanel('terminal'),
	showTerminal: () => panelActions.showPanel('terminal'),
	hideTerminal: () => panelActions.hidePanel('terminal'),

	// Problems panel
	toggleProblems: () => panelActions.togglePanel('problems'),
	showProblems: () => panelActions.showPanel('problems'),
	hideProblems: () => panelActions.hidePanel('problems'),

	// Output panel
	toggleOutput: () => panelActions.togglePanel('output'),
	showOutput: () => panelActions.showPanel('output'),
	hideOutput: () => panelActions.hidePanel('output'),

	// Debug console panel
	toggleDebugConsole: () => panelActions.togglePanel('debugConsole'),
	showDebugConsole: () => panelActions.showPanel('debugConsole'),
	hideDebugConsole: () => panelActions.hidePanel('debugConsole'),

	// Close all panels
	closeAllPanels: () => {
		panelsStore.set({
			explorer: false,
			search: false,
			git: false,
			extensions: false,
			terminal: false,
			problems: false,
			output: false,
			debugConsole: false
		});
	},

	// Close all except specified panel
	closeOtherPanels: (keepPanel: keyof PanelState) => {
		const newState = {
			explorer: false,
			search: false,
			git: false,
			extensions: false,
			terminal: false,
			problems: false,
			output: false,
			debugConsole: false
		};
		newState[keepPanel] = true;
		panelsStore.set(newState);
	},

	// Utility methods
	isPanelOpen: (panel: keyof PanelState): boolean => {
		const state = get(panelsStore);
		return state[panel];
	},

	getOpenPanels: (): (keyof PanelState)[] => {
		const state = get(panelsStore);
		return Object.keys(state).filter(
			(key) => state[key as keyof PanelState]
		) as (keyof PanelState)[];
	},

	getOpenPanelsCount: (): number => {
		const state = get(panelsStore);
		return Object.values(state).filter(Boolean).length;
	},

	// Preset panel configurations
	setDefaultPanels: () => {
		panelsStore.set({ ...defaultPanels });
	},

	setDevelopmentPanels: () => {
		panelsStore.set({
			explorer: true,
			search: false,
			git: true,
			extensions: false,
			terminal: true,
			problems: true,
			output: false,
			debugConsole: false
		});
	},

	setDebugPanels: () => {
		panelsStore.set({
			explorer: true,
			search: false,
			git: false,
			extensions: false,
			terminal: true,
			problems: true,
			output: true,
			debugConsole: true
		});
	},

	setMinimalPanels: () => {
		panelsStore.set({
			explorer: true,
			search: false,
			git: false,
			extensions: false,
			terminal: false,
			problems: false,
			output: false,
			debugConsole: false
		});
	},

	// Persistence
	persistPanels: () => {
		if (typeof window === 'undefined') return;

		const state = get(panelsStore);
		localStorage.setItem('aura-panels', JSON.stringify(state));
	},

	restorePanels: () => {
		if (typeof window === 'undefined') return;

		const saved = localStorage.getItem('aura-panels');
		if (saved) {
			try {
				const parsed = JSON.parse(saved);
				panelsStore.set({ ...defaultPanels, ...parsed });
			} catch (error) {
				console.warn('Failed to restore panels:', error);
			}
		}
	},

	// Reset to default
	reset: () => {
		panelsStore.set({ ...defaultPanels });
	}
};

// Auto-persist panel changes
if (typeof window !== 'undefined') {
	panelsStore.subscribe(() => {
		clearTimeout((globalThis as any).panelsPersistTimeout);
		(globalThis as any).panelsPersistTimeout = setTimeout(() => {
			panelActions.persistPanels();
		}, 300);
	});

	// Restore panels on load
	panelActions.restorePanels();
}
