<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth.client.js';
	import ProfilePicture from '$lib/components/shared/profile-picture.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';

	import CreditCardIcon from '@lucide/svelte/icons/credit-card';
	import KeyIcon from '@lucide/svelte/icons/key';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import UserIcon from '@lucide/svelte/icons/user';

	type Props = {
		/**
		 * User data
		 */
		user?: {
			id: string;
			email: string;
			username?: string;
			name?: string;
			image?: string;
		};
		/**
		 * Profile dialog open state handler
		 */
		onProfileClick?: () => void;
	};

	let { user, onProfileClick }: Props = $props();

	const displayName = $derived(user?.name || user?.username || user?.email || 'User');
	const profileImage = $derived(user?.image);

	async function handleSignOut() {
		try {
			await authClient.signOut();
			goto('/auth/signin');
		} catch (error) {
			console.error('Sign out error:', error);
		}
	}

	function handleProfileSettings() {
		onProfileClick?.();
	}

	function handleAccountSettings() {
		// TODO: Navigate to account settings page
		console.log('Account settings clicked');
	}

	function handleApiTokens() {
		// TODO: Open API tokens dialog or navigate to tokens page
		console.log('API tokens clicked');
	}

	function handleBilling() {
		// TODO: Navigate to billing page
		console.log('Billing clicked');
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger class="focus:outline-none">
		<ProfilePicture
			name={displayName}
			src={profileImage}
			size="md"
			clickable={true}
			class="transition-all duration-200 hover:ring-2 hover:ring-primary/20"
		/>
	</DropdownMenu.Trigger>

	<DropdownMenu.Content align="end" side="right" class="w-56">
		<!-- User Info Section -->
		<div class="px-2 py-1.5">
			<div class="flex items-center gap-2">
				<ProfilePicture name={displayName} src={profileImage} size="sm" />
				<div class="flex flex-col">
					<p class="text-sm leading-none font-medium">{displayName}</p>
					{#if user?.email}
						<p class="text-xs text-muted-foreground">{user.email}</p>
					{/if}
				</div>
			</div>
		</div>

		<DropdownMenu.Separator />

		<!-- Profile Actions -->
		<DropdownMenu.Group>
			<DropdownMenu.Item onclick={handleProfileSettings}>
				<UserIcon size={16} class="mr-2" />
				Profile Settings
			</DropdownMenu.Item>

			<DropdownMenu.Item onclick={handleAccountSettings}>
				<SettingsIcon size={16} class="mr-2" />
				Account Settings
			</DropdownMenu.Item>

			<DropdownMenu.Item onclick={handleApiTokens}>
				<KeyIcon size={16} class="mr-2" />
				API Tokens
			</DropdownMenu.Item>

			<DropdownMenu.Item onclick={handleBilling}>
				<CreditCardIcon size={16} class="mr-2" />
				Billing
			</DropdownMenu.Item>
		</DropdownMenu.Group>

		<DropdownMenu.Separator />

		<!-- Sign Out -->
		<DropdownMenu.Item onclick={handleSignOut} class="text-destructive focus:text-destructive">
			<LogOutIcon size={16} class="mr-2" />
			Sign Out
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>
