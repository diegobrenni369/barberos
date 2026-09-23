"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkoutAppointment } from "@/app/actions/checkout";
import type { AppointmentData } from "@/components/agenda/appointment-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { formatMoney, paymentMethods, type CashPaymentMethod } from "@/lib/cash";

export function CheckoutDialog({ appointment, barberName, onClose }: { appointment: AppointmentData; barberName: string; onClose: () => void }) {
  const router = useRouter();
  const [discount, setDiscount] = useState("0");
  const [method, setMethod] = useState<CashPaymentMethod | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const submitting = useRef(false);
  const currency = appointment.currency;
  // Exact integer arithmetic for the CLP preview, never a source of server totals.
  const wholePrice = /^\d+(?:\.0+)?$/.test(appointment.price) ? BigInt(appointment.price.split(".")[0]) : null;
  const discountValue = /^\d{1,10}$/.test(discount) ? BigInt(discount) : null;
  const valid = wholePrice !== null && discountValue !== null && discountValue <= wholePrice;
  const total = valid ? (wholePrice - discountValue).toString() : null;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !valid || !method) return;
    submitting.current = true;
    setError("");
    startTransition(async () => {
      try {
        const result = await checkoutAppointment({ appointmentId: appointment.id, expectedUpdatedAt: appointment.updatedAt, discountAmount: discount, method });
        if (!result.ok) { setError(result.error); return; }
        router.refresh();
        onClose();
      } catch { setError("No se pudo confirmar el pago. Actualiza la agenda antes de reintentar."); }
      finally { submitting.current = false; }
    });
  }

  return <Dialog open onOpenChange={open => { if (!open && !pending) onClose(); }}>
    <DialogContent showCloseButton={!pending} className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto sm:max-w-md">
      <DialogHeader><DialogTitle>Cobrar atención</DialogTitle><DialogDescription>{appointment.customerName} · {barberName}</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {appointment.status === "COMPLETED" && <p className="text-xs text-muted-foreground">Atención completada sin venta registrada. Este cobro creará su venta y pago.</p>}
        <div className="flex justify-between gap-4 rounded-lg bg-muted/40 p-3"><span className="min-w-0 break-words">{appointment.serviceName}</span><span className="shrink-0 tabular-nums">{formatMoney(appointment.price, currency)}</span></div>
        <Separator />
        <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{formatMoney(appointment.price, currency)}</span></div>
        <div className="space-y-2"><div className="flex items-center justify-between gap-4"><Label htmlFor="checkout-discount">Descuento ({currency})</Label><Input id="checkout-discount" className="w-32 shrink-0 text-right tabular-nums" inputMode="numeric" value={discount} onChange={event => setDiscount(event.target.value)} disabled={pending} aria-invalid={!valid} /></div>{!valid && <p className="text-xs text-destructive">Usa pesos enteros entre cero y el subtotal.</p>}</div>
        <div className="flex items-center justify-between border-t pt-3 text-lg font-semibold"><span>Total</span><span className="tabular-nums">{total === null ? "—" : formatMoney(total, currency)}</span></div>
        <div className="space-y-2"><Label id="checkout-method-label">Método de pago</Label><Select value={method} onValueChange={value => setMethod(value)} disabled={pending}><SelectTrigger aria-labelledby="checkout-method-label" className="w-full"><SelectValue placeholder="Seleccionar método" /></SelectTrigger><SelectContent>{Object.entries(paymentMethods).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancelar</Button><Button type="submit" disabled={pending || !valid || !method}>{pending ? "Registrando…" : "Registrar pago"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
