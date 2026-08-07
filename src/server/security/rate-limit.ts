type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
export function rateLimit(key: string, limit: number, durationMs: number): boolean { const now = Date.now(); const current = buckets.get(key); if (!current || current.resetAt <= now) { buckets.set(key, { count: 1, resetAt: now + durationMs }); return true; } if (current.count >= limit) return false; current.count += 1; return true; }
