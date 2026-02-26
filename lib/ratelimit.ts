import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const hasRedis = Boolean(redisUrl && redisToken);

/** No-op limiter when Upstash is not configured (e.g. local dev). Always allows. */
const noopLimiter = {
  limit: async () => ({ success: true as const }),
};

function createLoginLimiter(): {
  limit: (identifier: string) => Promise<{ success: boolean }>;
} {
  if (!hasRedis) return noopLimiter;
  const redis = new Redis({ url: redisUrl!, token: redisToken! });
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "15 m"),
    prefix: "rl:login",
  });
  return ratelimit;
}

function createSeedLimiter(): {
  limit: (identifier: string) => Promise<{ success: boolean }>;
} {
  if (!hasRedis) return noopLimiter;
  const redis = new Redis({ url: redisUrl!, token: redisToken! });
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 h"),
    prefix: "rl:seed",
  });
  return ratelimit;
}

function createFloatImportLimiter(): {
  limit: (identifier: string) => Promise<{ success: boolean }>;
} {
  if (!hasRedis) return noopLimiter;
  const redis = new Redis({ url: redisUrl!, token: redisToken! });
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "15 m"),
    prefix: "rl:float-import",
  });
  return ratelimit;
}

export const loginRatelimit = createLoginLimiter();
export const seedRatelimit = createSeedLimiter();
export const floatImportRatelimit = createFloatImportLimiter();

/** Get client IP from request headers (Vercel, proxies). */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return headers.get("x-real-ip") ?? "unknown";
}
