<script lang="ts">
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
</script>

<Sidebar.Provider>
	<AppSidebar />

	<Sidebar.Inset>
		<slot />
	</Sidebar.Inset>
</Sidebar.Provider>
