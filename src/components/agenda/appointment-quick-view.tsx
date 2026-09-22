"use client";

import { useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import { updateAppointment, restoreAppointment } from "@/app/actions/appointments";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { AppointmentData } from "./appointment-dialog";
import { AppointmentDetails } from "./appointment-details";

export function AppointmentQuickView({ appointment, barberName, onClose, onEdit }: { appointment: AppointmentData; barberName: string; onClose: () => void; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();
  const actions = appointment.status === "SCHEDULED"
    ? [{ status: "CONFIRMED", label: "Confirmar" }, { status: "COMPLETED", label: "Marcar completada" }, { status: "NO_SHOW", label: "No asistió" }, { status: "CANCELLED", label: "Cancelar reserva" }]
    : appointment.status === "CONFIRMED"
      ? [{ status: "COMPLETED", label: "Marcar completada" }, { status: "NO_SHOW", label: "No asistió" }, { status: "CANCELLED", label: "Cancelar reserva" }]
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
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" onClick={onEdit} disabled={pending}>Editar reserva</Button>
          {(actions.length > 0 || appointment.status === "CANCELLED") && <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Acciones de la reserva" disabled={pending} />}><MoreHorizontal /></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {actions.map(action => <DropdownMenuItem key={action.status} onClick={() => changeStatus(action.status)}>{action.label}</DropdownMenuItem>)}
              {appointment.status === "CANCELLED" && <DropdownMenuItem onClick={() => changeStatus("SCHEDULED")}>Restaurar reserva</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>}
        </div>
      </div>;
}
