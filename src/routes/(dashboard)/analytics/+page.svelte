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
	import { Progress } from '$lib/components/ui/progress';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import { BarChart3, Clock, Code, TrendingUp, Users } from 'lucide-svelte';

	let analyticsData = {
		totalProjects: 12,
		activeUsers: 45,
		totalCommits: 234,
		avgBuildTime: '2.3s',
		usageStats: {
			apiCalls: 15420,
			storageUsed: '2.4GB',
			bandwidth: '15.6MB'
		},
		projectMetrics: [
			{ name: 'Web App', commits: 45, status: 'active' },
			{ name: 'Mobile App', commits: 32, status: 'active' },
			{ name: 'API Service', commits: 28, status: 'maintenance' }
		]
	};
</script>

<svelte:head>
	<title>Analytics - Aura IDE</title>
</svelte:head>

<div class="flex-1 space-y-4 p-4 pt-6 md:p-8">
	<div class="flex items-center justify-between space-y-2">
		<h2 class="text-3xl font-bold tracking-tight">Analytics</h2>
		<div class="flex items-center space-x-2">
			<Button variant="outline" size="sm">
				<BarChart3 class="mr-2 h-4 w-4" />
				Export Report
			</Button>
		</div>
	</div>

	<Tabs value="overview" class="space-y-4">
		<TabsList>
			<TabsTrigger value="overview">Overview</TabsTrigger>
			<TabsTrigger value="projects">Projects</TabsTrigger>
			<TabsTrigger value="performance">Performance</TabsTrigger>
		</TabsList>

		<TabsContent value="overview" class="space-y-4">
			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle class="text-sm font-medium">Total Projects</CardTitle>
						<Code class="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div class="text-2xl font-bold">{analyticsData.totalProjects}</div>
						<p class="text-xs text-muted-foreground">+2 from last month</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle class="text-sm font-medium">Active Users</CardTitle>
						<Users class="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div class="text-2xl font-bold">{analyticsData.activeUsers}</div>
						<p class="text-xs text-muted-foreground">+12% from last month</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle class="text-sm font-medium">Total Commits</CardTitle>
						<TrendingUp class="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div class="text-2xl font-bold">{analyticsData.totalCommits}</div>
						<p class="text-xs text-muted-foreground">+8% from last week</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle class="text-sm font-medium">Avg Build Time</CardTitle>
						<Clock class="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div class="text-2xl font-bold">{analyticsData.avgBuildTime}</div>
						<p class="text-xs text-muted-foreground">-0.2s from last week</p>
					</CardContent>
				</Card>
			</div>

			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
				<Card class="col-span-4">
					<CardHeader>
						<CardTitle>Usage Statistics</CardTitle>
						<CardDescription>Your API usage and resource consumption</CardDescription>
					</CardHeader>
					<CardContent class="space-y-4">
						<div class="space-y-2">
							<div class="flex items-center justify-between text-sm">
								<span>API Calls</span>
								<span>{analyticsData.usageStats.apiCalls.toLocaleString()}</span>
							</div>
							<Progress value={75} class="h-2" />
						</div>
						<div class="space-y-2">
							<div class="flex items-center justify-between text-sm">
								<span>Storage Used</span>
								<span>{analyticsData.usageStats.storageUsed}</span>
							</div>
							<Progress value={60} class="h-2" />
						</div>
						<div class="space-y-2">
							<div class="flex items-center justify-between text-sm">
								<span>Bandwidth</span>
								<span>{analyticsData.usageStats.bandwidth}</span>
							</div>
							<Progress value={45} class="h-2" />
						</div>
					</CardContent>
				</Card>

				<Card class="col-span-3">
					<CardHeader>
						<CardTitle>Recent Activity</CardTitle>
						<CardDescription>Latest project updates and commits</CardDescription>
					</CardHeader>
					<CardContent>
						<div class="space-y-4">
							{#each analyticsData.projectMetrics as project}
								<div class="flex items-center">
									<div class="ml-4 space-y-1">
										<p class="text-sm leading-none font-medium">
											{project.name}
										</p>
										<p class="text-sm text-muted-foreground">
											{project.commits} commits
										</p>
									</div>
									<div class="ml-auto">
										<Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
											{project.status}
										</Badge>
									</div>
								</div>
							{/each}
						</div>
					</CardContent>
				</Card>
			</div>
		</TabsContent>

		<TabsContent value="projects" class="space-y-4">
			<Card>
				<CardHeader>
					<CardTitle>Project Analytics</CardTitle>
					<CardDescription>Detailed metrics for each project</CardDescription>
				</CardHeader>
				<CardContent>
					<p class="text-muted-foreground">Project analytics will be implemented here.</p>
				</CardContent>
			</Card>
		</TabsContent>

		<TabsContent value="performance" class="space-y-4">
			<Card>
				<CardHeader>
					<CardTitle>Performance Metrics</CardTitle>
					<CardDescription>System performance and optimization data</CardDescription>
				</CardHeader>
				<CardContent>
					<p class="text-muted-foreground">Performance metrics will be implemented here.</p>
				</CardContent>
			</Card>
		</TabsContent>
	</Tabs>
</div>
