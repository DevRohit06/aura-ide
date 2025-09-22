<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { LogOut } from 'lucide-svelte';

	async function logout() {
		try {
			await fetch('/api/auth/logout', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${localStorage.getItem('accessToken')}`
				}
			});
		} catch (error) {
			console.error('Logout error:', error);
		} finally {
			localStorage.removeItem('accessToken');
			goto('/auth/login');
		}
	}
</script>

<svelte:head>
	<title>Sessions - Aura IDE</title>
</svelte:head>

<header class="flex h-16 shrink-0 items-center gap-2 border-b px-4">
	<Sidebar.Trigger class="-ml-1" />
	<div class="flex items-center gap-2">
		<h1 class="text-lg font-semibold">Sessions</h1>
	</div>
	<div class="ml-auto flex items-center gap-2">
		<Button variant="outline" size="sm" onclick={logout}>
			<LogOut class="mr-2 h-4 w-4" />
			Logout
		</Button>
	</div>
</header>
