"use client";

import { useState, useTransition } from "react";
import { createAgendaCustomer } from "@/app/actions/customers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateCustomerDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (customer: { id: string; name: string }) => void }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return <Dialog open onOpenChange={open => { if (!open && !pending) onClose(); }}>
    <DialogContent className="sm:max-w-sm" showCloseButton={!pending}>
      <DialogHeader><DialogTitle>Crear cliente nuevo</DialogTitle><DialogDescription>Si el teléfono ya existe, usaremos ese cliente.</DialogDescription></DialogHeader>
      <form onSubmit={event => {
        event.preventDefault(); event.stopPropagation();
        if (pending) return;
        const data = new FormData(event.currentTarget);
        setError("");
        startTransition(async () => {
          try {
            const result = await createAgendaCustomer(data);
            if (result.customer) onCreated(result.customer);
            else setError(result.error || "No se pudo guardar el cliente.");
          } catch { setError("No se pudo guardar el cliente. Intenta nuevamente."); }
        });
      }} className="space-y-4">
        <div className="grid gap-2"><Label htmlFor="agenda-customer-name">Nombre</Label><Input id="agenda-customer-name" name="name" autoComplete="name" required minLength={2} maxLength={100} disabled={pending} /></div>
        <div className="grid gap-2"><Label htmlFor="agenda-customer-phone">Teléfono</Label><Input id="agenda-customer-phone" name="phone" type="tel" autoComplete="tel" required maxLength={30} disabled={pending} /></div>
        <div className="grid gap-2"><Label htmlFor="agenda-customer-email">Email (opcional)</Label><Input id="agenda-customer-email" name="email" type="email" autoComplete="email" maxLength={254} disabled={pending} /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar cliente"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
