<script lang="ts">
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Separator from '$lib/components/ui/separator/index.js';

	import { themeStore, themeActions, themeOptions } from '$lib/stores/theme.store.js';
	import { settingsStore, settingsActions } from '$lib/stores/settings.store.js';
	import {
		comprehensiveSettingsStore,
		comprehensiveSettingsActions,
		currentTheme,
		editorConfig
	} from '$lib/stores/comprehensive-settings.store.js';

	import BellIcon from '@lucide/svelte/icons/bell';
	import CheckIcon from '@lucide/svelte/icons/check';
	import GlobeIcon from '@lucide/svelte/icons/globe';
	import HouseIcon from '@lucide/svelte/icons/house';
	import KeyboardIcon from '@lucide/svelte/icons/keyboard';
	import LinkIcon from '@lucide/svelte/icons/link';
	import LockIcon from '@lucide/svelte/icons/lock';
	import MenuIcon from '@lucide/svelte/icons/menu';
	import MessageCircleIcon from '@lucide/svelte/icons/message-circle';
	import PaintbrushIcon from '@lucide/svelte/icons/paintbrush';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import VideoIcon from '@lucide/svelte/icons/video';
	import MonitorIcon from '@lucide/svelte/icons/monitor';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import TypeIcon from '@lucide/svelte/icons/type';
	import CodeIcon from '@lucide/svelte/icons/code';

	const data = {
		nav: [
			{ name: 'Appearance', icon: PaintbrushIcon, id: 'appearance' },
			{ name: 'Editor', icon: CodeIcon, id: 'editor' },
			{ name: 'Keyboard', icon: KeyboardIcon, id: 'keyboard' },
			{ name: 'Advanced', icon: SettingsIcon, id: 'advanced' }
		]
	};

	let { open = $bindable(false), child = null, props = {} } = $props();

	let activeSection = $state('appearance');

	// Reactive values
	let theme = $derived($themeStore);
	let settings = $derived($settingsStore);
	let comprehensiveSettings = $derived($comprehensiveSettingsStore);
	let currentThemeValue = $derived($currentTheme);
	let editorSettings = $derived($editorConfig);

	function setActiveSection(sectionId: string) {
		activeSection = sectionId;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		class="overflow-hidden p-0 md:max-h-[600px] md:max-w-[800px] lg:max-w-[900px]"
		trapFocus={false}
	>
		<Dialog.Title class="sr-only">Settings</Dialog.Title>
		<Dialog.Description class="sr-only">Customize your settings here.</Dialog.Description>
		<Sidebar.Provider class="items-start">
			<Sidebar.Root collapsible="none" class="hidden border-r md:flex">
				<Sidebar.Content>
					<Sidebar.Group>
						<Sidebar.GroupContent>
							<Sidebar.Menu>
								{#each data.nav as item (item.name)}
									<Sidebar.MenuItem>
										<Sidebar.MenuButton
											isActive={activeSection === item.id}
											onclick={() => setActiveSection(item.id)}
										>
											{#snippet child({ props })}
												<button onclick={() => setActiveSection(item.id)} {...props}>
													<item.icon />
													<span>{item.name}</span>
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
			<main class="flex h-[580px] flex-1 flex-col overflow-hidden">
				<header
					class="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12"
				>
					<div class="flex items-center gap-2 px-4">
						<Breadcrumb.Root>
							<Breadcrumb.List>
								<Breadcrumb.Item class="hidden md:block">
									<Breadcrumb.Link href="#">Settings</Breadcrumb.Link>
								</Breadcrumb.Item>
								<Breadcrumb.Separator class="hidden md:block" />
								<Breadcrumb.Item>
									<Breadcrumb.Page
										>{data.nav.find((item) => item.id === activeSection)?.name ||
											'Settings'}</Breadcrumb.Page
									>
								</Breadcrumb.Item>
							</Breadcrumb.List>
						</Breadcrumb.Root>
					</div>
				</header>
				<div class="flex flex-1 flex-col gap-6 overflow-y-auto p-4 pt-0">
					{#if activeSection === 'appearance'}
						<div class="space-y-6">
							<div>
								<h3 class="text-lg font-medium">Appearance</h3>
								<p class="text-sm text-muted-foreground">
									Customize the look and feel of the editor.
								</p>
							</div>

							<Separator.Root />

							<div class="space-y-4">
								<div>
									<Label class="text-sm font-medium">Theme</Label>
									<p class="text-xs text-muted-foreground">
										Choose between light and dark theme with OneDark.
									</p>
								</div>

								<div class="flex gap-4">
									<Button
										variant={theme.mode === 'light' ? 'default' : 'outline'}
										size="sm"
										onclick={() => themeActions.setThemeMode('light')}
										class="flex items-center gap-2"
									>
										<SunIcon size={16} />
										Light
									</Button>
									<Button
										variant={theme.mode === 'dark' ? 'default' : 'outline'}
										size="sm"
										onclick={() => themeActions.setThemeMode('dark')}
										class="flex items-center gap-2"
									>
										<MoonIcon size={16} />
										Dark
									</Button>
								</div>
							</div>
						</div>
					{:else if activeSection === 'editor'}
						<div class="space-y-6">
							<div>
								<h3 class="text-lg font-medium">Editor</h3>
								<p class="text-sm text-muted-foreground">Customize editor behavior and features.</p>
							</div>

							<Separator.Root />

							<!-- Editor Settings -->
							<div class="space-y-4">
								<div class="flex items-center justify-between">
									<div class="space-y-0.5">
										<Label class="text-sm font-medium">Line Numbers</Label>
										<p class="text-xs text-muted-foreground">Show line numbers in the editor</p>
									</div>
									<Switch
										checked={settings.lineNumbers}
										onCheckedChange={settingsActions.toggleLineNumbers}
									/>
								</div>

								<div class="flex items-center justify-between">
									<div class="space-y-0.5">
										<Label class="text-sm font-medium">Word Wrap</Label>
										<p class="text-xs text-muted-foreground">Wrap long lines of text</p>
									</div>
									<Switch
										checked={settings.wordWrap}
										onCheckedChange={settingsActions.toggleWordWrap}
									/>
								</div>

								<div class="flex items-center justify-between">
									<div class="space-y-0.5">
										<Label class="text-sm font-medium">Mini Map</Label>
										<p class="text-xs text-muted-foreground">Show code minimap overview</p>
									</div>
									<Switch
										checked={settings.miniMap}
										onCheckedChange={settingsActions.toggleMiniMap}
									/>
								</div>

								<div class="flex items-center justify-between">
									<div class="space-y-0.5">
										<Label class="text-sm font-medium">Auto Save</Label>
										<p class="text-xs text-muted-foreground">Automatically save changes</p>
									</div>
									<Switch
										checked={settings.autoSave}
										onCheckedChange={settingsActions.toggleAutoSave}
									/>
								</div>

								<div class="flex items-center justify-between">
									<div class="space-y-0.5">
										<Label class="text-sm font-medium">Format on Save</Label>
										<p class="text-xs text-muted-foreground">Format code when saving</p>
									</div>
									<Switch
										checked={settings.formatOnSave}
										onCheckedChange={settingsActions.toggleFormatOnSave}
									/>
								</div>

								<!-- Tab Settings -->
								<div class="space-y-2">
									<Label class="text-sm font-medium">Tab Size</Label>
									<div class="flex items-center gap-2">
										<Input
											type="number"
											min="1"
											max="8"
											value={settings.tabSize}
											onchange={(e) => settingsActions.setTabSize(Number(e.currentTarget.value))}
											class="w-20"
										/>
										<span class="text-sm text-muted-foreground">spaces</span>
									</div>
								</div>

								<div class="flex items-center justify-between">
									<div class="space-y-0.5">
										<Label class="text-sm font-medium">Insert Spaces</Label>
										<p class="text-xs text-muted-foreground">Use spaces instead of tabs</p>
									</div>
									<Switch
										checked={settings.insertSpaces}
										onCheckedChange={settingsActions.toggleInsertSpaces}
									/>
								</div>

								<!-- Font Settings -->
								<Separator.Root />

								<div class="space-y-4">
									<div class="space-y-2">
										<Label class="text-sm font-medium">Font Size</Label>
										<div class="flex items-center gap-2">
											<Input
												type="number"
												min="8"
												max="32"
												value={settings.fontSize}
												onchange={(e) => settingsActions.setFontSize(Number(e.currentTarget.value))}
												class="w-20"
											/>
											<span class="text-sm text-muted-foreground">px</span>
										</div>
									</div>

									<div class="space-y-2">
										<Label class="text-sm font-medium">Line Height</Label>
										<div class="flex items-center gap-2">
											<Input
												type="number"
												min="1.0"
												max="3.0"
												step="0.1"
												value={settings.lineHeight}
												onchange={(e) =>
													settingsActions.setLineHeight(Number(e.currentTarget.value))}
												class="w-20"
											/>
										</div>
									</div>
								</div>
							</div>
						</div>
					{:else if activeSection === 'keyboard'}
						<div class="space-y-6">
							<div>
								<h3 class="text-lg font-medium">Keyboard</h3>
								<p class="text-sm text-muted-foreground">
									Configure keyboard shortcuts and editor modes.
								</p>
							</div>

							<Separator.Root />

							<div class="space-y-4">
								<div class="flex items-center justify-between">
									<div class="space-y-0.5">
										<Label class="text-sm font-medium">Vim Mode</Label>
										<p class="text-xs text-muted-foreground">Enable Vim key bindings</p>
									</div>
									<Switch checked={settings.vim} onCheckedChange={settingsActions.toggleVimMode} />
								</div>

								<div class="flex items-center justify-between">
									<div class="space-y-0.5">
										<Label class="text-sm font-medium">Emacs Mode</Label>
										<p class="text-xs text-muted-foreground">Enable Emacs key bindings</p>
									</div>
									<Switch
										checked={settings.emacs}
										onCheckedChange={settingsActions.toggleEmacsMode}
									/>
								</div>
							</div>
						</div>
					{:else if activeSection === 'advanced'}
						<div class="space-y-6">
							<div>
								<h3 class="text-lg font-medium">Advanced</h3>
								<p class="text-sm text-muted-foreground">Advanced settings and preferences.</p>
							</div>

							<Separator.Root />

							<div class="space-y-4">
								<div class="space-y-2">
									<Label class="text-sm font-medium">Auto Save Delay</Label>
									<div class="flex items-center gap-2">
										<Input
											type="number"
											min="100"
											max="10000"
											value={settings.autoSaveDelay}
											onchange={(e) =>
												settingsActions.setAutoSaveDelay(Number(e.currentTarget.value))}
											class="w-24"
										/>
										<span class="text-sm text-muted-foreground">milliseconds</span>
									</div>
								</div>

								<div class="flex gap-2">
									<Button variant="outline" size="sm" onclick={settingsActions.reset}>
										Reset Settings
									</Button>
								</div>
							</div>
						</div>
					{:else}
						<div class="space-y-6">
							<div>
								<h3 class="text-lg font-medium">Coming Soon</h3>
								<p class="text-sm text-muted-foreground">This section is under development.</p>
							</div>
						</div>
					{/if}
				</div>
			</main>
		</Sidebar.Provider>
	</Dialog.Content>
</Dialog.Root>
