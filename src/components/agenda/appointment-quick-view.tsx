"use client";
import { semanticColors, paymentTone } from "@/lib/semantic-colors";
import { toast } from "sonner";

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
import { calendarDate } from "@/lib/agenda-navigation";
import { Separator } from "@/components/ui/separator";

export function AppointmentQuickView({ appointment, barberName, onClose, onEdit }: { appointment: AppointmentData; barberName: string; onClose: () => void; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [saleDetail, setSaleDetail] = useState<Awaited<ReturnType<typeof getAppointmentSale>>>(null);
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
        <div className="space-y-1 text-sm">
          <p className="break-words text-base font-semibold leading-snug">{appointment.customerName}</p>
          <p className="break-words text-muted-foreground">{appointment.serviceName}</p>
        </div>
        <Separator />
        <div className="space-y-1 text-sm">
          <p className="text-xs text-muted-foreground">Fecha y hora</p>
          <p>{new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(calendarDate(appointment.date))}</p>
          <p className="tabular-nums font-medium">{appointment.time}–{appointment.endTime}</p>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-sm">
          <div className="space-y-1"><p className="text-xs text-muted-foreground">Profesional</p><p className="break-words">{barberName}</p></div>
          <div className="space-y-1 text-right"><p className="text-xs text-muted-foreground">Precio</p><p className="tabular-nums font-medium">{formatMoney(appointment.price, appointment.currency)}</p></div>
        </div>
        <Separator />
        {appointment.customerConfirmedAt && <p className="text-xs text-muted-foreground">Cliente confirmó asistencia</p>}
        {appointment.sale && <p className="text-xs text-muted-foreground"><span className={semanticColors[paymentTone(appointment.sale.paymentLabel)].text}>{appointment.sale.paymentLabel}</span>{appointment.sale.method && <> · {paymentMethods[appointment.sale.method]}</>} · {formatMoney(appointment.sale.total, appointment.sale.currency)}</p>}
        {appointment.sale && appointment.canCharge && <Button variant="outline" disabled={pending} onClick={() => startTransition(async () => {
          try {
            const detail = await getAppointmentSale(appointment.id);
            if (detail) setSaleDetail(detail);
            else toast.error("No se encontró la venta.");
          } catch { toast.error("No se pudo cargar la venta. Intenta nuevamente."); }
        })}>Ver venta</Button>}
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
