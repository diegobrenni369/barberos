"use client";

import { useState, useTransition } from "react";
import { CheckoutDialog } from "@/components/cash/checkout-dialog";
import { SaleDetails } from "@/components/cash/sale-details";
import { getAppointmentSale } from "@/app/actions/sale-details";
import { formatMoney, paymentMethods } from "@/lib/cash";
import { MoreHorizontal } from "lucide-react";
import { updateAppointment, restoreAppointment } from "@/app/actions/appointments";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { AppointmentData } from "./appointment-dialog";
import { AppointmentDetails } from "./appointment-details";

export function AppointmentQuickView({ appointment, barberName, onClose, onEdit }: { appointment: AppointmentData; barberName: string; onClose: () => void; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [saleDetail, setSaleDetail] = useState<Awaited<ReturnType<typeof getAppointmentSale>>>(null);
  const [saleError, setSaleError] = useState("");
  const canCharge = appointment.canCharge && !appointment.sale && ["SCHEDULED", "CONFIRMED", "COMPLETED"].includes(appointment.status);
  const actions = appointment.status === "SCHEDULED"
    ? [{ status: "CONFIRMED", label: "Confirmar" }, { status: "NO_SHOW", label: "No asistió" }, { status: "CANCELLED", label: "Cancelar reserva" }]
    : appointment.status === "CONFIRMED"
      ? [{ status: "NO_SHOW", label: "No asistió" }, { status: "CANCELLED", label: "Cancelar reserva" }]
      : [];

  function changeStatus(status: string) {
    const form = new FormData();
    for (const key of ["id", "barberId", "customerId", "serviceId", "date", "time", "notes"] as const) form.set(key, appointment[key]);
    form.set("status", status);
    form.set("intent", "status");
    startTransition(async () => {
      onClose();
      if (appointment.status === "CANCELLED") await restoreAppointment(form);
      else await updateAppointment(form);
    });
  }

  return <div className="space-y-4 px-5 py-4">
        <AppointmentDetails appointment={appointment} barberName={barberName} showDate />
        {appointment.sale && <p className="text-xs text-muted-foreground">{appointment.sale.paymentLabel}{appointment.sale.method && <> · {paymentMethods[appointment.sale.method]}</>} · {formatMoney(appointment.sale.total, appointment.sale.currency)}</p>}
        {appointment.sale && appointment.canCharge && <Button variant="outline" disabled={pending} onClick={() => startTransition(async () => {
          setSaleError("");
          try {
            const detail = await getAppointmentSale(appointment.id);
            if (detail) setSaleDetail(detail);
            else setSaleError("No se encontró la venta.");
          } catch { setSaleError("No se pudo cargar la venta. Intenta nuevamente."); }
        })}>Ver venta</Button>}
        {saleError && <p role="alert" className="text-xs text-destructive">{saleError}</p>}
        {saleDetail && <SaleDetails sale={saleDetail.sale} timezone={saleDetail.timezone} onClose={() => setSaleDetail(null)} />}
        {canCharge && <Button className="w-full" onClick={() => setCheckoutOpen(true)}>Cobrar</Button>}
        {canCharge && appointment.status === "COMPLETED" && <p className="text-xs text-muted-foreground">Atención completada sin cobro registrado.</p>}
        {checkoutOpen && !appointment.sale && <CheckoutDialog appointment={appointment} barberName={barberName} onClose={() => setCheckoutOpen(false)} />}
        <div className="flex items-center justify-between gap-2">
          {!appointment.sale && <Button variant="outline" onClick={onEdit} disabled={pending}>Editar reserva</Button>}
          {!appointment.sale && (actions.length > 0 || appointment.status === "CANCELLED") && <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Acciones de la reserva" disabled={pending} />}><MoreHorizontal /></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {actions.map(action => <DropdownMenuItem key={action.status} onClick={() => changeStatus(action.status)}>{action.label}</DropdownMenuItem>)}
              {appointment.status === "CANCELLED" && <DropdownMenuItem onClick={() => changeStatus("SCHEDULED")}>Restaurar reserva</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>}
        </div>
      </div>;
}
