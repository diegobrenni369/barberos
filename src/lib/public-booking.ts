import { Prisma, type PrismaClient } from "@prisma/client";
import { dayRangeUtc, utcToZonedParts, zonedDateTimeToUtc } from "@/lib/agenda";
import { dayOfWeekForDate, minuteToTime, ensureBarberAvailable, ensureNoBarberBreak, ensureNoBarberBlock } from "@/lib/barber-availability";
import { ensureNoOverlap } from "@/lib/appointment-overlap";
import { PUBLIC_BOOKING_DAYS, PUBLIC_SLOT_MINUTES, publicBookingInput, publicSlotInput, type PublicSlotInput, type BookingConfirmation } from "@/lib/public-booking-input";

export class PublicBookingError extends Error {}
export const SLOT_TAKEN = "Este horario acaba de ser reservado. Elige otro horario.";
const unavailableCodes = new Set(["OUTSIDE_AVAILABILITY", "BARBERSHOP_CLOSED", "OUTSIDE_BUSINESS_HOURS", "BARBER_BREAK", "BARBER_BLOCKED", "APPOINTMENT_OVERLAP"]);

export function bookingDateLimit(today: string) {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + PUBLIC_BOOKING_DAYS);
  return date.toISOString().slice(0, 10);
}

async function loadBookingDay(db: Prisma.TransactionClient, input: PublicSlotInput, now: Date) {
  const shop = await db.barbershop.findFirst({ where: { slug: input.slug, isActive: true }, select: { id: true, name: true, timezone: true } });
  if (!shop) throw new PublicBookingError("La reserva online no está disponible.");
  const today = utcToZonedParts(now, shop.timezone).date;
  if (input.date < today || input.date > bookingDateLimit(today)) throw new PublicBookingError("Elige una fecha dentro de los próximos 90 días.");
  const service = await db.service.findFirst({ where: { id: input.serviceId, barbershopId: shop.id, isActive: true, isOnlineBookingEnabled: true, onlinePaymentPolicy: "NONE" }, select: { id: true, name: true, durationMinutes: true, price: true } });
  if (!service || service.durationMinutes <= 0 || service.durationMinutes > 1440) throw new PublicBookingError("Este servicio no está disponible para reservar online.");
  const dayOfWeek = dayOfWeekForDate(input.date);
  const range = dayRangeUtc(input.date, shop.timezone);
  const [businessHour, barbers] = await Promise.all([
    db.barbershopBusinessHour.findUnique({ where: { barbershopId_dayOfWeek: { barbershopId: shop.id, dayOfWeek } }, select: { opensMinute: true, closesMinute: true, isClosed: true } }),
    db.barber.findMany({
      where: { barbershopId: shop.id, isActive: true, ...(input.barberId ? { id: input.barberId } : {}) }, orderBy: { id: "asc" },
      select: { id: true, name: true,
        availabilities: { where: { barbershopId: shop.id }, select: { dayOfWeek: true, startMinute: true, endMinute: true } },
        breaks: { where: { barbershopId: shop.id, dayOfWeek }, select: { startMinute: true, endMinute: true } },
        blocks: { where: { barbershopId: shop.id, startsAt: { lt: range.end }, endsAt: { gt: range.start } }, select: { id: true, startsAt: true, endsAt: true } },
        appointments: { where: { barbershopId: shop.id, status: { not: "CANCELLED" }, startsAt: { lt: range.end }, endsAt: { gt: range.start } }, select: { id: true, startsAt: true, endsAt: true } },
      },
    }),
  ]);
  return { shop, service, businessHour, barbers, dayOfWeek };
}

