import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { mobileResponse, resolveMobileAccess, mobileBarberInput } from "@/lib/mobile-auth";
import { commissionPeriod, getCommissions, sumMoney, SettlementError } from "@/lib/commissions";
import { utcToZonedParts } from "@/lib/agenda";

export const runtime = "nodejs";
const input = z.object({ barberId: z.string().min(1).max(100), period: z.enum(["week", "previous-week", "fortnight", "month", "custom"]).optional(), from: z.string().optional(), to: z.string().optional() });

export async function GET(request: Request) {
  try {
    const access = await resolveMobileAccess(request);
    if (!access) return mobileResponse({ error: "Sesión no válida." }, 401);
    const query = input.parse(mobileBarberInput(access, Object.fromEntries(new URL(request.url).searchParams)));
    const { barbershopId, barbershop } = access.membership;
    const barber = await prisma.barber.findFirst({ where: { id: query.barberId, barbershopId, isActive: true }, select: { id: true, name: true } });
    if (!barber) return mobileResponse({ error: "Profesional no encontrado." }, 404);
    const today = utcToZonedParts(new Date(), barbershop.timezone).date;
    let start = query.from, end = query.to;
    const kind = query.period ?? (start || end ? "custom" : "month");
    if (kind === "week" || kind === "previous-week") {
      const day = new Date(`${today}T12:00:00Z`);
      day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7 - (kind === "previous-week" ? 7 : 0));
      start = day.toISOString().slice(0, 10);
      day.setUTCDate(day.getUTCDate() + 6); end = day.toISOString().slice(0, 10);
    } else if (kind === "fortnight") {
      const second = Number(today.slice(8)) > 15;
      start = `${today.slice(0, 7)}-${second ? "16" : "01"}`;
      const last = new Date(`${today.slice(0, 7)}-01T12:00:00Z`);
      last.setUTCMonth(last.getUTCMonth() + 1); last.setUTCDate(0);
      end = second ? last.toISOString().slice(0, 10) : `${today.slice(0, 7)}-15`;
    }
    const period = commissionPeriod(barbershop.timezone, kind === "month" ? {} : { period: "custom", start, end });
    const [report, shop] = await Promise.all([
      getCommissions(prisma, barbershopId, period, barber.id),
      prisma.barbershop.findUniqueOrThrow({ where: { id: barbershopId }, select: { currency: true } }),
    ]);
    const eligible = report.rows.filter(row => !row.settlementItem);
    return mobileResponse({ barber, timezone: barbershop.timezone, currency: shop.currency, from: period.start, to: period.end,
      settlement: access.role === "OWNER" ? { count: eligible.length, total: sumMoney(eligible.map(row => row.amount)).toString() } : null,
      summary: { sales: report.sales.toString(), generated: report.commission.toString(), pending: report.pending.toString(), paid: report.paid.toString() },
      rows: report.rows.slice().reverse().map(row => ({ id: row.id, date: row.sale.createdAt.toISOString(), service: row.sale.items.map(item => item.description).join(" · "), customer: row.sale.customerName, base: row.baseAmount.toString(), rate: row.rate.toString(), amount: row.amount.toString(), currency: row.sale.currency, paid: row.settlementItem?.settlement.status === "PAID" })),
    });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SettlementError) return mobileResponse({ error: "Selecciona un profesional y un rango de fechas válido." }, 400);
    return mobileResponse({ error: "No se pudieron cargar las comisiones." }, 503);
  }
}
