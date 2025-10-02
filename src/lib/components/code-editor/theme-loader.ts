// Lazy imports for CodeMirror themes to reduce initial bundle size
export const loadOneDarkTheme = () => import('@codemirror/theme-one-dark').then((m) => m.oneDark);
export const loadBarfTheme = () => import('thememirror').then((m) => m.barf);
export const loadDraculaTheme = () => import('thememirror').then((m) => m.dracula);
export const loadTomorrowTheme = () => import('thememirror').then((m) => m.tomorrow);
