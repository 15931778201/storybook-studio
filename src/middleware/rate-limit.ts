// src/middleware/rate-limit.ts
import { Redis } from 'ioredis';

const redis = new Redis();

export async function rateLimit(key: string, max: number, windowSec: number): Promise<boolean> {
  const current = await redis.incr(key);
  if (current === 1) await redis.expire(key, windowSec);
  return current <= max;
}