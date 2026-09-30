import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { commissionPeriod, getCommissions, sumMoney, SettlementError } from "@/lib/commissions";
import { formatMoney } from "@/lib/cash";
import { PageHeader } from "@/components/page-header";
import { CommissionPeriodFilter } from "@/components/commissions/period-filter";
import { CommissionDetail } from "@/components/commissions/commission-detail";

export default async function CommissionsPage({ searchParams }: { searchParams: Promise<{ period?: string; start?: string; end?: string; barber?: string }> }) {
  const membership = await requireRole("OWNER");
  const query = await searchParams;
  const shop = membership.barbershop;
  let period;
  try { period = commissionPeriod(shop.timezone, query); }
  catch (error) { return <section className="space-y-4"><PageHeader title="Comisiones" description="Revisa el período seleccionado." /><p role="alert">{error instanceof SettlementError ? error.message : "Período inválido"}</p><Link href="/commissions">Volver a este mes</Link></section>; }
  const report = await getCommissions(prisma, shop.id, period);
  const money = (value: { toString(): string }, currency = shop.currency) => formatMoney(value.toString(), currency);
  const date = (value: Date) => new Intl.DateTimeFormat("es-CL", { timeZone: shop.timezone, day: "numeric", month: "short", year: "numeric" }).format(value);
  const label = `${date(period.from)} – ${date(new Date(period.to.getTime() - 1))}`;
  const ids = [...new Set([...report.rows.map(row => row.barberId), ...report.settlements.map(row => row.barberId)])];
  return <section className="space-y-6">
    <PageHeader title="Comisiones" description="Comisiones históricas y pagos a profesionales." />
    <CommissionPeriodFilter key={`${query.period}-${period.start}-${period.end}`} initialPeriod={query.period ?? "current"} start={period.start} end={period.end} />
    <p className="text-sm text-muted-foreground">{label}. Ventas y pendientes por fecha de venta; pagado por fecha de liquidación.</p>
    <dl className="grid grid-cols-2 gap-4 rounded-xl border p-4 md:grid-cols-4">{[["Ventas netas", report.sales], ["Comisiones", report.commission], ["Pendiente", report.pending], ["Pagado", report.paid]].map(([title, value]) => <div key={String(title)}><dt className="text-xs text-muted-foreground">{String(title)}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{money(value)}</dd></div>)}</dl>
    <section className="space-y-3"><h2 className="font-medium">Equipo</h2>{query.barber && <Link className="text-sm underline" href="/commissions">Ver todo el equipo</Link>}
      <div className="divide-y rounded-xl border">{ids.filter(id => !query.barber || query.barber === id).map(id => {
        const rows = report.rows.filter(row => row.barberId === id);
        const pending = rows.filter(row => row.settlementItem?.settlement.status !== "PAID");
        const name = rows[0]?.barber.name ?? report.settlements.find(row => row.barberId === id)!.barberName;
        const sales = money(sumMoney(rows.map(row => row.baseAmount)));
        const total = money(sumMoney(rows.map(row => row.amount)));
        return <div key={id} className="flex flex-wrap items-center justify-between gap-4 p-4"><div className="min-w-0"><h3 className="break-words font-medium">{name}</h3><p className="text-xs text-muted-foreground">{rows.length} atenciones · {pending.length ? pending.length === rows.length ? "Pendiente" : "Parcialmente pagado" : "Pagado"}</p></div><div className="flex flex-wrap items-center gap-5 text-sm"><div><p className="text-xs text-muted-foreground">Ventas netas</p><p className="tabular-nums">{sales}</p></div><div><p className="text-xs text-muted-foreground">Comisión</p><p className="tabular-nums">{total}</p></div><CommissionDetail name={name} period={label} sales={sales} total={total} pending={money(sumMoney(pending.map(row => row.amount)))} payment={pending.some(row => !row.settlementItem) ? { barberId: id, start: period.start, end: period.end } : undefined} lines={rows.map(row => ({ date: date(row.sale.createdAt), customer: row.sale.customerName, service: row.sale.items.map(item => item.description).join(" · "), base: money(row.baseAmount), rate: row.rate.toString(), amount: money(row.amount), paid: row.settlementItem?.settlement.status === "PAID" }))} /></div></div>;
      })}{ids.length === 0 && <p className="p-5 text-sm text-muted-foreground">No hay comisiones en este período.</p>}</div>
    </section>
    <section className="space-y-3"><h2 className="font-medium">Liquidaciones pagadas en el período</h2><div className="divide-y rounded-xl border">{report.settlements.filter(row => !query.barber || row.barberId === query.barber).map(row => <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-medium">{row.barberName}</p><p className="text-xs text-muted-foreground">Pagada el {date(row.paidAt!)} · {money(row.totalCommission, row.currency)}</p></div><CommissionDetail name={row.barberName} period={`${date(row.periodStart)} – ${date(new Date(row.periodEnd.getTime() - 1))} · Pagada`} sales={money(row.totalSales, row.currency)} total={money(row.totalCommission, row.currency)} lines={row.items.map(item => ({ date: date(item.saleAt), customer: item.customerName, service: item.description, base: money(item.baseAmount, row.currency), rate: item.rate.toString(), amount: money(item.amount, row.currency), paid: true }))} /></div>)}{report.settlements.length === 0 && <p className="p-5 text-sm text-muted-foreground">No hay liquidaciones pagadas en este período.</p>}</div></section>
  </section>;
}
