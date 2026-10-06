"use client";
import { toast } from "sonner";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { payCommission } from "@/app/actions/commissions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";

export type CommissionLine = { date: string; customer: string; service: string; base: string; rate: string; amount: string; paid: boolean };
export function CommissionDetail({ name, period, sales, total, pending, lines, payment }: {
  name: string; period: string; sales: string; total: string; pending?: string; lines: CommissionLine[];
  payment?: { barberId: string; start: string; end: string };
}) {
  const [confirm, setConfirm] = useState(false);
  const [saving, startTransition] = useTransition();
  const router = useRouter();
  return <Sheet onOpenChange={() => { setConfirm(false); }}>
    <SheetTrigger render={<Button variant="outline" size="sm" />}>Ver detalle</SheetTrigger>
    <SheetContent className="data-[side=right]:sm:max-w-lg" style={{ width: "min(100vw, 32rem)" }}>
      <SheetHeader><SheetTitle>{name}</SheetTitle><SheetDescription>{period}</SheetDescription></SheetHeader>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-5">
        <dl className="grid grid-cols-2 gap-3 border-b pb-4 text-sm"><div><dt className="text-muted-foreground">Ventas netas</dt><dd className="font-medium tabular-nums">{sales}</dd></div><div><dt className="text-muted-foreground">Comisión</dt><dd className="font-medium tabular-nums">{total}</dd></div></dl>
        <div className="divide-y">{lines.map((line, index) => <div key={index} className="space-y-1 py-3 text-sm"><div className="flex justify-between gap-3"><span className="text-muted-foreground">{line.date}</span><span className="text-xs text-muted-foreground">{line.paid ? "Pagada" : "Pendiente"}</span></div><p className="break-words font-medium">{line.service}</p><p className="break-words text-xs text-muted-foreground">{line.customer}</p><div className="flex flex-wrap justify-between gap-2 tabular-nums"><span>{line.base} · {line.rate}%</span><span>{line.amount}</span></div></div>)}</div>
      </div>
      {payment && <div className="space-y-3 border-t p-5"><p className="text-sm">Pendiente: <strong>{pending}</strong></p>{confirm ? <><p className="text-sm text-muted-foreground">Confirma que ya pagaste estas comisiones. Se guardará una liquidación histórica; esto no realiza una transferencia.</p><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={saving} onClick={() => setConfirm(false)}>Volver</Button><Button disabled={saving} onClick={() => startTransition(async () => { try { const result = await payCommission(payment); if (!result.ok) toast.error(result.error); else { toast.success("Pago registrado."); setConfirm(false); router.refresh(); } } catch { toast.error("No se pudo registrar el pago."); } })}>{saving ? "Registrando…" : "Confirmar pago realizado"}</Button></div></> : <Button onClick={() => setConfirm(true)}>Marcar comisión como pagada</Button>}</div>}
    </SheetContent>
  </Sheet>;
}
