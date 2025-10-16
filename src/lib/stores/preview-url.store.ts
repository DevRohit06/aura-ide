/**
 * Preview URL Store
 * Manages application preview URLs for browser mode
 * Supports multiple ports per project (e.g., frontend:3000, backend:8080)
 */

import { derived, writable } from 'svelte/store';

export interface PreviewURL {
	url: string;
	port: number;
	label?: string; // e.g., "Frontend", "Backend", "API"
	isDefault?: boolean;
	token?: string; // Authentication token for this specific URL
}

export interface ProjectPreview {
	projectId: string;
	sandboxId: string;
	urls: PreviewURL[];
	activeUrlIndex: number;
	token?: string; // Optional token for proxy access
}

interface PreviewURLState {
	previews: Map<string, ProjectPreview>;
}

function createPreviewURLStore() {
	const { subscribe, set, update } = writable<PreviewURLState>({
		previews: new Map()
	});

	return {
		subscribe,

		/**
		 * Set preview URLs for a project (from Daytona or other sandbox provider)
		 */
		setProjectPreview: (
			projectId: string,
			sandboxId: string,
			urls: PreviewURL[],
			token?: string
		) => {
			update((state) => {
				// Find default URL or use first one
				const defaultIndex = urls.findIndex((u) => u.isDefault) || 0;

				state.previews.set(projectId, {
					projectId,
					sandboxId,
					urls,
					activeUrlIndex: defaultIndex,
					token: token || undefined // Reset token; can be set later if needed
				});

				console.log(`📡 [PreviewURL] Set preview URLs for project ${projectId}:`, urls);
				return state;
			});
		},

		/**
		 * Add a single URL to existing project preview
		 */
		addURL: (projectId: string, url: PreviewURL) => {
			update((state) => {
				const preview = state.previews.get(projectId);
				if (preview) {
					preview.urls.push(url);
					console.log(`📡 [PreviewURL] Added URL for project ${projectId}:`, url);
				}
				return state;
			});
		},

		/**
		 * Remove a URL from project preview
		 */
		removeURL: (projectId: string, urlString: string) => {
			update((state) => {
				const preview = state.previews.get(projectId);
				if (preview) {
					preview.urls = preview.urls.filter((u) => u.url !== urlString);
					// Reset active index if needed
					if (preview.activeUrlIndex >= preview.urls.length) {
						preview.activeUrlIndex = Math.max(0, preview.urls.length - 1);
					}
					console.log(`📡 [PreviewURL] Removed URL for project ${projectId}:`, urlString);
				}
				return state;
			});
		},

		/**
		 * Set the active URL for a project
		 */
		setActiveURL: (projectId: string, index: number) => {
			update((state) => {
				const preview = state.previews.get(projectId);
				if (preview && index >= 0 && index < preview.urls.length) {
					preview.activeUrlIndex = index;
					console.log(
						`📡 [PreviewURL] Set active URL for project ${projectId}:`,
						preview.urls[index]
					);
				}
				return state;
			});
		},

		/**
		 * Get preview data for a project
		 */
		getProjectPreview: (projectId: string): ProjectPreview | undefined => {
			let preview: ProjectPreview | undefined;
			subscribe((state) => {
				preview = state.previews.get(projectId);
			})();
			return preview;
		},

		/**
		 * Clear preview URLs for a project
		 */
		clearProjectPreview: (projectId: string) => {
			update((state) => {
				state.previews.delete(projectId);
				console.log(`📡 [PreviewURL] Cleared preview URLs for project ${projectId}`);
				return state;
			});
		},

		/**
		 * Clear all preview URLs
		 */
		clearAll: () => {
			set({ previews: new Map() });
			console.log('📡 [PreviewURL] Cleared all preview URLs');
		}
	};
}

export const previewURLStore = createPreviewURLStore();

/**
 * Derived store for getting active preview URL for a specific project
 */
export function getActivePreviewURL(projectId: string) {
	return derived(previewURLStore, ($store) => {
		const preview = $store.previews.get(projectId);
		if (!preview || preview.urls.length === 0) {
			return null;
		}
		return preview.urls[preview.activeUrlIndex];
	});
}

/**
 * Derived store for getting all preview URLs for a specific project
 */
export function getAllPreviewURLs(projectId: string) {
	return derived(previewURLStore, ($store) => {
		const preview = $store.previews.get(projectId);
		return preview?.urls || [];
	});
}

/**
 * Derived store for getting the token for a specific project
 */
export function getProjectToken(projectId: string) {
	return derived(previewURLStore, ($store) => {
		const preview = $store.previews.get(projectId);
		return preview?.token || null;
	});
}

/**
 * Derived store for getting the active URL's token for a specific project
 */
export function getActiveURLToken(projectId: string) {
	return derived(previewURLStore, ($store) => {
		const preview = $store.previews.get(projectId);
		if (!preview || preview.urls.length === 0) {
			return null;
		}
		const activeUrl = preview.urls[preview.activeUrlIndex];
		// Return URL-specific token or fallback to project token
		return activeUrl?.token || preview.token || null;
	});
}

/**
 * Helper actions for managing preview URLs
 */
export const previewURLActions = {
	/**
	 * Set preview URLs from Daytona sandbox response
	 */
	setFromDaytona: (
		projectId: string,
		sandboxId: string,
		daytonaResponse: {
			urls?: Array<{ url: string; port: number; label?: string; token?: string }>;
			primaryUrl?: string;
			ports?: number[];
			token?: string; // Global token for all URLs if individual tokens not provided
		}
	) => {
		const urls: PreviewURL[] = [];
		const globalToken = daytonaResponse.token; // Token to use if individual URLs don't have tokens

		// Add URLs from response
		if (daytonaResponse.urls && daytonaResponse.urls.length > 0) {
			urls.push(
				...daytonaResponse.urls.map((u) => ({
					url: u.url,
					port: u.port,
					label: u.label,
					isDefault: u.url === daytonaResponse.primaryUrl,
					token: u.token || globalToken // Use URL-specific token or fallback to global
				}))
			);
		} else if (daytonaResponse.primaryUrl) {
			// Fallback to primary URL
			const port = parseInt(new URL(daytonaResponse.primaryUrl).port) || 3000;
			urls.push({
				url: daytonaResponse.primaryUrl,
				port,
				label: 'Primary',
				isDefault: true,
				token: globalToken // Use global token
			});
		} else if (daytonaResponse.ports && daytonaResponse.ports.length > 0) {
			// Fallback to ports
			urls.push(
				...daytonaResponse.ports.map((port, index) => ({
					url: `http://localhost:${port}`,
					port,
					label: `Port ${port}`,
					isDefault: index === 0,
					token: globalToken // Use global token
				}))
			);
		}

		if (urls.length > 0) {
			// Pass global token to project preview as well
			previewURLStore.setProjectPreview(projectId, sandboxId, urls, globalToken);
			console.log(
				`📡 [PreviewURL] Set ${urls.length} URLs for project ${projectId} with token: ${globalToken ? '✓' : '✗'}`
			);
		} else {
			console.warn(`⚠️ [PreviewURL] No URLs found in Daytona response for project ${projectId}`);
		}
	},

	/**
	 * Set preview URLs from generic sandbox response
	 */
	setFromSandbox: (
		projectId: string,
		sandboxId: string,
		url: string,
		label: string = 'Application',
		token?: string
	) => {
		const port = parseInt(new URL(url).port) || 3000;
		previewURLStore.setProjectPreview(
			projectId,
			sandboxId,
			[
				{
					url,
					port,
					label,
					isDefault: true,
					token
				}
			],
			token
		);
	}
};
