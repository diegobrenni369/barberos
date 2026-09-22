"use client";

import { statuses, type AppointmentData } from "./appointment-dialog";
import { calendarDate } from "@/lib/agenda-navigation";

export function AppointmentDetails({ appointment, barberName, showDate = false }: { appointment: AppointmentData; barberName: string; showDate?: boolean }) {
  return <div className="space-y-3 text-sm">
    <div><p className="font-medium">{appointment.customerName}</p><p className="text-muted-foreground">{appointment.serviceName}</p></div>
    <div className="space-y-1">
      <p className="tabular-nums">{showDate && <>{new Intl.DateTimeFormat("es-CL", { weekday: "short", day: "numeric", month: "short" }).format(calendarDate(appointment.date))} · </>}{appointment.time}–{appointment.endTime}</p>
      <p className="text-muted-foreground">{barberName}</p>
    </div>
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span aria-hidden className="size-1.5 rounded-full bg-current" />{statuses.find(item => item.value === appointment.status)?.label ?? appointment.status}</span>
      <span className="tabular-nums">{new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(Number(appointment.price))}</span>
    </div>
  </div>;
}
