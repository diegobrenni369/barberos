import { createHash, randomBytes } from "node:crypto";
import type { Appointment, Prisma, PrismaClient, ReminderType } from "@prisma/client";
import { normalizeBookingPhone } from "@/lib/public-booking-input";
import { utcToZonedParts } from "@/lib/agenda";

export const REMINDER_OFFSETS: Record<ReminderType, number> = {
  FIRST_REMINDER: 24 * 60 * 60_000,
  FINAL_REMINDER: 2 * 60 * 60_000,
};
const active = (status: string) => status === "SCHEDULED" || status === "CONFIRMED";
export const hashActionToken = (token: string) => createHash("sha256").update(token).digest("hex");
export function reminderPhone(phone: string | null) {
  if (!phone || !/^[+\d\s().-]+$/.test(phone) || phone.length > 30) return null;
  const normalized = normalizeBookingPhone(phone);
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}

// All mutation hooks run inside the SAME transaction as the Appointment write.
// Revision distinguishes a fresh restore (even at the same hour) from a retry.
export async function syncAppointmentReminders(tx: Prisma.TransactionClient, barbershopId: string, appointmentId: string, previous?: Appointment, now = new Date()) {
  let appointment = await tx.appointment.findFirstOrThrow({ where: { id: appointmentId, barbershopId } });
  const changed = previous && (previous.startsAt.getTime() !== appointment.startsAt.getTime()
    || previous.endsAt.getTime() !== appointment.endsAt.getTime() || previous.barberId !== appointment.barberId
    || previous.customerId !== appointment.customerId || previous.serviceId !== appointment.serviceId
    || (!active(previous.status) && active(appointment.status)));
  const terminal = !active(appointment.status) || appointment.startsAt <= now;
  if (changed || terminal) {
    await tx.appointmentReminder.updateMany({ where: { barbershopId, appointmentId, status: { in: ["SCHEDULED", "PROCESSING"] } }, data: { status: "CANCELLED", cancelledAt: now } });
    await tx.appointmentPublicAccess.updateMany({ where: { barbershopId, appointmentId, revokedAt: null }, data: { revokedAt: now } });
    if (changed) appointment = await tx.appointment.update({ where: { id: appointmentId, barbershopId }, data: { reminderRevision: { increment: 1 }, customerConfirmedAt: null } });
  }
  if (terminal) return;
  const customer = await tx.customer.findFirst({ where: { id: appointment.customerId, barbershopId }, select: { phone: true } });
  if (!reminderPhone(customer?.phone ?? null)) return;
  await tx.appointmentReminder.createMany({ skipDuplicates: true, data: Object.entries(REMINDER_OFFSETS).flatMap(([type, offset]) => {
    // startsAt is already an absolute UTC instant resolved in the shop timezone.
    const scheduledFor = new Date(appointment.startsAt.getTime() - offset);
    return scheduledFor > now ? [{ barbershopId, appointmentId, revision: appointment.reminderRevision, type: type as ReminderType, scheduledFor }] : [];
  }) });
}

export async function lockAppointment(tx: Prisma.TransactionClient, appointmentId: string, barbershopId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Appointment" WHERE "id" = ${appointmentId} AND "barbershopId" = ${barbershopId} FOR UPDATE`;
}

// Server-only primitive: caller must authorize the tenant before issuing a link.
// Returns the secret once; only its hash is persisted. No logging of the URL.
export async function issueAppointmentAccess(tx: Prisma.TransactionClient, barbershopId: string, appointmentId: string, now = new Date()) {
  await lockAppointment(tx, appointmentId, barbershopId);
  const appointment = await tx.appointment.findFirstOrThrow({ where: { id: appointmentId, barbershopId }, include: { barbershop: true } });
  if (!active(appointment.status) || appointment.startsAt <= now || !appointment.barbershop.isActive) throw new Error("APPOINTMENT_UNAVAILABLE");
  const token = randomBytes(32).toString("base64url");
  await tx.appointmentPublicAccess.create({ data: { barbershopId, appointmentId, revision: appointment.reminderRevision, tokenHash: hashActionToken(token), expiresAt: appointment.startsAt } });
  return `/book/${encodeURIComponent(appointment.barbershop.slug)}/manage/${token}`;
}

export async function findPublicAppointment(tx: Prisma.TransactionClient, slug: string, token: string, now = new Date()) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || slug.length > 60) return null;
  const access = await tx.appointmentPublicAccess.findUnique({ where: { tokenHash: hashActionToken(token) }, include: { appointment: { include: { barbershop: true, service: true, barber: true } } } });
  if (!access || access.revokedAt || access.expiresAt <= now) return null;
  const a = access.appointment;
  if (a.barbershop.slug !== slug || !a.barbershop.isActive || a.startsAt <= now || !active(a.status)
    || a.reminderRevision !== access.revision || a.service.barbershopId !== access.barbershopId || a.barber.barbershopId !== access.barbershopId) return null;
  return a;
}

