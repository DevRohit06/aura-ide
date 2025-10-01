export interface SidebarViewData {
	id: string;
	name: string;
	icon: string;
	component?: any;
}

export type SidebarViewId = 'explorer' | 'search' | 'source-control' | 'debug' | 'extensions' | 'vector-indexing';