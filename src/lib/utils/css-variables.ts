import type { ComprehensiveSettings } from '$lib/types/settings';

// CSS variable names mapping
const CSS_VARIABLES = {
	// Appearance
	'--font-size': 'appearance.fontSize',
	'--font-family': 'appearance.fontFamily',
	'--line-height': 'appearance.lineHeight',
	'--transparency': 'appearance.transparency',

	// Editor
	'--editor-tab-size': 'editor.tabSize',
	'--editor-cursor-width': 'editor.cursorWidth',
	'--editor-scroll-beyond-last-column': 'editor.scrollBeyondLastColumn',

	// Terminal
	'--terminal-font-size': 'terminal.fontSize',
	'--terminal-font-family': 'terminal.fontFamily',
	'--terminal-line-height': 'terminal.lineHeight'
} as const;

// Get nested property value
function getNestedValue(obj: any, path: string): any {
	return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Apply settings as CSS variables
export function applyCSSVariables(settings: ComprehensiveSettings): void {
	if (typeof document === 'undefined') return;

	const root = document.documentElement;

	// Apply each CSS variable
	Object.entries(CSS_VARIABLES).forEach(([cssVar, settingPath]) => {
		const value = getNestedValue(settings, settingPath);

		if (value !== undefined && value !== null) {
			// Convert value to appropriate CSS format
			let cssValue = String(value);

			// Handle specific formatting
			if (cssVar === '--font-family' || cssVar === '--terminal-font-family') {
				cssValue = `"${value}"`;
			} else if (cssVar === '--transparency') {
				cssValue = String(value);
			} else if (typeof value === 'number') {
				// Add appropriate units
				if (cssVar.includes('font-size')) {
					cssValue = `${value}px`;
				} else if (cssVar.includes('line-height')) {
					cssValue = String(value);
				} else if (cssVar.includes('width') || cssVar.includes('column')) {
					cssValue = `${value}px`;
				} else {
					cssValue = String(value);
				}
			}

			root.style.setProperty(cssVar, cssValue);
		}
	});

	// Apply theme class
	const themeClass = `theme-${settings.appearance.theme}`;
	root.className = root.className.replace(/theme-\w+/g, '').trim();
	root.classList.add(themeClass);

	// Apply color scheme class
	const colorSchemeClass = `theme-${settings.appearance.colorScheme}`;
	root.className = root.className.replace(/theme-(onedark|dracula)/g, '').trim();
	if (settings.appearance.colorScheme && settings.appearance.colorScheme !== 'onedark') {
		root.classList.add(colorSchemeClass);
	}

	// Apply compact mode
	if (settings.appearance.compactMode) {
		root.classList.add('compact-mode');
	} else {
		root.classList.remove('compact-mode');
	}

	// Apply animations setting
	if (!settings.appearance.animations) {
		root.classList.add('no-animations');
	} else {
		root.classList.remove('no-animations');
	}

	// Apply editor settings as data attributes for CSS selectors
	root.setAttribute('data-word-wrap', String(settings.editor.wordWrap));
	root.setAttribute('data-line-numbers', String(settings.editor.lineNumbers));
	root.setAttribute('data-minimap', String(settings.editor.miniMap));
	root.setAttribute('data-breadcrumbs', String(settings.editor.breadcrumbs));
	root.setAttribute('data-smooth-scrolling', String(settings.editor.smoothScrolling));
	root.setAttribute('data-cursor-blinking', settings.editor.cursorBlinking);
	root.setAttribute('data-cursor-style', settings.editor.cursorStyle);
	root.setAttribute('data-keymap', settings.keyboard.keyMap);
}

// Remove all applied CSS variables and classes
export function removeCSSVariables(): void {
	if (typeof document === 'undefined') return;

	const root = document.documentElement;

	// Remove CSS variables
	Object.keys(CSS_VARIABLES).forEach((cssVar) => {
		root.style.removeProperty(cssVar);
	});

	// Remove theme classes
	root.className = root.className.replace(/theme-\w+/g, '').trim();
	root.classList.remove('compact-mode', 'no-animations');

	// Remove data attributes
	root.removeAttribute('data-word-wrap');
	root.removeAttribute('data-line-numbers');
	root.removeAttribute('data-minimap');
	root.removeAttribute('data-breadcrumbs');
	root.removeAttribute('data-smooth-scrolling');
	root.removeAttribute('data-cursor-blinking');
	root.removeAttribute('data-cursor-style');
	root.removeAttribute('data-keymap');
}

// CSS utility classes generator
export function generateUtilityCSS(settings: ComprehensiveSettings): string {
	return `
		/* Dynamic utility classes based on settings */
		.editor-font {
			font-family: var(--font-family, ${settings.appearance.fontFamily});
			font-size: var(--font-size, ${settings.appearance.fontSize}px);
			line-height: var(--line-height, ${settings.appearance.lineHeight});
		}
		
		.terminal-font {
			font-family: var(--terminal-font-family, ${settings.terminal.fontFamily});
			font-size: var(--terminal-font-size, ${settings.terminal.fontSize}px);
			line-height: var(--terminal-line-height, ${settings.terminal.lineHeight});
		}
		
		.compact-mode .compact-spacing {
			padding: 0.25rem;
			margin: 0.125rem;
		}
		
		.no-animations * {
			animation-duration: 0s !important;
			transition-duration: 0s !important;
		}
		
		[data-word-wrap="true"] .editor-content {
			white-space: pre-wrap;
			word-wrap: break-word;
		}
		
		[data-line-numbers="false"] .line-numbers {
			display: none;
		}
		
		[data-minimap="false"] .minimap {
			display: none;
		}
		
		[data-breadcrumbs="false"] .breadcrumbs {
			display: none;
		}
		
		[data-smooth-scrolling="false"] .editor-scroll {
			scroll-behavior: auto;
		}
		
		[data-cursor-style="block"] .cursor {
			width: 1ch;
			background-color: currentColor;
		}
		
		[data-cursor-style="underline"] .cursor {
			border-bottom: var(--editor-cursor-width, 2px) solid currentColor;
			background-color: transparent;
		}
		
		[data-cursor-blinking="solid"] .cursor {
			animation: none;
		}
		
		.theme-light {
			color-scheme: light;
		}
		
		.theme-dark {
			color-scheme: dark;
		}
		
		.theme-high-contrast {
			color-scheme: dark;
			--background: #000000;
			--foreground: #ffffff;
			--border: #ffffff;
		}
	`;
}

// Initialize CSS variables system
export function initializeCSSVariables(settings: ComprehensiveSettings): void {
	if (typeof document === 'undefined') return;

	// Apply initial settings
	applyCSSVariables(settings);

	// Inject utility CSS
	const styleId = 'aura-settings-css';
	let styleElement = document.getElementById(styleId) as HTMLStyleElement;

	if (!styleElement) {
		styleElement = document.createElement('style');
		styleElement.id = styleId;
		document.head.appendChild(styleElement);
	}

	styleElement.textContent = generateUtilityCSS(settings);
}

// Update CSS variables when settings change
export function updateCSSVariables(settings: ComprehensiveSettings): void {
	applyCSSVariables(settings);

	// Update utility CSS
	const styleElement = document.getElementById('aura-settings-css') as HTMLStyleElement;
	if (styleElement) {
		styleElement.textContent = generateUtilityCSS(settings);
	}
}
