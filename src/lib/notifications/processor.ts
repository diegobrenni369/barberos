import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { issueAppointmentAccess, lockAppointment, reminderPhone } from "../appointment-reminders";
import { utcToZonedParts } from "../agenda";
import { readNotificationConfig, type NotificationConfig } from "./config";
import { resolveNotificationSender } from "./senders";
import { classifySendError, type NotificationSender } from "./types";
import { reminderEvent } from "./logging";

type Options = { sender?: NotificationSender; now?: Date; baseUrl?: string; barbershopId?: string; limit?: number; config?: NotificationConfig };
export async function processDueReminders(db: PrismaClient, options: Options = {}) {
  // Validate configuration BEFORE claiming rows; twilio never silently falls back.
  const config = options.config ?? readNotificationConfig();
  const sender = options.sender ?? resolveNotificationSender(config);
  const provider = sender.provider ?? config.provider;
  const clock = () => options.now ?? new Date();
  const now = clock();
  const origin = new URL(options.baseUrl ?? config.baseUrl);
  if (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname))) throw new Error("INVALID_PUBLIC_ORIGIN");
  const tenant = options.barbershopId ? { barbershopId: options.barbershopId } : {};
  const limit = Math.min(100, Math.max(1, options.limit ?? 50));
  const result = { sent: 0, cancelled: 0, failed: 0, recovered: 0, retried: 0 };
  const staleBefore = new Date(+now - config.staleMs);
  const stale = await db.appointmentReminder.findMany({ where: { ...tenant, status: "PROCESSING", OR: [{ processingStartedAt: { lte: staleBefore } }, { processingStartedAt: null, updatedAt: { lte: staleBefore } }] }, orderBy: { updatedAt: "asc" }, take: limit });
  for (const row of stale) {
    // Older 10.1 rows may have sent without recording dispatch metadata. Quarantine.
    const unknown = (!row.provider || row.provider !== "mock") && (row.dispatchStartedAt !== null || row.processingStartedAt === null);
    const failed = unknown || row.attemptCount >= config.maxAttempts;
    const recovered = await db.appointmentReminder.updateMany({ where: { id: row.id, status: "PROCESSING", updatedAt: row.updatedAt, claimToken: row.claimToken }, data: {
      status: failed ? "FAILED" : "SCHEDULED", processingStartedAt: null,
      nextAttemptAt: failed ? null : now, lastError: unknown ? "OUTCOME_UNKNOWN" : failed ? "ATTEMPTS_EXHAUSTED" : "STALE_RECOVERED",
      // Keep the last claim token to correlate a late, signed callback.
    } });
    if (recovered.count) { result.recovered++; reminderEvent("reminder_recovered", { reminderId: row.id, barbershopId: row.barbershopId }); }
  }
  const due = await db.appointmentReminder.findMany({ where: { ...tenant, status: "SCHEDULED", scheduledFor: { lte: now }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] }, orderBy: [{ scheduledFor: "asc" }, { id: "asc" }], take: limit });
  for (const reminder of due) {
    const claimToken = randomUUID();
    const claim = await db.appointmentReminder.updateMany({ where: { id: reminder.id, status: "SCHEDULED", attemptCount: { lt: config.maxAttempts }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] }, data: { status: "PROCESSING", provider, claimToken, processingStartedAt: clock(), dispatchStartedAt: null, lastAttemptAt: clock(), attemptCount: { increment: 1 }, nextAttemptAt: null, lastError: null } });
    if (!claim.count) {
      await db.appointmentReminder.updateMany({ where: { id: reminder.id, status: "SCHEDULED", attemptCount: { gte: config.maxAttempts } }, data: { status: "FAILED", lastError: "ATTEMPTS_EXHAUSTED" } });
      continue;
    }
    reminderEvent("reminder_claimed", { reminderId: reminder.id, appointmentId: reminder.appointmentId, barbershopId: reminder.barbershopId, attemptCount: reminder.attemptCount + 1 });
    try {
      const prepared = await db.$transaction(async tx => {
        await lockAppointment(tx, reminder.appointmentId, reminder.barbershopId);
        const row = await tx.appointmentReminder.findUniqueOrThrow({ where: { id: reminder.id } });
        if (row.status !== "PROCESSING" || row.claimToken !== claimToken) return null;
        const a = await tx.appointment.findUniqueOrThrow({ where: { id: row.appointmentId, barbershopId: row.barbershopId }, include: { customer: true, service: true, barber: true, barbershop: true } });
        const phone = reminderPhone(a.customer.phone);
        const dispatchTime = clock();
        if (!["SCHEDULED", "CONFIRMED"].includes(a.status) || a.startsAt <= dispatchTime || a.reminderRevision !== row.revision || !phone || !a.barbershop.isActive
          || [a.customer, a.service, a.barber].some(item => item.barbershopId !== a.barbershopId) || row.channel !== "WHATSAPP") {
          await tx.appointmentReminder.updateMany({ where: { id: row.id, claimToken }, data: { status: "CANCELLED", cancelledAt: dispatchTime, processingStartedAt: null } });
          return null;
        }
        // Persist link BEFORE external I/O: a crash cannot leave an accepted message
        // with a token hash rolled back. Plain token only exists in this local payload.
        const path = await issueAppointmentAccess(tx, a.barbershopId, a.id, dispatchTime);
        const local = utcToZonedParts(a.startsAt, a.barbershop.timezone);
        return { phone, type: row.type, idempotencyKey: row.id, attemptKey: claimToken, data: { barbershopName: a.barbershop.name, customerName: a.customer.name, serviceName: a.service.name, barberName: a.barber.name, localDate: local.date, localStartTime: local.time, manageUrl: new URL(path, origin.origin).href } };
      });
      if (!prepared) { result.cancelled++; continue; }
      // Fenced dispatch authorization: recovery cannot authorize an old worker.
      const dispatch = await db.appointmentReminder.updateMany({ where: { id: reminder.id, status: "PROCESSING", claimToken }, data: { dispatchStartedAt: clock() } });
      if (!dispatch.count) { result.cancelled++; continue; }
      const sent = await sender.sendReminder(prepared);
      // A signed callback can arrive first. Do not regress its delivery state, and
      // preserve cancellation if the Appointment changed while network I/O ran.
      await db.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "AppointmentReminder" WHERE "id" = ${reminder.id} FOR UPDATE`;
        const row = await tx.appointmentReminder.findUniqueOrThrow({ where: { id: reminder.id } });
        if (row.claimToken !== claimToken || (row.externalMessageId && row.externalMessageId !== sent.externalMessageId)) return;
        await tx.appointmentReminder.update({ where: { id: row.id }, data: { status: row.status === "CANCELLED" ? "CANCELLED" : "SENT", sentAt: row.sentAt ?? clock(), externalMessageId: sent.externalMessageId, deliveryStatus: row.deliveryStatus ?? "QUEUED", processingStartedAt: null, nextAttemptAt: null, lastError: null } });
      });
      result.sent++;
      reminderEvent("reminder_sent", { reminderId: reminder.id, barbershopId: reminder.barbershopId });
    } catch (error) {
      const failure = classifySendError(error);
      const attempt = reminder.attemptCount + 1;
      const retry = failure.retryable && (!failure.ambiguous || sender.safeToRetryAfterUnknownOutcome === true) && attempt < config.maxAttempts;
      const updated = await db.appointmentReminder.updateMany({ where: { id: reminder.id, status: "PROCESSING", claimToken, externalMessageId: null }, data: { status: retry ? "SCHEDULED" : "FAILED", processingStartedAt: null, nextAttemptAt: retry ? new Date(+clock() + config.retryMs * 2 ** (attempt - 1)) : null, lastError: failure.code } });
      if (updated.count) { if (retry) result.retried++; else result.failed++; reminderEvent("reminder_failed", { reminderId: reminder.id, barbershopId: reminder.barbershopId, attemptCount: attempt }); }
    }
  }
  return result;
}
