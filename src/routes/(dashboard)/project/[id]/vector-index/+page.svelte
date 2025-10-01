<script lang="ts">
	import { page } from '$app/stores';
	import ConfirmModal from '$lib/components/common/modals/confirm-modal.svelte';
	import { Button } from '$lib/components/ui/button';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';

	let files: Array<{ path: string; isSelected?: boolean }> = [];
	let loading = false;
	let indexing = false;
	let progress = 0;
	let message = '';

	const projectId = get(page).params.id;

	let confirmOpen = false;
	let confirmTitle = '';
	let confirmBody = '';
	let confirmResolve: ((value: boolean) => void) | null = null;

	onMount(async () => {
		await loadFiles();
	});

	async function loadFiles() {
		loading = true;
		try {
			const response = await fetch('/api/files', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ operation: 'list', projectId, path: '' })
			});
			if (!response.ok) throw new Error('Failed to list files');
			const data = await response.json();
			// Expect data.data.files or data.data.database etc.
			const fileList = data?.data?.files || data?.data?.database || [];
			files = fileList.map((f: any) => ({
				path: f.path || f.name || f.filePath || f,
				isSelected: true
			}));
		} catch (err) {
			console.error('Failed to load files:', err);
			message = 'Failed to load project files';
		} finally {
			loading = false;
		}
	}

	function toggleSelectAll() {
		const anyUnselected = files.some((f) => !f.isSelected);
		files = files.map((f) => ({ ...f, isSelected: anyUnselected }));
	}

	function showConfirm(title: string, body: string) {
		confirmTitle = title;
		confirmBody = body;
		confirmOpen = true;
		return new Promise<boolean>((resolve) => {
			confirmResolve = resolve;
		});
	}

	function handleModalConfirm() {
		confirmOpen = false;
		if (confirmResolve) confirmResolve(true);
		confirmResolve = null;
	}

	function handleModalCancel() {
		confirmOpen = false;
		if (confirmResolve) confirmResolve(false);
		confirmResolve = null;
	}

	async function indexSelected() {
		const selected = files.filter((f) => f.isSelected);
		if (selected.length === 0) return;

		const ok = await showConfirm(
			'Index files',
			`Queue indexing of ${selected.length} files into vector DB for project ${projectId}? This will run asynchronously.`
		);
		if (!ok) return;

		indexing = true;
		progress = 0;
		message = '';

		try {
			const docs: any[] = [];
			for (let i = 0; i < selected.length; i++) {
				const path = selected[i].path;
				// Read file content
				const r = await fetch('/api/files', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ operation: 'read', projectId, path })
				});
				if (!r.ok) {
					console.warn('Failed to read file:', path);
					continue;
				}
				const rr = await r.json();
				const content = rr?.data?.content || rr?.content || '';
				docs.push({ id: `${projectId}:${path}`, filePath: path, content, projectId });
				progress = Math.round(((i + 1) / selected.length) * 100);
			}

			if (docs.length === 0) {
				message = 'No files could be read for indexing';
				return;
			}

			// Enqueue indexing job
			const enqueueRes = await fetch('/api/vector-db/queue', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(docs)
			});
			if (!enqueueRes.ok) throw new Error('Failed to enqueue indexing job');
			const enqueueJson = await enqueueRes.json();
			const jobId = enqueueJson?.jobId;
			if (!jobId) throw new Error('No job id returned');

			message = `Indexing job queued (jobId: ${jobId}). Polling status...`;

			// Poll job status
			let finished = false;
			while (!finished) {
				await new Promise((r) => setTimeout(r, 1500));
				const statusRes = await fetch(`/api/vector-db/queue?jobId=${encodeURIComponent(jobId)}`);
				if (!statusRes.ok) {
					console.warn('Failed to fetch job status');
					continue;
				}
				const statusJson = await statusRes.json();
				if (!statusJson?.success) {
					console.warn('Job not found or error');
					continue;
				}
				const status = statusJson.status;
				if (status.progress || status.progress === 0) {
					progress = Number(status.progress) || progress;
				}
				if (status.state === 'completed' || status.state === 'failed' || status.state === 'stuck') {
					finished = true;
					message = `Indexing job ${jobId} ${status.state}`;
					if (status.returnValue) {
						message += ` - indexed ${status.returnValue.indexed || 0} docs`;
					}
				}
			}
		} catch (err) {
			console.error('Indexing error:', err);
			message = 'Indexing failed to enqueue or process';
		} finally {
			indexing = false;
			progress = 100;
		}
	}
</script>

<div class="mb-4 px-4">
	<h1 class="text-2xl font-semibold">Vector Index</h1>
	<p class="text-sm text-muted-foreground">Index project files into the code vector store</p>
</div>

<div class="p-4">
	<div class="mb-4 flex items-center gap-2">
		<Button onclick={loadFiles} disabled={loading} variant="secondary">Refresh files</Button>
		<Button onclick={toggleSelectAll} variant="ghost">Toggle Select All</Button>
		<Button onclick={indexSelected} variant="secondary" disabled={indexing || loading}>
			Index Selected
		</Button>
	</div>

	{#if loading}
		<p>Loading files...</p>
	{:else if files.length === 0}
		<p>No files found in project.</p>
	{:else}
		<div class="mb-4 max-h-96 overflow-y-auto border p-2">
			{#each files as f (f.path)}
				<div class="flex items-center gap-2 p-1">
					<input type="checkbox" bind:checked={f.isSelected} />
					<div class="truncate">{f.path}</div>
				</div>
			{/each}
		</div>
	{/if}

	{#if indexing}
		<div class="mb-2">Indexing... {progress}%</div>
	{/if}

	{#if message}
		<div class="mt-4 text-sm">{message}</div>
	{/if}
</div>

<ConfirmModal
	bind:open={confirmOpen}
	title={confirmTitle}
	description={confirmBody}
	on:confirm={handleModalConfirm}
	on:cancel={handleModalCancel}
/>
