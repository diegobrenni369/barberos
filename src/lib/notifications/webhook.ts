import twilio from "twilio";
import type { PrismaClient } from "@prisma/client";
import type { TwilioConfig } from "./config";
import { reminderEvent } from "./logging";

const statuses: Record<string, string> = { accepted: "QUEUED", queued: "QUEUED", sending: "QUEUED", sent: "SENT", delivered: "DELIVERED", read: "READ", failed: "FAILED", undelivered: "UNDELIVERED" };
const rank: Record<string, number> = { QUEUED: 0, SENT: 1, FAILED: 2, UNDELIVERED: 2, DELIVERED: 3, READ: 4 };

export async function applyTwilioCallback(db: PrismaClient, input: { sid: string; status: string; reminderId?: string; attemptKey?: string }) {
  const deliveryStatus = statuses[input.status];
  if (!deliveryStatus || !/^SM[0-9a-fA-F]{32}$/.test(input.sid)) return;
  await db.$transaction(async tx => {
    const found = await tx.appointmentReminder.findFirst({ where: { provider: "twilio", externalMessageId: input.sid } });
    // Signed correlation handles callbacks racing with persistence of the REST SID.
    const candidate = found ?? (input.reminderId && input.attemptKey ? await tx.appointmentReminder.findFirst({ where: { id: input.reminderId, claimToken: input.attemptKey, provider: "twilio", dispatchStartedAt: { not: null }, externalMessageId: null } }) : null);
    if (!candidate) return;
    await tx.$queryRaw`SELECT "id" FROM "AppointmentReminder" WHERE "id" = ${candidate.id} FOR UPDATE`;
    const row = await tx.appointmentReminder.findUniqueOrThrow({ where: { id: candidate.id } });
    if (row.provider !== "twilio" || (row.externalMessageId && row.externalMessageId !== input.sid)) return;
    if (!row.externalMessageId && (row.claimToken !== input.attemptKey || !row.dispatchStartedAt)) return;
    const nextStatus = row.deliveryStatus && rank[row.deliveryStatus] >= rank[deliveryStatus] ? row.deliveryStatus : deliveryStatus;
    if (row.externalMessageId === input.sid && row.deliveryStatus === nextStatus) return;
    await tx.appointmentReminder.update({ where: { id: row.id }, data: {
      externalMessageId: input.sid, deliveryStatus: nextStatus,
      // Failure of DELIVERY doesn't change Appointment or mean API rejection.
      status: row.status === "CANCELLED" ? "CANCELLED" : "SENT",
      sentAt: row.sentAt ?? new Date(), processingStartedAt: null, nextAttemptAt: null,
    } });
    reminderEvent("twilio_callback", { reminderId: row.id, barbershopId: row.barbershopId });
  });
}

async function boundedBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16_384) { await reader.cancel(); throw new Error("BODY_TOO_LARGE"); }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
export async function handleTwilioStatus(request: Request, db: PrismaClient, config: TwilioConfig) {
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) return new Response(null, { status: 415 });
  let params: Record<string, string>; let url: URL;
  try {
    url = new URL(request.url);
    const form = new URLSearchParams(await boundedBody(request));
    if (new Set(form.keys()).size !== [...form.keys()].length) return new Response(null, { status: 400 });
    params = Object.fromEntries(form);
  } catch { return new Response(null, { status: 400 }); }
  // Use the EXACT externally configured URL, not attacker-controlled Host/proxy headers.
  const canonical = config.callbackUrl + url.search;
  const signature = request.headers.get("x-twilio-signature") ?? "";
  if (!twilio.validateRequest(config.authToken, signature, canonical, params) || params.AccountSid !== config.accountSid) return new Response(null, { status: 403 });
  try {
    await applyTwilioCallback(db, { sid: params.MessageSid ?? "", status: params.MessageStatus ?? "", reminderId: url.searchParams.get("reminder") ?? undefined, attemptKey: url.searchParams.get("attempt") ?? undefined });
    return new Response(null, { status: 204 });
  } catch { return new Response(null, { status: 503 }); }
}
