"use client";

import { useId, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const policies = { NONE: "No requerir pago", OPTIONAL: "Pago opcional", FULL: "Pago completo", DEPOSIT: "Solicitar abono" };
type Policy = keyof typeof policies;
export function ServiceOnlineSettings({ enabled = false, policy = "NONE", deposit = "" }: { enabled?: boolean; policy?: Policy; deposit?: string }) {
  const id = useId();
  const [online, setOnline] = useState(enabled);
  const [payment, setPayment] = useState<Policy>(policy);
  return <section className="grid gap-3 border-t pt-4">
    <input type="hidden" name="isOnlineBookingEnabled" value={String(online)} />
    <input type="hidden" name="onlinePaymentPolicy" value={payment} />
    <div className="flex items-center justify-between gap-3"><Label htmlFor={`${id}-online`}>Disponible para reserva online</Label><Switch id={`${id}-online`} checked={online} onCheckedChange={setOnline} /></div>
    <div className="grid gap-2"><Label htmlFor={`${id}-policy`}>Pago al reservar</Label><Select value={payment} onValueChange={value => { if (value && value in policies) setPayment(value as Policy); }}><SelectTrigger id={`${id}-policy`} className="w-full"><SelectValue>{policies[payment]}</SelectValue></SelectTrigger><SelectContent>{Object.entries(policies).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
    {payment === "DEPOSIT" && <div className="grid gap-2"><Label htmlFor={`${id}-deposit`}>Monto del abono (CLP)</Label><Input id={`${id}-deposit`} name="depositAmount" type="number" min="1" step="1" required defaultValue={deposit} /></div>}
    {payment !== "NONE" && <p className="text-xs text-muted-foreground">Pago online próximamente. Este servicio no se publicará en la reserva online hasta habilitar los pagos.</p>}
  </section>;
}
