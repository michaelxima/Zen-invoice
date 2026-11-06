import "server-only";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** Per-process fixed-window limiter. Also configure provider/edge limits for multi-instance deployments. */
export function enforceRateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > limit) throw new Error("Too many requests. Please try again later.");

  if (buckets.size > 10_000) {
    for (const [bucketKey, value] of buckets) {
      if (value.resetAt <= now) buckets.delete(bucketKey);
    }
  }
}

export function getRequestRateLimitKey(ip: string | null, fallback: string): string {
  return ip?.trim().slice(0, 80) || fallback;
}
