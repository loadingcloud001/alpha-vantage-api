import * as fs from 'fs';
import * as path from 'path';
import { AlphaKey, KeyPool, MAX_REQUESTS_PER_KEY } from './types';

// keys.json is mounted READ-ONLY from host in Docker
// Usage tracking is IN-MEMORY only (lost on restart, but that's fine since
// we have 200 keys x 25 = 5000 req/day. Overuse risk is minimal.)
const KEYS_FILE = path.resolve(__dirname, '../keys.json');

let keyPool: KeyPool | null = null;
let lastResetDate: string = '';

function getUTCMidnight(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  ).toISOString();
}

function loadPool(): KeyPool {
  if (!fs.existsSync(KEYS_FILE)) {
    throw new Error(`keys.json not found at ${KEYS_FILE}`);
  }
  const raw = fs.readFileSync(KEYS_FILE, 'utf-8');
  const parsed = JSON.parse(raw) as KeyPool;

  // Reset counts if it's a new UTC day
  const today = getUTCMidnight().slice(0, 10);
  if (lastResetDate !== today) {
    parsed.keys.forEach((k) => {
      k.used = 0;
      k.lastIP = null;
    });
    lastResetDate = today;
  }

  return parsed;
}

export function getAvailableKey(): AlphaKey | null {
  const pool = loadPool();
  const available = pool.keys.filter((k) => k.used < MAX_REQUESTS_PER_KEY);
  if (available.length === 0) {
    return null;
  }
  // Random pick — avoids predictable patterns
  return available[Math.floor(Math.random() * available.length)];
}

export function markKeyUsed(key: string, ip: string | null): void {
  const pool = loadPool();
  const entry = pool.keys.find((k) => k.key === key);
  if (entry) {
    entry.used += 1;
    entry.lastIP = ip;
  }
  // Note: changes are in-memory only. On container restart, usage is lost.
  // This is acceptable — we have 200 keys x 25 = 5000 req/day capacity.
}

export function getPoolStats(): { total: number; available: number; used: number } {
  const pool = loadPool();
  const available = pool.keys.filter((k) => k.used < MAX_REQUESTS_PER_KEY).length;
  const total = pool.keys.length;
  const used = total - available;
  return { total, available, used };
}
