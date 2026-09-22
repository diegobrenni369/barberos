"use client";

import { useState } from "react";
import {
  AGENDA_PIXELS_PER_MINUTE,
  AGENDA_SLOT_MINUTES,
  AGENDA_TOP_GUTTER,
} from "@/lib/agenda";
import { AgendaToolbar } from "@/components/agenda/agenda-toolbar";
import { AvailabilityInterval, AvailabilityLayer, isSlotAvailable } from "@/components/agenda/availability-layer";
import { AppointmentCard } from "@/components/agenda/appointment-card";
import { BarberBlock, BarberBlockData } from "@/components/agenda/barber-block";
import { BarberBreak, BarberBreakData } from "@/components/agenda/barber-break";
import { BarberBlockDialog } from "@/components/agenda/barber-block-dialog";
import {
  AppointmentData,
  AppointmentDialog,
  AgendaOption,
  ServiceOption,
} from "@/components/agenda/appointment-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CalendarPlus, LockKeyhole } from "lucide-react";

const HOUR_COLUMN_WIDTH = 68;
const BARBER_MIN_WIDTH = 220;
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
  availability,
  recurringBreaks,
  blocks,
  reasons,
  startMinute,
  endMinute,
}: {
  date: string;
  today: string;
  showCancelled: boolean;
  nowMinutes: number | null;
  barbers: AgendaOption[];
  customers: AgendaOption[];
  services: ServiceOption[];
  appointments: AppointmentData[];
  availability: { barberId: string; configured: boolean; intervals: AvailabilityInterval[] }[];
  recurringBreaks: BarberBreakData[];
  blocks: BarberBlockData[];
  reasons: AgendaOption[];
  startMinute: number;
  endMinute: number;
}) {
  const totalMinutes = endMinute - startMinute;
  const gridHeight = totalMinutes * AGENDA_PIXELS_PER_MINUTE;
  const [dialog, setDialog] = useState<{
    appointment?: AppointmentData;
    time: string;
    barberId?: string;
  } | null>(null);
  const [blockDialog, setBlockDialog] = useState<{ block?: BarberBlockData; barberId: string; time: string } | null>(null);
  const openNew = (barberId?: string, minutes = startMinute) =>
    setDialog({ barberId, time: formatTime(minutes) });
  const slots = Array.from(
    { length: Math.ceil(totalMinutes / AGENDA_SLOT_MINUTES) + 1 },
    (_, index) => Math.min(startMinute + index * AGENDA_SLOT_MINUTES, endMinute),
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
                        (minutes - startMinute) *
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
                        (minutes - startMinute) *
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
                  <AvailabilityLayer intervals={availability.find((item) => item.barberId === barber.id)?.intervals ?? []} start={startMinute} end={endMinute} />
                  {slots.slice(0, -1).filter((minutes) => {
                    const duration = Math.min(AGENDA_SLOT_MINUTES, endMinute - minutes);
                    const overlaps = (start: number, end: number) => start < minutes + duration && end > minutes;
                    return isSlotAvailable(availability.find((item) => item.barberId === barber.id)?.intervals ?? [], minutes, duration)
                      && !recurringBreaks.some((item) => item.barberId === barber.id && overlaps(item.startMinute, item.endMinute))
                      && !blocks.some((item) => item.barberId === barber.id && (item.allDay || overlaps(toMinutes(item.startTime), toMinutes(item.endTime))))
                      && !appointments.some((item) => item.barberId === barber.id && item.status !== "CANCELLED" && overlaps(toMinutes(item.time), toMinutes(item.endTime)));
                  }).map((minutes) => (
                    <DropdownMenu key={minutes}>
                      <DropdownMenuTrigger
                        nativeButton
                        render={<button type="button" aria-label={`Acciones a las ${formatTime(minutes)} con ${barber.name}`} className="absolute z-[2] transition-colors hover:bg-primary/[0.035] focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" style={{ left: 0, right: 0, top: AGENDA_TOP_GUTTER + (minutes - startMinute) * AGENDA_PIXELS_PER_MINUTE, height: Math.min(AGENDA_SLOT_MINUTES, endMinute - minutes) * AGENDA_PIXELS_PER_MINUTE }} />}
                      />
                      <DropdownMenuContent align="start" className="w-auto min-w-[160px]">
                        <DropdownMenuItem onClick={() => openNew(barber.id, minutes)}><CalendarPlus />Nueva reserva</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setBlockDialog({ barberId: barber.id, time: formatTime(minutes) })}><LockKeyhole />Bloquear horario</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ))}
                  {recurringBreaks.filter((item) => item.barberId === barber.id).map((item) => <BarberBreak key={item.id} item={item} gridStartMinute={startMinute} gridEndMinute={endMinute} />)}
                  {blocks.filter((item) => item.barberId === barber.id).map((block) => <BarberBlock key={block.id} block={block} gridStartMinute={startMinute} gridEndMinute={endMinute} onClick={() => setBlockDialog({ block, barberId: block.barberId, time: block.startTime })} />)}
                  {appointments
                    .filter((item) => item.barberId === barber.id)
                    .map((item) => (
                      <AppointmentCard
                        key={item.id}
                        appointment={item}
                        gridStartMinute={startMinute}
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
                          (nowMinutes - startMinute) *
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
      {blockDialog && <BarberBlockDialog key={blockDialog.block?.id ?? `${blockDialog.barberId}-${blockDialog.time}`} open onOpenChange={(open) => { if (!open) setBlockDialog(null); }} block={blockDialog.block} defaults={{ barberId: blockDialog.barberId, date, startTime: blockDialog.time, endTime: formatTime(Math.min(toMinutes(blockDialog.time) + 30, endMinute)) }} barbers={barbers} reasons={reasons} />}
    </div>
  );
}

function toMinutes(time: string) { const [hour, minute] = time.split(":").map(Number); return hour * 60 + minute; }
