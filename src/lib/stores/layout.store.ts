import type { EditorLayout } from '@/types/editor-state';
import { get, writable } from 'svelte/store';
import { sidebarPanelActions } from './sidebar-panels.store';

// Default layout state
const defaultLayout: EditorLayout = {
	sidebarWidth: 240,
	sidebarVisible: true,
	terminalHeight: 200,
	terminalVisible: false,
	aiPanelWidth: 300,
	aiPanelVisible: false,
	miniMapVisible: true
};

// Layout store
export const layoutStore = writable<EditorLayout>(defaultLayout);

// Layout actions
export const layoutActions = {
	// Update layout properties
	updateLayout: (updates: Partial<EditorLayout>) => {
		layoutStore.update((state) => ({ ...state, ...updates }));
	},

	// Sidebar controls
	toggleSidebar: () => {
		layoutStore.update((state) => ({
			...state,
			sidebarVisible: !state.sidebarVisible
		}));
		// Also toggle the sidebar panel store for consistency
		sidebarPanelActions.toggleLeftSidebar();
	},

	setSidebarWidth: (width: number) => {
		layoutStore.update((state) => ({
			...state,
			sidebarWidth: Math.max(150, Math.min(600, width)) // Clamp between 150-600px
		}));
	},

	showSidebar: () => {
		layoutStore.update((state) => ({
			...state,
			sidebarVisible: true
		}));
	},

	hideSidebar: () => {
		layoutStore.update((state) => ({
			...state,
			sidebarVisible: false
		}));
	},

	// Terminal controls
	toggleTerminal: () => {
		layoutStore.update((state) => ({
			...state,
			terminalVisible: !state.terminalVisible
		}));
	},

	setTerminalHeight: (height: number) => {
		layoutStore.update((state) => ({
			...state,
			terminalHeight: Math.max(100, Math.min(500, height)) // Clamp between 100-500px
		}));
	},

	showTerminal: () => {
		layoutStore.update((state) => ({
			...state,
			terminalVisible: true
		}));
	},

	hideTerminal: () => {
		layoutStore.update((state) => ({
			...state,
			terminalVisible: false
		}));
	},

	// AI Panel controls
	toggleAIPanel: () => {
		layoutStore.update((state) => ({
			...state,
			aiPanelVisible: !state.aiPanelVisible
		}));
	},

	setAIPanelWidth: (width: number) => {
		layoutStore.update((state) => ({
			...state,
			aiPanelWidth: Math.max(200, Math.min(500, width)) // Clamp between 200-500px
		}));
	},

	showAIPanel: () => {
		layoutStore.update((state) => ({
			...state,
			aiPanelVisible: true
		}));
	},

	hideAIPanel: () => {
		layoutStore.update((state) => ({
			...state,
			aiPanelVisible: false
		}));
	},

	// Minimap controls
	toggleMinimap: () => {
		layoutStore.update((state) => ({
			...state,
			miniMapVisible: !state.miniMapVisible
		}));
	},

	showMinimap: () => {
		layoutStore.update((state) => ({
			...state,
			miniMapVisible: true
		}));
	},

	hideMinimap: () => {
		layoutStore.update((state) => ({
			...state,
			miniMapVisible: false
		}));
	},

	// Utility methods
	getCurrentLayout: (): EditorLayout => {
		return get(layoutStore);
	},

	// Preset layouts
	setCompactLayout: () => {
		layoutStore.set({
			sidebarWidth: 200,
			sidebarVisible: true,
			terminalHeight: 150,
			terminalVisible: false,
			aiPanelWidth: 250,
			aiPanelVisible: false,
			miniMapVisible: false
		});
	},

	setFullScreenLayout: () => {
		layoutStore.set({
			sidebarWidth: 240,
			sidebarVisible: false,
			terminalHeight: 200,
			terminalVisible: false,
			aiPanelWidth: 300,
			aiPanelVisible: false,
			miniMapVisible: false
		});
	},

	setDevelopmentLayout: () => {
		layoutStore.set({
			sidebarWidth: 260,
			sidebarVisible: true,
			terminalHeight: 220,
			terminalVisible: true,
			aiPanelWidth: 320,
			aiPanelVisible: false,
			miniMapVisible: true
		});
	},

	// Persistence
	persistLayout: () => {
		if (typeof window === 'undefined') return;

		const state = get(layoutStore);
		localStorage.setItem('aura-layout', JSON.stringify(state));
	},

	restoreLayout: () => {
		if (typeof window === 'undefined') return;

		const saved = localStorage.getItem('aura-layout');
		if (saved) {
			try {
				const parsed = JSON.parse(saved);
				layoutStore.set({ ...defaultLayout, ...parsed });
			} catch (error) {
				console.warn('Failed to restore layout:', error);
			}
		}
	},

	// Reset to default
	reset: () => {
		layoutStore.set({ ...defaultLayout });
	}
};

// Auto-persist layout changes
if (typeof window !== 'undefined') {
	layoutStore.subscribe(() => {
		clearTimeout((globalThis as any).layoutPersistTimeout);
		(globalThis as any).layoutPersistTimeout = setTimeout(() => {
			layoutActions.persistLayout();
		}, 300);
	});

	// Restore layout on load
	layoutActions.restoreLayout();
}
