import { writable } from 'svelte/store';

// Current project store
export const currentProjectId = writable<string | null>(null);

// Project actions
export const projectActions = {
	setCurrentProject: (projectId: string | null) => {
		currentProjectId.set(projectId);
	},

	getCurrentProject: (): string | null => {
		let id: string | null = null;
		currentProjectId.subscribe((value) => {
			id = value;
		})();
		return id;
	}
};
