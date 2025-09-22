import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { MongoClient, ObjectId } from 'mongodb';

// Use your existing MongoDB setup
const MONGODB_URI = env.DATABASE_URL || env.MONGODB_URI || 'mongodb://localhost:27017/aura-dev';
const DATABASE_NAME = env.MONGODB_DB_NAME || 'aura-dev';

// Create MongoDB client and database instance
const client = new MongoClient(MONGODB_URI);
const db = client.db(DATABASE_NAME);

export const auth = betterAuth({
	database: mongodbAdapter(db),
	baseURL: env.ORIGIN || env.PUBLIC_ORIGIN || 'http://localhost:5173',
	secret: env.BETTER_AUTH_SECRET || env.AUTH_SECRET || 'your-secret-key-here',
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: false // Can be enabled later
	},
	socialProviders: {
		google: {
			clientId: env.GOOGLE_CLIENT_ID || '',
			clientSecret: env.GOOGLE_CLIENT_SECRET || '',
			enabled: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
		},
		github: {
			clientId: env.GITHUB_CLIENT_ID || '',
			clientSecret: env.GITHUB_CLIENT_SECRET || '',
			enabled: !!(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET)
		}
	},
	session: {
		expiresIn: 60 * 60 * 24 * 7, // 7 days
		updateAge: 60 * 60 * 24, // 24 hours
		cookieCache: {
			enabled: true,
			maxAge: 60 * 5 // 5 minutes
		}
	},
	plugins: [
		sveltekitCookies(getRequestEvent) // Make sure this is the last plugin
	],
	advanced: {
		database: {
			generateId: () => new ObjectId().toString()
		},
		cookies: {
			sessionToken: {
				name: 'better-auth.session_token',
				attributes: {
					secure: env.NODE_ENV === 'production',
					sameSite: 'strict',
					httpOnly: true
				}
			}
		}
	}
});

export type Session = typeof auth.$Infer.Session;
