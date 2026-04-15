import { RateLimitEntry, RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW_MS } from './types';

const clients = new Map<string, RateLimitEntry>();

export function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = clients.get(ip);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    clients.set(ip, { count: 1, resetAt });
    return { allowed: true, remaining: RATE_LIMIT_REQUESTS - 1, resetAt };
  }

  if (entry.count >= RATE_LIMIT_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: RATE_LIMIT_REQUESTS - entry.count,
    resetAt: entry.resetAt,
  };
}

export function cleanupExpired(): void {
  const now = Date.now();
  for (const [ip, entry] of clients.entries()) {
    if (now > entry.resetAt) {
      clients.delete(ip);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpired, 5 * 60 * 1000);
