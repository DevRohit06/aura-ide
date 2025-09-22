<!--
  SandboxCreateDialog.svelte
  Dialog component for creating new sandbox environments with template selection
-->
<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger,
		SelectValue
	} from '$lib/components/ui/select';
	import { Textarea } from '$lib/components/ui/textarea';
	import { ExternalLink, Loader2 } from 'lucide-svelte';
	import { onMount } from 'svelte';

	interface Props {
		open: boolean;
		onCreated?: () => void;
	}

	let { open = $bindable(), onCreated }: Props = $props();

	interface Template {
		id: string;
		name: string;
		type: string;
		description: string;
		category: string;
		tags: string[];
		popularity_score: number;
		dependencies: Array<{
			dependency_name: string;
			dependency_version: string;
			dependency_type: string;
		}>;
		preview_url?: string;
	}

	// Form state
	let name = $state('');
	let description = $state('');
	let selectedTemplate = $state<string>('');
	let selectedProvider = $state<'daytona' | 'e2b' | 'local'>('daytona');
	let environment = $state('node');
	let projectId = $state('');

	// Component state
	let templates = $state<Template[]>([]);
	let loading = $state(false);
	let creating = $state(false);
	let error = $state<string | null>(null);
	let templateSearch = $state('');
	let selectedCategory = $state<string>('all');

	// Categories
	const categories = [
		'all',
		'frontend',
		'backend',
		'fullstack',
		'mobile',
		'data-science',
		'machine-learning',
		'devops',
		'game-dev',
		'desktop'
	];

	// Environment options
	const environments = [
		{ value: 'node', label: 'Node.js' },
		{ value: 'python', label: 'Python' },
		{ value: 'go', label: 'Go' },
		{ value: 'rust', label: 'Rust' },
		{ value: 'java', label: 'Java' },
		{ value: 'php', label: 'PHP' },
		{ value: 'ruby', label: 'Ruby' },
		{ value: 'dotnet', label: '.NET' }
	];

	// Provider options
	const providers = [
		{ value: 'daytona', label: 'Daytona', description: 'Cloud-native development environment' },
		{ value: 'e2b', label: 'E2B', description: 'Secure code execution environment' },
		{ value: 'local', label: 'Local', description: 'Local development environment' }
	];

	// Reactive filtered templates
	let filteredTemplates = $derived(() => {
		return templates
			.filter((template) => {
				const matchesSearch =
					!templateSearch ||
					template.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
					template.description.toLowerCase().includes(templateSearch.toLowerCase()) ||
					template.tags.some((tag) => tag.toLowerCase().includes(templateSearch.toLowerCase()));

				const matchesCategory =
					selectedCategory === 'all' || template.category === selectedCategory;

				return matchesSearch && matchesCategory;
			})
			.sort((a, b) => b.popularity_score - a.popularity_score);
	});

	// Load available templates
	async function loadTemplates() {
		loading = true;
		error = null;

		try {
			const response = await fetch('/api/templates');
			if (!response.ok) {
				throw new Error('Failed to load templates');
			}

			const data = await response.json();
			templates = data.templates;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load templates';
			console.error('Error loading templates:', err);
		} finally {
			loading = false;
		}
	}

	// Create sandbox
	async function createSandbox() {
		if (!name.trim()) {
			error = 'Sandbox name is required';
			return;
		}

		if (!selectedTemplate) {
			error = 'Please select a template';
			return;
		}

		creating = true;
		error = null;

		try {
			const response = await fetch('/api/sandbox', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name: name.trim(),
					description: description.trim(),
					templateId: selectedTemplate,
					provider: selectedProvider,
					environment,
					projectId: projectId.trim() || undefined
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to create sandbox');
			}

			const data = await response.json();
			console.log('Sandbox created:', data);

			// Reset form
			name = '';
			description = '';
			selectedTemplate = '';
			projectId = '';

			// Close dialog and notify parent
			open = false;
			onCreated?.();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create sandbox';
			console.error('Error creating sandbox:', err);
		} finally {
			creating = false;
		}
	}

	// Reset form when dialog opens
	$effect(() => {
		if (open) {
			name = '';
			description = '';
			selectedTemplate = '';
			projectId = '';
			error = null;
			if (templates.length === 0) {
				loadTemplates();
			}
		}
	});

	// Lifecycle
	onMount(() => {
		if (open) {
			loadTemplates();
		}
	});
</script>

