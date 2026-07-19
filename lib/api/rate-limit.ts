import { ApiError } from "@/lib/api/error-handler";

/**
 * Sliding-window rate limiter. Ships with an in-process store so the app
 * runs standalone; swap `store` for a Redis/Upstash-backed implementation
 * for multi-instance deployments (Vercel serverless — recommended before
 * production launch, since in-process state doesn't share across
 * lambdas). The interface stays identical either way.
 */
interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<number>;
}

class InMemoryStore implements RateLimitStore {
  private hits = new Map<string, { count: number; resetAt: number }>();

  async increment(key: string, windowMs: number): Promise<number> {
    const now = Date.now();
    const existing = this.hits.get(key);
    if (!existing || existing.resetAt < now) {
      this.hits.set(key, { count: 1, resetAt: now + windowMs });
      return 1;
    }
    existing.count += 1;
    return existing.count;
  }
}

const store: RateLimitStore = new InMemoryStore();

export async function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): Promise<void> {
  const count = await store.increment(key, windowMs);
  if (count > limit) {
    throw new ApiError(429, "Too many requests. Please slow down.", "RATE_LIMITED");
  }
}
