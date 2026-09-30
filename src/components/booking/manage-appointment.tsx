"use client";

import { useState, useTransition } from "react";
import { appointmentResponse } from "@/app/actions/appointment-response";
import { Button } from "@/components/ui/button";

export function ManageAppointment({ slug, token, confirmed, summary }: { slug: string; token: string; confirmed: boolean; summary: string }) {
  const [pending, startTransition] = useTransition();
  const [isConfirmed, setConfirmed] = useState(confirmed);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState(false);
  function respond(action: "confirm" | "cancel") {
    startTransition(async () => {
      setError(false);
      try {
        const result = await appointmentResponse(slug, token, action);
        if (!result.ok) { setError(true); return; }
        if (action === "confirm") setConfirmed(true);
        else setCancelled(true);
        setCancelling(false);
      } catch { setError(true); }
    });
  }
  if (cancelled) return <p role="status" className="text-sm">Tu reserva fue cancelada. El horario quedó disponible.</p>;
  return <div className="space-y-3">
    {error && <p role="alert" className="text-sm text-destructive">No pudimos realizar la acción. El enlace puede haber dejado de estar disponible. Actualiza la página o contacta a la barbería.</p>}
    {cancelling ? <div className="space-y-3 rounded-lg border border-border p-4">
      <h2 className="font-medium">¿Cancelar tu reserva?</h2>
      <p className="text-sm text-muted-foreground">{summary}</p>
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={pending} onClick={() => setCancelling(false)}>Volver</Button><Button variant="destructive" disabled={pending} onClick={() => respond("cancel")}>{pending ? "Cancelando…" : "Cancelar reserva"}</Button></div>
    </div> : <>
      {isConfirmed ? <p role="status" className="text-sm">Ya confirmaste tu asistencia. ¡Te esperamos!</p> : <Button className="w-full" disabled={pending} onClick={() => respond("confirm")}>{pending ? "Confirmando…" : "Confirmar asistencia"}</Button>}
      <Button variant="outline" className="w-full" disabled={pending} onClick={() => setCancelling(true)}>Cancelar reserva</Button>
    </>}
  </div>;
}
