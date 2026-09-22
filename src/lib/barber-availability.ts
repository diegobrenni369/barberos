import { DayOfWeek, Prisma } from "@prisma/client";
import { utcToZonedParts } from "@/lib/agenda";

export const DAYS: DayOfWeek[] = [DayOfWeek.SUNDAY, DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY];

export function timeToMinute(time: string) { const [hour, minute] = time.split(":").map(Number); return hour * 60 + minute; }
export function minuteToTime(minute: number) { return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`; }
export function dayOfWeekForDate(date: string) { return DAYS[new Date(`${date}T12:00:00Z`).getUTCDay()]; }
export function effectiveAvailability(hasCustomSchedule: boolean, customIntervals: { startMinute: number; endMinute: number }[], businessHour: { opensMinute: number; closesMinute: number; isClosed: boolean } | null) {
  if (!businessHour || businessHour.isClosed) return [];
  const source = hasCustomSchedule ? customIntervals : [{ startMinute: businessHour.opensMinute, endMinute: businessHour.closesMinute }];
  return source.map((item) => ({ startMinute: Math.max(item.startMinute, businessHour.opensMinute), endMinute: Math.min(item.endMinute, businessHour.closesMinute) })).filter((item) => item.startMinute < item.endMinute);
}

export async function ensureBarberAvailable(tx: Prisma.TransactionClient, args: { barbershopId: string; barberId: string; startsAt: Date; endsAt: Date; timezone: string }) {
  const start = utcToZonedParts(args.startsAt, args.timezone);
  const end = utcToZonedParts(args.endsAt, args.timezone);
  if (start.date !== end.date) throw new Error("OUTSIDE_AVAILABILITY");
  const dayOfWeek = dayOfWeekForDate(start.date);
  const businessHour = await tx.barbershopBusinessHour.findUnique({ where: { barbershopId_dayOfWeek: { barbershopId: args.barbershopId, dayOfWeek } }, select: { opensMinute: true, closesMinute: true, isClosed: true } });
  if (!businessHour || businessHour.isClosed) throw new Error("BARBERSHOP_CLOSED");
  const rows = await tx.barberAvailability.findMany({ where: { barbershopId: args.barbershopId, barberId: args.barberId, dayOfWeek }, select: { startMinute: true, endMinute: true } });
  const hasConfiguration = await tx.barberAvailability.findFirst({ where: { barbershopId: args.barbershopId, barberId: args.barberId }, select: { id: true } });
  const intervals = effectiveAvailability(Boolean(hasConfiguration), rows, businessHour);
  const startMinute = start.hour * 60 + start.minute;
  const endMinute = end.hour * 60 + end.minute;
  if (startMinute < businessHour.opensMinute || endMinute > businessHour.closesMinute) throw new Error("OUTSIDE_BUSINESS_HOURS");
  if (!intervals.some((row) => startMinute >= row.startMinute && endMinute <= row.endMinute)) throw new Error("OUTSIDE_AVAILABILITY");
}

export async function ensureNoBarberBlock(tx: Prisma.TransactionClient, args: { barbershopId: string; barberId: string; startsAt: Date; endsAt: Date; excludeBlockId?: string }) {
  const block = await tx.barberBlock.findFirst({ where: { barbershopId: args.barbershopId, barberId: args.barberId, startsAt: { lt: args.endsAt }, endsAt: { gt: args.startsAt }, ...(args.excludeBlockId ? { id: { not: args.excludeBlockId } } : {}) }, select: { id: true } });
  if (block) throw new Error("BARBER_BLOCKED");
}

export async function ensureNoBarberBreak(tx: Prisma.TransactionClient, args: { barbershopId: string; barberId: string; startsAt: Date; endsAt: Date; timezone: string }) {
  const start = utcToZonedParts(args.startsAt, args.timezone);
  const end = utcToZonedParts(args.endsAt, args.timezone);
  if (start.date !== end.date) throw new Error("BARBER_BREAK");
  const startMinute = start.hour * 60 + start.minute;
  const endMinute = end.hour * 60 + end.minute;
  const item = await tx.barberBreak.findFirst({ where: { barbershopId: args.barbershopId, barberId: args.barberId, dayOfWeek: dayOfWeekForDate(start.date), startMinute: { lt: endMinute }, endMinute: { gt: startMinute } }, select: { id: true } });
  if (item) throw new Error("BARBER_BREAK");
}
