import type { SidebarPanelState } from '@/types/editor-state';
import { get, writable } from 'svelte/store';

export type SidebarView = 'explorer' | 'search' | 'source-control' | 'debug' | 'extensions' | 'vector-indexing';

// Default sidebar panel state
const defaultSidebarPanels: SidebarPanelState = {
	// Left sidebar views - only explorer is active by default
	explorer: true,
	search: false,
	'source-control': false,
	debug: false,
	extensions: false,
	'vector-indexing': false,
	
	// Panel visibility
	leftSidebarVisible: true,
	rightSidebarVisible: true,
	terminalVisible: true
};

// Current active view state
interface SidebarState {
	panels: SidebarPanelState;
	currentView: SidebarView;
}

const defaultState: SidebarState = {
	panels: defaultSidebarPanels,
	currentView: 'explorer'
};

// Sidebar panels store
export const sidebarPanelsStore = writable<SidebarState>(defaultState);

// Sidebar panel actions
export const sidebarPanelActions = {
	// Get current state
	getCurrentState: (): SidebarState => {
		return get(sidebarPanelsStore);
	},

	// Set current view and manage panel states
	setCurrentView: (view: SidebarView) => {
		sidebarPanelsStore.update((state) => {
			// Reset all views to false
			const newPanels = { ...state.panels };
			Object.keys(newPanels).forEach(key => {
				if (key !== 'leftSidebarVisible' && key !== 'rightSidebarVisible') {
					newPanels[key as keyof SidebarPanelState] = false;
				}
			});
			
			// Set the new view to true
			newPanels[view] = true;
			
			// Ensure sidebar is visible when setting a view
			newPanels.leftSidebarVisible = true;
			
			return {
				...state,
				panels: newPanels,
				currentView: view
			};
		});
	},

	// Toggle view - if same view is clicked, hide the sidebar
	toggleView: (view: SidebarView) => {
		sidebarPanelsStore.update((state) => {
			const isCurrentlyActive = state.currentView === view && state.panels[view];
			const isLeftSidebarVisible = state.panels.leftSidebarVisible;
			
			if (isCurrentlyActive && isLeftSidebarVisible) {
				// Same view clicked and sidebar is visible - hide the sidebar
				return {
					...state,
					panels: {
						...state.panels,
						leftSidebarVisible: false
					}
				};
			} else {
				// Different view or sidebar was hidden - show the view
				const newPanels = { ...state.panels };
				
				// Reset all views to false
				Object.keys(newPanels).forEach(key => {
					if (key !== 'leftSidebarVisible' && key !== 'rightSidebarVisible') {
						newPanels[key as keyof SidebarPanelState] = false;
					}
				});
				
				// Set the new view to true and make sidebar visible
				newPanels[view] = true;
				newPanels.leftSidebarVisible = true;
				
				return {
					...state,
					panels: newPanels,
					currentView: view
				};
			}
		});
	},

	// Toggle sidebar visibility
	toggleLeftSidebar: () => {
		sidebarPanelsStore.update((state) => ({
			...state,
			panels: {
				...state.panels,
				leftSidebarVisible: !state.panels.leftSidebarVisible
			}
		}));
	},

	toggleRightSidebar: () => {
		sidebarPanelsStore.update((state) => ({
			...state,
			panels: {
				...state.panels,
				rightSidebarVisible: !state.panels.rightSidebarVisible
			}
		}));
	},

	toggleTerminal: () => {
		sidebarPanelsStore.update((state) => ({
			...state,
			panels: {
				...state.panels,
				terminalVisible: !state.panels.terminalVisible
			}
		}));
	},

	// Show/hide sidebar
	showLeftSidebar: () => {
		sidebarPanelsStore.update((state) => ({
			...state,
			panels: {
				...state.panels,
				leftSidebarVisible: true
			}
		}));
	},

	hideLeftSidebar: () => {
		sidebarPanelsStore.update((state) => ({
			...state,
			panels: {
				...state.panels,
				leftSidebarVisible: false
			}
		}));
	},

	showRightSidebar: () => {
		sidebarPanelsStore.update((state) => ({
			...state,
			panels: {
				...state.panels,
				rightSidebarVisible: true
			}
		}));
	},

	hideRightSidebar: () => {
		sidebarPanelsStore.update((state) => ({
			...state,
			panels: {
				...state.panels,
				rightSidebarVisible: false
			}
		}));
	},

	showTerminal: () => {
		sidebarPanelsStore.update((state) => ({
			...state,
			panels: {
				...state.panels,
				terminalVisible: true
			}
		}));
	},

	hideTerminal: () => {
		sidebarPanelsStore.update((state) => ({
			...state,
			panels: {
				...state.panels,
				terminalVisible: false
			}
		}));
	},

	// Utility methods
	isViewActive: (view: SidebarView): boolean => {
		const state = get(sidebarPanelsStore);
		return state.panels[view] && state.panels.leftSidebarVisible;
	},

	isLeftSidebarVisible: (): boolean => {
		const state = get(sidebarPanelsStore);
		return state.panels.leftSidebarVisible;
	},

	isRightSidebarVisible: (): boolean => {
		const state = get(sidebarPanelsStore);
		return state.panels.rightSidebarVisible;
	},

	isTerminalVisible: (): boolean => {
		const state = get(sidebarPanelsStore);
		return state.panels.terminalVisible;
	},

	getCurrentView: (): SidebarView => {
		const state = get(sidebarPanelsStore);
		return state.currentView;
	},

	// Persistence
	persistSidebarPanels: () => {
		if (typeof window === 'undefined') return;

		const state = get(sidebarPanelsStore);
		localStorage.setItem('aura-sidebar-panels', JSON.stringify(state));
	},

	restoreSidebarPanels: () => {
		if (typeof window === 'undefined') return;

		const saved = localStorage.getItem('aura-sidebar-panels');
		if (saved) {
			try {
				const parsed = JSON.parse(saved);
				sidebarPanelsStore.set({ ...defaultState, ...parsed });
			} catch (error) {
				console.warn('Failed to restore sidebar panels:', error);
			}
		}
	},

	// Reset to default
	reset: () => {
		sidebarPanelsStore.set({ ...defaultState });
	}
};

// Auto-persist sidebar panel changes
if (typeof window !== 'undefined') {
	sidebarPanelsStore.subscribe(() => {
		clearTimeout((globalThis as any).sidebarPanelsPersistTimeout);
		(globalThis as any).sidebarPanelsPersistTimeout = setTimeout(() => {
			sidebarPanelActions.persistSidebarPanels();
		}, 300);
	});

	// Restore sidebar panels on load
	sidebarPanelActions.restoreSidebarPanels();
}