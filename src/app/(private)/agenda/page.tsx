import { PageHeader } from "@/components/page-header";
import { AgendaView } from "@/components/agenda/agenda-view";
import { AGENDA_END_HOUR, AGENDA_START_HOUR, dayRangeUtc, utcToZonedParts } from "@/lib/agenda";
import { requireBarbershopAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function validDate(value?: string) { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00Z`).getTime()); }

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ date?: string; error?: string; cancelled?: string }> }) {
  const membership = await requireBarbershopAccess();
  const params = await searchParams;
  const timezone = membership.barbershop.timezone;
  const now = new Date();
  const todayParts = utcToZonedParts(now, timezone);
  const date = validDate(params.date) ? params.date! : todayParts.date;
  const showCancelled = params.cancelled === "true";
  const range = dayRangeUtc(date, timezone);
  const [barbers, customers, services, appointments] = await Promise.all([
    prisma.barber.findMany({ where: { barbershopId: membership.barbershopId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.customer.findMany({ where: { barbershopId: membership.barbershopId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.service.findMany({ where: { barbershopId: membership.barbershopId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, durationMinutes: true, price: true } }),
    prisma.appointment.findMany({ where: { barbershopId: membership.barbershopId, startsAt: { gte: range.start, lt: range.end }, ...(showCancelled ? {} : { status: { not: "CANCELLED" } }) }, include: { customer: { select: { name: true } }, service: { select: { name: true } } }, orderBy: { startsAt: "asc" } }),
  ]);
  const formatter = new Intl.DateTimeFormat("es-CL", { timeZone: timezone, weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const titleDate = formatter.format(new Date(range.start.getTime() + 12 * 60 * 60_000));
  const serialized = appointments.map((item) => { const start = utcToZonedParts(item.startsAt, timezone); const end = utcToZonedParts(item.endsAt, timezone); return { id: item.id, barberId: item.barberId, customerId: item.customerId, serviceId: item.serviceId, date: start.date, time: start.time, endTime: end.time, status: item.status, notes: item.notes ?? "", customerName: item.customer.name, serviceName: item.service.name }; });
  const currentMinutes = todayParts.hour * 60 + todayParts.minute;
  const nowMinutes = date === todayParts.date && currentMinutes >= AGENDA_START_HOUR * 60 && currentMinutes <= AGENDA_END_HOUR * 60 ? currentMinutes : null;

  return <section className="space-y-6"><PageHeader title="Agenda" description={titleDate.charAt(0).toUpperCase() + titleDate.slice(1)} />{params.error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{params.error}</p>}<AgendaView date={date} today={todayParts.date} showCancelled={showCancelled} nowMinutes={nowMinutes} barbers={barbers} customers={customers} services={services.map((item) => ({ ...item, price: item.price.toString() }))} appointments={serialized} /></section>;
}
