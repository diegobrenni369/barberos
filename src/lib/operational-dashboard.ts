import { Prisma } from "@prisma/client";
import { dayRangeUtc, utcToZonedParts } from "./agenda";
import { validSalesInRange } from "./sales-report";

export async function getOperationalDashboard(db: Prisma.TransactionClient, barbershopId: string, timezone: string, now = new Date()) {
  const today = utcToZonedParts(now, timezone).date;
  const dates = Array.from({ length: 7 }, (_, index) => {
    // Shift calendar dates, not 24-hour instants (DST days may have 23/25 hours).
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 6 + index);
    return date.toISOString().slice(0, 10);
  });
  const range = dayRangeUtc(today, timezone);
  const start = dayRangeUtc(dates[0], timezone).start;
  const [appointments, sales, barbers] = await Promise.all([
    db.appointment.findMany({ where: { barbershopId, startsAt: { gte: start, lt: range.end } }, select: { id: true, barberId: true, startsAt: true, status: true }, orderBy: [{ startsAt: "asc" }, { id: "asc" }] }),
    db.sale.findMany({ where: validSalesInRange(barbershopId, start, range.end), select: { total: true, createdAt: true, barberId: true } }),
    db.barber.findMany({ where: { barbershopId, isActive: true }, select: { id: true, name: true }, orderBy: [{ name: "asc" }, { id: "asc" }] }),
  ]);
  // Select from the already-loaded day data, then fetch at most six display rows.
  const todayAppointments = appointments.filter(item => item.startsAt >= range.start);
  const upcoming = todayAppointments.filter(item => item.startsAt >= now && (item.status === "SCHEDULED" || item.status === "CONFIRMED"));
  const recent = todayAppointments.filter(item => item.status === "COMPLETED" && item.startsAt < now)
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime() || a.id.localeCompare(b.id));
  const selected = [...upcoming, ...recent].slice(0, 6);
  const details = selected.length ? await db.appointment.findMany({
    where: { barbershopId, id: { in: selected.map(item => item.id) } },
    select: { id: true, startsAt: true, status: true, customer: { select: { name: true } }, service: { select: { name: true } }, barber: { select: { name: true } } },
    take: 6,
  }) : [];
  const byId = new Map(details.map(item => [item.id, item]));
  const dailyAgenda = selected.flatMap(item => { const detail = byId.get(item.id); return detail ? [detail] : []; });
  const remainingAgendaCount = todayAppointments.filter(item => ["COMPLETED", "SCHEDULED", "CONFIRMED"].includes(item.status)).length - dailyAgenda.length;
  const trend = dates.map(date => ({ date, sales: new Prisma.Decimal(0), completed: 0 }));
  const days = new Map(trend.map(day => [day.date, day]));
  const team = barbers.map(barber => ({ ...barber, completed: 0, sales: new Prisma.Decimal(0), next: null as Date | null }));
  const members = new Map(team.map(barber => [barber.id, barber]));
  const counts = { reservations: 0, active: 0, completed: 0, cancelled: 0, noShow: 0 };
  for (const appointment of appointments) {
    const date = utcToZonedParts(appointment.startsAt, timezone).date;
    if (appointment.status === "COMPLETED") days.get(date)!.completed++;
    if (date !== today) continue;
    counts.reservations++;
    const member = members.get(appointment.barberId);
    if (appointment.status === "COMPLETED") { counts.completed++; if (member) member.completed++; }
    if (appointment.status === "CANCELLED") counts.cancelled++;
    if (appointment.status === "NO_SHOW") counts.noShow++;
    if (appointment.status === "SCHEDULED" || appointment.status === "CONFIRMED") {
      counts.active++;
      if (member && !member.next && appointment.startsAt >= now) member.next = appointment.startsAt;
    }
  }
  let total = new Prisma.Decimal(0);
  let saleCount = 0;
  for (const sale of sales) {
    const date = utcToZonedParts(sale.createdAt, timezone).date;
    const day = days.get(date);
    if (day) day.sales = day.sales.plus(sale.total);
    if (date !== today) continue;
    total = total.plus(sale.total);
    saleCount++;
    const member = members.get(sale.barberId);
    if (member) member.sales = member.sales.plus(sale.total);
  }
  return { today, counts, total, saleCount, average: saleCount ? total.div(saleCount) : new Prisma.Decimal(0), dailyAgenda, remainingAgendaCount, team, trend };
}
