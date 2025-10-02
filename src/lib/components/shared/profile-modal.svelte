<script lang="ts">
	import ProfilePicture from '$lib/components/shared/profile-picture.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Separator from '$lib/components/ui/separator/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';

	import CopyIcon from '@lucide/svelte/icons/copy';
	import CreditCardIcon from '@lucide/svelte/icons/credit-card';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import KeyIcon from '@lucide/svelte/icons/key';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import ShieldIcon from '@lucide/svelte/icons/shield';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import UserIcon from '@lucide/svelte/icons/user';

	type Props = {
		open?: boolean;
		user?: {
			id: string;
			email: string;
			username?: string;
			name?: string;
			image?: string;
		};
	};

	let { open = $bindable(false), user }: Props = $props();

	// Profile categories
	const profileCategories = [
		{ id: 'profile', name: 'Profile', icon: 'user' },
		{ id: 'tokens', name: 'API Tokens', icon: 'key' },
		{ id: 'account', name: 'Account', icon: 'settings' },
		{ id: 'security', name: 'Security', icon: 'shield' },
		{ id: 'billing', name: 'Billing', icon: 'credit-card' }
	];

	const iconMap = {
		user: UserIcon,
		key: KeyIcon,
		settings: SettingsIcon,
		shield: ShieldIcon,
		'credit-card': CreditCardIcon
	};

	let activeSection = $state('profile');
	let profileForm = $state({
		name: user?.name || '',
		username: user?.username || '',
		email: user?.email || '',
		bio: ''
	});

	// Mock API tokens data
	let apiTokens = $state([
		{
			id: '1',
			name: 'Production API',
			token: 'aura_***************************xyz',
			lastUsed: '2024-01-15',
			created: '2024-01-01',
			permissions: ['read', 'write']
		},
		{
			id: '2',
			name: 'Development',
			token: 'aura_***************************abc',
			lastUsed: '2024-01-10',
			created: '2023-12-15',
			permissions: ['read']
		}
	]);

	let newTokenName = $state('');
	let showTokenForm = $state(false);
	let visibleTokens = $state<Set<string>>(new Set());

	function setActiveSection(sectionId: string) {
		activeSection = sectionId;
	}

	function saveProfile() {
		// TODO: Implement profile save
		console.log('Saving profile:', profileForm);
	}

	function copyToken(token: string) {
		navigator.clipboard.writeText(token);
		// TODO: Show toast notification
	}

	function toggleTokenVisibility(tokenId: string) {
		const newVisible = new Set(visibleTokens);
		if (newVisible.has(tokenId)) {
			newVisible.delete(tokenId);
		} else {
			newVisible.add(tokenId);
		}
		visibleTokens = newVisible;
	}

	function createNewToken() {
		if (!newTokenName.trim()) return;

		const newToken = {
			id: Date.now().toString(),
			name: newTokenName,
			token: `aura_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`,
			lastUsed: 'Never',
			created: new Date().toISOString().split('T')[0],
			permissions: ['read', 'write']
		};

		apiTokens = [...apiTokens, newToken];
		newTokenName = '';
		showTokenForm = false;
	}

	function deleteToken(tokenId: string) {
		apiTokens = apiTokens.filter((token) => token.id !== tokenId);
	}

	function formatToken(token: string, visible: boolean): string {
		if (visible) return token;
		const prefix = token.substring(0, 5);
		const suffix = token.substring(token.length - 3);
		return `${prefix}***************************${suffix}`;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		class="overflow-hidden p-0 md:max-h-[700px] md:max-w-[1000px] lg:max-w-[1200px]"
		trapFocus={false}
	>
		<Dialog.Title class="sr-only">Profile Settings</Dialog.Title>
		<Dialog.Description class="sr-only">
			Manage your profile, API tokens, and account settings.
		</Dialog.Description>

		<Sidebar.Provider class="items-start">
			<Sidebar.Root collapsible="none" class="hidden border-r md:flex">
				<Sidebar.Content>
					<Sidebar.Header class="p-4">
						<div class="flex items-center gap-3">
							<ProfilePicture
								name={user?.name || user?.username || user?.email || 'User'}
								src={user?.image}
								size="lg"
							/>
							<div>
								<p class="font-medium">{user?.name || user?.username || 'User'}</p>
								<p class="text-sm text-muted-foreground">{user?.email}</p>
							</div>
						</div>
					</Sidebar.Header>

					<Sidebar.Group>
						<Sidebar.GroupContent>
							<Sidebar.Menu>
								{#each profileCategories as category (category.id)}
									{@const Icon = iconMap?.[category.icon as keyof typeof iconMap]}
									<Sidebar.MenuItem>
										<Sidebar.MenuButton
											isActive={activeSection === category.id}
											onclick={() => setActiveSection(category.id)}
										>
											{#snippet child({ props })}
												<button onclick={() => setActiveSection(category.id)} {...props}>
													<Icon size={16} />
													<span>{category.name}</span>
												</button>
											{/snippet}
										</Sidebar.MenuButton>
									</Sidebar.MenuItem>
								{/each}
							</Sidebar.Menu>
						</Sidebar.GroupContent>
					</Sidebar.Group>
				</Sidebar.Content>
			</Sidebar.Root>

			<main class="flex h-[650px] flex-1 flex-col overflow-hidden">
				<header class="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear">
					<div class="flex w-full items-center justify-between px-4">
						<Breadcrumb.Root>
							<Breadcrumb.List>
								<Breadcrumb.Item class="hidden md:block">
									<Breadcrumb.Link href="#">Profile</Breadcrumb.Link>
								</Breadcrumb.Item>
								<Breadcrumb.Separator class="hidden md:block" />
								<Breadcrumb.Item>
									<Breadcrumb.Page>
										{profileCategories.find((cat) => cat.id === activeSection)?.name || 'Profile'}
									</Breadcrumb.Page>
								</Breadcrumb.Item>
							</Breadcrumb.List>
						</Breadcrumb.Root>
					</div>
				</header>

				<div class="flex flex-1 flex-col gap-6 overflow-y-auto p-4 pt-0">
					{#if activeSection === 'profile'}
						<div class="space-y-6">
							<div>
								<h3 class="text-lg font-medium">Profile Information</h3>
								<p class="text-sm text-muted-foreground">
									Update your profile information and preferences.
								</p>
							</div>

							<Separator.Root />

							<div class="space-y-4">
								<div class="grid grid-cols-2 gap-4">
									<div class="space-y-2">
										<Label for="name">Full Name</Label>
										<Input
											id="name"
											bind:value={profileForm.name}
											placeholder="Enter your full name"
										/>
									</div>

									<div class="space-y-2">
										<Label for="username">Username</Label>
										<Input
											id="username"
											bind:value={profileForm.username}
											placeholder="Enter your username"
										/>
									</div>
								</div>

								<div class="space-y-2">
									<Label for="email">Email</Label>
									<Input
										id="email"
										type="email"
										bind:value={profileForm.email}
										placeholder="Enter your email"
									/>
								</div>

								<div class="space-y-2">
									<Label for="bio">Bio</Label>
									<Textarea
										id="bio"
										bind:value={profileForm.bio}
										placeholder="Tell us about yourself..."
										rows={3}
									/>
								</div>

								<div class="flex justify-end">
									<Button onclick={saveProfile}>Save Changes</Button>
								</div>
							</div>
						</div>
					{:else if activeSection === 'tokens'}
						<div class="space-y-6">
							<div class="flex items-center justify-between">
								<div>
									<h3 class="text-lg font-medium">API Tokens</h3>
									<p class="text-sm text-muted-foreground">
										Manage your API tokens for programmatic access.
									</p>
								</div>
								<Button onclick={() => (showTokenForm = true)} size="sm">
									<PlusIcon size={16} class="mr-2" />
									New Token
								</Button>
							</div>

							<Separator.Root />

							{#if showTokenForm}
								<Card.Root>
									<Card.Header>
										<Card.Title>Create New Token</Card.Title>
										<Card.Description>
											Give your token a descriptive name to identify its purpose.
										</Card.Description>
									</Card.Header>
									<Card.Content>
										<div class="space-y-4">
											<div class="space-y-2">
												<Label for="token-name">Token Name</Label>
												<Input
													id="token-name"
													bind:value={newTokenName}
													placeholder="e.g., Production API, Development"
												/>
											</div>
											<div class="flex gap-2">
												<Button onclick={createNewToken} disabled={!newTokenName.trim()}>
													Create Token
												</Button>
												<Button variant="outline" onclick={() => (showTokenForm = false)}>
													Cancel
												</Button>
											</div>
										</div>
									</Card.Content>
								</Card.Root>
							{/if}

							<div class="space-y-4">
								{#each apiTokens as token (token.id)}
									<Card.Root>
										<Card.Header>
											<div class="flex items-center justify-between">
												<div>
													<Card.Title class="text-base">{token.name}</Card.Title>
													<Card.Description>
														Created {token.created} • Last used {token.lastUsed}
													</Card.Description>
												</div>
												<div class="flex items-center gap-2">
													{#each token.permissions as permission}
														<Badge variant="secondary" class="text-xs">
															{permission}
														</Badge>
													{/each}
												</div>
											</div>
										</Card.Header>
										<Card.Content>
											<div class="flex items-center gap-2">
												<Input
													readonly
													value={formatToken(token.token, visibleTokens.has(token.id))}
													class="font-mono text-sm"
												/>
												<Button
													variant="outline"
													size="icon"
													onclick={() => toggleTokenVisibility(token.id)}
												>
													{#if visibleTokens.has(token.id)}
														<EyeOffIcon size={16} />
													{:else}
														<EyeIcon size={16} />
													{/if}
												</Button>
												<Button
													variant="outline"
													size="icon"
													onclick={() => copyToken(token.token)}
												>
													<CopyIcon size={16} />
												</Button>
												<Button
													variant="outline"
													size="icon"
													onclick={() => deleteToken(token.id)}
													class="text-destructive hover:text-destructive"
												>
													<TrashIcon size={16} />
												</Button>
											</div>
										</Card.Content>
									</Card.Root>
								{/each}

								{#if apiTokens.length === 0}
									<div class="py-8 text-center">
										<KeyIcon size={48} class="mx-auto mb-4 text-muted-foreground" />
										<h3 class="mb-2 text-lg font-medium">No API tokens</h3>
										<p class="mb-4 text-sm text-muted-foreground">
											Create your first API token to get started.
										</p>
										<Button onclick={() => (showTokenForm = true)}>
											<PlusIcon size={16} class="mr-2" />
											Create Token
										</Button>
									</div>
								{/if}
							</div>
						</div>
					{:else if activeSection === 'account'}
						<div class="space-y-6">
							<div>
								<h3 class="text-lg font-medium">Account Settings</h3>
								<p class="text-sm text-muted-foreground">
									Manage your account preferences and settings.
								</p>
							</div>

							<Separator.Root />

							<div class="py-8 text-center">
								<SettingsIcon size={48} class="mx-auto mb-4 text-muted-foreground" />
								<h3 class="mb-2 text-lg font-medium">Coming Soon</h3>
								<p class="text-sm text-muted-foreground">
									Account settings will be available in a future update.
								</p>
							</div>
						</div>
					{:else if activeSection === 'security'}
						<div class="space-y-6">
							<div>
								<h3 class="text-lg font-medium">Security</h3>
								<p class="text-sm text-muted-foreground">
									Manage your security settings and authentication.
								</p>
							</div>

							<Separator.Root />

							<div class="py-8 text-center">
								<ShieldIcon size={48} class="mx-auto mb-4 text-muted-foreground" />
								<h3 class="mb-2 text-lg font-medium">Coming Soon</h3>
								<p class="text-sm text-muted-foreground">
									Security settings will be available in a future update.
								</p>
							</div>
						</div>
					{:else if activeSection === 'billing'}
						<div class="space-y-6">
							<div>
								<h3 class="text-lg font-medium">Billing</h3>
								<p class="text-sm text-muted-foreground">
									Manage your subscription and billing information.
								</p>
							</div>

							<Separator.Root />

							<div class="py-8 text-center">
								<CreditCardIcon size={48} class="mx-auto mb-4 text-muted-foreground" />
								<h3 class="mb-2 text-lg font-medium">Coming Soon</h3>
								<p class="text-sm text-muted-foreground">
									Billing management will be available in a future update.
								</p>
							</div>
						</div>
					{/if}
				</div>
			</main>
		</Sidebar.Provider>
	</Dialog.Content>
</Dialog.Root>
