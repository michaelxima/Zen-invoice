import "server-only";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// The browser suite signs up and signs in many accounts from one address, which the sign-up limit
// (5 per hour) would block after a few tests. Limits are raised only for the app server the suite starts
// (E2E_DISPOSABLE_DB=1, which src/db/index.ts accepts only for a disposable *_test database) and never in a
// production build. Read on every call so tests can change it.
const E2E_LIMIT_MULTIPLIER = 100;

export function effectiveLimit(limit: number): number {
  const relaxed = process.env.E2E_DISPOSABLE_DB === "1" && process.env.NODE_ENV !== "production";
  return relaxed ? limit * E2E_LIMIT_MULTIPLIER : limit;
}

/** Per-process fixed-window limiter. Also configure provider/edge limits for multi-instance deployments. */
export function enforceRateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > effectiveLimit(limit)) throw new Error("Too many requests. Please try again later.");

  if (buckets.size > 10_000) {
    for (const [bucketKey, value] of buckets) {
      if (value.resetAt <= now) buckets.delete(bucketKey);
    }
  }
}

export function getRequestRateLimitKey(ip: string | null, fallback: string): string {
  return ip?.trim().slice(0, 80) || fallback;
}
