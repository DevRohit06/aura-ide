import { env } from '$env/dynamic/private';
import Redis from 'ioredis';

export interface RateLimitResult {
	allowed: boolean;
	remaining?: number;
	retryAfter?: number | null; // seconds
}

export interface IRateLimiter {
	allowRequest(userId: string): Promise<RateLimitResult>;
	close?(): Promise<void>;
}

/**
 * Simple in-memory token bucket rate limiter (for single-node usage)
 */
class InMemoryRateLimiter implements IRateLimiter {
	private limits: Map<
		string,
		{ tokens: number; lastRefill: number; capacity: number; refillRatePerMs: number }
	>; // per-user
	private defaultCapacity: number;
	private defaultRatePerMinute: number;

	constructor() {
		this.limits = new Map();
		this.defaultCapacity = parseInt(env.RATE_LIMIT_CAPACITY || '') || 10; // burst
		this.defaultRatePerMinute = parseInt(env.RATE_LIMIT_RPM || '') || 60; // tokens per minute
	}

	async allowRequest(userId: string): Promise<RateLimitResult> {
		const now = Date.now();
		let node = this.limits.get(userId);
		if (!node) {
			const ratePerMs = this.defaultRatePerMinute / 60000;
			node = {
				tokens: this.defaultCapacity,
				lastRefill: now,
				capacity: this.defaultCapacity,
				refillRatePerMs: ratePerMs
			};
			this.limits.set(userId, node);
		}

		// refill
		const elapsed = now - node.lastRefill;
		const refill = elapsed * node.refillRatePerMs;
		if (refill > 0) {
			node.tokens = Math.min(node.capacity, node.tokens + refill);
			node.lastRefill = now;
		}

		if (node.tokens >= 1) {
			node.tokens -= 1;
			this.limits.set(userId, node);
			return { allowed: true, remaining: Math.floor(node.tokens) };
		}

		// calculate retryAfter in seconds until at least 1 token is available
		const deficit = 1 - node.tokens;
		const msUntil = Math.ceil(deficit / node.refillRatePerMs);
		return { allowed: false, retryAfter: Math.ceil(msUntil / 1000), remaining: 0 };
	}

	async close() {
		// nothing to close for in-memory
	}
}

/**
 * Redis-based fixed-window limiter as an alternative (returns remaining and retry info)
 */
class RedisRateLimiterWrapper implements IRateLimiter {
	private client: any;
	private windowMs: number;
	private max: number;

	constructor(redisUrl?: string, windowMs = 60_000, max = 60) {
		this.client = new Redis(redisUrl || env.REDIS_URL || 'redis://localhost:6379');
		this.windowMs = windowMs;
		this.max = max;
	}

	async allowRequest(userId: string): Promise<RateLimitResult> {
		const redisKey = `rate:${userId}:${Math.floor(Date.now() / this.windowMs)}`;
		const ttlSeconds = Math.ceil(this.windowMs / 1000);

		const current = await this.client.incr(redisKey);
		if (current === 1) {
			await this.client.expire(redisKey, ttlSeconds);
		}

		const allowed = current <= this.max;
		let remaining = Math.max(0, this.max - current);
		let retryAfter: number | null = null;
		if (!allowed) {
			const ttl = await this.client.ttl(redisKey);
			retryAfter = ttl > 0 ? ttl : ttlSeconds;
			remaining = 0;
		}
		return { allowed, remaining, retryAfter };
	}

	async close() {
		try {
			await this.client.quit();
		} catch (err) {
			// ignore
		}
	}
}

/**
 * Facade for rate limiting. Uses Redis if REDIS_URL is present, otherwise in-memory.
 */
export class RateLimiter implements IRateLimiter {
	private static instance: RateLimiter | null = null;
	private impl: IRateLimiter;

	private constructor() {
		if (env.REDIS_URL) {
			this.impl = new RedisRateLimiterWrapper(env.REDIS_URL);
		} else {
			this.impl = new InMemoryRateLimiter();
		}
	}

	static getInstance() {
		if (!RateLimiter.instance) RateLimiter.instance = new RateLimiter();
		return RateLimiter.instance;
	}

	allowRequest(userId: string): Promise<RateLimitResult> {
		return this.impl.allowRequest(userId);
	}

	async close() {
		if (this.impl.close) await this.impl.close();
	}
}

export const rateLimiter = RateLimiter.getInstance();

// Facade for the vector indexing route which expects a redis-like limiter API
export const redisRateLimiter = (function () {
	// In-memory fixed window map: key -> { count, windowStart }
	const windowMap: Map<string, { count: number; windowStart: number }> = new Map();

	async function allow(userId: string, tokens: number, windowMs: number, max: number) {
		// If Redis is configured, use INCRBY for atomic increments
		if (env.REDIS_URL) {
			try {
				const client = new Redis(env.REDIS_URL);
				const windowKey = `docrate:${userId}:${Math.floor(Date.now() / windowMs)}`;
				const ttlSeconds = Math.ceil(windowMs / 1000);
				const current = await client.incrby(windowKey, tokens);
				if (current === tokens) {
					await client.expire(windowKey, ttlSeconds);
				}
				const allowed = current <= max;
				let retryAfterSeconds: number | null = null;
				if (!allowed) {
					const ttl = await client.ttl(windowKey);
					retryAfterSeconds = ttl > 0 ? ttl : ttlSeconds;
				}
				const remaining = Math.max(0, max - current);
				await client.quit();
				return { allowed, remaining, retryAfterSeconds };
			} catch (err) {
				console.warn('Redis doc rate limiter failed, falling back to in-memory:', err);
			}
		}

		// In-memory fixed window fallback
		const key = `${userId}:${Math.floor(Date.now() / windowMs)}`;
		const nowWindowStart = Math.floor(Date.now() / windowMs) * windowMs;
		const entry = windowMap.get(key) || { count: 0, windowStart: nowWindowStart };
		if (entry.windowStart !== nowWindowStart) {
			entry.count = 0;
			entry.windowStart = nowWindowStart;
		}
		entry.count += tokens;
		windowMap.set(key, entry);
		const allowed = entry.count <= max;
		const remaining = Math.max(0, max - entry.count);
		let retryAfterSeconds: number | null = null;
		if (!allowed) {
			const msLeft = windowMs - (Date.now() - entry.windowStart);
			retryAfterSeconds = Math.ceil(msLeft / 1000);
		}
		return { allowed, remaining, retryAfterSeconds };
	}

	return { allow };
})();
