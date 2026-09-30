import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { dayRangeUtc, utcToZonedParts } from "./agenda";

export class SettlementError extends Error {}
const civil = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Fecha inválida");
export const settlementInput = z.object({ barberId: z.string().min(1).max(100), start: civil, end: civil });
export function commissionPeriod(timezone: string, query: { period?: string; start?: string; end?: string }, now = new Date()) {
  let start: string, end: string;
  if (query.period === "custom") {
    const parsed = z.object({ start: civil, end: civil }).safeParse(query);
    if (!parsed.success) throw new SettlementError("Selecciona fechas válidas para el período.");
    ({ start, end } = parsed.data);
  } else {
    const today = utcToZonedParts(now, timezone).date;
    const month = new Date(`${today.slice(0, 7)}-01T12:00:00Z`);
    if (query.period === "previous") month.setUTCMonth(month.getUTCMonth() - 1);
    start = month.toISOString().slice(0, 10);
    month.setUTCMonth(month.getUTCMonth() + 1); month.setUTCDate(0);
    end = month.toISOString().slice(0, 10);
  }
  if (start > end) throw new SettlementError("El inicio debe ser anterior al término.");
  return { start, end, from: dayRangeUtc(start, timezone).start, to: dayRangeUtc(end, timezone).end };
}
export const sumMoney = (values: Prisma.Decimal[]) => values.reduce((sum, value) => sum.plus(value), new Prisma.Decimal(0));
export function commissionScope(barbershopId: string, period: ReturnType<typeof commissionPeriod>): Prisma.CommissionWhereInput {
  return { barbershopId, barber: { barbershopId }, sale: { barbershopId, status: "COMPLETED", createdAt: { gte: period.from, lt: period.to } } };
}

export async function settleCommissions(db: PrismaClient, barbershopId: string, raw: unknown) {
  const parsed = settlementInput.safeParse(raw);
  if (!parsed.success) throw new SettlementError("Revisa el barbero y las fechas.");
  const input = parsed.data;
  try {
    return await db.$transaction(async tx => {
      const shop = await tx.barbershop.findUniqueOrThrow({ where: { id: barbershopId } });
      const barber = await tx.barber.findFirst({ where: { id: input.barberId, barbershopId } });
      if (!barber || !shop.isActive) throw new SettlementError("Barbero no disponible.");
      const period = commissionPeriod(shop.timezone, { period: "custom", ...input });
      const rows = await tx.commission.findMany({ where: { ...commissionScope(barbershopId, period), barberId: barber.id, settlementItem: null }, include: { sale: { include: { items: true } } }, orderBy: { createdAt: "asc" } });
      if (!rows.length) throw new SettlementError("No hay comisiones pendientes para liquidar. Actualiza la página.");
      if (rows.some(row => row.sale.barberId !== barber.id || row.sale.currency !== shop.currency || row.amount.isNegative())) throw new SettlementError("Las comisiones contienen datos inconsistentes. Revisa las ventas.");
      return tx.commissionSettlement.create({ data: {
        barbershopId, barberId: barber.id, barberName: barber.name, currency: shop.currency,
        periodStart: period.from, periodEnd: period.to,
        totalSales: sumMoney(rows.map(row => row.baseAmount)), totalCommission: sumMoney(rows.map(row => row.amount)),
        status: "PAID", paidAt: new Date(),
        items: { create: rows.map(row => ({ commissionId: row.id, saleAt: row.sale.createdAt, customerName: row.sale.customerName, description: row.sale.items.map(item => item.description).join(" · "), baseAmount: row.baseAmount, rate: row.rate, amount: row.amount })) },
      } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) throw new SettlementError("Otra liquidación coincidió con esta operación. Actualiza antes de reintentar.");
    throw error;
  }
}

export async function getCommissions(db: PrismaClient, barbershopId: string, period: ReturnType<typeof commissionPeriod>) {
  const [rows, settlements] = await Promise.all([
    db.commission.findMany({ where: commissionScope(barbershopId, period), include: { barber: { select: { name: true } }, sale: { include: { items: true } }, settlementItem: { include: { settlement: { select: { status: true } } } } }, orderBy: { sale: { createdAt: "asc" } } }),
    db.commissionSettlement.findMany({ where: { barbershopId, status: "PAID", paidAt: { gte: period.from, lt: period.to } }, include: { items: { orderBy: { saleAt: "asc" } } }, orderBy: { paidAt: "desc" } }),
  ]);
  const pending = rows.filter(row => row.settlementItem?.settlement.status !== "PAID");
  return { rows, settlements, sales: sumMoney(rows.map(row => row.baseAmount)), commission: sumMoney(rows.map(row => row.amount)), pending: sumMoney(pending.map(row => row.amount)), paid: sumMoney(settlements.map(row => row.totalCommission)) };
}
