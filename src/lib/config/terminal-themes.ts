/**
 * Terminal theme configurations for xterm.js
 * Provides dark and light themes with optimized colors for terminal readability
 */

import type { ITheme } from '@xterm/xterm';

export interface TerminalThemeConfig {
	dark: ITheme;
	light: ITheme;
}

export const terminalThemes: TerminalThemeConfig = {
	dark: {
		// Modern dark theme with high contrast and readability (GitHub Dark)
		background: '#0d1117',
		foreground: '#f0f6fc',
		cursor: '#58a6ff',
		cursorAccent: '#0d1117',
		selection: 'rgba(88, 166, 255, 0.3)',
		selectionForeground: '#f0f6fc',
		// Standard colors
		black: '#484f58',
		red: '#ff7b72',
		green: '#3fb950',
		yellow: '#d29922',
		blue: '#58a6ff',
		magenta: '#bc8cff',
		cyan: '#39c5cf',
		white: '#b1bac4',
		// Bright colors
		brightBlack: '#6e7681',
		brightRed: '#ffa198',
		brightGreen: '#56d364',
		brightYellow: '#e3b341',
		brightBlue: '#79c0ff',
		brightMagenta: '#d2a8ff',
		brightCyan: '#56d4dd',
		brightWhite: '#f0f6fc'
	},
	light: {
		// Clean light theme with proper contrast (GitHub Light)
		background: '#ffffff',
		foreground: '#24292f',
		cursor: '#0969da',
		cursorAccent: '#ffffff',
		selection: 'rgba(9, 105, 218, 0.2)',
		selectionForeground: '#24292f',
		// Standard colors
		black: '#24292f',
		red: '#cf222e',
		green: '#116329',
		yellow: '#4d2d00',
		blue: '#0969da',
		magenta: '#8250df',
		cyan: '#1b7c83',
		white: '#6e7781',
		// Bright colors
		brightBlack: '#656d76',
		brightRed: '#a40e26',
		brightGreen: '#1a7f37',
		brightYellow: '#633c01',
		brightBlue: '#218bff',
		brightMagenta: '#a475f9',
		brightCyan: '#3192aa',
		brightWhite: '#8c959f'
	}
};

// Alternative theme configurations
export const alternativeThemes = {
	// Classic dark theme
	darkClassic: {
		background: '#1e1e1e',
		foreground: '#d4d4d4',
		cursor: '#d4d4d4',
		cursorAccent: '#1e1e1e',
		selection: 'rgba(255, 255, 255, 0.3)',
		black: '#000000',
		red: '#cd3131',
		green: '#0dbc79',
		yellow: '#e5e510',
		blue: '#2472c8',
		magenta: '#bc3fbc',
		cyan: '#11a8cd',
		white: '#e5e5e5',
		brightBlack: '#666666',
		brightRed: '#f14c4c',
		brightGreen: '#23d18b',
		brightYellow: '#f5f543',
		brightBlue: '#3b8eea',
		brightMagenta: '#d670d6',
		brightCyan: '#29b8db',
		brightWhite: '#ffffff'
	},

	// Dracula theme
	dracula: {
		background: '#282a36',
		foreground: '#f8f8f2',
		cursor: '#f8f8f2',
		cursorAccent: '#282a36',
		selection: 'rgba(255, 255, 255, 0.1)',
		black: '#21222c',
		red: '#ff5555',
		green: '#50fa7b',
		yellow: '#f1fa8c',
		blue: '#bd93f9',
		magenta: '#ff79c6',
		cyan: '#8be9fd',
		white: '#f8f8f2',
		brightBlack: '#6272a4',
		brightRed: '#ff6e6e',
		brightGreen: '#69ff94',
		brightYellow: '#ffffa5',
		brightBlue: '#d6acff',
		brightMagenta: '#ff92df',
		brightCyan: '#a4ffff',
		brightWhite: '#ffffff'
	},

	// Solarized Dark
	solarizedDark: {
		background: '#002b36',
		foreground: '#839496',
		cursor: '#839496',
		cursorAccent: '#002b36',
		selection: 'rgba(131, 148, 150, 0.2)',
		black: '#073642',
		red: '#dc322f',
		green: '#859900',
		yellow: '#b58900',
		blue: '#268bd2',
		magenta: '#d33682',
		cyan: '#2aa198',
		white: '#eee8d5',
		brightBlack: '#002b36',
		brightRed: '#cb4b16',
		brightGreen: '#586e75',
		brightYellow: '#657b83',
		brightBlue: '#839496',
		brightMagenta: '#6c71c4',
		brightCyan: '#93a1a1',
		brightWhite: '#fdf6e3'
	},

	// Solarized Light
	solarizedLight: {
		background: '#fdf6e3',
		foreground: '#657b83',
		cursor: '#657b83',
		cursorAccent: '#fdf6e3',
		selection: 'rgba(101, 123, 131, 0.2)',
		black: '#073642',
		red: '#dc322f',
		green: '#859900',
		yellow: '#b58900',
		blue: '#268bd2',
		magenta: '#d33682',
		cyan: '#2aa198',
		white: '#eee8d5',
		brightBlack: '#002b36',
		brightRed: '#cb4b16',
		brightGreen: '#586e75',
		brightYellow: '#657b83',
		brightBlue: '#839496',
		brightMagenta: '#6c71c4',
		brightCyan: '#93a1a1',
		brightWhite: '#fdf6e3'
	}
};

/**
 * Get terminal theme based on current mode
 * @param mode - Theme mode ('dark' | 'light')
 * @param variant - Optional theme variant
 * @returns Terminal theme configuration
 */
export function getTerminalTheme(
	mode: 'dark' | 'light',
	variant: 'default' | 'classic' | 'dracula' | 'solarized' = 'default'
): ITheme {
	if (variant === 'classic' && mode === 'dark') {
		return alternativeThemes.darkClassic;
	}
	if (variant === 'dracula') {
		return alternativeThemes.dracula;
	}
	if (variant === 'solarized') {
		return mode === 'dark' ? alternativeThemes.solarizedDark : alternativeThemes.solarizedLight;
	}

	return terminalThemes[mode];
}

/**
 * Apply theme to existing terminal instance
 * @param terminal - Terminal instance
 * @param theme - Theme configuration
 */
export function applyTerminalTheme(terminal: any, theme: ITheme): void {
	if (terminal && terminal.options) {
		terminal.options.theme = theme;
	}
}

/**
 * Get CSS variables for terminal theme integration
 * @param theme - Theme configuration
 * @returns CSS custom properties object
 */
export function getTerminalThemeCSSVars(theme: ITheme): Record<string, string> {
	return {
		'--terminal-bg': theme.background || '#000000',
		'--terminal-fg': theme.foreground || '#ffffff',
		'--terminal-cursor': theme.cursor || '#ffffff',
		'--terminal-selection': theme.selection || 'rgba(255, 255, 255, 0.3)',
		'--terminal-black': theme.black || '#000000',
		'--terminal-red': theme.red || '#ff0000',
		'--terminal-green': theme.green || '#00ff00',
		'--terminal-yellow': theme.yellow || '#ffff00',
		'--terminal-blue': theme.blue || '#0000ff',
		'--terminal-magenta': theme.magenta || '#ff00ff',
		'--terminal-cyan': theme.cyan || '#00ffff',
		'--terminal-white': theme.white || '#ffffff'
	};
}
