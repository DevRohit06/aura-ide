import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), devtoolsJson()],
	optimizeDeps: {
		exclude: [
			'codemirror',
			'@codemirror/view',
			'@codemirror/state',
			'@codemirror/commands',
			'@codemirror/search',
			'@codemirror/autocomplete',
			'@codemirror/lint',
			'@codemirror/lang-javascript',
			'@codemirror/lang-python',
			'@codemirror/lang-html',
			'@codemirror/lang-css',
			'@codemirror/lang-json',
			'@codemirror/lang-markdown',
			'@codemirror/theme-one-dark',
			'@replit/codemirror-lang-svelte'
		]
	},
	ssr: {
		noExternal: [
			'codemirror',
			'@codemirror/view',
			'@codemirror/state',
			'@codemirror/commands',
			'@codemirror/search',
			'@codemirror/autocomplete',
			'@codemirror/lint',
			'@codemirror/lang-javascript',
			'@codemirror/lang-python',
			'@codemirror/lang-html',
			'@codemirror/lang-css',
			'@codemirror/lang-json',
			'@codemirror/lang-markdown',
			'@codemirror/theme-one-dark'
		]
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					environment: 'browser',
					browser: {
						enabled: true,
						provider: 'playwright',
						instances: [{ browser: 'chromium' }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**'],
					setupFiles: ['./vitest-setup-client.ts']
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
