import type { PrismaClient } from "@prisma/client";
import { hashActionToken } from "../appointment-reminders";

// Shared, durable fixed-window limiter: no in-memory Map, no IP/PII storage.
// Invalid tokens create no rows. Edge/IP abuse protection is still required.
export async function allowAppointmentAction(db: PrismaClient, token: string, now = new Date()) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const before = new Date(+now - 60_000);
  const rows = await db.$queryRaw<{ actionCount: number }[]>`
    UPDATE "AppointmentPublicAccess"
    SET "actionCount" = CASE WHEN "actionWindowStartedAt" IS NULL OR "actionWindowStartedAt" <= ${before} THEN 1 ELSE "actionCount" + 1 END,
        "actionWindowStartedAt" = CASE WHEN "actionWindowStartedAt" IS NULL OR "actionWindowStartedAt" <= ${before} THEN ${now} ELSE "actionWindowStartedAt" END
    WHERE "tokenHash" = ${hashActionToken(token)} AND "revokedAt" IS NULL AND "expiresAt" > ${now}
      AND ("actionWindowStartedAt" IS NULL OR "actionWindowStartedAt" <= ${before} OR "actionCount" < 10)
    RETURNING "actionCount"
  `;
  return rows.length === 1;
}
