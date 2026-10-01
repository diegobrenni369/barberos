import { prisma } from "@/lib/prisma";
import { readCronSecret } from "@/lib/notifications/config";
import { handleReminderCron, runReminderProcessor } from "@/lib/notifications/cron";

export const runtime = "nodejs";
export async function POST(request: Request) {
  return handleReminderCron(request, readCronSecret(), () => runReminderProcessor(prisma));
}
// Supports schedulers using authenticated GET (e.g. Vercel); no schedule installed.
export const GET = POST;
