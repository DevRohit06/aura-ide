<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import { Book, Code, ExternalLink, FileText, Search } from 'lucide-svelte';

	let searchQuery = $state('');

	const docsSections = [
		{
			title: 'Getting Started',
			description: 'Learn the basics of Aura IDE',
			icon: Book,
			articles: [
				{ title: 'Installation Guide', url: '#' },
				{ title: 'First Project Setup', url: '#' },
				{ title: 'Basic Configuration', url: '#' }
			]
		},
		{
			title: 'API Reference',
			description: 'Complete API documentation',
			icon: Code,
			articles: [
				{ title: 'Authentication Endpoints', url: '#' },
				{ title: 'Project Management', url: '#' },
				{ title: 'File Operations', url: '#' }
			]
		},
		{
			title: 'Guides',
			description: 'Step-by-step tutorials',
			icon: FileText,
			articles: [
				{ title: 'Advanced Editor Features', url: '#' },
				{ title: 'Terminal Integration', url: '#' },
				{ title: 'Plugin Development', url: '#' }
			]
		}
	];
</script>

<svelte:head>
	<title>Documentation - Aura IDE</title>
</svelte:head>

<div class="flex-1 space-y-4 p-4 pt-6 md:p-8">
	<div class="flex items-center justify-between space-y-2">
		<h2 class="text-3xl font-bold tracking-tight">Documentation</h2>
		<div class="flex items-center space-x-2">
			<div class="relative">
				<Search class="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
				<Input
					placeholder="Search documentation..."
					class="w-[300px] pl-8"
					bind:value={searchQuery}
				/>
			</div>
		</div>
	</div>

	<Tabs value="overview" class="space-y-4">
		<TabsList>
			<TabsTrigger value="overview">Overview</TabsTrigger>
			<TabsTrigger value="api">API</TabsTrigger>
			<TabsTrigger value="guides">Guides</TabsTrigger>
		</TabsList>

		<TabsContent value="overview" class="space-y-4">
			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each docsSections as section}
					<Card class="cursor-pointer transition-shadow hover:shadow-md">
						<CardHeader>
							<div class="flex items-center space-x-2">
								<section.icon class="h-5 w-5" />
								<CardTitle class="text-lg">{section.title}</CardTitle>
							</div>
							<CardDescription>{section.description}</CardDescription>
						</CardHeader>
						<CardContent>
							<div class="space-y-2">
								{#each section.articles as article}
									<div class="flex items-center justify-between rounded-md p-2 hover:bg-muted">
										<span class="text-sm">{article.title}</span>
										<ExternalLink class="h-3 w-3 text-muted-foreground" />
									</div>
								{/each}
							</div>
						</CardContent>
					</Card>
				{/each}
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Quick Links</CardTitle>
					<CardDescription>Frequently accessed documentation</CardDescription>
				</CardHeader>
				<CardContent>
					<div class="grid gap-2 md:grid-cols-2">
						<Button variant="outline" class="justify-start">
							<Book class="mr-2 h-4 w-4" />
							User Manual
						</Button>
						<Button variant="outline" class="justify-start">
							<Code class="mr-2 h-4 w-4" />
							Developer Guide
						</Button>
						<Button variant="outline" class="justify-start">
							<FileText class="mr-2 h-4 w-4" />
							Changelog
						</Button>
						<Button variant="outline" class="justify-start">
							<ExternalLink class="mr-2 h-4 w-4" />
							Community Forum
						</Button>
					</div>
				</CardContent>
			</Card>
		</TabsContent>

		<TabsContent value="api" class="space-y-4">
			<Card>
				<CardHeader>
					<CardTitle>API Documentation</CardTitle>
					<CardDescription>Complete reference for Aura IDE APIs</CardDescription>
				</CardHeader>
				<CardContent>
					<p class="text-muted-foreground">API documentation will be implemented here.</p>
				</CardContent>
			</Card>
		</TabsContent>

		<TabsContent value="guides" class="space-y-4">
			<Card>
				<CardHeader>
					<CardTitle>Guides & Tutorials</CardTitle>
					<CardDescription>Step-by-step guides for common tasks</CardDescription>
				</CardHeader>
				<CardContent>
					<p class="text-muted-foreground">Guides and tutorials will be implemented here.</p>
				</CardContent>
			</Card>
		</TabsContent>
	</Tabs>
</div>
