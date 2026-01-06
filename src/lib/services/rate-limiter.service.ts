import { env } from '$env/dynamic/private';

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
 * Rate limiter using in-memory token bucket algorithm.
 */
export class RateLimiter implements IRateLimiter {
	private static instance: RateLimiter | null = null;
	private impl: IRateLimiter;

	private constructor() {
		this.impl = new InMemoryRateLimiter();
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

// In-memory fixed window rate limiter for document/API rate limiting
export const redisRateLimiter = (function () {
	// In-memory fixed window map: key -> { count, windowStart }
	const windowMap: Map<string, { count: number; windowStart: number }> = new Map();

	async function allow(userId: string, tokens: number, windowMs: number, max: number) {
		// In-memory fixed window
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
