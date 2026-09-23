import { Prisma } from "@prisma/client";

export const CUSTOMER_HISTORY_SIZE = 10;

// Caller supplies the tenant from the authenticated membership, never the URL.
export async function getCustomerProfile(db: Prisma.TransactionClient, barbershopId: string, customerId: string, requestedPage = 1, now = new Date()) {
  const customer = await db.customer.findFirst({ where: { id: customerId, barbershopId } });
  if (!customer) return null;
  const where = { barbershopId, customerId };
  const past: Prisma.AppointmentWhereInput = {
    ...where,
    startsAt: { lt: now },
    status: { in: ["COMPLETED", "CANCELLED", "NO_SHOW"] },
  };
  const completed = { ...where, status: "COMPLETED" as const };
  const [counts, sales, lastVisit, next, historyCount, frequentServices, frequentBarbers] = await Promise.all([
    db.appointment.groupBy({ by: ["status"], where, _count: { _all: true } }),
    db.sale.aggregate({ where: { ...where, status: "COMPLETED" }, _sum: { total: true }, _count: { _all: true } }),
    db.appointment.findFirst({ where: { ...completed, startsAt: { lt: now } }, orderBy: [{ startsAt: "desc" }, { id: "asc" }], select: { startsAt: true } }),
    db.appointment.findFirst({ where: { ...where, startsAt: { gte: now }, status: { in: ["SCHEDULED", "CONFIRMED"] } }, orderBy: [{ startsAt: "asc" }, { id: "asc" }], include: { service: true, barber: true } }),
    db.appointment.count({ where: past }),
    db.appointment.groupBy({ by: ["serviceId"], where: completed, _count: { _all: true }, orderBy: [{ _count: { serviceId: "desc" } }, { serviceId: "asc" }], take: 1 }),
    db.appointment.groupBy({ by: ["barberId"], where: completed, _count: { _all: true }, orderBy: [{ _count: { barberId: "desc" } }, { barberId: "asc" }], take: 1 }),
  ]);
  const pages = Math.max(1, Math.ceil(historyCount / CUSTOMER_HISTORY_SIZE));
  const page = Math.min(pages, Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1);
  const [history, service, barber] = await Promise.all([
    db.appointment.findMany({ where: past, orderBy: [{ startsAt: "desc" }, { id: "asc" }], skip: (page - 1) * CUSTOMER_HISTORY_SIZE, take: CUSTOMER_HISTORY_SIZE, include: { service: { select: { name: true } }, barber: { select: { name: true } }, sale: { select: { barbershopId: true, customerId: true, total: true, currency: true, status: true, items: { where: { barbershopId }, select: { description: true }, orderBy: { id: "asc" } } } } } }),
    frequentServices[0] ? db.service.findFirst({ where: { id: frequentServices[0].serviceId, barbershopId }, select: { name: true } }) : null,
    frequentBarbers[0] ? db.barber.findFirst({ where: { id: frequentBarbers[0].barberId, barbershopId }, select: { name: true } }) : null,
  ]);
  const total = sales._sum.total ?? new Prisma.Decimal(0);
  return { customer, counts: Object.fromEntries(counts.map(row => [row.status, row._count._all])), total, average: sales._count._all ? total.div(sales._count._all) : new Prisma.Decimal(0), saleCount: sales._count._all, lastVisit: lastVisit?.startsAt ?? null, next, history: history.map(row => ({ ...row, sale: row.sale?.barbershopId === barbershopId && row.sale.customerId === customerId ? row.sale : null })), page, pages, historyCount, frequentService: service ? { name: service.name, count: frequentServices[0]._count._all } : null, frequentBarber: barber ? { name: barber.name, count: frequentBarbers[0]._count._all } : null };
}
