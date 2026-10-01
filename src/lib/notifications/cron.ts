import { createHash, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { processDueReminders } from "./processor";
import { readNotificationConfig } from "./config";

export async function runReminderProcessor(db: PrismaClient) {
  const config = readNotificationConfig();
  await db.$executeRaw`DELETE FROM "PublicRateLimit" WHERE "key" IN (SELECT "key" FROM "PublicRateLimit" WHERE "expiresAt" < CURRENT_TIMESTAMP - INTERVAL '1 day' LIMIT 1000)`;
  const result = await processDueReminders(db, { config });
  console.info(JSON.stringify({ event: "reminder_run", finishedAt: new Date().toISOString(), ...result }));
  return result;
}
export async function handleReminderCron(request: Request, secret: string | undefined, run: () => Promise<unknown>) {
  const supplied = request.headers.get("authorization") ?? "";
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!secret || secret.length < 32 || !timingSafeEqual(digest(supplied), digest(`Bearer ${secret}`))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try { return Response.json(await run(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "Reminder processor unavailable" }, { status: 503 }); }
}
