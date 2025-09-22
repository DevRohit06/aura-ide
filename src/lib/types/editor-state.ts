import type { CursorPosition, SelectionRange } from './files';

// Editor store state
export interface EditorState {
	activeFileId: string | null;
	openFiles: string[];
	fileStates: Map<string, FileEditorState>;
	layout: EditorLayout;
	panels: PanelState;
	settings: EditorSettings;
}

export interface FileEditorState {
	scrollPosition: number;
	cursorPosition: CursorPosition | number;
	selection: SelectionRange[];
	isDirty: boolean;
	undoHistory: string[];
	redoHistory: string[];
	lastSaved: Date;
}

export interface EditorLayout {
	sidebarWidth: number;
	sidebarVisible: boolean;
	terminalHeight: number;
	terminalVisible: boolean;
	aiPanelWidth: number;
	aiPanelVisible: boolean;
	miniMapVisible: boolean;
}

export interface PanelState {
	explorer: boolean;
	search: boolean;
	git: boolean;
	extensions: boolean;
	terminal: boolean;
	problems: boolean;
	output: boolean;
	debugConsole: boolean;
}

export interface EditorSettings {
	theme: 'light' | 'dark' | 'system';
	fontSize: number;
	fontFamily: string;
	lineHeight: number;
	tabSize: number;
	insertSpaces: boolean;
	wordWrap: boolean;
	lineNumbers: boolean;
	miniMap: boolean;
	autoSave: boolean;
	autoSaveDelay: number;
	formatOnSave: boolean;
	vim: boolean;
	emacs: boolean;
}
