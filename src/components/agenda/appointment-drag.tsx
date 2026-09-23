"use client";

import { createContext, useContext, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { DragDropProvider, DragOverlay, useDroppable, useDragOperation } from "@dnd-kit/react";
import { PointerSensor, PointerActivationConstraints } from "@dnd-kit/dom";
import { pointerIntersection } from "@dnd-kit/collision";
import { moveAppointment } from "@/app/actions/move-appointment";
import { AGENDA_PIXELS_PER_MINUTE, AGENDA_SLOT_MINUTES, AGENDA_TOP_GUTTER } from "@/lib/agenda";
import { dragTime, snapAgendaMinute } from "@/lib/appointment-drag";
import type { AppointmentData, ServiceOption } from "./appointment-dialog";
import type { AvailabilityInterval } from "./availability-layer";
import type { BarberBreakData } from "./barber-break";
import type { BarberBlockData } from "./barber-block";

const DragPending = createContext(false);
const ServiceEligibility = createContext<ServiceOption[]>([]);
export const useAppointmentDragPending = () => useContext(DragPending);
const sensors = [PointerSensor.configure({
  preventActivation: event => event.pointerType !== "mouse" || event.button !== 0,
  activationConstraints: [new PointerActivationConstraints.Distance({ value: 8 })],
})];

export function AppointmentDragProvider({ children, date, appointments, services }: { children: ReactNode; date: string; appointments: AppointmentData[]; services: ServiceOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  return <ServiceEligibility.Provider value={services}><DragPending.Provider value={pending}><DragDropProvider sensors={sensors}
    onDragStart={() => setMessage("")}
    onDragEnd={event => {
      if (event.canceled || lock.current) return;
      const { source, target } = event.operation;
      const appointment = appointments.find(item => item.id === source?.id);
      if (!appointment) return;
      if (!target || target.data.valid !== true) { setMessage(target?.data.eligible === false ? "Este profesional no realiza este servicio." : "No disponible en ese horario. La reserva no se movió."); return; }
      const barberId = target.data.barberId;
      const minute = target.data.minute;
      if (typeof barberId !== "string" || typeof minute !== "number") return;
      const time = dragTime(minute);
      if (barberId === appointment.barberId && time === appointment.time) return;
      lock.current = true;
      startTransition(async () => {
        try {
          const result = await moveAppointment({ id: appointment.id, barberId, date, time, expectedUpdatedAt: appointment.updatedAt });
          setMessage(result.ok ? "" : result.error ?? "No se pudo mover la reserva.");
          router.refresh();
        } catch {
          setMessage("No se pudo confirmar el movimiento. Actualizando la agenda…");
          router.refresh();
        } finally { lock.current = false; }
      });
    }}>
    {children}
    <DragOverlay dropAnimation={null}>{source => {
      const item = appointments.find(appointment => appointment.id === source.id);
      return item ? <div className="pointer-events-none rounded-md border bg-card/90 px-3 py-2 text-xs shadow-sm"><p className="truncate font-medium">{item.customerName}</p><p className="text-muted-foreground">{item.serviceName} · {item.durationMinutes} min</p></div> : null;
    }}</DragOverlay>
    {(message || pending) && <p role="status" className="fixed bottom-4 left-1/2 z-[60] max-w-[90vw] -translate-x-1/2 rounded-lg border bg-popover px-4 py-2 text-sm shadow-sm">{pending ? "Guardando movimiento…" : message}</p>}
  </DragDropProvider></DragPending.Provider></ServiceEligibility.Provider>;
}

export function AppointmentDropSlot({ barberId, minute, gridStart, gridEnd, intervals, breaks, blocks, appointments }: {
  barberId: string; minute: number; gridStart: number; gridEnd: number;
  intervals: AvailabilityInterval[]; breaks: BarberBreakData[]; blocks: BarberBlockData[]; appointments: AppointmentData[];
}) {
  const { source } = useDragOperation();
  const services = useContext(ServiceEligibility);
  const appointment = appointments.find(item => item.id === source?.id);
  const eligible = Boolean(appointment && services.find(item => item.id === appointment.serviceId)?.barberIds.includes(barberId));
  const start = snapAgendaMinute(minute, gridStart);
  const end = start + (appointment?.durationMinutes ?? AGENDA_SLOT_MINUTES);
  const overlaps = (from: number, to: number) => from < end && to > start;
  const toMinute = (time: string) => { const [h, m] = time.split(":").map(Number); return h * 60 + m; };
  const valid = eligible && end <= gridEnd && intervals.some(item => item.startMinute <= start && item.endMinute >= end)
    && !breaks.some(item => item.barberId === barberId && overlaps(item.startMinute, item.endMinute))
    && !blocks.some(item => item.barberId === barberId && (item.allDay || overlaps(toMinute(item.startTime), toMinute(item.endTime))))
    && !appointments.some(item => item.id !== source?.id && item.barberId === barberId && item.status !== "CANCELLED" && overlaps(toMinute(item.time), toMinute(item.endTime)));
  const { ref, isDropTarget } = useDroppable({ id: `slot-${barberId}-${start}`, collisionDetector: pointerIntersection, data: { barberId, minute: start, valid, eligible } });
  return <div ref={ref} aria-hidden className="pointer-events-none absolute inset-x-0 z-20" style={{ top: AGENDA_TOP_GUTTER + (start - gridStart) * AGENDA_PIXELS_PER_MINUTE, height: Math.min(AGENDA_SLOT_MINUTES, gridEnd - start) * AGENDA_PIXELS_PER_MINUTE }}>
    {source && isDropTarget && <div className={`absolute inset-x-1 top-0 rounded-md border border-dashed ${valid ? "border-foreground/15 bg-foreground/[0.01]" : "border-destructive/20 bg-destructive/[0.015]"}`} style={{ height: (end - start) * AGENDA_PIXELS_PER_MINUTE }} />}
  </div>;
}
