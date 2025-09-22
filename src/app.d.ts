// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: {
				id: string;
				email: string;
				username: string;
			} | null;
			session: {
				session: {
					id: string;
					createdAt: Date;
					updatedAt: Date;
					userId: string;
					expiresAt: Date;
					token: string;
					ipAddress?: string | null;
					userAgent?: string | null;
				};
				user: {
					id: string;
					createdAt: Date;
					updatedAt: Date;
					email: string;
					emailVerified: boolean;
					name: string;
					image?: string | null;
				};
			} | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};

declare module '$env/dynamic/private' {
	export const HELICONE_API_KEY: string;
	export const OPENAI_API_KEY: string;
	export const ANTHROPIC_API_KEY: string;
	export const HELICONE_OPENAI_BASE_URL: string;
	export const HELICONE_ANTHROPIC_BASE_URL: string;
	export const HELICONE_BASE_URL: string;
	export const HELICONE_DEFAULT_MODEL: string;
	export const HELICONE_TIMEOUT: string;
	export const TAVILY_API_KEY: string;
	export const JWT_SECRET: string;
	export const DATABASE_URL: string;

	export const GITHUB_CLIENT_ID: string;
	export const GITHUB_CLIENT_SECRET: string;
	export const GOOGLE_CLIENT_ID: string;
	export const GOOGLE_CLIENT_SECRET: string;
	export const R2_ACCESS_KEY_ID: string;
	export const R2_SECRET_ACCESS_KEY: string;
	export const R2_BUCKET_NAME: string;
	export const R2_ACCOUNT_ID: string;
	export const R2_ENDPOINT: string;
	export const DATABASE_URL: string;
}
