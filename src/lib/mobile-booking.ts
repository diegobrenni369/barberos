import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { dayRangeUtc, utcToZonedParts, zonedDateTimeToUtc } from "@/lib/agenda";
import { dayOfWeekForDate, effectiveAvailability, minuteToTime } from "@/lib/barber-availability";
import { ensureBarberService } from "@/lib/barber-service";
import { availableBarber } from "@/lib/public-booking";
import { PUBLIC_SLOT_MINUTES, publicBookingInput } from "@/lib/public-booking-input";
import { matchOrCreateCustomer } from "@/lib/customer-matching";
import { syncAppointmentReminders } from "@/lib/appointment-reminders";
import { ensureNoActiveAppointment } from "@/lib/barber-blocks";

export class MobileBookingError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
export const barberInput = z.object({ barberId: z.string().cuid() }).strict();
export const dayInput = barberInput.extend({ date: z.iso.date() }).strict();
export const slotInput = dayInput.extend({ serviceId: z.string().cuid() }).strict();
const contactInput = publicBookingInput.pick({ name: true, phone: true, email: true });
export const bookingInput = slotInput.extend({ time: publicBookingInput.shape.time, customerId: z.string().cuid().optional(), customer: contactInput.optional() }).strict().refine(value => Boolean(value.customerId) !== Boolean(value.customer), "Selecciona un cliente o ingresa sus datos.");
export const blockInput = dayInput.extend({ allDay: z.boolean(), startTime: publicBookingInput.shape.time.optional(), endTime: publicBookingInput.shape.time.optional(), reasonId: z.string().cuid(), note: z.string().trim().max(500).optional() }).strict().refine(value => value.allDay || (value.startTime && value.endTime && value.startTime < value.endTime), "Revisa la hora de inicio y fin.");

export async function loadMobileDay(tx: Prisma.TransactionClient, barbershopId: string, input: z.infer<typeof dayInput>) {
  const shop = await tx.barbershop.findFirst({ where: { id: barbershopId, isActive: true }, select: { id: true, name: true, timezone: true } });
  if (!shop) throw new MobileBookingError("Barbería no disponible.", 404);
  const dayOfWeek = dayOfWeekForDate(input.date);
  const range = dayRangeUtc(input.date, shop.timezone);
  const [businessHour, barber] = await Promise.all([
    tx.barbershopBusinessHour.findUnique({ where: { barbershopId_dayOfWeek: { barbershopId, dayOfWeek } }, select: { opensMinute: true, closesMinute: true, isClosed: true } }),
    tx.barber.findFirst({ where: { id: input.barberId, barbershopId, isActive: true }, select: { id: true, name: true,
      availabilities: { where: { barbershopId }, select: { dayOfWeek: true, startMinute: true, endMinute: true } },
      breaks: { where: { barbershopId, dayOfWeek }, select: { startMinute: true, endMinute: true } },
      blocks: { where: { barbershopId, startsAt: { lt: range.end }, endsAt: { gt: range.start } }, select: { id: true, startsAt: true, endsAt: true } },
      appointments: { where: { barbershopId, status: { not: "CANCELLED" }, startsAt: { lt: range.end }, endsAt: { gt: range.start } }, select: { id: true, startsAt: true, endsAt: true } },
    } }),
  ]);
  if (!barber) throw new MobileBookingError("Profesional no disponible.", 404);
  return { shop, dayOfWeek, businessHour, barbers: [barber], intervals: effectiveAvailability(barber.availabilities.length > 0, barber.availabilities.filter(row => row.dayOfWeek === dayOfWeek), businessHour) };
}

async function bookingDay(tx: Prisma.TransactionClient, barbershopId: string, input: z.infer<typeof slotInput>) {
  const day = await loadMobileDay(tx, barbershopId, input);
  const service = await tx.service.findFirst({ where: { id: input.serviceId, barbershopId, isActive: true }, select: { id: true, name: true, durationMinutes: true, price: true } });
  if (!service || service.durationMinutes <= 0 || service.durationMinutes > 1440) throw new MobileBookingError("Servicio no disponible.", 404);
  await ensureBarberService(tx, barbershopId, input.barberId, service.id);
  return { ...day, service };
}