export async function respondToAppointment(db: PrismaClient, slug: string, token: string, action: "confirm" | "cancel", now?: Date) {
  return db.$transaction(async tx => {
    const candidate = await findPublicAppointment(tx, slug, token, now);
    if (!candidate) return false;
    await lockAppointment(tx, candidate.id, candidate.barbershopId);
    const actionTime = now ?? new Date();
    const a = await findPublicAppointment(tx, slug, token, actionTime);
    if (!a) return false;
    if (action === "confirm") {
      await tx.appointment.updateMany({ where: { id: a.id, barbershopId: a.barbershopId, customerConfirmedAt: null }, data: { customerConfirmedAt: actionTime } });
    } else {
      await tx.appointment.update({ where: { id: a.id, barbershopId: a.barbershopId }, data: { status: "CANCELLED" } });
      await syncAppointmentReminders(tx, a.barbershopId, a.id, a, actionTime);
    }
    return true;
  });
}

export type ReminderMessageData = {
  barbershopName: string; customerName: string; serviceName: string; barberName: string;
  localDate: string; localStartTime: string; manageUrl: string;
};
export interface NotificationSender {
  // Provider MUST deduplicate this stable key, including after an ambiguous timeout.
  sendReminder(input: { idempotencyKey: string; phone: string; data: ReminderMessageData }): Promise<{ externalMessageId: string }>;
}
export const mockNotificationSender: NotificationSender = {
  async sendReminder({ idempotencyKey }) {
    if (process.env.NODE_ENV === "production") throw new Error("MOCK_DISABLED_IN_PRODUCTION");
    return { externalMessageId: `mock:${idempotencyKey}` };
  },
};

export async function processDueReminders(db: PrismaClient, options: { sender?: NotificationSender; now?: Date; baseUrl: string; barbershopId?: string; limit?: number }) {
  const now = options.now ?? new Date();
  const sender = options.sender ?? mockNotificationSender;
  const origin = new URL(options.baseUrl);
  if (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname))) throw new Error("INVALID_PUBLIC_ORIGIN");
  const due = await db.appointmentReminder.findMany({ where: { status: "SCHEDULED", scheduledFor: { lte: now }, ...(options.barbershopId ? { barbershopId: options.barbershopId } : {}) }, orderBy: [{ scheduledFor: "asc" }, { id: "asc" }], take: Math.min(100, Math.max(1, options.limit ?? 50)) });
  const result = { sent: 0, cancelled: 0, failed: 0 };
  for (const reminder of due) {
    const claim = await db.appointmentReminder.updateMany({ where: { id: reminder.id, status: "SCHEDULED" }, data: { status: "PROCESSING" } });
    if (!claim.count) continue;
    try {
      const outcome = await db.$transaction(async tx => {
        // Serializes send against rescheduling/cancellation; recheck after lock.
        await lockAppointment(tx, reminder.appointmentId, reminder.barbershopId);
        const dispatchTime = options.now ?? new Date();
        const row = await tx.appointmentReminder.findUniqueOrThrow({ where: { id: reminder.id } });
        if (row.status !== "PROCESSING") return "cancelled" as const;
        const a = await tx.appointment.findUniqueOrThrow({ where: { id: reminder.appointmentId, barbershopId: reminder.barbershopId }, include: { customer: true, service: true, barber: true, barbershop: true } });
        const phone = reminderPhone(a.customer.phone);
        if (!active(a.status) || a.startsAt <= dispatchTime || a.reminderRevision !== row.revision || !phone || !a.barbershop.isActive
          || [a.customer, a.service, a.barber].some(item => item.barbershopId !== a.barbershopId) || row.channel !== "WHATSAPP") {
          await tx.appointmentReminder.update({ where: { id: row.id }, data: { status: "CANCELLED", cancelledAt: dispatchTime } });
          return "cancelled" as const;
        }
        const path = await issueAppointmentAccess(tx, a.barbershopId, a.id, dispatchTime);
        const local = utcToZonedParts(a.startsAt, a.barbershop.timezone);
        const sent = await sender.sendReminder({ idempotencyKey: row.id, phone, data: { barbershopName: a.barbershop.name, customerName: a.customer.name, serviceName: a.service.name, barberName: a.barber.name, localDate: local.date, localStartTime: local.time, manageUrl: new URL(path, origin.origin).href } });
        await tx.appointmentReminder.update({ where: { id: row.id }, data: { status: "SENT", sentAt: dispatchTime, externalMessageId: sent.externalMessageId } });
        return "sent" as const;
      }, { timeout: 10_000 });
      result[outcome]++;
    } catch {
      // No automatic retry after an ambiguous send; preserve stable idempotency key.
      const failed = await db.appointmentReminder.updateMany({ where: { id: reminder.id, status: "PROCESSING" }, data: { status: "FAILED" } });
      result.failed += failed.count;
    }
  }
  return result;
}
