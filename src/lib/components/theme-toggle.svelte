<script lang="ts">
	import { browser } from '$app/environment';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Monitor, Moon, Sun } from 'lucide-svelte';
	import { onMount } from 'svelte';

	let theme = $state('system');

	onMount(() => {
		if (browser) {
			theme = localStorage.getItem('theme') || 'system';
			applyTheme(theme);
		}
	});

	function applyTheme(newTheme: string) {
		if (!browser) return;

		theme = newTheme;
		localStorage.setItem('theme', newTheme);

		const root = document.documentElement;

		if (newTheme === 'dark') {
			root.classList.add('dark');
		} else if (newTheme === 'light') {
			root.classList.remove('dark');
		} else {
			// System theme
			const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
			if (isDark) {
				root.classList.add('dark');
			} else {
				root.classList.remove('dark');
			}
		}
	}

	function getThemeIcon(currentTheme: string) {
		switch (currentTheme) {
			case 'light':
				return Sun;
			case 'dark':
				return Moon;
			default:
				return Monitor;
		}
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#if theme === 'light'}
			<Sun class="h-4 w-4" />
		{:else if theme === 'dark'}
			<Moon class="h-4 w-4" />
		{:else}
			<Monitor class="h-4 w-4" />
		{/if}
		<span class="sr-only">Toggle theme</span>
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end" class="w-40">
		<DropdownMenu.Item onclick={() => applyTheme('light')} class="cursor-pointer">
			<Sun class="mr-2 h-4 w-4" />
			Light
		</DropdownMenu.Item>
		<DropdownMenu.Item onclick={() => applyTheme('dark')} class="cursor-pointer">
			<Moon class="mr-2 h-4 w-4" />
			Dark
		</DropdownMenu.Item>
		<DropdownMenu.Item onclick={() => applyTheme('system')} class="cursor-pointer">
			<Monitor class="mr-2 h-4 w-4" />
			System
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>
