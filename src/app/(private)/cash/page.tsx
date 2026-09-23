import Link from "next/link";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dayRangeUtc, utcToZonedParts } from "@/lib/agenda";
import { paymentMethods, type CashPaymentMethod, type SaleDetailsData } from "@/lib/cash";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { CashSummary } from "@/components/cash/cash-summary";
import { SalesTable } from "@/components/cash/sales-table";

export default async function CashPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const membership = await requireRole("OWNER");
  const { timezone, currency } = membership.barbershop;
  const params = await searchParams;
  const today = utcToZonedParts(new Date(), timezone).date;
  const parsed = z.iso.date().safeParse(params.date);
  const date = parsed.success ? parsed.data : today;
  const range = dayRangeUtc(date, timezone);
  const sales = await prisma.sale.findMany({ where: { barbershopId: membership.barbershopId, status: "COMPLETED", createdAt: { gte: range.start, lt: range.end } }, include: { items: true, payments: true, commission: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  const total = sales.reduce((sum, sale) => sum.plus(sale.total), new Prisma.Decimal(0));
  const methods = Object.fromEntries(Object.keys(paymentMethods).map(method => [method, sales.flatMap(sale => sale.payments).filter(payment => payment.method === method).reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0)).toString()])) as Record<CashPaymentMethod, string>;
  const serialized: SaleDetailsData[] = sales.map(sale => ({ ...sale, createdAt: sale.createdAt.toISOString(), subtotal: sale.subtotal.toString(), discountAmount: sale.discountAmount.toString(), total: sale.total.toString(), items: sale.items.map(item => ({ ...item, unitPrice: item.unitPrice.toString(), subtotal: item.subtotal.toString() })), payments: sale.payments.map(payment => ({ id: payment.id, method: payment.method, amount: payment.amount.toString() })), commission: sale.commission ? { rate: sale.commission.rate.toString(), baseAmount: sale.commission.baseAmount.toString(), amount: sale.commission.amount.toString() } : null }));
  function shifted(offset: number) { const next = new Date(`${date}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + offset); return `/cash?date=${next.toISOString().slice(0, 10)}`; }
  const label = new Intl.DateTimeFormat("es-CL", { timeZone: "UTC", dateStyle: "long" }).format(new Date(`${date}T12:00:00Z`));
  return <section className="space-y-6"><PageHeader title="Caja" description="Ventas y pagos registrados en tu barbería." /><div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="icon" nativeButton={false} render={<Link href={shifted(-1)} aria-label="Día anterior" />}><ChevronLeft /></Button><Button variant="outline" nativeButton={false} render={<Link href={`/cash?date=${today}`} />}>Hoy</Button><Button variant="outline" size="icon" nativeButton={false} render={<Link href={shifted(1)} aria-label="Día siguiente" />}><ChevronRight /></Button><span className="ml-2 text-sm text-muted-foreground">{label}</span></div><CashSummary total={total.toString()} methods={methods} currency={currency} /><div className="space-y-3"><h2 className="text-base font-medium">Ventas del día</h2><SalesTable sales={serialized} timezone={timezone} /></div></section>;
}
