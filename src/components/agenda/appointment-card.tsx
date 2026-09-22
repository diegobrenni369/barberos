"use client";

import { AppointmentData } from "@/components/agenda/appointment-dialog";
import { AGENDA_PIXELS_PER_MINUTE, AGENDA_TOP_GUTTER } from "@/lib/agenda";

const appointmentStatusStyles: Record<string, { label: string; card: string; indicator: string }> = {
  SCHEDULED: {
    label: "Agendada",
    card: "border-blue-200/70 bg-blue-50/60 hover:bg-blue-50/80 dark:border-blue-800/50 dark:bg-blue-950/20 dark:hover:bg-blue-950/30",
    indicator: "bg-blue-500 dark:bg-blue-400",
  },
  CONFIRMED: {
    label: "Confirmada",
    card: "border-emerald-200/70 bg-emerald-50/60 hover:bg-emerald-50/80 dark:border-emerald-800/50 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30",
    indicator: "bg-emerald-500 dark:bg-emerald-400",
  },
  COMPLETED: {
    label: "Completada",
    card: "border-border bg-muted/50 hover:bg-muted/70",
    indicator: "bg-slate-400 dark:bg-slate-500",
  },
  CANCELLED: {
    label: "Cancelada",
    card: "border-dashed border-red-200/70 bg-red-50/60 opacity-75 hover:bg-red-50/80 dark:border-red-800/50 dark:bg-red-950/20 dark:hover:bg-red-950/30",
    indicator: "bg-red-500 dark:bg-red-400",
  },
  NO_SHOW: {
    label: "No asistió",
    card: "border-amber-200/70 bg-amber-50/60 hover:bg-amber-50/80 dark:border-amber-800/50 dark:bg-amber-950/20 dark:hover:bg-amber-950/30",
    indicator: "bg-amber-500 dark:bg-amber-400",
  },
};

export function AppointmentCard({ appointment, gridStartMinute, onClick, ...buttonProps }: { appointment: AppointmentData; gridStartMinute: number; onClick: () => void } & Omit<React.ComponentPropsWithRef<"button">, "onClick">) {
  const [hour, minute] = appointment.time.split(":").map(Number);
  const [endHour, endMinute] = appointment.endTime.split(":").map(Number);
  const start = hour * 60 + minute;
  const duration = endHour * 60 + endMinute - start;
  const compact = duration <= 30;
  const statusStyle = appointmentStatusStyles[appointment.status] ?? appointmentStatusStyles.COMPLETED;

  return <button {...buttonProps} type="button" onClick={onClick} className={`absolute z-10 overflow-hidden rounded-md border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${statusStyle.card}`} style={{ left: 4, right: 4, top: AGENDA_TOP_GUTTER + (start - gridStartMinute) * AGENDA_PIXELS_PER_MINUTE, height: duration * AGENDA_PIXELS_PER_MINUTE }}>{compact ? <div className="flex h-full min-w-0 items-center justify-between gap-2 px-2"><div className="min-w-0 truncate text-xs"><span className="font-medium text-foreground">{appointment.customerName}</span><span className="text-muted-foreground"> · {appointment.serviceName}</span></div><span className="shrink-0 tabular-nums text-[11px] text-foreground/70">{appointment.time}–{appointment.endTime}</span></div> : <div className="grid h-full min-w-0 grid-cols-[minmax(0,1fr)_auto] content-center gap-x-3 gap-y-1 px-2.5 py-1.5"><div className="truncate text-sm font-medium leading-tight">{appointment.customerName}</div><div className="self-center whitespace-nowrap tabular-nums text-xs text-foreground/70">{appointment.time}–{appointment.endTime}</div><div className="truncate text-xs leading-tight text-muted-foreground">{appointment.serviceName}</div><div className="flex items-center gap-1 self-center whitespace-nowrap text-[10px] text-muted-foreground"><span className={`size-1.5 rounded-full ${statusStyle.indicator}`} />{statusStyle.label}</div></div>}</button>;
}