<Dialog bind:open>
	<DialogContent class="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden">
		<DialogHeader>
			<DialogTitle>Create New Sandbox</DialogTitle>
			<DialogDescription>Set up a new development environment from a template</DialogDescription>
		</DialogHeader>

		<div class="flex-1 space-y-6 overflow-y-auto">
			<!-- Basic Information -->
			<div class="grid gap-4">
				<div class="grid gap-2">
					<Label for="sandbox-name">Sandbox Name</Label>
					<Input
						id="sandbox-name"
						type="text"
						placeholder="My awesome project"
						bind:value={name}
						required
					/>
				</div>

				<div class="grid gap-2">
					<Label for="sandbox-description">Description (Optional)</Label>
					<Textarea
						id="sandbox-description"
						placeholder="Brief description of your project..."
						bind:value={description}
						rows={2}
					/>
				</div>

				<div class="grid gap-2">
					<Label for="project-id">Project ID (Optional)</Label>
					<Input
						id="project-id"
						type="text"
						placeholder="Link to existing project"
						bind:value={projectId}
					/>
				</div>
			</div>

			<!-- Provider & Environment -->
			<div class="grid gap-4 md:grid-cols-2">
				<div class="grid gap-2">
					<Label>Provider</Label>
					<Select bind:value={selectedProvider}>
						<SelectTrigger>
							<SelectValue placeholder="Select provider" />
						</SelectTrigger>
						<SelectContent>
							{#each providers as provider}
								<SelectItem value={provider.value}>
									<div>
										<div class="font-medium">{provider.label}</div>
										<div class="text-sm text-muted-foreground">{provider.description}</div>
									</div>
								</SelectItem>
							{/each}
						</SelectContent>
					</Select>
				</div>

				<div class="grid gap-2">
					<Label>Runtime Environment</Label>
					<Select bind:value={environment}>
						<SelectTrigger>
							<SelectValue placeholder="Select environment" />
						</SelectTrigger>
						<SelectContent>
							{#each environments as env}
								<SelectItem value={env.value}>{env.label}</SelectItem>
							{/each}
						</SelectContent>
					</Select>
				</div>
			</div>

			<!-- Template Selection -->
			<div class="space-y-4">
				<div>
					<Label class="text-base font-semibold">Select Template</Label>
					<p class="text-sm text-muted-foreground">Choose a starting point for your sandbox</p>
				</div>

				<!-- Template Filters -->
				<div class="flex flex-col gap-2 sm:flex-row">
					<Input
						type="text"
						placeholder="Search templates..."
						bind:value={templateSearch}
						class="flex-1"
					/>
					<Select bind:value={selectedCategory}>
						<SelectTrigger class="w-full sm:w-40">
							<SelectValue placeholder="Category" />
						</SelectTrigger>
						<SelectContent>
							{#each categories as category}
								<SelectItem value={category}>
									{category === 'all' ? 'All Categories' : category}
								</SelectItem>
							{/each}
						</SelectContent>
					</Select>
				</div>

				<!-- Templates Grid -->
				{#if loading}
					<div class="flex items-center justify-center py-8">
						<Loader2 class="h-6 w-6 animate-spin" />
						<span class="ml-2">Loading templates...</span>
					</div>
				{:else if filteredTemplates().length > 0}
					<div class="grid max-h-64 gap-3 overflow-y-auto">
						{#each filteredTemplates() as template}
							<Card
								class={`cursor-pointer transition-all hover:shadow-md ${
									selectedTemplate === template.id ? 'ring-2 ring-primary' : ''
								}`}
								onclick={() => (selectedTemplate = template.id)}
							>
								<CardHeader class="pb-2">
									<div class="flex items-start justify-between">
										<div class="flex-1">
											<CardTitle class="text-base">{template.name}</CardTitle>
											<CardDescription class="mt-1 text-sm">
												{template.description}
											</CardDescription>
										</div>
										<div class="flex items-center gap-2">
											<Badge variant="secondary" class="text-xs">
												{template.category}
											</Badge>
											{#if template.preview_url}
												<Button
													variant="ghost"
													size="sm"
													onclick={(e) => {
														e.stopPropagation();
														window.open(template.preview_url, '_blank');
													}}
												>
													<ExternalLink class="h-3 w-3" />
												</Button>
											{/if}
										</div>
									</div>
								</CardHeader>

								<CardContent class="pt-0">
									<div class="mb-2 flex flex-wrap gap-1">
										{#each template.tags.slice(0, 3) as tag}
											<Badge variant="outline" class="text-xs">
												{tag}
											</Badge>
										{/each}
										{#if template.tags.length > 3}
											<Badge variant="outline" class="text-xs">
												+{template.tags.length - 3} more
											</Badge>
										{/if}
									</div>

									{#if template.dependencies.length > 0}
										<div class="text-xs text-muted-foreground">
											<strong>Dependencies:</strong>
											{template.dependencies
												.slice(0, 3)
												.map((dep) => dep.dependency_name)
												.join(', ')}
											{#if template.dependencies.length > 3}
												and {template.dependencies.length - 3} more
											{/if}
										</div>
									{/if}
								</CardContent>
							</Card>
						{/each}
					</div>
				{:else}
					<Card>
						<CardContent class="flex items-center justify-center py-8">
							<p class="text-muted-foreground">No templates found matching your criteria</p>
						</CardContent>
					</Card>
				{/if}
			</div>

			<!-- Error Display -->
			{#if error}
				<div class="rounded-md border border-red-200 bg-red-50 p-3">
					<p class="text-sm text-red-800">{error}</p>
				</div>
			{/if}
		</div>

		<!-- Actions -->
		<div class="flex justify-end gap-2 border-t pt-4">
			<Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
			<Button onclick={createSandbox} disabled={creating || !name.trim() || !selectedTemplate}>
				{#if creating}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					Creating...
				{:else}
					Create Sandbox
				{/if}
			</Button>
		</div>
	</DialogContent>
</Dialog>
