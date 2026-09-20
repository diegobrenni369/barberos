"use client";

import { useState } from "react";
import {
  AGENDA_END_HOUR,
  AGENDA_PIXELS_PER_MINUTE,
  AGENDA_SLOT_MINUTES,
  AGENDA_START_HOUR,
  AGENDA_TOP_GUTTER,
} from "@/lib/agenda";
import { AgendaToolbar } from "@/components/agenda/agenda-toolbar";
import { AppointmentCard } from "@/components/agenda/appointment-card";
import {
  AppointmentData,
  AppointmentDialog,
  AgendaOption,
  ServiceOption,
} from "@/components/agenda/appointment-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const HOUR_COLUMN_WIDTH = 68;
const BARBER_MIN_WIDTH = 220;
const totalMinutes = (AGENDA_END_HOUR - AGENDA_START_HOUR) * 60;
const gridHeight = totalMinutes * AGENDA_PIXELS_PER_MINUTE;

function formatTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AgendaView({
  date,
  today,
  nowMinutes,
  barbers,
  customers,
  services,
  appointments,
}: {
  date: string;
  today: string;
  showCancelled: boolean;
  nowMinutes: number | null;
  barbers: AgendaOption[];
  customers: AgendaOption[];
  services: ServiceOption[];
  appointments: AppointmentData[];
}) {
  const [dialog, setDialog] = useState<{
    appointment?: AppointmentData;
    time: string;
    barberId?: string;
  } | null>(null);
  const openNew = (barberId?: string, minutes = AGENDA_START_HOUR * 60) =>
    setDialog({ barberId, time: formatTime(minutes) });
  const slots = Array.from(
    { length: totalMinutes / AGENDA_SLOT_MINUTES + 1 },
    (_, index) => AGENDA_START_HOUR * 60 + index * AGENDA_SLOT_MINUTES,
  );
  const columnTemplate = `${HOUR_COLUMN_WIDTH}px repeat(${barbers.length}, minmax(${BARBER_MIN_WIDTH}px, 1fr))`;

  return (
    <div className="space-y-4">
      <AgendaToolbar date={date} today={today} onNew={() => openNew()} />
      {barbers.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          Agrega al menos un barbero activo para utilizar la agenda.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
          <div
            style={{
              width: "100%",
              minWidth: HOUR_COLUMN_WIDTH + barbers.length * BARBER_MIN_WIDTH,
            }}
          >
            <div
              className="sticky top-0 z-30 grid border-b bg-card/95 shadow-[0_1px_0_0_var(--border)] backdrop-blur"
              style={{ width: "100%", gridTemplateColumns: columnTemplate }}
            >
              <div className="flex h-11 items-center px-3 text-xs font-normal text-muted-foreground">
                Hora
              </div>
              {barbers.map((barber) => (
                <div
                  key={barber.id}
                  className="flex h-11 min-w-0 items-center gap-2 border-l px-3"
                >
                  <Avatar className="size-7 shrink-0">
                    <AvatarFallback className="text-[10px] font-medium">
                      {initials(barber.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-sm font-medium">
                    {barber.name}
                  </span>
                </div>
              ))}
            </div>
            <div
              className="relative grid"
              style={{
                width: "100%",
                gridTemplateColumns: columnTemplate,
                height: gridHeight + AGENDA_TOP_GUTTER,
              }}
            >
              <div className="pointer-events-none absolute inset-0 z-0">
                {slots.map((minutes) => (
                  <div
                    key={minutes}
                    className="absolute"
                    style={{
                      left: 0,
                      right: 0,
                      top:
                        AGENDA_TOP_GUTTER +
                        (minutes - AGENDA_START_HOUR * 60) *
                          AGENDA_PIXELS_PER_MINUTE,
                      borderTop:
                        minutes % 60 === 0
                          ? "1px solid var(--border)"
                          : "1px solid color-mix(in oklab, var(--border) 55%, transparent)",
                    }}
                  />
                ))}
              </div>
              <div className="relative border-r bg-muted/10">
                {slots.map((minutes) => (
                  <div
                    key={minutes}
                    className={`absolute right-2 -translate-y-1/2 tabular-nums font-normal ${minutes % 60 === 0 ? "text-xs text-muted-foreground" : "text-[11px] text-muted-foreground/60"}`}
                    style={{
                      top:
                        AGENDA_TOP_GUTTER +
                        (minutes - AGENDA_START_HOUR * 60) *
                          AGENDA_PIXELS_PER_MINUTE,
                    }}
                  >
                    {formatTime(minutes)}
                  </div>
                ))}
              </div>
              {barbers.map((barber) => (
                <div
                  key={barber.id}
                  className="relative min-w-0 border-r border-border/60 last:border-r-0"
                >
                  {slots.slice(0, -1).map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      aria-label={`Nueva reserva a las ${formatTime(minutes)} con ${barber.name}`}
                      onClick={() => openNew(barber.id, minutes)}
                      className="absolute transition-colors hover:bg-primary/[0.035] focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      style={{
                        left: 0,
                        right: 0,
                        top:
                          AGENDA_TOP_GUTTER +
                          (minutes - AGENDA_START_HOUR * 60) *
                            AGENDA_PIXELS_PER_MINUTE,
                        height: AGENDA_SLOT_MINUTES * AGENDA_PIXELS_PER_MINUTE,
                      }}
                    />
                  ))}
                  {appointments
                    .filter((item) => item.barberId === barber.id)
                    .map((item) => (
                      <AppointmentCard
                        key={item.id}
                        appointment={item}
                        onClick={() =>
                          setDialog({
                            appointment: item,
                            time: item.time,
                            barberId: item.barberId,
                          })
                        }
                      />
                    ))}
                  {nowMinutes !== null && (
                    <div
                      className="pointer-events-none absolute z-20 border-t border-destructive/80"
                      style={{
                        left: 0,
                        right: 0,
                        top:
                          AGENDA_TOP_GUTTER +
                          (nowMinutes - AGENDA_START_HOUR * 60) *
                            AGENDA_PIXELS_PER_MINUTE,
                      }}
                    >
                      <span className="absolute -top-1 -left-1 size-2 rounded-full bg-destructive" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {dialog && (
        <AppointmentDialog
          key={`${dialog.appointment?.id ?? "new"}-${dialog.barberId}-${dialog.time}`}
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          appointment={dialog.appointment}
          defaults={{ date, time: dialog.time, barberId: dialog.barberId }}
          barbers={barbers}
          customers={customers}
          services={services}
        />
      )}
    </div>
  );
}
