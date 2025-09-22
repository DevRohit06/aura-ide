import { auth } from '$lib/auth.js';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = auth.handler;
export const POST: RequestHandler = auth.handler;
