import { PageHeader } from "@/components/page-header";
import { AgendaWorkspace } from "@/components/agenda/agenda-workspace";
import { dayRangeUtc, utcToZonedParts } from "@/lib/agenda";
import { dayOfWeekForDate, effectiveAvailability } from "@/lib/barber-availability";
import { requireBarbershopAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function validDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ date?: string; error?: string; cancelled?: string }> }) {
  const membership = await requireBarbershopAccess(); const params = await searchParams;
  const timezone = membership.barbershop.timezone; const now = new Date(); const todayParts = utcToZonedParts(now, timezone);
  const date = validDate(params.date) ? params.date! : todayParts.date; const showCancelled = params.cancelled === "true"; const range = dayRangeUtc(date, timezone); const dayOfWeek = dayOfWeekForDate(date);
  const [businessHour, barbers, customers, services, appointments, blocks, reasons] = await Promise.all([
    prisma.barbershopBusinessHour.findUnique({ where: { barbershopId_dayOfWeek: { barbershopId: membership.barbershopId, dayOfWeek } } }),
    prisma.barber.findMany({ where: { barbershopId: membership.barbershopId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, availabilities: { select: { dayOfWeek: true, startMinute: true, endMinute: true }, orderBy: { startMinute: "asc" } }, breaks: { select: { id: true, dayOfWeek: true, startMinute: true, endMinute: true, label: true }, orderBy: { startMinute: "asc" } } } }),
    prisma.customer.findMany({ where: { barbershopId: membership.barbershopId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.service.findMany({ where: { barbershopId: membership.barbershopId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, durationMinutes: true, price: true } }),
    prisma.appointment.findMany({ where: { barbershopId: membership.barbershopId, startsAt: { gte: range.start, lt: range.end }, ...(showCancelled ? {} : { status: { not: "CANCELLED" } }) }, include: { customer: { select: { name: true } }, service: { select: { name: true } } }, orderBy: { startsAt: "asc" } }),
    prisma.barberBlock.findMany({ where: { barbershopId: membership.barbershopId, startsAt: { lt: range.end }, endsAt: { gt: range.start } }, include: { reason: { select: { id: true, name: true } } }, orderBy: { startsAt: "asc" } }),
    prisma.blockReason.findMany({ where: { barbershopId: membership.barbershopId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const formatter = new Intl.DateTimeFormat("es-CL", { timeZone: timezone, weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const titleDate = formatter.format(new Date(range.start.getTime() + 12 * 60 * 60_000));
  const serialized = appointments.map((item) => { const start = utcToZonedParts(item.startsAt, timezone); const end = utcToZonedParts(item.endsAt, timezone); return { id: item.id, barberId: item.barberId, customerId: item.customerId, serviceId: item.serviceId, date: start.date, time: start.time, endTime: end.time, status: item.status, notes: item.notes ?? "", customerName: item.customer.name, serviceName: item.service.name, price: item.price.toString(), updatedAt: item.updatedAt.toISOString(), durationMinutes: (item.endsAt.getTime() - item.startsAt.getTime()) / 60_000 }; });
  const serializedBlocks = blocks.map((item) => { const start = utcToZonedParts(item.startsAt, timezone); const end = utcToZonedParts(item.endsAt, timezone); const allDay = start.time === "00:00" && end.date !== start.date; return { id: item.id, barberId: item.barberId, date, startTime: start.time, endTime: end.time, allDay, reasonId: item.reasonId, reasonName: item.reason.name, note: item.note ?? "" }; });
  const availability = barbers.map((barber) => { const configured = barber.availabilities.length > 0; const custom = barber.availabilities.filter((item) => item.dayOfWeek === dayOfWeek).map(({ startMinute, endMinute }) => ({ startMinute, endMinute })); return { barberId: barber.id, configured, intervals: effectiveAvailability(configured, custom, businessHour) }; });
  const recurringBreaks = barbers.flatMap((barber) => barber.breaks.filter((item) => item.dayOfWeek === dayOfWeek).map((item) => ({ id: item.id, barberId: barber.id, startMinute: item.startMinute, endMinute: item.endMinute, label: item.label?.trim() || "Descanso" })));
  const currentMinutes = todayParts.hour * 60 + todayParts.minute;
  const nowMinutes = businessHour && !businessHour.isClosed && date === todayParts.date && currentMinutes >= businessHour.opensMinute && currentMinutes <= businessHour.closesMinute ? currentMinutes : null;
  return <section className="space-y-6"><PageHeader title="Agenda" description={titleDate.charAt(0).toUpperCase() + titleDate.slice(1)} />{params.error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{params.error}</p>}<AgendaWorkspace isClosed={!businessHour || businessHour.isClosed} date={date} today={todayParts.date} showCancelled={showCancelled} nowMinutes={nowMinutes} startMinute={businessHour?.opensMinute ?? 0} endMinute={businessHour?.closesMinute ?? 0} barbers={barbers.map(({ id, name }) => ({ id, name }))} customers={customers} services={services.map((item) => ({ ...item, price: item.price.toString() }))} appointments={serialized} availability={availability} recurringBreaks={recurringBreaks} blocks={serializedBlocks} reasons={reasons} /></section>;
}