// Same domain checks used by Agenda, supplied with tenant/day-scoped preloaded
// rows. This path performs no database query per slot or per candidate.
async function availableBarber(db: Prisma.TransactionClient, day: Awaited<ReturnType<typeof loadBookingDay>>, date: string, time: string, now: Date) {
  const startsAt = zonedDateTimeToUtc(date, time, day.shop.timezone);
  if (startsAt <= now) return null;
  const roundTrip = utcToZonedParts(startsAt, day.shop.timezone);
  if (roundTrip.date !== date || roundTrip.time !== time) return null; // Nonexistent DST wall time.
  const endsAt = new Date(startsAt.getTime() + day.service.durationMinutes * 60000);
  for (const barber of day.barbers) {
    const args = { barbershopId: day.shop.id, barberId: barber.id, startsAt, endsAt, timezone: day.shop.timezone };
    try {
      await ensureBarberAvailable(db, args, { businessHour: day.businessHour, hasCustomSchedule: barber.availabilities.length > 0, intervals: barber.availabilities.filter(row => row.dayOfWeek === day.dayOfWeek) });
      await ensureNoBarberBreak(db, args, barber.breaks);
      await ensureNoBarberBlock(db, args, barber.blocks);
      await ensureNoOverlap(db, day.shop.id, barber.id, startsAt, endsAt, undefined, barber.appointments);
      return { barber, startsAt, endsAt };
    } catch (error) {
      if (!(error instanceof Error) || !unavailableCodes.has(error.message)) throw error;
    }
  }
  return null;
}

export async function getPublicSlots(db: Prisma.TransactionClient, raw: unknown, now = new Date()): Promise<string[]> {
  const parsed = publicSlotInput.safeParse(raw);
  if (!parsed.success) throw new PublicBookingError("Revisa el servicio, profesional y fecha seleccionados.");
  const day = await loadBookingDay(db, parsed.data, now);
  if (!day.businessHour || day.businessHour.isClosed) return [];
  const slots: string[] = [];
  const first = Math.ceil(day.businessHour.opensMinute / PUBLIC_SLOT_MINUTES) * PUBLIC_SLOT_MINUTES;
  for (let minute = first; minute + day.service.durationMinutes <= day.businessHour.closesMinute; minute += PUBLIC_SLOT_MINUTES) {
    const time = minuteToTime(minute);
    if (await availableBarber(db, day, parsed.data.date, time, now)) slots.push(time);
  }
  return slots;
}

export async function confirmPublicBooking(db: PrismaClient, raw: unknown, now = new Date()): Promise<BookingConfirmation> {
  const parsed = publicBookingInput.safeParse(raw);
  if (!parsed.success) throw new PublicBookingError("Revisa tus datos y el horario seleccionado.");
  const input = parsed.data;
  if (Number(input.time.slice(3)) % PUBLIC_SLOT_MINUTES !== 0) throw new PublicBookingError("Selecciona uno de los horarios disponibles.");
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(async tx => {
        const day = await loadBookingDay(tx, input, now);
        const selected = await availableBarber(tx, day, input.date, input.time, now);
        if (!selected) throw new PublicBookingError(SLOT_TAKEN);
        const digits = input.phone.slice(1);
        const local = digits.startsWith("56") && digits.length === 11 ? digits.slice(2) : digits;
        // Match existing formatted phones without altering unverified customer data.
        // Values are parameterized; lookup is always scoped to the resolved tenant.
        const matches = await tx.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "Customer"
          WHERE "barbershopId" = ${day.shop.id} AND "isActive" = true
            AND regexp_replace("phone", '[^0-9]', '', 'g') IN (${digits}, ${local}, ${`00${digits}`})
          ORDER BY "createdAt", "id" LIMIT 1
        `;
        const customer = matches[0] ?? await tx.customer.create({ data: { barbershopId: day.shop.id, name: input.name, phone: input.phone, email: input.email || null }, select: { id: true } });
        await tx.appointment.create({ data: {
          barbershopId: day.shop.id, customerId: customer.id, barberId: selected.barber.id, serviceId: day.service.id,
          startsAt: selected.startsAt, endsAt: selected.endsAt, price: day.service.price, status: "CONFIRMED", source: "ONLINE",
        } });
        return { shop: day.shop.name, service: day.service.name, barber: selected.barber.name, date: input.date, time: input.time };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        if (attempt < 2) continue;
        throw new PublicBookingError(SLOT_TAKEN);
      }
      throw error;
    }
  }
  throw new PublicBookingError(SLOT_TAKEN);
}
