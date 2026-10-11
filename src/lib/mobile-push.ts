import { Prisma, type Appointment, type PrismaClient } from "@prisma/client";
import { after } from "next/server";
import { mobileMembership } from "./mobile-auth";
import { utcToZonedParts } from "./agenda";

type Kind = "ONLINE" | "CANCELLED" | "RESCHEDULED";
export type PushEvent = { id: string; barbershopId: string; version: string; kind: Kind };
export function appointmentPush(next: Appointment, previous?: Appointment): PushEvent | null {
  const kind: Kind | null = !previous ? next.source === "ONLINE" ? "ONLINE" : null
    : next.status === "CANCELLED" && previous.status !== "CANCELLED" ? "CANCELLED"
    : next.status !== "CANCELLED" && (next.startsAt.getTime() !== previous.startsAt.getTime() || next.endsAt.getTime() !== previous.endsAt.getTime() || next.barberId !== previous.barberId) ? "RESCHEDULED" : null;
  return kind ? { id: next.id, barbershopId: next.barbershopId, version: next.updatedAt.toISOString(), kind } : null;
}
const log = () => console.error(JSON.stringify({ event: "mobile_push_failed" }));
const headers = () => ({ "Content-Type": "application/json", ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}) });
type ExpoResult = { status: "ok" | "error"; id?: string; details?: { error?: string } };
async function expo(path: string, body: unknown) {
  const response = await fetch(`https://exp.host/--/api/v2/push/${path}`, { method: "POST", headers: headers(), body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("EXPO_FAILED");
  return response.json();
}

// Called only AFTER the domain transaction commits. No network I/O inside it.
export function scheduleMobilePush(db: PrismaClient, event: PushEvent | null) {
  if (!event) return;
  try { after(async () => { try { await dispatchAppointmentPush(db, event); } catch { log(); } }); }
  catch { log(); } // Non-request callers may not support Next after; never fail a booking.
}
async function dispatchAppointmentPush(db: PrismaClient, event: PushEvent) {
  const a = await db.appointment.findFirst({ where: { id: event.id, barbershopId: event.barbershopId }, include: { barbershop: true, barber: true, customer: true, service: true } });
  if (!a || !a.barbershop.isActive || a.updatedAt.toISOString() !== event.version || [a.barber, a.customer, a.service].some(row => row.barbershopId !== a.barbershopId)) return;
  const owners = await db.barbershopMembership.findMany({ where: { barbershopId: a.barbershopId, role: "OWNER" }, select: { userId: true } });
  const users = new Set(owners.map(row => row.userId));
  if (a.barber.isActive && a.barber.userId) users.add(a.barber.userId);
  const recipients: string[] = [];
  for (const userId of users) {
    // Match the same active tenant and identity that MobileSession can actually open.
    const member = await mobileMembership(userId);
    if (member?.barbershopId === a.barbershopId && (member.role === "OWNER" || member.barberId === a.barberId)) recipients.push(userId);
  }
  const local = utcToZonedParts(a.startsAt, a.barbershop.timezone);
  const title = { ONLINE: "Nueva reserva", CANCELLED: "Cita cancelada", RESCHEDULED: "Cita reprogramada" }[event.kind];
  const body = event.kind === "ONLINE" ? `${a.customer.name} · ${a.service.name} · ${local.time}` : `${a.customer.name} · ${local.date} ${local.time}`;
  await sendMobilePush(db, recipients, `${a.id}:${event.version}:${event.kind}`, { title, body: body.slice(0, 180), data: { type: "appointment", barbershopId: a.barbershopId, barberId: a.barberId, date: local.date } });
}

export async function sendMobilePush(db: PrismaClient, userIds: string[], eventKey: string, message: { title: string; body: string; data: Record<string, string> }) {
  const devices = await db.mobilePushToken.findMany({ where: { userId: { in: [...new Set(userIds)] }, revokedAt: null, session: { revokedAt: null, expiresAt: { gt: new Date() } } } });
  for (const device of devices) {
    try {
      // Persist before POST. Unknown outcomes are NOT retried, avoiding duplicate alerts.
      const delivery = await db.mobilePushDelivery.create({ data: { deviceId: device.id, eventKey } });
      const live = await db.mobilePushToken.findFirst({ where: { id: device.id, userId: device.userId, updatedAt: device.updatedAt, revokedAt: null, session: { revokedAt: null, expiresAt: { gt: new Date() } } } });
      if (!live) continue;
      const result = await expo("send", { to: live.token, ...message, sound: "default", channelId: "operational" }) as { data?: ExpoResult };
      const ticket = result.data;
      if (ticket?.details?.error === "DeviceNotRegistered") await db.mobilePushToken.updateMany({ where: { id: live.id, updatedAt: live.updatedAt }, data: { revokedAt: new Date() } });
      await db.mobilePushDelivery.update({ where: { id: delivery.id }, data: { receiptId: ticket?.status === "ok" ? ticket.id : null, checkedAt: ticket?.status === "ok" && ticket.id ? null : new Date() } });
      if (ticket?.status !== "ok") log();
    } catch (error) { if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) log(); }
  }
}

// Delayed delivery failures arrive as receipts, not necessarily as send tickets.
export async function checkMobilePushReceipts(db: PrismaClient) {
  try {
    const rows = await db.mobilePushDelivery.findMany({ where: { checkedAt: null, receiptId: { not: null }, createdAt: { lte: new Date(Date.now() - 15 * 60_000) } }, orderBy: { createdAt: "asc" }, take: 100 });
    if (!rows.length) return;
    const result = await expo("getReceipts", { ids: rows.map(row => row.receiptId) }) as { data?: Record<string, ExpoResult> };
    for (const row of rows) {
      const receipt = result.data?.[row.receiptId!];
      if (!receipt && Date.now() - row.createdAt.getTime() < 24 * 3600_000) continue;
      if (receipt?.details?.error === "DeviceNotRegistered") await db.mobilePushToken.updateMany({ where: { id: row.deviceId, updatedAt: { lte: row.createdAt } }, data: { revokedAt: new Date() } });
      await db.mobilePushDelivery.update({ where: { id: row.id }, data: { checkedAt: new Date() } });
      if (receipt?.status === "error" || !receipt) log();
    }
  } catch { log(); }
}
