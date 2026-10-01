import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import type { PrismaClient } from "@prisma/client";
import { logFailure } from "./safe-logging";

export type RateLimitStore = { consume(key: string, limit: number, windowSeconds: number): Promise<boolean> };
export type PublicScope = "availability" | "booking" | "login" | "register" | "manage";
const limits: Record<PublicScope, number> = { availability: 120, booking: 10, login: 10, register: 5, manage: 60 };

export function postgresRateLimitStore(db: PrismaClient): RateLimitStore {
  return { async consume(key, limit, windowSeconds) {
    // Database time and atomic UPSERT work across workers and clock skew.
    const rows = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO "PublicRateLimit" ("key", "count", "expiresAt")
      VALUES (${key}, 1, CURRENT_TIMESTAMP + ${windowSeconds} * INTERVAL '1 second')
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "PublicRateLimit"."expiresAt" <= CURRENT_TIMESTAMP THEN 1 ELSE "PublicRateLimit"."count" + 1 END,
        "expiresAt" = CASE WHEN "PublicRateLimit"."expiresAt" <= CURRENT_TIMESTAMP THEN CURRENT_TIMESTAMP + ${windowSeconds} * INTERVAL '1 second' ELSE "PublicRateLimit"."expiresAt" END
      WHERE "PublicRateLimit"."expiresAt" <= CURRENT_TIMESTAMP OR "PublicRateLimit"."count" < ${limit}
      RETURNING "count"`;
    return rows.length === 1;
  } };
}

export function rateLimitIdentity(headers: Pick<Headers, "get">, env: Record<string, string | undefined> = process.env) {
  const header = env.RATE_LIMIT_IP_HEADER;
  if (!header) {
    if (env.NODE_ENV === "production") throw new Error("RATE_LIMIT_IP_HEADER_REQUIRED");
    return "local-development";
  }
  const ip = headers.get(header)?.trim() ?? "";
  // Do not trust an arbitrary forwarded chain or user-supplied fallback header.
  if (!isIP(ip)) throw new Error("TRUSTED_IP_REQUIRED");
  return ip;
}

export async function allowPublicRequest(db: PrismaClient, headers: Pick<Headers, "get">, scope: PublicScope, store = postgresRateLimitStore(db)) {
  try {
    const secret = process.env.AUTH_SECRET || (process.env.NODE_ENV !== "production" ? "development-rate-limit-only" : "");
    if (!secret) return false;
    const identity = rateLimitIdentity(headers);
    const key = createHmac("sha256", secret).update(`${scope}:${identity}`).digest("hex");
    return await store.consume(key, limits[scope], 60);
  } catch { logFailure("rate_limit_unavailable"); return false; }
}
