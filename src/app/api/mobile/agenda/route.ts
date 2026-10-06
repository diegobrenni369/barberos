import { dayRangeUtc, utcToZonedParts } from "@/lib/agenda";
import { dayOfWeekForDate, effectiveAvailability } from "@/lib/barber-availability";
import { mobileResponse, resolveMobileAccess } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const access = await resolveMobileAccess(request);
    if (!access) return mobileResponse({ error: "Sesión no válida." }, 401);
    const { barbershopId, barbershop } = access.membership;
    const params = new URL(request.url).searchParams;
    const today = utcToZonedParts(new Date(), barbershop.timezone).date;
    const date = params.get("date") ?? today;
    const parsed = new Date(`${date}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return mobileResponse({ error: "Fecha no válida." }, 400);
    const barbers = await prisma.barber.findMany({ where: { barbershopId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
    const barberId = params.get("barberId") ?? barbers[0]?.id ?? null;
    if (barberId !== null && !barbers.some(barber => barber.id === barberId)) return mobileResponse({ error: "Profesional no disponible." }, 404);
    const dayOfWeek = dayOfWeekForDate(date);
    const range = dayRangeUtc(date, barbershop.timezone);
    const businessHour = await prisma.barbershopBusinessHour.findUnique({ where: { barbershopId_dayOfWeek: { barbershopId, dayOfWeek } }, select: { isClosed: true, opensMinute: true, closesMinute: true } });
    const scope = { barbershopId, barberId: barberId ?? "" };
    const [appointments, breaks, blocks, availability] = barberId ? await Promise.all([
      prisma.appointment.findMany({ where: { ...scope, startsAt: { lt: range.end }, endsAt: { gt: range.start }, status: { not: "CANCELLED" } }, select: { id: true, startsAt: true, endsAt: true, status: true, notes: true, price: true, barbershop: { select: { currency: true } }, barber: { select: { name: true } }, sale: { select: { id: true } }, customer: { select: { name: true, phone: true } }, service: { select: { name: true } } }, orderBy: { startsAt: "asc" } }),
      prisma.barberBreak.findMany({ where: { ...scope, dayOfWeek }, select: { id: true, startMinute: true, endMinute: true, label: true }, orderBy: { startMinute: "asc" } }),
      prisma.barberBlock.findMany({ where: { ...scope, startsAt: { lt: range.end }, endsAt: { gt: range.start } }, select: { id: true, startsAt: true, endsAt: true, reason: { select: { name: true } } }, orderBy: { startsAt: "asc" } }),
      prisma.barberAvailability.findMany({ where: scope, select: { dayOfWeek: true, startMinute: true, endMinute: true } }),
    ]) : [[], [], [], []];
    const minute = (value: Date) => {
      if (value <= range.start) return 0;
      if (value >= range.end) return 1440;
      const parts = utcToZonedParts(value, barbershop.timezone);
      return parts.hour * 60 + parts.minute;
    };
    return mobileResponse({ date, today, barbershop: { id: barbershopId, name: barbershop.name, timezone: barbershop.timezone }, barbers, barberId, businessHour,
      availability: effectiveAvailability(availability.length > 0, availability.filter(row => row.dayOfWeek === dayOfWeek), businessHour),
      appointments: appointments.map(item => ({ id: item.id, startMinute: minute(item.startsAt), endMinute: minute(item.endsAt), customerName: item.customer.name, serviceName: item.service.name, status: item.status, phone: item.customer.phone, notes: item.notes, price: item.price.toString(), currency: item.barbershop.currency, barberName: item.barber.name, startsAt: item.startsAt.toISOString(), endsAt: item.endsAt.toISOString(), canChangeStatus: !item.sale && ["SCHEDULED", "CONFIRMED"].includes(item.status) })),
      breaks, blocks: blocks.map(item => ({ id: item.id, startMinute: minute(item.startsAt), endMinute: minute(item.endsAt), label: item.reason.name })),
    });
  } catch {
    return mobileResponse({ error: "No se pudo cargar la agenda." }, 503);
  }
}
