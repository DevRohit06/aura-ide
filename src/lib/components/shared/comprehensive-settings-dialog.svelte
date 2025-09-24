<script lang="ts">
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Separator from '$lib/components/ui/separator/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';

	import {
		comprehensiveSettingsActions,
		comprehensiveSettingsStore,
		hasValidationErrors,
		settingsCategories,
		settingsValidationErrors
	} from '$lib/stores/comprehensive-settings.store.js';

	import AlertTriangleIcon from 'lucide-svelte/icons/alert-triangle';
	import BrainIcon from 'lucide-svelte/icons/brain';
	import CodeIcon from 'lucide-svelte/icons/code';
	import DownloadIcon from 'lucide-svelte/icons/download';
	import FolderIcon from 'lucide-svelte/icons/folder';
	import KeyboardIcon from 'lucide-svelte/icons/keyboard';
	import MonitorIcon from 'lucide-svelte/icons/monitor';
	import MoonIcon from 'lucide-svelte/icons/moon';
	import PaintbrushIcon from 'lucide-svelte/icons/paintbrush';
	import RotateCcwIcon from 'lucide-svelte/icons/rotate-ccw';
	import SearchIcon from 'lucide-svelte/icons/search';
	import SettingsIcon from 'lucide-svelte/icons/settings';
	import ShieldIcon from 'lucide-svelte/icons/shield';
	import SunIcon from 'lucide-svelte/icons/sun';
	import TerminalIcon from 'lucide-svelte/icons/terminal';
	import UploadIcon from 'lucide-svelte/icons/upload';
	import ZapIcon from 'lucide-svelte/icons/zap';

	const iconMap = {
		paintbrush: PaintbrushIcon,
		code: CodeIcon,
		keyboard: KeyboardIcon,
		brain: BrainIcon,
		terminal: TerminalIcon,
		folder: FolderIcon,
		zap: ZapIcon,
		shield: ShieldIcon,
		settings: SettingsIcon
	};

	const colorSchemes = [
		{ value: 'onedark', label: 'One Dark' },
		{ value: 'dracula', label: 'Dracula' },
		{ value: 'barf', label: 'Barf' },
		{ value: 'tomorrow', label: 'Tomorrow' }
	];

	const keyMaps = [
		{ value: 'default', label: 'Default' },
		{ value: 'vim', label: 'Vim' },
		{ value: 'emacs', label: 'Emacs' }
	];

	let { open = $bindable(false) } = $props();
	let activeSection = $state('appearance');
	let searchQuery = $state('');
	let showImportDialog = $state(false);
	let showExportDialog = $state(false);
	let importData = $state('');
	let exportData = $state('');
	let includeSecrets = $state(false);

	// Reactive values
	let settings = $derived($comprehensiveSettingsStore);
	let validationErrors = $derived($settingsValidationErrors);
	let hasErrors = $derived($hasValidationErrors);

	let colorSchemeValue = $state<string>();
	let keyMapValue = $state<string>();

	const colorSchemeTriggerContent = $derived(
		colorSchemes.find((c) => c.value === colorSchemeValue)?.label ?? 'Select color scheme'
	);

	const keyMapTriggerContent = $derived(
		keyMaps.find((k) => k.value === keyMapValue)?.label ?? 'Select key map'
	);

	$effect(() => {
		colorSchemeValue ??= settings.appearance.colorScheme;
		if (colorSchemeValue && colorSchemeValue !== settings.appearance.colorScheme) {
			comprehensiveSettingsActions.updateSetting('appearance', 'colorScheme', colorSchemeValue);
		}
	});

	$effect(() => {
		keyMapValue ??= settings.keyboard.keyMap;
		if (keyMapValue && keyMapValue !== settings.keyboard.keyMap) {
			comprehensiveSettingsActions.updateSetting('keyboard', 'keyMap', keyMapValue as any);
		}
	});

	function setActiveSection(sectionId: string) {
		activeSection = sectionId;
	}

	async function handleExport() {
		const exported = await comprehensiveSettingsActions.exportSettings(includeSecrets);
		if (exported) {
			exportData = JSON.stringify(exported, null, 2);
			showExportDialog = true;
		}
	}

	async function handleImport() {
		if (!importData.trim()) return;

		try {
			const parsed = JSON.parse(importData);
			const result = await comprehensiveSettingsActions.importSettings(parsed);

			if (result.success) {
				importData = '';
				showImportDialog = false;
				// Show success message
			} else {
				// Show error messages
				console.error('Import errors:', result.errors);
			}
		} catch (error) {
			console.error('Failed to parse import data:', error);
		}
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
	}

	function downloadAsFile(content: string, filename: string) {
		const blob = new Blob([content], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	// Theme preview functions
	function previewTheme(theme: string) {
		comprehensiveSettingsActions.previewThemeChange(theme);
	}

	function applyThemePreview() {
		comprehensiveSettingsActions.applyThemePreview();
	}

	function cancelThemePreview() {
		comprehensiveSettingsActions.cancelThemePreview();
	}

	// Preset functions
	function applyPreset(presetId: string) {
		const presets = comprehensiveSettingsActions.getBuiltInPresets();
		const preset = presets.find((p) => p.id === presetId);
		if (preset) {
			comprehensiveSettingsActions.applyPreset(preset);
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		class="overflow-hidden p-0 md:max-h-[700px] md:max-w-[1000px] lg:max-w-[1200px]"
		trapFocus={false}
	>
		<Dialog.Title class="sr-only">Comprehensive Settings</Dialog.Title>
		<Dialog.Description class="sr-only"
			>Customize all aspects of your IDE experience.</Dialog.Description
		>

		<Sidebar.Provider class="items-start">
			<Sidebar.Root collapsible="none" class="hidden border-r md:flex">
				<Sidebar.Content>
					<Sidebar.Header class="p-4">
						<div class="flex items-center gap-2">
							<SearchIcon size={16} />
							<Input placeholder="Search settings..." bind:value={searchQuery} class="h-8" />
						</div>
					</Sidebar.Header>

					<Sidebar.Group>
						<Sidebar.GroupContent>
							<Sidebar.Menu>
								{#each settingsCategories as category (category.id)}
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
													{#if category.id === 'appearance' && hasErrors}
														<AlertTriangleIcon size={12} class="ml-auto text-destructive" />
													{/if}
												</button>
											{/snippet}
										</Sidebar.MenuButton>
									</Sidebar.MenuItem>
								{/each}
							</Sidebar.Menu>
						</Sidebar.GroupContent>
					</Sidebar.Group>

					<Sidebar.Footer class="border-t p-4">
						<div class="flex flex-col gap-2">
							<Button
								variant="outline"
								size="sm"
								onclick={handleExport}
								class="w-full justify-start"
							>
								<DownloadIcon size={14} />
								Export Settings
							</Button>
							<Button
								variant="outline"
								size="sm"
								onclick={() => (showImportDialog = true)}
								class="w-full justify-start"
							>
								<UploadIcon size={14} />
								Import Settings
							</Button>
							<Button
								variant="outline"
								size="sm"
								onclick={comprehensiveSettingsActions.resetToDefaults}
								class="w-full justify-start text-destructive"
							>
								<RotateCcwIcon size={14} />
								Reset All
							</Button>
						</div>
					</Sidebar.Footer>
				</Sidebar.Content>
			</Sidebar.Root>

			<main class="flex h-[650px] flex-1 flex-col overflow-hidden">
				<header class="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear">
					<div class="flex w-full items-center justify-between px-4">
						<Breadcrumb.Root>
							<Breadcrumb.List>
								<Breadcrumb.Item class="hidden md:block">
									<Breadcrumb.Link href="#">Settings</Breadcrumb.Link>
								</Breadcrumb.Item>
								<Breadcrumb.Separator class="hidden md:block" />
								<Breadcrumb.Item>
									<Breadcrumb.Page>
										{settingsCategories.find((cat) => cat.id === activeSection)?.name || 'Settings'}
									</Breadcrumb.Page>
								</Breadcrumb.Item>
							</Breadcrumb.List>
						</Breadcrumb.Root>

						{#if hasErrors}
							<Badge variant="destructive" class="flex items-center gap-1">
								<AlertTriangleIcon size={12} />
								{validationErrors.length} Error{validationErrors.length !== 1 ? 's' : ''}
							</Badge>
						{/if}
					</div>
				</header>

				<div class="flex flex-1 flex-col gap-6 overflow-y-auto p-4 pt-0">
					{#if validationErrors.length > 0}
						<Alert.Root variant="destructive">
							<AlertTriangleIcon size={16} />
							<Alert.Title>Configuration Errors</Alert.Title>
							<Alert.Description>
								<ul class="mt-2 list-inside list-disc space-y-1">
									{#each validationErrors as error}
										<li>{error.message}</li>
									{/each}
								</ul>
							</Alert.Description>
						</Alert.Root>
					{/if}

					{#if activeSection === 'appearance'}
						<div class="space-y-6">
							<div>
								<h3 class="text-lg font-medium">Appearance</h3>
								<p class="text-sm text-muted-foreground">
									Customize the look and feel of the editor.
								</p>
							</div>

							<Separator.Root />

							<!-- Theme Section -->
							<div class="space-y-4">
								<div>
									<Label class="text-sm font-medium">Theme</Label>
									<p class="text-xs text-muted-foreground">
										Choose between light, dark, or system preference with live preview.
									</p>
								</div>

								<div class="flex gap-4">
									<Button
										variant={settings.appearance.theme === 'light' ? 'default' : 'outline'}
										size="sm"
										onclick={() =>
											comprehensiveSettingsActions.updateSetting('appearance', 'theme', 'light')}
										onmouseenter={() => previewTheme('light')}
										onmouseleave={cancelThemePreview}
										class="flex items-center gap-2"
									>
										<SunIcon size={16} />
										Light
									</Button>
									<Button
										variant={settings.appearance.theme === 'dark' ? 'default' : 'outline'}
										size="sm"
										onclick={() =>
											comprehensiveSettingsActions.updateSetting('appearance', 'theme', 'dark')}
										onmouseenter={() => previewTheme('dark')}
										onmouseleave={cancelThemePreview}
										class="flex items-center gap-2"
									>
										<MoonIcon size={16} />
										Dark
									</Button>
									<Button
										variant={settings.appearance.theme === 'system' ? 'default' : 'outline'}
										size="sm"
										onclick={() =>
											comprehensiveSettingsActions.updateSetting('appearance', 'theme', 'system')}
										onmouseenter={() => previewTheme('system')}
										onmouseleave={cancelThemePreview}
										class="flex items-center gap-2"
									>
										<MonitorIcon size={16} />
										System
									</Button>
								</div>

								<div class="space-y-2">
									<Label class="text-sm font-medium">Color Scheme</Label>
									<Select.Root type="single" name="colorScheme" bind:value={colorSchemeValue}>
										<Select.Trigger class="w-48">
											{colorSchemeTriggerContent}
										</Select.Trigger>
										<Select.Content>
											<Select.Group>
												<Select.Label>Color Schemes</Select.Label>
												{#each colorSchemes as scheme (scheme.value)}
													<Select.Item value={scheme.value} label={scheme.label}>
														{scheme.label}
													</Select.Item>
												{/each}
											</Select.Group>
										</Select.Content>
									</Select.Root>
								</div>
							</div>

							<!-- Font Settings -->
							<Separator.Root />
							<div class="space-y-4">
								<div>
									<Label class="text-sm font-medium">Typography</Label>
									<p class="text-xs text-muted-foreground">
										Configure font family, size, and spacing.
									</p>
								</div>

								<div class="grid grid-cols-2 gap-4">
									<div class="space-y-2">
										<Label class="text-sm font-medium">Font Size</Label>
										<div class="flex items-center gap-2">
											<Input
												type="number"
												min="8"
												max="32"
												value={settings.appearance.fontSize}
												onchange={(e) =>
													comprehensiveSettingsActions.updateSetting(
														'appearance',
														'fontSize',
														Number(e.currentTarget.value)
													)}
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
												value={settings.appearance.lineHeight}
												onchange={(e) =>
													comprehensiveSettingsActions.updateSetting(
														'appearance',
														'lineHeight',
														Number(e.currentTarget.value)
													)}
												class="w-20"
											/>
										</div>
									</div>
								</div>

								<div class="space-y-2">
									<Label class="text-sm font-medium">Font Family</Label>
									<Input
										value={settings.appearance.fontFamily}
										onchange={(e) =>
											comprehensiveSettingsActions.updateSetting(
												'appearance',
												'fontFamily',
												e.currentTarget.value
											)}
										placeholder="Monaco, Menlo, monospace"
									/>
								</div>
							</div>

							<!-- Layout Settings -->
							<Separator.Root />
							<div class="space-y-4">
								<div>
									<Label class="text-sm font-medium">Layout</Label>
									<p class="text-xs text-muted-foreground">UI layout and visual preferences.</p>
								</div>

								<div class="space-y-4">
									<div class="flex items-center justify-between">
										<div class="space-y-0.5">
											<Label class="text-sm font-medium">High Contrast</Label>
											<p class="text-xs text-muted-foreground">
												Enable high contrast colors for better accessibility
											</p>
										</div>
										<Switch
											checked={settings.appearance.highContrast}
											onCheckedChange={(checked) =>
												comprehensiveSettingsActions.updateSetting(
													'appearance',
													'highContrast',
													checked
												)}
										/>
									</div>

									<div class="flex items-center justify-between">
										<div class="space-y-0.5">
											<Label class="text-sm font-medium">Compact Mode</Label>
											<p class="text-xs text-muted-foreground">Reduce spacing and padding</p>
										</div>
										<Switch
											checked={settings.appearance.compactMode}
											onCheckedChange={(checked) =>
												comprehensiveSettingsActions.updateSetting(
													'appearance',
													'compactMode',
													checked
												)}
										/>
									</div>

									<div class="flex items-center justify-between">
										<div class="space-y-0.5">
											<Label class="text-sm font-medium">Animations</Label>
											<p class="text-xs text-muted-foreground">
												Enable UI animations and transitions
											</p>
										</div>
										<Switch
											checked={settings.appearance.animations}
											onCheckedChange={(checked) =>
												comprehensiveSettingsActions.updateSetting(
													'appearance',
													'animations',
													checked
												)}
										/>
									</div>

									<div class="space-y-2">
										<Label class="text-sm font-medium">Transparency</Label>
										<div class="flex items-center gap-2">
											<Input
												type="range"
												min="0.5"
												max="1.0"
												step="0.1"
												value={settings.appearance.transparency}
												onchange={(e) =>
													comprehensiveSettingsActions.updateSetting(
														'appearance',
														'transparency',
														Number(e.currentTarget.value)
													)}
												class="flex-1"
											/>
											<span class="w-12 text-sm text-muted-foreground"
												>{Math.round(settings.appearance.transparency * 100)}%</span
											>
										</div>
									</div>
								</div>
							</div>

							<!-- Presets -->
							<Separator.Root />
							<div class="space-y-4">
								<div>
									<Label class="text-sm font-medium">Presets</Label>
									<p class="text-xs text-muted-foreground">
										Quick configuration presets for common use cases.
									</p>
								</div>

								<div class="flex flex-wrap gap-2">
									{#each comprehensiveSettingsActions.getBuiltInPresets() as preset}
										<Button variant="outline" size="sm" onclick={() => applyPreset(preset.id)}>
											{preset.name}
										</Button>
									{/each}
								</div>
							</div>
						</div>
					{:else if activeSection === 'editor'}
						<div class="space-y-6">
							<div>
								<h3 class="text-lg font-medium">Editor</h3>
								<p class="text-sm text-muted-foreground">
									Configure code editor behavior and features.
								</p>
							</div>

							<Separator.Root />

							<!-- Display Settings -->
							<div class="space-y-4">
								<div>
									<Label class="text-sm font-medium">Display</Label>
									<p class="text-xs text-muted-foreground">Editor visual elements and layout.</p>
								</div>

								<div class="grid grid-cols-2 gap-4">
									<div class="flex items-center justify-between">
										<div class="space-y-0.5">
											<Label class="text-sm font-medium">Line Numbers</Label>
											<p class="text-xs text-muted-foreground">Show line numbers</p>
										</div>
										<Switch
											checked={settings.editor.lineNumbers}
											onCheckedChange={(checked) =>
												comprehensiveSettingsActions.updateSetting(
													'editor',
													'lineNumbers',
													checked
												)}
										/>
									</div>

									<div class="flex items-center justify-between">
										<div class="space-y-0.5">
											<Label class="text-sm font-medium">Relative Line Numbers</Label>
											<p class="text-xs text-muted-foreground">Show relative line numbers</p>
										</div>
										<Switch
											checked={settings.editor.lineNumbersRelative}
											onCheckedChange={(checked) =>
												comprehensiveSettingsActions.updateSetting(
													'editor',
													'lineNumbersRelative',
													checked
												)}
										/>
									</div>

									<div class="flex items-center justify-between">
										<div class="space-y-0.5">
											<Label class="text-sm font-medium">Word Wrap</Label>
											<p class="text-xs text-muted-foreground">Wrap long lines</p>
										</div>
										<Switch
											checked={settings.editor.wordWrap}
											onCheckedChange={(checked) =>
												comprehensiveSettingsActions.updateSetting('editor', 'wordWrap', checked)}
										/>
									</div>

									<div class="flex items-center justify-between">
										<div class="space-y-0.5">
											<Label class="text-sm font-medium">Mini Map</Label>
											<p class="text-xs text-muted-foreground">Show code overview</p>
										</div>
										<Switch
											checked={settings.editor.miniMap}
											onCheckedChange={(checked) =>
												comprehensiveSettingsActions.updateSetting('editor', 'miniMap', checked)}
										/>
									</div>

									<div class="flex items-center justify-between">
										<div class="space-y-0.5">
											<Label class="text-sm font-medium">Breadcrumbs</Label>
											<p class="text-xs text-muted-foreground">Show file path breadcrumbs</p>
										</div>
										<Switch
											checked={settings.editor.breadcrumbs}
											onCheckedChange={(checked) =>
												comprehensiveSettingsActions.updateSetting(
													'editor',
													'breadcrumbs',
													checked
												)}
										/>
									</div>

									<div class="flex items-center justify-between">
										<div class="space-y-0.5">
											<Label class="text-sm font-medium">Code Folding</Label>
											<p class="text-xs text-muted-foreground">Enable code folding</p>
										</div>
										<Switch
											checked={settings.editor.folding}
											onCheckedChange={(checked) =>
												comprehensiveSettingsActions.updateSetting('editor', 'folding', checked)}
										/>
									</div>
								</div>
							</div>

							<!-- Behavior Settings -->
							<Separator.Root />
							<div class="space-y-4">
								<div>
									<Label class="text-sm font-medium">Behavior</Label>
									<p class="text-xs text-muted-foreground">Editor behavior and automation.</p>
								</div>

								<div class="grid grid-cols-2 gap-4">
									<div class="flex items-center justify-between">
										<div class="space-y-0.5">
											<Label class="text-sm font-medium">Auto Save</Label>
											<p class="text-xs text-muted-foreground">Automatically save changes</p>
										</div>
										<Switch
											checked={settings.editor.autoSave}
											onCheckedChange={(checked) =>
												comprehensiveSettingsActions.updateSetting('editor', 'autoSave', checked)}
										/>
									</div>

									<div class="flex items-center justify-between">
										<div class="space-y-0.5">
											<Label class="text-sm font-medium">Format on Save</Label>
											<p class="text-xs text-muted-foreground">Format code when saving</p>
										</div>
										<Switch
											checked={settings.editor.formatOnSave}
											onCheckedChange={(checked) =>
												comprehensiveSettingsActions.updateSetting(
													'editor',
													'formatOnSave',
													checked
												)}
										/>
									</div>

									<div class="flex items-center justify-between">
										<div class="space-y-0.5">
											<Label class="text-sm font-medium">Format on Paste</Label>
											<p class="text-xs text-muted-foreground">Format pasted code</p>
										</div>
										<Switch
											checked={settings.editor.formatOnPaste}
											onCheckedChange={(checked) =>
												comprehensiveSettingsActions.updateSetting(
													'editor',
													'formatOnPaste',
													checked
												)}
										/>
									</div>

									<div class="flex items-center justify-between">
										<div class="space-y-0.5">
											<Label class="text-sm font-medium">Trim Whitespace</Label>
											<p class="text-xs text-muted-foreground">Remove trailing whitespace</p>
										</div>
										<Switch
											checked={settings.editor.trimTrailingWhitespace}
											onCheckedChange={(checked) =>
												comprehensiveSettingsActions.updateSetting(
													'editor',
													'trimTrailingWhitespace',
													checked
												)}
										/>
									</div>
								</div>

								<div class="space-y-2">
									<Label class="text-sm font-medium">Auto Save Delay</Label>
									<div class="flex items-center gap-2">
										<Input
											type="number"
											min="100"
											max="10000"
											value={settings.editor.autoSaveDelay}
											onchange={(e) =>
												comprehensiveSettingsActions.updateSetting(
													'editor',
													'autoSaveDelay',
													Number(e.currentTarget.value)
												)}
											class="w-24"
										/>
										<span class="text-sm text-muted-foreground">milliseconds</span>
									</div>
								</div>
							</div>

							<!-- Indentation Settings -->
							<Separator.Root />
							<div class="space-y-4">
								<div>
									<Label class="text-sm font-medium">Indentation</Label>
									<p class="text-xs text-muted-foreground">Tab and spacing configuration.</p>
								</div>

								<div class="grid grid-cols-2 gap-4">
									<div class="space-y-2">
										<Label class="text-sm font-medium">Tab Size</Label>
										<div class="flex items-center gap-2">
											<Input
												type="number"
												min="1"
												max="8"
												value={settings.editor.tabSize}
												onchange={(e) =>
													comprehensiveSettingsActions.updateSetting(
														'editor',
														'tabSize',
														Number(e.currentTarget.value)
													)}
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
											checked={settings.editor.insertSpaces}
											onCheckedChange={(checked) =>
												comprehensiveSettingsActions.updateSetting(
													'editor',
													'insertSpaces',
													checked
												)}
										/>
									</div>

									<div class="flex items-center justify-between">
										<div class="space-y-0.5">
											<Label class="text-sm font-medium">Detect Indentation</Label>
											<p class="text-xs text-muted-foreground">Auto-detect file indentation</p>
										</div>
										<Switch
											checked={settings.editor.detectIndentation}
											onCheckedChange={(checked) =>
												comprehensiveSettingsActions.updateSetting(
													'editor',
													'detectIndentation',
													checked
												)}
										/>
									</div>
								</div>
							</div>
						</div>
					{:else if activeSection === 'keyboard'}
						<div class="space-y-6">
							<div>
								<h3 class="text-lg font-medium">Keyboard</h3>
								<p class="text-sm text-muted-foreground">
									Configure keyboard shortcuts and input methods.
								</p>
							</div>

							<Separator.Root />

							<div class="space-y-4">
								<div>
									<Label class="text-sm font-medium">Key Map</Label>
									<p class="text-xs text-muted-foreground">
										Choose your preferred key binding style.
									</p>
								</div>

								<Select.Root type="single" name="keyMap" bind:value={keyMapValue}>
									<Select.Trigger class="w-48">
										{keyMapTriggerContent}
									</Select.Trigger>
									<Select.Content>
										<Select.Group>
											<Select.Label>Key Maps</Select.Label>
											{#each keyMaps as map (map.value)}
												<Select.Item value={map.value} label={map.label}>
													{map.label}
												</Select.Item>
											{/each}
										</Select.Group>
									</Select.Content>
								</Select.Root>

								<div class="grid grid-cols-2 gap-4">
									<div class="flex items-center justify-between">
										<div class="space-y-0.5">
											<Label class="text-sm font-medium">Multi Cursor</Label>
											<p class="text-xs text-muted-foreground">Enable multiple cursors</p>
										</div>
										<Switch
											checked={settings.keyboard.enableMultiCursor}
											onCheckedChange={(checked) =>
												comprehensiveSettingsActions.updateSetting(
													'keyboard',
													'enableMultiCursor',
													checked
												)}
										/>
									</div>

									<div class="flex items-center justify-between">
										<div class="space-y-0.5">
											<Label class="text-sm font-medium">Bracket Matching</Label>
											<p class="text-xs text-muted-foreground">Highlight matching brackets</p>
										</div>
										<Switch
											checked={settings.keyboard.enableBracketMatching}
											onCheckedChange={(checked) =>
												comprehensiveSettingsActions.updateSetting(
													'keyboard',
													'enableBracketMatching',
													checked
												)}
										/>
									</div>

									<div class="flex items-center justify-between">
										<div class="space-y-0.5">
											<Label class="text-sm font-medium">Auto Closing Brackets</Label>
											<p class="text-xs text-muted-foreground">Auto-close brackets and braces</p>
										</div>
										<Switch
											checked={settings.keyboard.enableAutoClosingBrackets}
											onCheckedChange={(checked) =>
												comprehensiveSettingsActions.updateSetting(
													'keyboard',
													'enableAutoClosingBrackets',
													checked
												)}
										/>
									</div>

									<div class="flex items-center justify-between">
										<div class="space-y-0.5">
											<Label class="text-sm font-medium">Auto Closing Quotes</Label>
											<p class="text-xs text-muted-foreground">Auto-close quotes</p>
										</div>
										<Switch
											checked={settings.keyboard.enableAutoClosingQuotes}
											onCheckedChange={(checked) =>
												comprehensiveSettingsActions.updateSetting(
													'keyboard',
													'enableAutoClosingQuotes',
													checked
												)}
										/>
									</div>
								</div>
							</div>
						</div>
					{:else}
						<div class="space-y-6">
							<div>
								<h3 class="text-lg font-medium">Coming Soon</h3>
								<p class="text-sm text-muted-foreground">
									This section is under development. More settings will be available soon.
								</p>
							</div>
						</div>
					{/if}
				</div>
			</main>
		</Sidebar.Provider>
	</Dialog.Content>
</Dialog.Root>

<!-- Export Dialog -->
<Dialog.Root bind:open={showExportDialog}>
	<Dialog.Content class="max-w-2xl">
		<Dialog.Header>
			<Dialog.Title>Export Settings</Dialog.Title>
			<Dialog.Description>Copy or download your settings configuration.</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4">
			<div class="flex items-center space-x-2">
				<Switch bind:checked={includeSecrets} id="include-secrets" />
				<Label for="include-secrets">Include sensitive data (API keys, etc.)</Label>
			</div>

			<Textarea
				readonly
				value={exportData}
				class="min-h-[300px] font-mono text-sm"
				placeholder="Settings will appear here..."
			/>

			<div class="flex gap-2">
				<Button onclick={() => copyToClipboard(exportData)}>Copy to Clipboard</Button>
				<Button variant="outline" onclick={() => downloadAsFile(exportData, 'aura-settings.json')}>
					<DownloadIcon size={16} />
					Download File
				</Button>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>

<!-- Import Dialog -->
<Dialog.Root bind:open={showImportDialog}>
	<Dialog.Content class="max-w-2xl">
		<Dialog.Header>
			<Dialog.Title>Import Settings</Dialog.Title>
			<Dialog.Description>Paste your settings configuration to import.</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4">
			<Textarea
				bind:value={importData}
				class="min-h-[300px] font-mono text-sm"
				placeholder="Paste your settings JSON here..."
			/>

			<div class="flex gap-2">
				<Button onclick={handleImport} disabled={!importData.trim()}>Import Settings</Button>
				<Button variant="outline" onclick={() => (showImportDialog = false)}>Cancel</Button>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
