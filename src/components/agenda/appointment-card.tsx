"use client";

import { semanticColors } from "@/lib/semantic-colors";

import { EVENT_INSET } from "./event-spacing";

import { AppointmentData } from "@/components/agenda/appointment-dialog";
import { AGENDA_PIXELS_PER_MINUTE, AGENDA_TOP_GUTTER } from "@/lib/agenda";

export const appointmentStatusStyles: Record<string, { label: string; card: string; indicator: string; badge: string }> = {
  SCHEDULED: {
    label: "Agendada",
    card: `${semanticColors.blue.tint} hover:bg-blue-50/80 dark:hover:bg-blue-950/30`,
    indicator: semanticColors.blue.indicator,
    badge: semanticColors.blue.tint + " " + semanticColors.blue.text,
  },
  CONFIRMED: {
    label: "Confirmada",
    card: `${semanticColors.green.tint} hover:bg-emerald-50/80 dark:hover:bg-emerald-950/30`,
    indicator: semanticColors.green.indicator,
    badge: semanticColors.green.tint + " " + semanticColors.green.text,
  },
  COMPLETED: {
    label: "Completada",
    card: `${semanticColors.green.tint} hover:bg-emerald-50/80 dark:hover:bg-emerald-950/30`,
    indicator: semanticColors.green.indicator,
    badge: semanticColors.green.tint + " " + semanticColors.green.text,
  },
  CANCELLED: {
    label: "Cancelada",
    card: `${semanticColors.red.tint} border-dashed opacity-75 hover:bg-red-50/80 dark:hover:bg-red-950/30`,
    indicator: semanticColors.red.indicator,
    badge: semanticColors.red.tint + " " + semanticColors.red.text,
  },
  NO_SHOW: {
    label: "No asistió",
    card: `${semanticColors.amber.tint} hover:bg-amber-50/80 dark:hover:bg-amber-950/30`,
    indicator: semanticColors.amber.indicator,
    badge: semanticColors.amber.tint + " " + semanticColors.amber.text,
  },
};

export function AppointmentCard({ appointment, gridStartMinute, onClick, ...buttonProps }: { appointment: AppointmentData; gridStartMinute: number; onClick: () => void } & Omit<React.ComponentPropsWithRef<"button">, "onClick">) {
  const [hour, minute] = appointment.time.split(":").map(Number);
  const [endHour, endMinute] = appointment.endTime.split(":").map(Number);
  const start = hour * 60 + minute;
  const duration = endHour * 60 + endMinute - start;
  const compact = duration <= 30;
  const statusStyle = appointmentStatusStyles[appointment.status] ?? appointmentStatusStyles.COMPLETED;

  return <button {...buttonProps} type="button" onClick={onClick} className="absolute z-10 overflow-hidden rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" style={{ left: EVENT_INSET, right: EVENT_INSET, paddingTop: EVENT_INSET, paddingBottom: EVENT_INSET, top: AGENDA_TOP_GUTTER + (start - gridStartMinute) * AGENDA_PIXELS_PER_MINUTE, height: duration * AGENDA_PIXELS_PER_MINUTE }}><div className={`h-full overflow-hidden rounded-md border transition-colors ${statusStyle.card}`}>{compact ? <div className="flex h-full min-w-0 items-center justify-between gap-2 px-2"><div className="min-w-0 truncate text-xs"><span className="font-medium text-foreground">{appointment.customerName}</span><span className="text-muted-foreground"> · {appointment.serviceName}</span></div><span className="shrink-0 tabular-nums text-[11px] text-foreground/70">{appointment.time}–{appointment.endTime}</span></div> : <div className="grid h-full min-w-0 grid-cols-[minmax(0,1fr)_auto] content-center gap-x-3 gap-y-1 px-2.5 py-1.5"><div className="truncate text-sm font-medium leading-tight">{appointment.customerName}</div><div className="self-center whitespace-nowrap tabular-nums text-xs text-foreground/70">{appointment.time}–{appointment.endTime}</div><div className="truncate text-xs leading-tight text-muted-foreground">{appointment.serviceName}</div><div className="flex items-center gap-1 self-center whitespace-nowrap text-[10px] text-muted-foreground"><span className={`size-1.5 rounded-full ${statusStyle.indicator}`} />{statusStyle.label}</div></div>}</div></button>;
}
