"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getSalePaymentLabel } from "@/lib/sale-balance";
import { Separator } from "@/components/ui/separator";
import { formatMoney, paymentMethods, type SaleDetailsData } from "@/lib/cash";

export function SaleDetails({ sale, timezone, onClose }: { sale: SaleDetailsData; timezone: string; onClose: () => void }) {
  const money = (value: string) => formatMoney(value, sale.currency);
  return <Sheet open onOpenChange={open => { if (!open) onClose(); }}><SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-md"><SheetHeader><SheetTitle>{sale.customerName}</SheetTitle><SheetDescription>{new Intl.DateTimeFormat("es-CL", { timeZone: timezone, dateStyle: "medium", timeStyle: "short", hourCycle: "h23" }).format(new Date(sale.createdAt))} · {getSalePaymentLabel(sale)}</SheetDescription></SheetHeader><div className="space-y-5 overflow-y-auto px-5 pb-6 text-sm">
    {sale.items.map(item => <div key={item.id} className="flex justify-between gap-4"><span>{item.quantity} × {item.description}</span><span className="shrink-0 tabular-nums">{money(item.subtotal)}</span></div>)}
    <Separator /><dl className="space-y-2">{[["Subtotal", sale.subtotal], ["Descuento", sale.discountAmount], ["Total", sale.total]].map(([label, value]) => <div key={label} className={`flex justify-between ${label === "Total" ? "font-semibold" : "text-muted-foreground"}`}><dt>{label}</dt><dd className="tabular-nums">{money(value)}</dd></div>)}</dl><Separator />
    <section className="space-y-2"><h3 className="font-medium">Pago</h3>{sale.payments.map(payment => <div key={payment.id} className="flex justify-between"><span>{paymentMethods[payment.method]}</span><span className="tabular-nums">{money(payment.amount)}</span></div>)}</section>
    <section className="space-y-2"><h3 className="font-medium">Barbero</h3><p className="text-muted-foreground">{sale.barberName}</p>{sale.commission && <><div className="flex justify-between"><span>Comisión {sale.commission.rate}%</span><span className="tabular-nums">{money(sale.commission.amount)}</span></div><p className="text-xs text-muted-foreground">Sobre {money(sale.commission.baseAmount)} netos</p></>}</section>
  </div></SheetContent></Sheet>;
}
