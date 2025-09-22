import { EditorView } from '@codemirror/view';

// Create theme
export function createTheme(isDark: boolean, settings: any) {
	const fontSize = settings.appearance?.fontSize || settings.fontSize || 14;
	const fontFamily =
		settings.appearance?.fontFamily || settings.fontFamily || 'JetBrains Mono, monospace';
	const lineHeight = settings.appearance?.lineHeight || settings.lineHeight || 1.4;
	const highContrast = settings.appearance?.highContrast || false;
	const compactMode = settings.appearance?.compactMode || false;
	const transparency = settings.appearance?.transparency || 1.0;
	const editorSettings = settings.editor || {};

	const padding = compactMode ? '8px' : '16px';
	const cursorWidth = editorSettings.cursorWidth || 2;
	const cursorStyle = editorSettings.cursorStyle || 'line';
	const cursorBlinking = editorSettings.cursorBlinking || 'blink';

	return EditorView.theme(
		{
			'&': {
				fontSize: `${fontSize}px`,
				fontFamily: fontFamily,
				height: '100%',
				opacity: transparency.toString()
			},
			'.cm-content': {
				padding: padding,
				lineHeight: lineHeight.toString(),
				minHeight: '100%'
			},
			'.cm-focused': {
				outline: 'none'
			},
			'.cm-editor': {
				height: '100%'
			},
			'.cm-search': {
				fontFamily: fontFamily,
				fontSize: '13px'
			},
			'.cm-cursor': {
				borderLeftWidth: cursorStyle === 'block' ? '0' : `${cursorWidth}px`,
				borderRightWidth: cursorStyle === 'block' ? `${cursorWidth}px` : '0',
				borderLeftStyle: cursorStyle === 'block' ? 'none' : 'solid',
				borderRightStyle: cursorStyle === 'block' ? 'solid' : 'none',
				animation: cursorBlinking === 'blink' ? 'cm-blink 1.2s infinite' : 'none',
				width: cursorStyle === 'block' ? `${cursorWidth}px` : '1px',
				marginLeft: cursorStyle === 'block' ? '-1px' : '0'
			},
			// High contrast adjustments
			...(highContrast && {
				'.cm-line': {
					color: isDark ? '#ffffff' : '#000000'
				},
				'.cm-cursor': {
					borderColor: isDark ? '#ffffff' : '#000000',
					backgroundColor:
						cursorStyle === 'block' ? (isDark ? '#ffffff' : '#000000') : 'transparent'
				},
				'.cm-selectionBackground': {
					backgroundColor: isDark ? '#ffffff40' : '#00000040'
				}
			}),
			// Compact mode adjustments
			...(compactMode && {
				'.cm-gutters': {
					fontSize: '12px'
				},
				'.cm-lineNumbers .cm-gutterElement': {
					padding: '0 4px'
				}
			})
		},
		{ dark: isDark }
	);
}