export async function mobileSlots(barbershopId: string, input: z.infer<typeof slotInput>) {
  const day = await bookingDay(prisma, barbershopId, input);
  if (!day.businessHour || day.businessHour.isClosed) return [];
  const slots: string[] = [];
  // Reuse the public candidate engine, without public-only service/payment filters.
  // Internal Agenda may operate on historical days, as does the web backoffice.
  for (let minute = Math.ceil(day.businessHour.opensMinute / PUBLIC_SLOT_MINUTES) * PUBLIC_SLOT_MINUTES; minute + day.service.durationMinutes <= day.businessHour.closesMinute; minute += PUBLIC_SLOT_MINUTES) {
    const time = minuteToTime(minute);
    if (await availableBarber(prisma, day, input.date, time, new Date(0))) slots.push(time);
  }
  return slots;
}

export async function createMobileBooking(barbershopId: string, input: z.infer<typeof bookingInput>) {
  return prisma.$transaction(async tx => {
    const day = await bookingDay(tx, barbershopId, input);
    if (Number(input.time.slice(3)) % PUBLIC_SLOT_MINUTES) throw new MobileBookingError("Selecciona un horario disponible.");
    const slot = await availableBarber(tx, day, input.date, input.time, new Date(0));
    if (!slot) throw new MobileBookingError("Ese horario ya no está disponible.");
    const customer = input.customerId
      ? await tx.customer.findFirst({ where: { id: input.customerId, barbershopId, isActive: true }, select: { id: true } })
      : await matchOrCreateCustomer(tx, barbershopId, input.customer!);
    if (!customer) throw new MobileBookingError("Cliente no disponible.", 404);
    const appointment = await tx.appointment.create({ data: { barbershopId, barberId: slot.barber.id, customerId: customer.id, serviceId: day.service.id, startsAt: slot.startsAt, endsAt: slot.endsAt, price: day.service.price, status: "SCHEDULED", source: "INTERNAL" }, select: { id: true } });
    await syncAppointmentReminders(tx, barbershopId, appointment.id);
    return { id: appointment.id, date: input.date };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function createMobileBlock(barbershopId: string, input: z.infer<typeof blockInput>) {
  return prisma.$transaction(async tx => {
    const day = await loadMobileDay(tx, barbershopId, input);
    const reason = await tx.blockReason.findFirst({ where: { id: input.reasonId, barbershopId, isActive: true }, select: { id: true } });
    if (!reason) throw new MobileBookingError("Motivo no disponible.", 404);
    if (input.allDay && !day.intervals.length) throw new MobileBookingError("El profesional no trabaja ese día. No es necesario bloquearlo.");
    const startTime = input.allDay ? minuteToTime(Math.min(...day.intervals.map(row => row.startMinute))) : input.startTime!;
    const endTime = input.allDay ? minuteToTime(Math.max(...day.intervals.map(row => row.endMinute))) : input.endTime!;
    const startsAt = zonedDateTimeToUtc(input.date, startTime, day.shop.timezone);
    const endsAt = zonedDateTimeToUtc(input.date, endTime, day.shop.timezone);
    if (startsAt >= endsAt || utcToZonedParts(startsAt, day.shop.timezone).time !== startTime || utcToZonedParts(endsAt, day.shop.timezone).time !== endTime) throw new MobileBookingError("Revisa el horario del bloqueo.", 400);
    // Same conflict policy as web: active appointments block the operation;
    // existing breaks/blocks do not prevent creating a block.
    await ensureNoActiveAppointment(tx, barbershopId, input.barberId, startsAt, endsAt);
    const block = await tx.barberBlock.create({ data: { barbershopId, barberId: input.barberId, reasonId: reason.id, startsAt, endsAt, note: input.note || null }, select: { id: true } });
    return { id: block.id, date: input.date };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
