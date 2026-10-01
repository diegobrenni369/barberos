import { prisma } from "@/lib/prisma";
import { readNotificationConfig } from "@/lib/notifications/config";
import { handleTwilioStatus } from "@/lib/notifications/webhook";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const config = readNotificationConfig();
    if (!config.twilio) return new Response(null, { status: 503 });
    return await handleTwilioStatus(request, prisma, config.twilio);
  } catch { return new Response(null, { status: 503 }); }
}
