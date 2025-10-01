import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { createAuthClient } from 'better-auth/client';
import { derived } from 'svelte/store';

const authClient = createAuthClient();

// Use Better Auth's reactive session store
const session = authClient.useSession;

// Create derived stores for easier use
export const user = derived(session, ($session) => $session.data?.user || null);
export const isAuthenticated = derived(session, ($session) => !!$session.data?.user);
export const isLoading = derived(session, ($session) => $session.isPending);

// Auth functions
export const authActions = {
	// Login function
	login: async (email: string, password: string) => {
		try {
			const { data, error } = await authClient.signIn.email({
				email,
				password
			});

			if (error) {
				return { success: false, error: error.message };
			}

			return { success: true };
		} catch (error) {
			return { success: false, error: 'Login failed' };
		}
	},

	// Register function
	register: async (email: string, password: string, firstName: string, lastName: string) => {
		try {
			const { data, error } = await authClient.signUp.email({
				email,
				password,
				name: `${firstName} ${lastName}`
			});

			if (error) {
				return { success: false, error: error.message };
			}

			return { success: true };
		} catch (error) {
			return { success: false, error: 'Registration failed' };
		}
	},

	// Logout function
	logout: async () => {
		try {
			await authClient.signOut();
			if (browser) {
				goto('/auth/login');
			}
		} catch (error) {
			console.error('Logout error:', error);
		}
	},

	// Social login
	loginWithGoogle: async () => {
		try {
			await authClient.signIn.social({
				provider: 'google'
			});
		} catch (error) {
			console.error('Google login error:', error);
		}
	},

	loginWithGitHub: async () => {
		try {
			await authClient.signIn.social({
				provider: 'github'
			});
		} catch (error) {
			console.error('GitHub login error:', error);
		}
	}
};

// Export the session store for direct access if needed
export { session };
